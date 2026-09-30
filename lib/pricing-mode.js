// Pricing mode for marketplace jobs (from 27 Sep 2026).
//
// Standard deliveries have a FIXED price: the first driver who taps "Accept" gets the job
// straight away — no bidding, no waiting for the customer to pick.
// Jobs a formula can't price well (dismantling/installation, crane/lift truck, custom
// requests, 14ft+ lorries, trailers, special vehicles) go out for QUOTES instead:
// drivers send a price and the customer picks one.
//
// Money fields on express_jobs:
//   budget_min      = what the CUSTOMER pays (after voucher, incl. any boosts)
//   coupon_discount = voucher amount, funded by TCG
//   driver price    = budget_min + coupon_discount   (what the driver is paid before commission)
//   budget_max      = ceiling for driver quotes (quote jobs only)
//
// Dependency-free: used by API routes and by the web UI. Keep in sync with
// lib/job-helpers.ts in the mobile app.

export const QUOTE_VEHICLES = ['lorry_14ft', 'lorry_24ft', 'trailer_20ft', 'trailer_40ft', 'special', 'lorry'];
export const QUOTE_EQUIPMENT = ['dismantlement', 'installation', 'crane', 'lift_truck', 'other_request'];
const NO_CEILING_EQUIPMENT = ['dismantlement', 'installation', 'other_request'];

// Customer "boost" when nobody has accepted yet (paid by the customer, goes to the driver)
export const BOOST_OPTIONS = [3, 5, 8];
export const BOOST_CAP = 20;

// ── Cross-border SG → Malaysia (Phase 1, 30 Sep 2026) ────────────────────────
// A job whose delivery address is in Malaysia is ALWAYS a quote job: drivers with
// cross_border_ready = true quote a total for the run (fuel, tolls, road charge, levy
// included). Customs paperwork (SG export permit + Malaysian K1) is done by TCG's
// declaring agents and billed to the customer separately.
export const CROSS_BORDER_COUNTRIES = ['MY'];
export const MY_CITIES = [
  { key: 'johor_bahru', label: 'Johor Bahru', state: 'Johor' },
  { key: 'kuala_lumpur', label: 'Kuala Lumpur', state: 'Kuala Lumpur' },
  { key: 'other', label: 'Other (Malaysia)', state: '' },
];
export const CUSTOMS_AGENT_OPTIONS = [
  { key: 'tcg', label: 'TCG declaring agent (recommended)' },
  { key: 'own', label: 'My own customs agent' },
];
export const CROSS_BORDER_EVENTS = [
  { key: 'at_sg_checkpoint', label: 'At Singapore checkpoint', icon: '🛂' },
  { key: 'cleared_sg', label: 'Cleared Singapore customs', icon: '✅' },
  { key: 'at_my_checkpoint', label: 'At Malaysia checkpoint', icon: '🛂' },
  { key: 'cleared_my', label: 'Cleared Malaysia customs — on the way', icon: '🚚' },
];
// Motorcycles can't carry commercial cargo across the Causeway
export const CROSS_BORDER_BLOCKED_VEHICLES = ['motorcycle'];

/** True when the delivery address is outside Singapore. */
export function isCrossBorder(job) {
  if (!job) return false;
  if (job.cross_border === true) return true;
  const c = String(job.destination_country || '').toUpperCase();
  return !!c && c !== 'SG';
}

/** City label for a cross-border job, e.g. "Johor Bahru" (falls back to the country). */
export function crossBorderCity(job) {
  const d = job?.cross_border_details || {};
  const city = MY_CITIES.find((c) => c.key === d.city);
  if (city && city.key !== 'other') return city.label;
  if (d.city_other) return String(d.city_other);
  return job?.destination_country === 'MY' || !job?.destination_country ? 'Malaysia' : String(job.destination_country);
}

/** Short badge text, e.g. "🇲🇾 Johor Bahru". */
export function crossBorderLabel(job) {
  return isCrossBorder(job) ? `🇲🇾 ${crossBorderCity(job)}` : '';
}

/** Label/icon for a checkpoint event key. */
export function crossBorderEventInfo(key) {
  return CROSS_BORDER_EVENTS.find((e) => e.key === key) || { key, label: String(key || '').replace(/_/g, ' '), icon: '•' };
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (v) => Math.round(v * 100) / 100;

function equipmentOf(job) {
  return Array.isArray(job?.equipment_needed) ? job.equipment_needed : [];
}

/** True when drivers send quotes for this job; false = fixed price, first driver to accept gets it. */
export function isQuoteJob(job) {
  if (!job) return false;
  if (isCrossBorder(job)) return true; // Malaysia runs are always driver-quoted
  const vehicle = String(job.vehicle_required || '').toLowerCase();
  if (QUOTE_VEHICLES.includes(vehicle)) return true;
  if (equipmentOf(job).some((k) => QUOTE_EQUIPMENT.includes(k))) return true;
  // No usable price at all → let drivers quote
  return !(num(job.budget_min) + num(job.coupon_discount) > 0);
}

/** What the customer pays (after voucher, incl. boosts). */
export function customerPrice(job) {
  return r2(Math.max(0, num(job?.budget_min)));
}

/** What the driver is paid for the job before commission (the voucher is TCG-funded). */
export function driverPrice(job) {
  return r2(Math.max(0, num(job?.budget_min)) + Math.max(0, num(job?.coupon_discount)));
}

/** Quote jobs: lowest and highest quote a driver may send (max null = no ceiling). */
export function quoteBounds(job) {
  const min = driverPrice(job);
  const vehicle = String(job?.vehicle_required || '').toLowerCase();
  const noCeiling = vehicle === 'special' || equipmentOf(job).some((k) => NO_CEILING_EQUIPMENT.includes(k));
  const rawMax = num(job?.budget_max);
  return { min, max: noCeiling || rawMax <= min ? null : r2(rawMax) };
}

/** Total the customer has added on top of the original price. */
export function boostTotal(job) {
  return r2(Math.max(0, num(job?.boost_total)));
}
