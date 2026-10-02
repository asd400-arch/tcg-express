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

// ── Unit numbers (2 Oct 2026) ────────────────────────────────────────────────────────────
// Pickup and delivery unit numbers are required: drivers were arriving at the right building
// with no idea which floor or shop. "No unit" is allowed for landed houses, warehouses with a
// single gate, etc., but the customer has to say so explicitly.

export const NO_UNIT_LABEL = 'No unit (landed / whole building)';

/** "5-01" → "#05-01", "#3-12a" → "#03-12A"; free text (e.g. "Shop 12", "Loading bay B") kept as typed. */
export function normalizeUnit(raw) {
  const s = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (s === NO_UNIT_LABEL) return s;
  const m = s.match(/^#?\s*(B?\d{1,3})\s*[-–]\s*([0-9]{1,5}[A-Za-z]?)$/i);
  if (m) {
    const floor = /^\d$/.test(m[1]) ? `0${m[1]}` : m[1].toUpperCase();
    return `#${floor}-${m[2].toUpperCase()}`;
  }
  return s;
}

/** Unit as stored inside the address string: "#05-01", "Shop 12", the no-unit label, or null. */
export function extractUnit(address) {
  const a = String(address || '');
  if (a.includes(NO_UNIT_LABEL)) return NO_UNIT_LABEL;
  const m = a.match(/#\s?B?\d{1,3}\s?[-–]\s?[0-9]{1,5}[A-Za-z]?/i);
  if (m) return m[0].replace(/\s/g, '').toUpperCase();
  const tagged = a.match(/\bUnit:\s*([^,]+)/i);
  return tagged ? tagged[1].trim() : null;
}

/** Composes the stored address: "Blk 123 #05-01, 1 Rochor Canal Rd" / "Unit: Shop 12, …" / "No unit (…), …". */
export function composeAddress(street, blk, unit) {
  const u = normalizeUnit(unit);
  const unitPart = !u ? '' : (u.startsWith('#') || u === NO_UNIT_LABEL ? u : `Unit: ${u}`);
  const prefix = [String(blk || '').trim(), unitPart].filter(Boolean).join(' ');
  const st = String(street || '').trim();
  return prefix ? `${prefix}, ${st}` : st;
}
