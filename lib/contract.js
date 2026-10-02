// Contract customers: fixed rate card + monthly invoice (2 Oct 2026).
//
// A rate card (customer_rate_cards) gives a customer a fixed price per drop: first drop of a trip
// at first_drop_sgd, each additional drop on the same trip at next_drop_sgd (e.g. S$8 / S$7.50).
// Contract orders are posted as a trip (one pickup, several drops) and billed on a monthly invoice:
// nothing is taken from the customer's wallet.
//
// Who drives: the card's driver_pool (usually the TCG fleet). A fleet driver doing fleet work is on
// salary (lib/driver-pool.js). If an on-call driver does an invoice-billed job, TCG pays that driver
// per job from its own funds at completion (payInvoiceJobDriver).

import { supabaseAdmin } from './supabase-server';
import { getCommissionRate } from './zero-commission';

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

function schemaMissing(error) {
  const msg = String(error?.message || '');
  return error?.code === '42703' || error?.code === '42P01' || error?.code === 'PGRST204' || error?.code === 'PGRST205'
    || /column .* does not exist|relation .* does not exist|Could not find the .* (column|table)/i.test(msg);
}

/** Active rate card for a customer, or null (also null before the migration). */
export async function loadRateCard(clientId) {
  if (!clientId) return null;
  const { data, error } = await supabaseAdmin
    .from('customer_rate_cards')
    .select('*')
    .eq('client_id', clientId)
    .eq('active', true)
    .maybeSingle();
  if (error) {
    if (!schemaMissing(error)) console.error('[contract] rate card lookup failed:', error.message);
    return null;
  }
  return data || null;
}

/** Price of drop n (1-based) on a trip. */
export function dropPrice(card, n) {
  return r2(n <= 1 ? card.first_drop_sgd : card.next_drop_sgd);
}

export function isInvoiceJob(job) {
  return job?.billing_mode === 'invoice';
}

/**
 * A driver accepts an invoice-billed job: no wallet debit, no escrow. The whole trip (every open
 * drop with the same consolidation_group_id) goes to this driver in one go.
 * @returns {Promise<{ok:true, jobs:object[]} | {ok:false, status:number, error:string}>}
 */
export async function assignInvoiceTrip(job, driverId) {
  const nowIso = new Date().toISOString();
  const ids = [job.id];
  if (job.consolidation_group_id) {
    const { data: siblings } = await supabaseAdmin
      .from('express_jobs')
      .select('id')
      .eq('consolidation_group_id', job.consolidation_group_id)
      .in('status', ['open', 'bidding'])
      .neq('id', job.id);
    for (const s of siblings || []) ids.push(s.id);
  }

  // Claim the tapped job first — the status guard makes a double tap or a race harmless
  const { data: first, error: e1 } = await supabaseAdmin
    .from('express_jobs')
    .update({ status: 'assigned', assigned_driver_id: driverId, final_amount: r2(job.budget_min), wallet_paid: false, updated_at: nowIso })
    .eq('id', job.id)
    .in('status', ['open', 'bidding'])
    .select('*')
    .maybeSingle();
  if (e1) return { ok: false, status: 500, error: 'Could not accept the job. Please try again.' };
  if (!first) return { ok: false, status: 409, error: 'This job is no longer available' };

  const claimed = [first];
  for (const id of ids.slice(1)) {
    const { data: row } = await supabaseAdmin
      .from('express_jobs')
      .select('budget_min')
      .eq('id', id)
      .maybeSingle();
    const { data: got } = await supabaseAdmin
      .from('express_jobs')
      .update({ status: 'assigned', assigned_driver_id: driverId, final_amount: r2(row?.budget_min), wallet_paid: false, updated_at: nowIso })
      .eq('id', id)
      .in('status', ['open', 'bidding'])
      .select('*')
      .maybeSingle();
    if (got) claimed.push(got);
  }
  return { ok: true, jobs: claimed.sort((a, b) => (a.trip_seq || 0) - (b.trip_seq || 0)) };
}

/**
 * An on-call (non-salary) driver completed an invoice-billed job: TCG pays them per job now and
 * collects from the customer on the monthly invoice. Idempotent per job.
 */
export async function payInvoiceJobDriver(job, driverId) {
  const price = r2(job.final_amount ?? job.budget_min);
  if (!(price > 0) || !driverId) return { paid: false };

  const { data: already } = await supabaseAdmin
    .from('wallet_transactions')
    .select('id')
    .eq('user_id', driverId)
    .eq('reference_type', 'job_payment')
    .eq('reference_id', job.id)
    .limit(1);
  if (already && already.length) return { paid: false, already: true };

  let rate = 15;
  try {
    const { data: settings } = await supabaseAdmin.from('express_settings').select('value').eq('key', 'commission_rate').single();
    if (settings?.value) rate = parseFloat(settings.value);
  } catch { /* default */ }
  rate = await getCommissionRate(supabaseAdmin, driverId, rate);
  const commission = r2(price * rate / 100);
  const payout = r2(price - commission);

  let { data: wallet } = await supabaseAdmin.from('wallets').select('id').eq('user_id', driverId).maybeSingle();
  if (!wallet) {
    const { data: nw } = await supabaseAdmin.from('wallets').insert([{ user_id: driverId, balance: 0 }]).select('id').single();
    wallet = nw;
  }
  if (!wallet) return { paid: false };

  const { error } = await supabaseAdmin.rpc('wallet_credit', {
    p_wallet_id: wallet.id,
    p_user_id: driverId,
    p_amount: payout,
    p_type: 'earning',
    p_description: `Delivery earning for job ${job.job_number || job.id} (contract, invoiced)`,
    p_reference_type: 'job_payment',
    p_reference_id: job.id,
    p_payment_method: 'system',
    p_payment_provider_ref: null,
    p_metadata: { billing: 'invoice', price, commission, rate },
  });
  if (error) {
    console.error('[contract] driver payout failed:', error.message);
    return { paid: false };
  }
  await supabaseAdmin.from('express_jobs').update({ driver_payout: payout, commission_amount: commission }).eq('id', job.id);
  return { paid: true, payout, commission };
}
