// TCG Fleet flat-rate promo (11 Oct 2026).
// A promo_codes row with discount_type 'fixed_price' sets the customer's price to discount_value
// (e.g. FLEET15 → S$15 flat, anywhere in Singapore). T&C: TCG Express fleet booking only,
// up to 5 kg and 1 cbm, no cross-border. The voucher covers the rest of the fare; fleet drivers
// are salaried, so the job stays with the fleet (it can't be opened to all drivers).

export const FIXED_PRICE = 'fixed_price';
export const FLEET_PROMO_MAX_KG = 5;
export const FLEET_PROMO_MAX_CM3 = 1_000_000; // 1 cbm

export function isFixedPricePromo(promo) {
  return promo?.discount_type === FIXED_PRICE;
}

function volumeCm3(dims) {
  if (!dims) return 0;
  const nums = String(dims).match(/[\d.]+/g);
  if (!nums || nums.length < 3) return 0;
  return parseFloat(nums[0]) * parseFloat(nums[1]) * parseFloat(nums[2]);
}

/**
 * @param {{ driverPool?: string, weight?: number|string, dimensions?: string, crossBorder?: boolean }} job
 * @returns {{ ok: true } | { ok: false, error: string, code: string }}
 */
export function fixedPriceEligibility({ driverPool, weight, dimensions, crossBorder } = {}) {
  if (crossBorder) {
    return { ok: false, code: 'promo_fleet_only', error: 'This flat-rate voucher is for deliveries within Singapore only.' };
  }
  if (driverPool !== 'tcg') {
    return { ok: false, code: 'promo_fleet_only', error: 'This flat-rate voucher is for TCG Express fleet bookings — choose "TCG Express fleet" as the driver option.' };
  }
  const kg = parseFloat(weight) || 0;
  if (kg > FLEET_PROMO_MAX_KG) {
    return { ok: false, code: 'promo_too_heavy', error: `This flat-rate voucher covers items up to ${FLEET_PROMO_MAX_KG} kg.` };
  }
  if (volumeCm3(dimensions) > FLEET_PROMO_MAX_CM3) {
    return { ok: false, code: 'promo_too_big', error: 'This flat-rate voucher covers items up to 1 cbm (e.g. 100 × 100 × 100 cm).' };
  }
  return { ok: true };
}

/** Discount that brings `fare` down to the promo's flat price. */
export function fixedPriceDiscount(promo, fare) {
  const target = parseFloat(promo?.discount_value) || 0;
  const amt = parseFloat(fare) || 0;
  return Math.max(0, Math.round((amt - target) * 100) / 100);
}
