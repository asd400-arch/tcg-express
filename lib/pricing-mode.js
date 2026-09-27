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
