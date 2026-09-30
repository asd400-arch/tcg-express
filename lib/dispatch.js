// Dispatch helpers (27 Sep 2026)
//  - releaseAssignedDriver(): take a job away from a driver before pickup (no-show etc.)
//  - alertDriversAboutJob(): push + in-app alert to drivers whose vehicle fits
//  - hasRecentNoShow(): drivers with a no-show in the last 30 days can't take jobs instantly
//  - runDispatchSweep(): every few minutes — suggest a boost to customers whose fixed-price job
//    has no driver after 10 min, remind drivers to tap "On my way" 60 min before pickup, and
//    release drivers who still haven't confirmed 10 min after the pickup time.
// Notifications are app-only (push + in-app), never email or WhatsApp.

import { supabaseAdmin } from './supabase-server';
import { notify } from './notify';
import { sendPushToUser } from './web-push';
import { getStripe } from './stripe';
import { getRouteLabel } from './job-helpers';
import { checkVehicleFit } from './fares';
import { isQuoteJob, driverPrice, quoteBounds, isCrossBorder } from './pricing-mode';
import { customerPaidAmount } from './escrow';

export const NO_SHOW_BLOCK_DAYS = 30;
export const CHECKIN_OPENS_MIN = 120;          // "On my way" can be tapped from 2 h before pickup
export const CHECKIN_REMINDER_MIN = 60;        // reminder push 60 min before pickup
export const AUTO_RELEASE_GRACE_MIN = 10;      // not confirmed 10 min after pickup time → released
export const AUTO_RELEASE_HARD_MIN = 45;       // …even if the app is sharing location, after 45 min
export const MIN_HOLD_BEFORE_RELEASE_MIN = 20; // never auto-release within 20 min of acceptance
export const NUDGE_AFTER_MIN = 10;             // no driver 10 min after posting → suggest a boost
export const LOCATION_ACTIVE_MIN = 20;         // live location in the last 20 min = on the way
export const REOPEN_PICKUP_MIN = 60;           // auto-reopened jobs get a pickup 60 min from now

const REASON_TEXT = {
  no_show: 'did not confirm or arrive by the pickup time',
  driver_cancelled: 'said they could not do the job',
  customer: 'the customer changed their plans',
};

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const money = (v) => `S$${r2(v).toFixed(2)}`;

