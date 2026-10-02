import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

// GET /api/admin/invoices?month=YYYY-MM[&client_id=…] — monthly invoice lines for contract customers (2 Oct 2026).
// Completed invoice-billed jobs, grouped by customer, with every line for the printable invoice.
export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.get('month') || '') ? sp.get('month') : new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);
  const [y, mo] = month.split('-').map(Number);
  // Singapore month boundaries (UTC+8)
  const from = new Date(Date.UTC(y, mo - 1, 1) - 8 * 3600000).toISOString();
  const to = new Date(Date.UTC(y, mo, 1) - 8 * 3600000).toISOString();

  let q = supabaseAdmin
    .from('express_jobs')
    .select('id, job_number, client_id, completed_at, pickup_address, delivery_address, delivery_contact, final_amount, budget_min, trip_seq, consolidation_group_id, status')
    .eq('billing_mode', 'invoice')
    .gte('completed_at', from)
    .lt('completed_at', to)
    .order('completed_at', { ascending: true });
  if (sp.get('client_id')) q = q.eq('client_id', sp.get('client_id'));
  const { data: jobs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clientIds = [...new Set((jobs || []).map((j) => j.client_id))];
  let clients = [];
  if (clientIds.length) {
    const { data } = await supabaseAdmin.from('express_users').select('id, company_name, contact_name, email, phone, billing_address, business_reg_number').in('id', clientIds);
    clients = data || [];
  }
  const { data: cards } = clientIds.length
    ? await supabaseAdmin.from('customer_rate_cards').select('client_id, payment_terms_days, active').in('client_id', clientIds)
    : { data: [] };

  const invoices = clients.map((c) => {
    const lines = (jobs || []).filter((j) => j.client_id === c.id).map((j) => ({
      job_number: j.job_number,
      date: j.completed_at,
      to: j.delivery_address,
      contact: j.delivery_contact,
      amount: Math.round(Number(j.final_amount ?? j.budget_min ?? 0) * 100) / 100,
    }));
    const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
    const terms = (cards || []).find((k) => k.client_id === c.id && k.active)?.payment_terms_days ?? 14;
    return { client: c, month, lines, drops: lines.length, total, payment_terms_days: terms };
  }).sort((a, b) => b.total - a.total);

  return NextResponse.json({ data: { month, invoices } });
}
