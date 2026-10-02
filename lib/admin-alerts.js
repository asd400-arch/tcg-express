// Admin alerts (1 Oct 2026) — the human safety net while the driver pool is small.
//
// Every job that goes live, every job still without a driver after UNACCEPTED_ALERT_MIN minutes,
// and every release/cancellation reaches the admins immediately, so someone can phone a driver
// before the customer gives up (the first organic job, TCG-2026-00010, died in 35 minutes).
//
// Who gets them: active users with role 'admin' (in-app + push through their app subscriptions)
// and the addresses in ADMIN_ALERT_EMAILS (default admin@techchainglobal.com). Add Scott's app
// login email to ADMIN_ALERT_EMAILS and his phone gets the push too.
// These are internal ops alerts, so they bypass the NOTIFICATION_EMAILS switch that keeps
// customer/driver email off. Nothing here ever throws into a request.

import { supabaseAdmin } from './supabase-server';
import { createNotification } from './notifications';
import { sendPushToUser } from './web-push';
import { sendEmail } from './email';
import { checkVehicleFit } from './fares';
import { getRouteLabel, getVehicleLabel, getAreaName } from './job-helpers';
import { isQuoteJob, isCrossBorder, driverPrice, customerPrice, quoteBounds } from './pricing-mode';
import { driverCanTakeJob, jobPool } from './driver-pool';

