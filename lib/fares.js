// Fare system configuration (SGD)
// Admin-configurable via /api/admin/settings key: "fare_table"

export const SIZE_TIERS = [
  { key: 'envelope', label: 'Envelope / Document', baseFare: 8, maxWeight: 1, icon: '✉️' },
  { key: 'small', label: 'Small (< 5kg)', baseFare: 15, maxWeight: 5, icon: '📦' },
  { key: 'medium', label: 'Medium (5–20kg)', baseFare: 30, maxWeight: 20, icon: '📦' },
  { key: 'large', label: 'Large (20–50kg)', baseFare: 60, maxWeight: 50, icon: '🏋️' },
  { key: 'bulky', label: 'Bulky / Heavy (50kg+)', baseFare: 120, maxWeight: Infinity, icon: '🚛' },
];

export const WEIGHT_RANGES = [
  { key: '0-5', label: '~5kg', midWeight: 3, sizeTier: 'small' },
  { key: '5-10', label: '5~10kg', midWeight: 7.5, sizeTier: 'medium' },
  { key: '10-20', label: '10~20kg', midWeight: 15, sizeTier: 'medium' },
  { key: '20-40', label: '20~40kg', midWeight: 30, sizeTier: 'large' },
  { key: '40-70', label: '40~70kg', midWeight: 55, sizeTier: 'bulky' },
  { key: '70-100', label: '70~100kg', midWeight: 85, sizeTier: 'bulky' },
  { key: '100+', label: '100kg+', midWeight: 120, sizeTier: 'bulky' },
];

export const VOLUME_TIERS = [
  { maxVolume: 10000, sizeTier: 'small', label: 'Small' },
  { maxVolume: 50000, sizeTier: 'medium', label: 'Medium' },
  { maxVolume: 200000, sizeTier: 'large', label: 'Large' },
  { maxVolume: Infinity, sizeTier: 'bulky', label: 'XL' },
];

export const URGENCY_MULTIPLIERS = {
  standard: { label: 'Standard', multiplier: 1.0, desc: 'Within 24 hours' },
  express: { label: 'Express', multiplier: 1.5, desc: 'Within 4 hours' },
  urgent: { label: 'Urgent', multiplier: 2.0, desc: 'Within 1 hour' },
};

export const ADDON_OPTIONS = [
  { key: 'extra_manpower', label: 'Extra Manpower', price: 30, unit: 'person', icon: '👷', hasQty: true },
  { key: 'white_glove', label: 'White Glove Service', price: 50, unit: 'flat', icon: '🧤', hasQty: false },
  { key: 'stairs', label: 'Stairs Surcharge', price: 15, unit: 'floor', icon: '🪜', hasQty: true },
];

export const BASIC_EQUIPMENT = [
  { key: 'hand_truck', label: 'Hand Cart', price: 20, icon: '🛒' },
  { key: 'trolley', label: 'Dolly', price: 20, icon: '🛞' },
  { key: 'pallet_jack', label: 'Straps', price: 20, icon: '🔗' },
];

export const SPECIAL_EQUIPMENT = [
  { key: 'forklift', label: 'Forklift', icon: '🏗️' },
  { key: 'crane', label: 'Crane', icon: '🏗️' },
  { key: 'stair_climber', label: 'Stair Lift', icon: '🪜' },
  { key: 'lift', label: 'Ladder Truck', icon: '🚚' },
];

export const DISTANCE_FREE_KM = 10;
export const DISTANCE_PER_KM = 1.5;

export function getAutoManpower(weightKg) {
  const w = parseFloat(weightKg);
  if (!w || w <= 0) return 1;
  if (w < 20) return 1;
  if (w <= 40) return 2;
  if (w <= 70) return 3;
  if (w <= 100) return 4;
  return 5;
}

export function getSizeTierFromVolume(l, w, h) {
  const length = parseFloat(l);
  const width = parseFloat(w);
  const height = parseFloat(h);
  if (!length || !width || !height) return null;
  const volume = length * width * height;
  const tier = VOLUME_TIERS.find(t => volume <= t.maxVolume);
  return tier ? tier.sizeTier : 'bulky';
}

export function getHigherSizeTier(tier1, tier2) {
  if (!tier1) return tier2;
  if (!tier2) return tier1;
  const order = ['envelope', 'small', 'medium', 'large', 'bulky'];
  return order.indexOf(tier1) >= order.indexOf(tier2) ? tier1 : tier2;
}

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

export function calculateFare({ sizeTier, urgency = 'standard', addons = {}, distanceKm = 0, basicEquipCount = 0 }) {
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

  let equipmentTotal = 0;
  if (basicEquipCount > 0) {
    equipmentTotal = basicEquipCount * 20;
    addonLines.push({ key: 'basic_equipment', label: 'Basic Equipment', qty: basicEquipCount, cost: equipmentTotal, unit: 'item', price: 20 });
  }

  let distSurcharge = 0;
  if (distanceKm > DISTANCE_FREE_KM) {
    distSurcharge = (distanceKm - DISTANCE_FREE_KM) * DISTANCE_PER_KM;
  }

  const total = baseWithUrgency + addonTotal + equipmentTotal + distSurcharge;
  return {
    baseFare,
    multiplier,
    baseWithUrgency,
    addonLines,
    addonTotal: addonTotal + equipmentTotal,
    distSurcharge,
    total,
    budgetMin: Math.round(total * 0.8),
    budgetMax: Math.round(total * 1.5),
  };
}
