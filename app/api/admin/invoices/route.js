import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

const SGT = 8 * 3600000;
const DAY = 86400000;

// GET /api/admin/invoices?month=YYYY-MM  or  ?week=YYYY-MM-DD (any day in the week, Mon–Sun SGT)
// Contract (invoice-billed) deliveries completed in the period, one invoice per company contract
// (2 Oct 2026; per-company grouping + weekly periods 5 Oct 2026). Staff who joined with the company
// code share one invoice; each line shows who ordered it.
export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const sp = new URL(request.url).searchParams;

  let kind = 'month';
  let fromMs;
  let toMs;
  let label;
  const weekParam = sp.get('week');
  if (/^\d{4}-\d{2}-\d{2}$/.test(weekParam || '')) {
    kind = 'week';
    const [y, mo, d] = weekParam.split('-').map(Number);
    const day = new Date(Date.UTC(y, mo - 1, d));
    const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY); // SGT calendar date of Monday
    fromMs = monday.getTime() - SGT;
    toMs = fromMs + 7 * DAY;
    label = monday.toISOString().slice(0, 10);
  } else {
    const month = /^\d{4}-\d{2}$/.test(sp.get('month') || '') ? sp.get('month') : new Date(Date.now() + SGT).toISOString().slice(0, 7);
    const [y, mo] = month.split('-').map(Number);
    fromMs = Date.UTC(y, mo - 1, 1) - SGT;
    toMs = Date.UTC(y, mo, 1) - SGT;
    label = month;
  }
  const from = new Date(fromMs).toISOString();
  const to = new Date(toMs).toISOString();

  const { data: jobs, error } = await supabaseAdmin
    .from('express_jobs')
    .select('id, job_number, client_id, rate_card_id, completed_at, delivery_address, delivery_contact, final_amount, budget_min')
    .eq('billing_mode', 'invoice')
    .gte('completed_at', from)
    .lt('completed_at', to)
    .order('completed_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cardIds = [...new Set((jobs || []).map((j) => j.rate_card_id).filter(Boolean))];
  let cards = [];
  if (cardIds.length) {
    const { data } = await supabaseAdmin.from('customer_rate_cards').select('*').in('id', cardIds);
    cards = data || [];
  }
  const userIds = [...new Set([...(jobs || []).map((j) => j.client_id), ...cards.map((c) => c.client_id).filter(Boolean)])];
  let users = [];
  if (userIds.length) {
    const { data } = await supabaseAdmin.from('express_users').select('id, company_name, contact_name, email, phone, billing_address, business_reg_number').in('id', userIds);
    users = data || [];
  }
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  // One invoice per contract; jobs without a card (older data) fall back to one per customer
  const groups = new Map();
  for (const j of jobs || []) {
    const key = j.rate_card_id || `client:${j.client_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(j);
  }

  const invoices = [...groups.entries()].map(([key, list]) => {
    const card = cards.find((c) => c.id === key) || null;
    const owner = card?.client_id ? userById[card.client_id] : null;
    const firstOrderer = userById[list[0].client_id] || null;
    const billTo = owner || firstOrderer || {};
    const lines = list.map((j) => ({
      job_number: j.job_number,
      date: j.completed_at,
      to: j.delivery_address,
      contact: j.delivery_contact,
      ordered_by: userById[j.client_id]?.contact_name || '',
      amount: Math.round(Number(j.final_amount ?? j.budget_min ?? 0) * 100) / 100,
    }));
    const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    return {
      key,
      card_id: card?.id || null,
      company: {
        name: card?.company_name || billTo.company_name || billTo.contact_name || 'Customer',
        uen: billTo.business_reg_number || null,
        address: billTo.billing_address || null,
        email: billTo.email || null,
      },
      billing: card?.billing === 'weekly_invoice' ? 'weekly' : 'monthly',
      period: { kind, from, to, label },
      lines,
      drops: lines.length,
      total,
      payment_terms_days: card?.payment_terms_days ?? 14,
    };
  }).sort((a, b) => b.total - a.total);

  return NextResponse.json({ data: { period: { kind, from, to, label }, invoices } });
}
