// Who may see and take a job (2 Oct 2026).
//
// A customer chooses, per job:
//   'open' — any approved on-call driver (the marketplace, default)
//   'tcg'  — TCG Express fleet drivers only (admin-flagged express_users.tcg_fleet)
//   a driver code — that one driver only (express_jobs.target_driver_id, pool 'direct')
//
// Columns (sql/2026-10-02-driver-pool.sql): express_jobs.driver_pool, express_jobs.target_driver_id,
// express_users.tcg_fleet, express_users.driver_code. Until the SQL runs, every job behaves as 'open'
// and posting a 'tcg' / direct job returns a clear 503.

import { supabaseAdmin } from './supabase-server';
import { normaliseDriverCode, jobPool } from './driver-pool-rules';

export { DRIVER_POOLS, POOL_LABELS, jobPool, driverCanTakeJob, poolBlockMessage, normaliseDriverCode, driverShortName } from './driver-pool-rules';

function schemaMissing(error) {
  const msg = String(error?.message || '');
  return error?.code === '42703' || error?.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(msg);
}

/** Pool fields of one driver (id, tcg_fleet, driver_code), with a fallback before the migration. */
export async function loadDriverPoolProfile(driverId) {
  if (!driverId) return null;
  const { data, error } = await supabaseAdmin
    .from('express_users')
    .select('id, tcg_fleet, driver_code')
    .eq('id', driverId)
    .maybeSingle();
  if (error) {
    if (!schemaMissing(error)) console.error('[driver-pool] profile lookup failed:', error.message);
    return { id: driverId, tcg_fleet: false, driver_code: null };
  }
  return data || { id: driverId, tcg_fleet: false, driver_code: null };
}

/**
 * Resolve a code typed by a customer to an approved, active driver.
 * @returns {Promise<{driver?: object, error?: string, status?: number}>}
 */
export async function resolveDriverCode(raw) {
  const code = normaliseDriverCode(raw);
  if (!code) return { error: 'Enter the driver code.', status: 400 };
  const { data, error } = await supabaseAdmin
    .from('express_users')
    .select('id, contact_name, vehicle_type, driver_status, is_active, role, driver_code')
    .eq('driver_code', code)
    .maybeSingle();
  if (error) {
    if (schemaMissing(error)) return { error: 'Booking a specific driver is being switched on — please try again shortly.', status: 503 };
    return { error: 'Could not check the driver code. Please try again.', status: 500 };
  }
  if (!data || data.role !== 'driver') return { error: `No driver found with code ${code}.`, status: 400 };
  if (data.driver_status !== 'approved' || data.is_active === false) {
    return { error: `Driver ${code} can't take jobs right now. Choose another option.`, status: 400 };
  }
  return { driver: data };
}


// ── Salaried TCG fleet drivers (2 Oct 2026) ──────────────────────────────────────────────
// Fleet drivers are paid a monthly salary for FLEET work: jobs booked for the TCG fleet ('tcg') or
// booked to them by code ('direct'). Those are settled to TCG (driver payout 0, the whole fare is
// TCG revenue), and per-job bonuses / launch top-ups don't apply. When idle they may also take open
// marketplace jobs — those are paid per job as usual, as their incentive (Scott, 2 Oct 2026).
// Fleet work stays countable for payroll: express_jobs.payout_mode = 'salary'.

/** True when this driver is a salaried TCG fleet driver. */
export async function isSalariedDriver(driverId) {
  if (!driverId) return false;
  const p = await loadDriverPoolProfile(driverId);
  return p?.tcg_fleet === true;
}

/** Salary job = done by a fleet driver AND booked for the fleet or for that driver. */
export async function isSalaryJob(job, driverId) {
  if (!job || !driverId) return false;
  if (jobPool(job) === 'open') return false;
  return isSalariedDriver(driverId);
}

/**
 * Settle a completed job done by a salaried fleet driver: the held escrow becomes TCG revenue.
 * Idempotent: does nothing if the escrow is no longer 'held'.
 * @returns {Promise<{settled:boolean, total?:number}>}
 */
export async function settleSalaryJob(jobId, driverId, fallbackTotal = 0) {
  const nowIso = new Date().toISOString();
  const { data: txn, error: tErr } = await supabaseAdmin
    .from('express_transactions')
    .select('id, total_amount')
    .eq('job_id', jobId)
    .eq('payment_status', 'held')
    .maybeSingle();
  if (tErr) {
    console.error('[salary] escrow lookup failed:', tErr.message);
    return { settled: false };
  }
  // Invoice-billed (contract) jobs have no escrow: the fare is the job price
  const total = Number(txn?.total_amount ?? fallbackTotal ?? 0);
  if (txn) {
    const { data: done, error: uErr } = await supabaseAdmin
      .from('express_transactions')
      .update({ payment_status: 'paid', released_at: nowIso, paid_at: nowIso, driver_payout: 0, commission_amount: total })
      .eq('id', txn.id)
      .eq('payment_status', 'held')
      .select('id')
      .maybeSingle();
    if (uErr || !done) {
      if (uErr) console.error('[salary] escrow settle failed:', uErr.message);
      return { settled: false };
    }
    try {
      await supabaseAdmin.from('payments').update({ settled_at: nowIso }).eq('job_id', jobId);
    } catch { /* optional table */ }
  }
  // Mark the job for payroll counting (columns from the 2 Oct migration; ignored if missing)
  try {
    const { error: jErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ payout_mode: 'salary', driver_payout: 0, commission_amount: total })
      .eq('id', jobId);
    if (jErr && !schemaMissing(jErr)) console.error('[salary] job mark failed:', jErr.message);
  } catch { /* non-critical */ }
  console.log(`[salary] job ${jobId} settled to TCG (driver ${driverId}, S$${total.toFixed(2)})`);
  return { settled: true, escrow: Boolean(txn), total };
}