export const UNACCEPTED_ALERT_MIN = 5;   // no driver 5 min after posting → alert the admins
export const UNACCEPTED_ALERT_HORIZON_H = 6; // …but only once pickup is within 6 hours (scheduled jobs wait)
export const ADMIN_ALERT_EMAILS = String(process.env.ADMIN_ALERT_EMAILS || 'admin@techchainglobal.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.techchainglobal.com').replace(/\/$/, '');

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const money = (v) => `S$${r2(v).toFixed(2)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function sgTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function minutesSince(iso, now = Date.now()) {
  const t = new Date(iso || 0).getTime();
  return t ? Math.max(0, Math.round((now - t) / 60000)) : 0;
}

function priceLine(job) {
  if (isQuoteJob(job)) {
    const { min, max } = quoteBounds(job);
    if (min > 0 && max) return `quotes ${money(min)}–${money(max)}`;
    if (max) return `quotes up to ${money(max)}`;
    return 'quote job';
  }
  const d = driverPrice(job);
  const c = customerPrice(job);
  return c !== d ? `${money(d)} fixed (customer pays ${money(c)})` : `${money(d)} fixed`;
}

function vehicleText(job) {
  // getVehicleLabel returns "🚗 Car" — drop the icon for email subjects and push titles
  const label = getVehicleLabel(job?.vehicle_required) || job?.vehicle_required || 'any vehicle';
  return String(label).replace(/^[^A-Za-z0-9]+/, '').trim() || 'any vehicle';
}

/** One-line description used in titles: "TCG-2026-00010 · Car · S$11.00 fixed · pickup 1 Oct, 5:05 pm · Rochor → West Coast". */
export function describeJob(job) {
  const route = (() => {
    try { return getRouteLabel(job); } catch { return `${getAreaName(job?.pickup_address)} → ${getAreaName(job?.delivery_address)}`; }
  })();
  const pool = jobPool(job);
  const poolText = pool === 'direct' ? ' · BOOKED DRIVER ONLY' : pool === 'tcg' ? ' · TCG FLEET ONLY' : '';
  return `${job.job_number || job.id} · ${vehicleText(job)} · ${priceLine(job)} · pickup ${sgTime(job.pickup_by)} · ${route}${poolText}`;
}

async function adminRecipients() {
  const seen = new Set();
  const out = [];
  try {
    const { data } = await supabaseAdmin
      .from('express_users')
      .select('id, email, role, is_active')
      .or(`role.eq.admin,email.in.(${ADMIN_ALERT_EMAILS.map((e) => `"${e}"`).join(',')})`);
    for (const u of data || []) {
      if (u.is_active === false || seen.has(u.id)) continue;
      seen.add(u.id);
      out.push(u);
    }
  } catch (e) {
    console.error('[admin-alerts] recipient lookup failed:', e?.message);
  }
  return out;
}

async function clientLine(clientId) {
  if (!clientId) return 'customer unknown';
  try {
    const { data: u } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, company_name, phone, email')
      .eq('id', clientId)
      .maybeSingle();
    if (!u) return 'customer unknown';
    return [u.company_name || u.contact_name, u.contact_name && u.company_name ? u.contact_name : null, u.phone, u.email].filter(Boolean).join(' · ');
  } catch {
    return 'customer unknown';
  }
}

/**
 * Drivers an admin can phone for this job: approved, active, vehicle fits, cross-border verified when needed.
 * Drivers who can receive a push come first, then the most recently active.
 */
export async function driverCallList(job, limit = 8) {
  try {
    let { data: drivers, error: dErr } = await supabaseAdmin
      .from('express_users')
      .select('id, contact_name, vehicle_type, phone, updated_at, cross_border_ready, tcg_fleet')
      .eq('role', 'driver')
      .eq('driver_status', 'approved')
      .eq('is_active', true);
    if (dErr) {
      ({ data: drivers } = await supabaseAdmin
        .from('express_users')
        .select('id, contact_name, vehicle_type, phone, updated_at, cross_border_ready')
        .eq('role', 'driver')
        .eq('driver_status', 'approved')
        .eq('is_active', true));
    }
    const crossBorder = isCrossBorder(job);
    const needsVehicle = job.vehicle_required && job.vehicle_required !== 'any';
    const fit = (drivers || [])
      .filter((d) => !crossBorder || d.cross_border_ready === true)
      .filter((d) => driverCanTakeJob(job, d))
      .filter((d) => !needsVehicle || checkVehicleFit(d.vehicle_type, job.vehicle_required).ok);
    const ids = fit.map((d) => d.id);
    let pushIds = new Set();
    if (ids.length) {
      const { data: subs } = await supabaseAdmin.from('express_push_subscriptions').select('user_id').in('user_id', ids);
      pushIds = new Set((subs || []).map((s) => s.user_id));
    }
    return fit
      .map((d) => ({ name: d.contact_name || 'Driver', vehicle: d.vehicle_type || '—', phone: d.phone || '—', push: pushIds.has(d.id), updated_at: d.updated_at }))
      .sort((a, b) => (b.push - a.push) || (new Date(b.updated_at || 0) - new Date(a.updated_at || 0)))
      .slice(0, limit);
  } catch (e) {
    console.error('[admin-alerts] driver call list failed:', e?.message);
    return [];
  }
}

function callListHtml(list) {
  if (!list.length) return '<p><em>No approved driver with a fitting vehicle.</em></p>';
  return `<table cellpadding="4" style="border-collapse:collapse;font-size:14px"><tr><th align="left">Driver</th><th align="left">Vehicle</th><th align="left">Phone</th><th align="left">Push</th></tr>${list
    .map((d) => `<tr><td>${esc(d.name)}</td><td>${esc(d.vehicle)}</td><td><a href="tel:${esc(String(d.phone).replace(/\s/g, ''))}">${esc(d.phone)}</a></td><td>${d.push ? 'yes' : 'no app'}</td></tr>`)
    .join('')}</table>`;
}

/**
 * Fan an alert out to the admins: in-app + push for admin users, email to ADMIN_ALERT_EMAILS.
 * @param {{type:string, title:string, message:string, html?:string, referenceId?:string, url?:string}} a
 */
export async function alertAdmins({ type, title, message, html, referenceId, url }) {
  const out = { users: 0, emailed: false };
  try {
    const users = await adminRecipients();
    await Promise.allSettled(users.map(async (u) => {
      await createNotification(u.id, type || 'admin_alert', title, message, referenceId);
      await sendPushToUser(u.id, {
        title,
        body: message,
        url: url || '/admin/jobs',
        data: { type: type || 'admin_alert', jobId: referenceId || null, job_id: referenceId || null, role: 'admin' },
      }).catch(() => {});
    }));
    out.users = users.length;
  } catch (e) {
    console.error('[admin-alerts] user fan-out failed:', e?.message);
  }
  try {
    if (ADMIN_ALERT_EMAILS.length) {
      const link = `${APP_URL}${url || '/admin/jobs'}`;
      await sendEmail(
        ADMIN_ALERT_EMAILS,
        `[TCG] ${title}`,
        `${html || `<p>${esc(message)}</p>`}<p style="margin-top:16px"><a href="${esc(link)}">${esc(link)}</a></p><p style="color:#64748b;font-size:12px">TCG Express admin alert · ${esc(sgTime(new Date().toISOString()))} SGT</p>`,
      );
      out.emailed = true;
    }
  } catch (e) {
    console.error('[admin-alerts] email failed:', e?.message);
  }
  console.log(`[admin-alerts] ${type}: ${title} → users ${out.users}, email ${out.emailed}`);
  return out;
}

/** A job just went live. */
export async function alertNewJob(job, { pushed = 0, inApp = 0 } = {}) {
  try {
    const desc = describeJob(job);
    const customer = await clientLine(job.client_id);
    const list = await driverCallList(job, 6);
    const title = `New job ${job.job_number}: ${vehicleText(job)}, ${priceLine(job)}, pickup ${sgTime(job.pickup_by)}`;
    const message = `${desc}. Alerted ${pushed} driver push(es), ${inApp} in-app. Customer: ${customer}`;
    const html = `<h3 style="margin:0 0 8px">New job ${esc(job.job_number)}</h3><p>${esc(desc)}</p>
