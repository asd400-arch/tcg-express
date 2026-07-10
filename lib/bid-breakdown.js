/**
 * Shared helper: build payments INSERT breakdown fields from bid equipment_charges + job fare_breakdown.
 * Used by: bids/[id]/accept, jobs/[id]/assign, jobs/[id]/instant-accept
 *
 * P6 new structure:  { base, dismantling, assembly, equipment: [{key, base_price, offered_price}] }
 * Legacy structure:  [{name, amount}]  (or null / undefined)
 */

const _r2 = v => Math.round((Number(v) || 0) * 100) / 100;

export function buildPaymentsBreakdown(bidEquipmentCharges, jobFareBreakdown, couponDiscount) {
  const bd = jobFareBreakdown || {};
  const ec = bidEquipmentCharges;

  const isNew = ec !== null && ec !== undefined && !Array.isArray(ec) && typeof ec === 'object';

  let dismantlingFee = 0;
  let assemblyFee    = 0;
  let equipmentFees  = 0;
  let breakdown_meta = null;

  if (isNew) {
    dismantlingFee = _r2(ec.dismantling || 0);
    assemblyFee    = _r2(ec.assembly    || 0);
    equipmentFees  = (ec.equipment || []).reduce(
      (s, e) => s + _r2(e.offered_price ?? e.base_price ?? 0),
      0
    );
    breakdown_meta = {
      bid_base:          _r2(ec.base || 0),
      dismantling_fee:   dismantlingFee,
      assembly_fee:      assemblyFee,
      equipment_charges: ec.equipment || [],
    };
  } else if (Array.isArray(ec) && ec.length > 0) {
    equipmentFees  = ec.reduce((s, e) => s + _r2(e.amount || 0), 0);
    breakdown_meta = { equipment_charges: ec };
  }

  return {
    base_fare:            isNew ? _r2(ec.base || 0) : _r2(bd.base_fare),
    urgency_surcharge:    _r2(bd.urgency_surcharge),
    distance_surcharge:   _r2(bd.distance_surcharge),
    helper_fee:           isNew
      ? _r2(dismantlingFee + assemblyFee + equipmentFees)
      : _r2((bd.addon_total || 0) + dismantlingFee + assemblyFee + equipmentFees),
    special_handling_fee: 0,
    save_mode_discount:   _r2(bd.save_mode_discount),
    ev_discount:          _r2(bd.ev_discount),
    promo_discount:       _r2(couponDiscount ?? bd.promo_discount ?? 0),
    breakdown_meta,
  };
}
