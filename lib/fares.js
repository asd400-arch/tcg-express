// Fare system configuration (SGD)
// Admin-configurable via /api/admin/settings key: "fare_table"

export const SIZE_TIERS = [
  { key: 'envelope', label: 'Envelope / Document', baseFare: 8, maxWeight: 1, icon: '✉️' },
  { key: 'small', label: 'Small (< 5kg)', baseFare: 15, maxWeight: 5, icon: '📦' },
  { key: 'medium', label: 'Medium (5–20kg)', baseFare: 30, maxWeight: 20, icon: '📦' },
  { key: 'large', label: 'Large (20–50kg)', baseFare: 60, maxWeight: 50, icon: '🏋️' },
  { key: 'bulky', label: 'Bulky / Heavy (50kg+)', baseFare: 120, maxWeight: Infinity, icon: '🚛' },
];

export const URGENCY_MULTIPLIERS = {
  standard: { label: 'Standard', multiplier: 1.0, desc: 'Within 24 hours' },
  express: { label: 'Express', multiplier: 1.5, desc: 'Within 4 hours' },
  urgent: { label: 'Urgent', multiplier: 2.0, desc: 'Within 1 hour' },
};

export const ADDON_OPTIONS = [
  { key: 'extra_manpower', label: 'Extra Manpower', price: 30, unit: 'person', icon: '👷', hasQty: true },
  { key: 'equipment_fee', label: 'Equipment Usage', price: 20, unit: 'item', icon: '🔧', hasQty: true },
  { key: 'white_glove', label: 'White Glove Service', price: 50, unit: 'flat', icon: '🧤', hasQty: false },
  { key: 'stairs', label: 'Stairs Surcharge', price: 15, unit: 'floor', icon: '🪜', hasQty: true },
];

export const DISTANCE_FREE_KM = 10;
export const DISTANCE_PER_KM = 1.5;

export function getSizeTierFromWeight(kg) {
  if (!kg || kg <= 0) return null;
  const w = parseFloat(kg);
  if (isNaN(w)) return null;
  if (w <= 1) return 'envelope';
  if (w <= 5) return 'small';
  if (w <= 20) return 'medium';
  if (w <= 50) return 'large';
  return 'bulky';
}

export function calculateFare({ sizeTier, urgency = 'standard', addons = {}, distanceKm = 0 }) {
  const tier = SIZE_TIERS.find(t => t.key === sizeTier);
  const urg = URGENCY_MULTIPLIERS[urgency];
  if (!tier || !urg) return null;

  const baseFare = tier.baseFare;
  const multiplier = urg.multiplier;
  const baseWithUrgency = baseFare * multiplier;

  let addonTotal = 0;
  const addonLines = [];
  for (const opt of ADDON_OPTIONS) {
    const qty = addons[opt.key];
    if (qty && qty > 0) {
      const cost = opt.price * qty;
      addonTotal += cost;
      addonLines.push({ ...opt, qty, cost });
    }
  }

  let distSurcharge = 0;
  if (distanceKm > DISTANCE_FREE_KM) {
    distSurcharge = (distanceKm - DISTANCE_FREE_KM) * DISTANCE_PER_KM;
  }

  const total = baseWithUrgency + addonTotal + distSurcharge;
  return {
    baseFare,
    multiplier,
    baseWithUrgency,
    addonLines,
    addonTotal,
    distSurcharge,
    total,
    budgetMin: Math.round(total * 0.8),
    budgetMax: Math.round(total * 1.5),
  };
}
