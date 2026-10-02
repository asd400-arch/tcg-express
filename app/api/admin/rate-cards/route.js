import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

// Contract rate cards (2 Oct 2026). Admin only.
// GET  → all cards with the customer's name
// POST { client_email | client_id, label?, vehicle?, first_drop_sgd, next_drop_sgd, driver_pool?, payment_terms_days?, notes? }
//      → creates (and deactivates the customer's previous active card)
// POST { id, active: false } → deactivates a card
export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { data, error } = await supabaseAdmin
    .from('customer_rate_cards')
    .select('*, client:client_id(id, company_name, contact_name, email)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
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

  let clientId = body.client_id || null;
  if (!clientId && body.client_email) {
    const { data: u } = await supabaseAdmin.from('express_users').select('id, role').ilike('email', String(body.client_email).trim()).maybeSingle();
    if (!u || u.role !== 'client') return NextResponse.json({ error: 'No customer account with that email' }, { status: 400 });
    clientId = u.id;
  }
  if (!clientId) return NextResponse.json({ error: 'Choose the customer' }, { status: 400 });

  const first = Math.round(parseFloat(body.first_drop_sgd) * 100) / 100;
  const next = Math.round(parseFloat(body.next_drop_sgd) * 100) / 100;
  if (!(first > 0) || !(next > 0)) return NextResponse.json({ error: 'Enter both prices' }, { status: 400 });
  const pool = body.driver_pool === 'open' ? 'open' : 'tcg';

  await supabaseAdmin.from('customer_rate_cards').update({ active: false, updated_at: nowIso }).eq('client_id', clientId).eq('active', true);
  const { data, error } = await supabaseAdmin.from('customer_rate_cards').insert({
    client_id: clientId,
    label: String(body.label || 'Contract rate').slice(0, 80),
    vehicle: String(body.vehicle || 'motorcycle').slice(0, 40),
    first_drop_sgd: first,
    next_drop_sgd: next,
    driver_pool: pool,
    payment_terms_days: Math.max(0, Math.min(90, parseInt(body.payment_terms_days, 10) || 14)),
    notes: body.notes ? String(body.notes).slice(0, 500) : null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