export function sgTime(iso) {
  try {
    return new Date(iso).toLocaleString('en-SG', {
      timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/** Missing-column errors mean the 27 Sep migration hasn't been run yet. */
export function isSchemaMissing(error) {
  const msg = String(error?.message || '');
  return error?.code === '42703' || error?.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(msg);
}

/** Price line used in pushes and notifications. */
export function jobPriceLine(job) {
  if (isQuoteJob(job)) {
    const { min, max } = quoteBounds(job);
    if (min > 0 && max) return `Quotes ${money(min)}–${money(max)}`;
    if (min > 0) return `Quotes from ${money(min)}`;
    if (max) return `Quotes up to ${money(max)}`;
    return 'Send your quote';
  }
  return `${money(driverPrice(job))} fixed`;
}

/** True if the driver has an unreviewed (or not cleared) no-show in the last 30 days. */
export async function hasRecentNoShow(driverId) {
  if (!driverId) return false;
  const since = new Date(Date.now() - NO_SHOW_BLOCK_DAYS * 86400000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('job_review_flags')
    .select('id, decision')
    .eq('driver_id', driverId)
    .gte('created_at', since)
    .filter('reasons', 'cs', JSON.stringify(['driver_no_show']))
    .limit(5);
  if (error) {
    console.error('[dispatch] no-show lookup failed (not blocking):', error.message);
    return false;
  }
  // decision 'ok' = an admin reviewed it and cleared the driver
  return (data || []).some((f) => f.decision !== 'ok');
}

/**
 * Active drivers with the columns dispatch needs. Falls back to the pre-cross-border
 * column set if the 30 Sep migration hasn't been run yet (cross_border_ready → undefined).
 */
export async function listActiveDrivers() {
  let { data, error } = await supabaseAdmin
    .from('express_users')
    .select('id, vehicle_type, cross_border_ready')
    .eq('role', 'driver')
    .eq('is_active', true);
  if (error && isSchemaMissing(error)) {
    ({ data, error } = await supabaseAdmin
      .from('express_users')
      .select('id, vehicle_type')
      .eq('role', 'driver')
      .eq('is_active', true));
  }
  if (error) {
    console.error('[dispatch] driver list failed:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Push + in-app alert to active drivers whose vehicle fits the job.
 * Cross-border (Malaysia) jobs go only to drivers with cross_border_ready = true.
 * @returns {Promise<{pushed:number, inApp:number}>}
 */
export async function alertDriversAboutJob(job, { title, body, inAppTitle, inAppBody, excludeDriverIds = [] }) {
  const exclude = new Set(excludeDriverIds.filter(Boolean));
  const drivers = await listActiveDrivers();
  const needsVehicle = job.vehicle_required && job.vehicle_required !== 'any';
  const crossBorder = isCrossBorder(job);
  const eligible = (drivers || [])
    .filter((d) => !exclude.has(d.id))
    .filter((d) => !crossBorder || d.cross_border_ready === true) // Malaysia runs: verified drivers only
    .filter((d) => !needsVehicle || checkVehicleFit(d.vehicle_type, job.vehicle_required).ok)
    .map((d) => d.id);
  if (eligible.length === 0) return { pushed: 0, inApp: 0 };

  const idSet = new Set(eligible);
  const { data: subs } = await supabaseAdmin.from('express_push_subscriptions').select('user_id');
  const pushIds = [...new Set((subs || []).map((s) => s.user_id))].filter((u) => idSet.has(u));
  await Promise.allSettled(pushIds.map((uid) => sendPushToUser(uid, {
    title,
    body,
    url: '/driver/jobs',
    data: { jobId: job.id, job_id: job.id, type: 'new_job', role: 'driver' },
  })));

  try {
    await supabaseAdmin.from('express_notifications').insert(eligible.map((uid) => ({
      user_id: uid,
      type: 'new_job',
      title: inAppTitle || title,
      body: inAppBody || body,
      reference_id: String(job.id),
      is_read: false,
    })));
  } catch (e) {
    console.error('[dispatch] in-app alert insert failed:', e?.message);
  }
  return { pushed: pushIds.length, inApp: eligible.length };
}

/**
 * Release the assigned driver before pickup.
 * action: 'reopen' (find another driver) | 'cancel'
 * reason: 'no_show' | 'driver_cancelled' | 'customer'
 * actorRole: 'client' | 'admin' | 'system'
 * @returns {Promise<{ok:true, data:object} | {ok:false, status:number, error:string}>}
 */
export async function releaseAssignedDriver({ jobId, action, reason = 'no_show', newPickupIso = null, actorRole = 'client', actorId = null }) {
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('express_jobs')
    .select('*') // whole row: pricing + cross-border fields are needed to re-alert the right drivers
    .eq('id', jobId)
    .single();
  if (jobErr || !job) return { ok: false, status: 404, error: 'Job not found' };
  if (actorRole === 'client' && job.client_id !== actorId) return { ok: false, status: 403, error: 'Forbidden' };
  if (job.status !== 'assigned' || !job.assigned_driver_id) {
    return {
      ok: false,
      status: 409,
      error: 'Only a job whose driver has not picked up yet can be released. After pickup, open a dispute instead.',
    };
  }

  const driverId = job.assigned_driver_id;
  const nowIso = new Date().toISOString();

  // 1) Claim the job first. The status + driver guard makes a concurrent pickup or a double tap harmless.
  const jobUpdate = action === 'cancel'
    ? { status: 'cancelled', cancelled_at: nowIso, cancelled_by: actorRole }
    : {
        status: 'open',
        assigned_driver_id: null,
        assigned_bid_id: null,
        final_amount: null,
        wallet_paid: false,
        ...(newPickupIso ? { pickup_by: newPickupIso } : {}),
      };
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from('express_jobs')
    .update(jobUpdate)
    .eq('id', jobId)
    .eq('status', 'assigned')
    .eq('assigned_driver_id', driverId)
    .select('id, pickup_by')
    .maybeSingle();
  if (claimErr) {
    console.error('[release] job update failed:', claimErr.message);
    return { ok: false, status: 500, error: 'Could not update the job. Please try again.' };
  }
  if (!claimed) {
    return { ok: false, status: 409, error: 'The job just changed (the driver may have picked up). Refresh and check.' };
  }

  // Dispatch columns (27 Sep migration) — best effort, ignored if the migration hasn't run yet.
  // A reopened job counts as already nudged so the customer isn't asked to boost straight away.
  try {
    const { error: dErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ driver_checkin_at: null, checkin_reminded_at: null, ...(action === 'reopen' ? { boost_nudged_at: nowIso } : {}) })
      .eq('id', jobId);
    if (dErr && !isSchemaMissing(dErr)) console.error('[release] dispatch reset failed:', dErr.message);
  } catch { /* non-critical */ }

  // 2) Refund what the customer paid (the voucher part was never theirs to get back).
  let refundAmount = 0;
  let refundNote = null;
  const { data: txn } = await supabaseAdmin
    .from('express_transactions')
    .select('*')
    .eq('job_id', jobId)
    .eq('payment_status', 'held')
    .maybeSingle();

  if (txn) {
    const paid = customerPaidAmount(txn, job);
    let stripeRefundId = null;
    let stripeFailed = false;
    if (txn.stripe_payment_intent_id) {
      const stripe = getStripe();
      if (stripe) {
        try {
          const r = await stripe.refunds.create({ payment_intent: txn.stripe_payment_intent_id });
          stripeRefundId = r.id;
        } catch (e) {
          stripeFailed = true;
          console.error('[release] Stripe refund failed:', e?.message);
        }
      }
    }

    if (stripeFailed) {
      refundNote = 'Card refund failed — our team has been alerted and will refund manually.';
    } else {
      const txnUpdate = { payment_status: 'refunded', refunded_at: nowIso };
      if (stripeRefundId) txnUpdate.stripe_refund_id = stripeRefundId;
      const { data: updatedTxn } = await supabaseAdmin
        .from('express_transactions')
        .update(txnUpdate)
        .eq('id', txn.id)
        .eq('payment_status', 'held')
        .select('id')
        .maybeSingle();

      if (updatedTxn) {
        refundAmount = paid;
        // Wallet payments go back to the wallet; card payments were refunded by Stripe above.
        if (!stripeRefundId && refundAmount > 0) {
          const { data: wallet } = await supabaseAdmin
            .from('wallets').select('id').eq('user_id', job.client_id).single();
          if (wallet) {
            const { error: creditErr } = await supabaseAdmin.rpc('wallet_credit', {
              p_wallet_id: wallet.id,
              p_user_id: job.client_id,
              p_amount: refundAmount,
              p_type: 'refund',
              p_reference_type: 'job',
              p_reference_id: jobId,
              p_description: `Refund — driver released (${reason.replace('_', ' ')}) on job ${job.job_number}`,
            });
            if (creditErr) {
              console.error('[release] wallet_credit failed:', creditErr.message);
              refundNote = 'Refund is being processed — our team has been alerted.';
            }
          } else {
            refundNote = 'Refund is being processed — our team has been alerted.';
          }
        }
      }
    }
  }

  // 3) Reject the released driver's bid so it can't be accepted again (also blocks re-accepting).
  if (job.assigned_bid_id) {
    await supabaseAdmin.from('express_bids').update({ status: 'rejected' }).eq('id', job.assigned_bid_id);
  }

  // 4) Record it for admin review (no-shows count against the driver). Non-critical.
  try {
    await supabaseAdmin.from('job_review_flags').insert([{
      job_id: jobId,
      driver_id: driverId,
      client_id: job.client_id,
      reasons: [reason === 'no_show' ? 'driver_no_show' : reason === 'driver_cancelled' ? 'driver_cancelled' : 'customer_release'],
      bonus_held: false,
      notes: actorRole === 'system'
        ? `Auto-released: no "On my way" confirmation by ${AUTO_RELEASE_GRACE_MIN} min after pickup (${action})`
        : `Driver released by ${actorRole} (${action})${refundNote ? ` — ${refundNote}` : ''}`,
    }]);
  } catch (e) {
    console.error('[release] review flag insert failed:', e?.message);
  }

  // 5) Tell the released driver.
  notify(driverId, {
    type: 'job',
    category: 'job_updates',
    title: `Job ${job.job_number} ${action === 'cancel' ? 'cancelled' : 'reassigned'}`,
    message: `You were removed from this job: ${REASON_TEXT[reason] || REASON_TEXT.no_show}.`,
    referenceId: jobId,
    url: '/driver/my-jobs',
    data: { type: 'job_released', jobId, job_id: jobId, role: 'driver' },
  }).catch((e) => console.error('[release] driver notify failed:', e?.message));

  const pickupIso = claimed.pickup_by || job.pickup_by;

  // 6) Reopen → alert the other drivers again, like a new job.
  if (action === 'reopen') {
    try {
      const reopened = { ...job, pickup_by: pickupIso };
      const route = getRouteLabel(job);
      const res = await alertDriversAboutJob(reopened, {
        title: isCrossBorder(job) ? '🇲🇾 Cross-border job available again' : '🚚 Job available again',
        body: `${job.job_number} | ${jobPriceLine(reopened)} | ${route}${pickupIso ? ` | pickup ${sgTime(pickupIso)}` : ''}`,
        inAppTitle: `Job available again: ${(job.item_description || 'Delivery').substring(0, 50)}`,
        inAppBody: `Job #${job.job_number} is open again (${jobPriceLine(reopened)}).${pickupIso ? ` Pickup ${sgTime(pickupIso)}.` : ''}`,
        excludeDriverIds: [driverId],
      });
      console.log(`[release] reopened ${job.job_number}: pushed ${res.pushed}, in-app ${res.inApp}`);
    } catch (e) {
      console.error('[release] re-alert drivers failed:', e?.message);
    }
  }

  // 7) Admin or automatic release → tell the customer too.
  if (actorRole !== 'client' && job.client_id) {
    const refundLine = refundAmount > 0 ? ` ${money(refundAmount)} was refunded to your wallet.` : '';
    const message = actorRole === 'system'
      ? `Your driver didn't confirm they were on the way, so we released them.${refundLine} ${action === 'reopen'
          ? `Your job is open again${pickupIso ? ` with pickup from ${sgTime(pickupIso)}` : ''} — you can cancel it for free.`
          : 'Your job was cancelled.'}`
      : action === 'reopen'
        ? `Your job is open for drivers again.${refundLine}`
        : `Your job was cancelled.${refundLine}`;
    notify(job.client_id, {
      type: 'job',
      category: 'job_updates',
      title: `Job ${job.job_number}: driver released`,
      message,
      referenceId: jobId,
      url: `/client/jobs/${jobId}`,
      data: { type: 'job', jobId, job_id: jobId, role: 'client' },
    }).catch(() => {});
  }

  return {
    ok: true,
    data: {
      jobId,
      action,
      reason,
      refundAmount,
      refundNote,
      status: action === 'cancel' ? 'cancelled' : 'open',
      pickup_by: pickupIso,
    },
  };
}

// ── Periodic sweep ────────────────────────────────────────────────────────────

let schemaMissingUntil = 0;

/**
 * One pass of the dispatch rules. Safe to run often and from several places at once:
 * every action first "claims" its row with a guarded update.
 */
export async function runDispatchSweep({ now = Date.now() } = {}) {
  const out = { nudged: 0, reminded: 0, released: 0, keptActive: 0, errors: [] };
  if (now < schemaMissingUntil) return { ...out, skipped: 'migration not run' };
  const nowIso = new Date(now).toISOString();
  const noteSchema = (e) => {
    if (isSchemaMissing(e)) schemaMissingUntil = now + 10 * 60000;
  };

  // 1) Fixed-price job with no driver after 10 min → suggest a boost to the customer (once).
  try {
    const cutoff = new Date(now - NUDGE_AFTER_MIN * 60000).toISOString();
    const { data: open, error } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number, status, created_at, pickup_by, budget_min, budget_max, coupon_discount, vehicle_required, equipment_needed, boost_total')
      .in('status', ['open', 'bidding'])
      .is('boost_nudged_at', null)
      .lte('created_at', cutoff)
      .limit(30);
    if (error) throw error;
    for (const job of open || []) {
      if (isQuoteJob(job)) continue;
      const { data: claimed } = await supabaseAdmin
        .from('express_jobs')
        .update({ boost_nudged_at: nowIso })
        .eq('id', job.id)
        .is('boost_nudged_at', null)
        .in('status', ['open', 'bidding'])
        .select('id')
        .maybeSingle();
      if (!claimed) continue;
      await notify(job.client_id, {
        type: 'job',
        category: 'job_updates',
        title: `No driver yet for ${job.job_number}`,
        message: 'Add S$3–S$8 to your price and we\'ll alert drivers again. Or keep waiting — the price stays the same.',
        referenceId: job.id,
        url: `/client/jobs/${job.id}`,
        data: { type: 'job', jobId: job.id, job_id: job.id, role: 'client' },
      }).catch(() => {});
      out.nudged++;
    }
  } catch (e) {
    noteSchema(e);
    out.errors.push(`nudge: ${e?.message || e}`);
  }
  if (now < schemaMissingUntil) return { ...out, skipped: 'migration not run' };

  // 2) Pickup within 60 min and no "On my way" yet → remind the driver (once).
  try {
    const soon = new Date(now + CHECKIN_REMINDER_MIN * 60000).toISOString();
    const { data: due, error } = await supabaseAdmin
      .from('express_jobs')
      .select('id, job_number, assigned_driver_id, pickup_by')
      .eq('status', 'assigned')
      .is('driver_checkin_at', null)
      .is('checkin_reminded_at', null)
      .not('pickup_by', 'is', null)
      .lte('pickup_by', soon)
      .limit(30);
    if (error) throw error;
    for (const job of due || []) {
      const { data: claimed } = await supabaseAdmin
        .from('express_jobs')
        .update({ checkin_reminded_at: nowIso })
        .eq('id', job.id)
        .eq('status', 'assigned')
        .is('checkin_reminded_at', null)
        .select('id')
        .maybeSingle();
      if (!claimed || !job.assigned_driver_id) continue;
      const deadline = new Date(new Date(job.pickup_by).getTime() + AUTO_RELEASE_GRACE_MIN * 60000).toISOString();
      await notify(job.assigned_driver_id, {
        type: 'job',
        category: 'job_updates',
        title: `Pickup ${sgTime(job.pickup_by)} — are you on your way?`,
        message: `Open My Jobs and tap "I'm on my way" for ${job.job_number}. If you don't confirm by ${sgTime(deadline)}, the job goes to another driver.`,
        referenceId: job.id,
        url: '/driver/my-jobs',
        data: { type: 'job', jobId: job.id, job_id: job.id, role: 'driver' },
      }).catch(() => {});
      out.reminded++;
    }
  } catch (e) {
    noteSchema(e);
    out.errors.push(`remind: ${e?.message || e}`);
  }

  // 3) Still not confirmed 10 min after the pickup time → release and reopen.
  try {
    const cutoff = new Date(now - AUTO_RELEASE_GRACE_MIN * 60000).toISOString();
    const { data: late, error } = await supabaseAdmin
      .from('express_jobs')
      .select('id, job_number, assigned_driver_id, pickup_by')
      .eq('status', 'assigned')
      .is('driver_checkin_at', null)
      .not('pickup_by', 'is', null)
      .lte('pickup_by', cutoff)
      .limit(20);
    if (error) throw error;
    for (const job of late || []) {
      // Accepted only minutes ago (e.g. taken after the pickup time) → give the driver time.
      const { data: txn } = await supabaseAdmin
        .from('express_transactions')
        .select('held_at, created_at')
        .eq('job_id', job.id)
        .eq('payment_status', 'held')
        .maybeSingle();
      const heldAt = txn?.held_at || txn?.created_at;
      if (heldAt && new Date(heldAt).getTime() > now - MIN_HOLD_BEFORE_RELEASE_MIN * 60000) continue;

      // Sharing live location from the app counts as on the way — up to 45 min after pickup.
      const minutesLate = (now - new Date(job.pickup_by).getTime()) / 60000;
      if (minutesLate < AUTO_RELEASE_HARD_MIN) {
        const { data: loc } = await supabaseAdmin
          .from('express_driver_locations')
          .select('driver_id, updated_at')
          .eq('job_id', job.id)
          .maybeSingle();
        if (loc && loc.driver_id === job.assigned_driver_id && new Date(loc.updated_at).getTime() > now - LOCATION_ACTIVE_MIN * 60000) {
          out.keptActive++;
          continue;
        }
      }

      const res = await releaseAssignedDriver({
        jobId: job.id,
        action: 'reopen',
        reason: 'no_show',
        newPickupIso: new Date(now + REOPEN_PICKUP_MIN * 60000).toISOString(),
        actorRole: 'system',
      });
      if (res.ok) out.released++;
      else if (res.status !== 409) out.errors.push(`release ${job.job_number}: ${res.error}`);
    }
  } catch (e) {
    noteSchema(e);
    out.errors.push(`release: ${e?.message || e}`);
  }

  if (out.nudged || out.reminded || out.released || out.errors.length) {
    console.log('[dispatch] sweep', JSON.stringify(out));
  }
  return out;
}

let lastSweepAt = 0;
let sweeping = false;

/** Throttled sweep for busy GET routes (run it via next/server `after()`), at most once a minute per instance. */
export async function maybeRunDispatchSweep(minIntervalMs = 60000) {
  const t = Date.now();
  if (sweeping || t - lastSweepAt < minIntervalMs) return null;
  sweeping = true;
  lastSweepAt = t;
  try {
    return await runDispatchSweep({ now: t });
  } catch (e) {
    console.error('[dispatch] sweep failed:', e?.message);
    return null;
  } finally {
    sweeping = false;
  }
}
