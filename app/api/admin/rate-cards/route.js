import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { makeJoinCode } from '../../../../lib/contract';

// Contract rate cards (2 Oct 2026; company codes + weekly invoices 5 Oct 2026). Admin only.
// GET  → all cards with the owner account, the linked staff accounts and the company code
// POST { company_name?, client_email? | client_id?, label?, vehicle?, first_drop_sgd, next_drop_sgd,
//        driver_pool?, billing? ('weekly' | 'monthly'), payment_terms_days?, notes? }
//      → creates a card with a company code; staff join with the code (POST /api/contract/join).
//        With a customer email, that account is linked straight away (and its previous own card turned off).
// POST { id, active: false } → deactivates a card
export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from('customer_rate_cards')
    .select('*, client:client_id(id, company_name, contact_name, email)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Staff linked by company code (column from the 5 Oct migration; skipped if missing)
  const ids = (data || []).map((c) => c.id);
  let members = [];
  if (ids.length) {
    const { data: m, error: mErr } = await supabaseAdmin
      .from('express_users')
      .select('id, contact_name, company_name, email, contract_card_id')
      .in('contract_card_id', ids);
    if (!mErr) members = m || [];
  }
  const cards = (data || []).map((c) => ({ ...c, members: members.filter((u) => u.contract_card_id === c.id) }));
  return NextResponse.json({ data: cards });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const nowIso = new Date().toISOString();

  if (body.id && body.active === false) {
    const { error } = await supabaseAdmin.from('customer_rate_cards').update({ active: false, updated_at: nowIso }).eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  let client = null;
  if (body.client_id || body.client_email) {
    const q = supabaseAdmin.from('express_users').select('id, role, company_name, contact_name');
    const { data: u } = body.client_id
      ? await q.eq('id', body.client_id).maybeSingle()
      : await q.ilike('email', String(body.client_email).trim()).maybeSingle();
    if (!u || u.role !== 'client') return NextResponse.json({ error: 'No customer account with that email' }, { status: 400 });
    client = u;
  }
  const companyName = String(body.company_name || client?.company_name || '').trim().slice(0, 120);
  if (!client && !companyName) return NextResponse.json({ error: 'Enter the company name (or a customer login email)' }, { status: 400 });

  const first = Math.round(parseFloat(body.first_drop_sgd) * 100) / 100;
  const next = Math.round(parseFloat(body.next_drop_sgd) * 100) / 100;
  if (!(first > 0) || !(next > 0)) return NextResponse.json({ error: 'Enter both prices' }, { status: 400 });
  const pool = body.driver_pool === 'open' ? 'open' : 'tcg';
  const weekly = body.billing === 'weekly' || body.billing === 'weekly_invoice';
  const terms = Math.max(0, Math.min(90, parseInt(body.payment_terms_days, 10) || (weekly ? 7 : 14)));

  if (client) {
    await supabaseAdmin.from('customer_rate_cards').update({ active: false, updated_at: nowIso }).eq('client_id', client.id).eq('active', true);
  }

  // Unique company code — retry on the rare clash
  let data = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5 && !data; attempt++) {
    const { data: row, error } = await supabaseAdmin.from('customer_rate_cards').insert({
      client_id: client ? client.id : null,
      company_name: companyName || null,
      join_code: makeJoinCode(companyName || client?.contact_name),
      label: String(body.label || 'Contract rate').slice(0, 80),
      vehicle: String(body.vehicle || 'motorcycle').slice(0, 40),
      first_drop_sgd: first,
      next_drop_sgd: next,
      driver_pool: pool,
      billing: weekly ? 'weekly_invoice' : 'monthly_invoice',
      payment_terms_days: terms,
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
    }).select().single();
    if (!error) data = row;
    else {
      lastError = error;
      if (error.code !== '23505') break; // not a duplicate code
    }
  }
  if (!data) {
    const msg = lastError?.message || 'Could not save';
    if (/company_name|join_code|billing_check|null value in column "client_id"/i.test(msg)) {
      return NextResponse.json({ error: 'Run sql/2026-10-05-company-code-weekly.sql in Supabase first.' }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (client) {
    await supabaseAdmin.from('express_users').update({ contract_card_id: data.id, updated_at: nowIso }).eq('id', client.id);
  }
  return NextResponse.json({ data });
}