<p><b>Customer:</b> ${esc(customer)}<br><b>Item:</b> ${esc((job.item_description || '').slice(0, 120))}<br><b>Alerted:</b> ${pushed} driver push(es), ${inApp} in-app</p>
<p>If nobody accepts within ${UNACCEPTED_ALERT_MIN} minutes you get a second alert with this call list:</p>${callListHtml(list)}`;
    return await alertAdmins({ type: 'admin_new_job', title, message, html, referenceId: job.id, url: '/admin/jobs' });
  } catch (e) {
    console.error('[admin-alerts] alertNewJob failed:', e?.message);
    return null;
  }
}

/** Still no driver after N minutes → the call list. */
export async function alertUnacceptedJob(job, minutes = UNACCEPTED_ALERT_MIN) {
  try {
    const desc = describeJob(job);
    const customer = await clientLine(job.client_id);
    const list = await driverCallList(job, 10);
    const quote = isQuoteJob(job);
    const title = `${quote ? 'No quote' : 'No driver'} after ${minutes} min: ${job.job_number} (${vehicleText(job)}, ${priceLine(job)}, pickup ${sgTime(job.pickup_by)})`;
    const message = `${desc}. Call a driver now: ${list.slice(0, 3).map((d) => `${d.name} ${d.phone}`).join(', ') || 'no fitting driver'}. Customer: ${customer}`;
    const html = `<h3 style="margin:0 0 8px;color:#b91c1c">${quote ? 'No quote' : 'No driver'} after ${minutes} minutes</h3><p>${esc(desc)}</p>
<p><b>Customer:</b> ${esc(customer)}<br><b>Item:</b> ${esc((job.item_description || '').slice(0, 120))}</p>
<p><b>Phone one of these drivers</b> (push = has the app and got the alert):</p>${callListHtml(list)}
<p>Then assign them from the admin jobs page, or ask them to tap Accept in the app.</p>`;
    return await alertAdmins({ type: 'admin_unaccepted', title, message, html, referenceId: job.id, url: '/admin/jobs' });
  } catch (e) {
    console.error('[admin-alerts] alertUnacceptedJob failed:', e?.message);
    return null;
  }
}

/** Customer cancelled a job that never got a driver (the TCG-2026-00010 case) — worth a phone call. */
export async function alertOpenJobCancelled(job, { by = 'client' } = {}) {
  try {
    const desc = describeJob(job);
    const customer = await clientLine(job.client_id);
    const waited = minutesSince(job.created_at);
    const title = `Cancelled by ${by} after ${waited} min without a driver: ${job.job_number}`;
    const message = `${desc}. Customer: ${customer}. Worth a call.`;
    const html = `<h3 style="margin:0 0 8px;color:#b91c1c">Open job cancelled by ${esc(by)} after ${waited} min without a driver</h3><p>${esc(desc)}</p><p><b>Customer:</b> ${esc(customer)}<br><b>Item:</b> ${esc((job.item_description || '').slice(0, 120))}</p><p>Call them: apologise, offer to run it at a time they choose with a driver you pre-arrange.</p>`;
    return await alertAdmins({ type: 'admin_job_cancelled', title, message, html, referenceId: job.id, url: '/admin/jobs' });
  } catch (e) {
    console.error('[admin-alerts] alertOpenJobCancelled failed:', e?.message);
    return null;
  }
}

/** A driver was released (no-show, driver cancelled, customer) — reopened or cancelled. */
export async function alertDriverReleased(job, { action, reason, actorRole, refundAmount = 0, pickupIso = null } = {}) {
  try {
    const desc = describeJob({ ...job, pickup_by: pickupIso || job.pickup_by });
    const customer = await clientLine(job.client_id);
    const reasonText = { no_show: 'driver no-show', driver_cancelled: 'driver cancelled', customer: 'customer changed plans' }[reason] || reason || 'released';
    const what = action === 'cancel' ? 'cancelled' : 'reopened for drivers';
    const title = `Driver released (${reasonText}) by ${actorRole || 'client'}: ${job.job_number} ${what}`;
    const list = action === 'reopen' ? await driverCallList(job, 10) : [];
    const message = `${desc}. ${refundAmount > 0 ? `${money(refundAmount)} refunded. ` : ''}Customer: ${customer}`;
    const html = `<h3 style="margin:0 0 8px;color:#b45309">Driver released: ${esc(reasonText)} (${esc(actorRole || 'client')})</h3><p>${esc(desc)}</p><p><b>Job is now:</b> ${esc(what)}${refundAmount > 0 ? ` · ${esc(money(refundAmount))} refunded to the customer` : ''}<br><b>Customer:</b> ${esc(customer)}</p>${action === 'reopen' ? `<p><b>Call list</b> (push = has the app):</p>${callListHtml(list)}` : ''}`;
    return await alertAdmins({ type: 'admin_driver_released', title, message, html, referenceId: job.id, url: '/admin/jobs' });
  } catch (e) {
    console.error('[admin-alerts] alertDriverReleased failed:', e?.message);
    return null;
  }
}
