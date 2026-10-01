// Job posting rules shared by the API and the web form (1 Oct 2026).
// Keep in sync with lib/job-helpers.ts in the mobile app.
//
// Why 60 minutes: with a small driver pool, a job posted for pickup in 30 minutes dies before
// anyone sees it (TCG-2026-00010, 1 Oct). An hour gives the alerts, and a phone call from the
// admin if nobody taps Accept within 15 minutes, time to work.

export const MIN_PICKUP_LEAD_MIN = 60;      // earliest pickup = now + 60 min
export const ACCEPT_PROMISE_MIN = 15;       // "we'll call you if no driver accepts within 15 minutes"
export const PICKUP_ROUND_MIN = 15;         // default pickup rounds up to the next quarter hour

export function minPickupMessage(leadMin = MIN_PICKUP_LEAD_MIN) {
  return `Earliest pickup is ${leadMin} minutes from now. We'll call you if no driver accepts within ${ACCEPT_PROMISE_MIN} minutes.`;
}

/** Customer-facing note under the pickup time field. */
export const PICKUP_LEAD_NOTE = `Earliest pickup: ${MIN_PICKUP_LEAD_MIN} minutes from now. Drivers usually accept within ${ACCEPT_PROMISE_MIN} minutes — if nobody has, we call you.`;

/** Earliest allowed pickup as a Date (now + lead, rounded up to the next quarter hour). */
export function defaultPickupDate(now = Date.now(), leadMin = MIN_PICKUP_LEAD_MIN) {
  const t = now + leadMin * 60000;
  const step = PICKUP_ROUND_MIN * 60000;
  return new Date(Math.ceil(t / step) * step);
}

/** True when a chosen pickup time is too soon (1 min slack for clock drift). */
export function pickupTooSoon(pickup, now = Date.now(), leadMin = MIN_PICKUP_LEAD_MIN) {
  const t = pickup instanceof Date ? pickup.getTime() : new Date(pickup).getTime();
  if (!t || Number.isNaN(t)) return false;
  return t < now + (leadMin - 1) * 60000;
}
