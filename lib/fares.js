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

// ── Dimension Presets (quick-fill) ──
export const DIMENSION_PRESETS = [
  { key: 'envelope', label: 'Envelope', icon: '✉️', l: 35, w: 25, h: 3, weightKey: '0-5' },
  { key: 'shoebox', label: 'Shoebox', icon: '👟', l: 35, w: 25, h: 15, weightKey: '0-5' },
  { key: 'small_box', label: 'Small Box', icon: '📦', l: 40, w: 30, h: 30, weightKey: '5-10' },
  { key: 'medium_box', label: 'Medium Box', icon: '📦', l: 60, w: 40, h: 40, weightKey: '10-20' },
  { key: 'large_box', label: 'Large Box', icon: '📦', l: 80, w: 60, h: 60, weightKey: '20-40' },
  { key: 'pallet', label: 'Pallet', icon: '🏗️', l: 120, w: 100, h: 100, weightKey: '40-70' },
  { key: 'furniture', label: 'Furniture', icon: '🛋️', l: 200, w: 100, h: 120, weightKey: '70-100' },
  { key: 'xl_cargo', label: 'XL Cargo', icon: '🚛', l: 300, w: 150, h: 150, weightKey: '100+' },
];

/**
 * Get the index of a vehicle mode in the VEHICLE_MODES array.
 * Used for upgrade-only enforcement.
 */
export function getVehicleModeIndex(key) {
  if (!key || key === 'any') return -1;
  return VEHICLE_MODES.findIndex(v => v.key === key);
}

// ── Vehicle Modes (9 types) ──
export const VEHICLE_MODES = [
  { key: 'motorcycle', label: 'Motorcycle', maxWeight: 8, maxL: 40, maxW: 30, maxH: 30, baseFare: 8, icon: '🏍️' },
  { key: 'car', label: 'Car', maxWeight: 20, maxL: 70, maxW: 50, maxH: 50, baseFare: 15, icon: '🚗' },
  { key: 'mpv', label: 'MPV', maxWeight: 50, maxL: 110, maxW: 80, maxH: 50, baseFare: 25, icon: '🚙' },
  { key: 'van_1_7m', label: '1.7m Van', maxWeight: 400, maxL: 160, maxW: 120, maxH: 100, baseFare: 45, icon: '🚐' },
  { key: 'van_2_4m', label: '2.4m Van', maxWeight: 800, maxL: 230, maxW: 120, maxH: 120, baseFare: 65, icon: '🚐' },
  { key: 'lorry_10ft', label: '10ft Lorry', maxWeight: 1200, maxL: 290, maxW: 140, maxH: 170, baseFare: 95, icon: '🚚' },
  { key: 'lorry_14ft', label: '14ft Lorry', maxWeight: 2000, maxL: 420, maxW: 170, maxH: 190, baseFare: 140, icon: '🚚' },
  { key: 'lorry_24ft', label: '24ft Lorry', maxWeight: 7000, maxL: 720, maxW: 220, maxH: 220, baseFare: 280, icon: '🚛' },
  { key: 'special', label: 'Special', maxWeight: Infinity, maxL: Infinity, maxW: Infinity, maxH: Infinity, baseFare: 0, icon: '🏗️' },
];

export const VALID_VEHICLE_KEYS = VEHICLE_MODES.map(v => v.key);

/**
 * Auto-select the smallest vehicle that fits all constraints.
 * Returns 'special' if nothing fits.
 */
export function autoSelectVehicle(weightKg, lengthCm, widthCm, heightCm) {
  const w = parseFloat(weightKg) || 0;
  const l = parseFloat(lengthCm) || 0;
  const wi = parseFloat(widthCm) || 0;
  const h = parseFloat(heightCm) || 0;

  for (const mode of VEHICLE_MODES) {
    if (mode.key === 'special') continue;
    if (w <= mode.maxWeight && l <= mode.maxL && wi <= mode.maxW && h <= mode.maxH) {
      return mode.key;
    }
  }
  return 'special';
}

/**
 * Map legacy vehicle type keys to new vehicle mode keys for backward compat.
 */
export function legacyVehicleLabel(key) {
  const map = {
    van: 'van_1_7m',
    truck: 'lorry_10ft',
    lorry: 'lorry_14ft',
  };
  const mapped = map[key] || key;
  const mode = VEHICLE_MODES.find(v => v.key === mapped);
  return mode ? mode.label : key;
}

// ── EV (Electric Vehicle) Constants ──
export const EV_EMISSION_FACTORS = {
  motorcycle: 0.08,
  car: 0.17,
  mpv: 0.21,
  van_1_7m: 0.27,
  van_2_4m: 0.27,
  lorry_10ft: 0.45,
  lorry_14ft: 0.62,
  lorry_24ft: 0.85,
};

export const EV_DISCOUNT_RATE = 0.08; // 8% off base fare

/**
 * Calculate CO2 saved by using an EV instead of ICE vehicle.
 * Returns kg of CO2 saved.
 */
export function calculateCO2Saved(vehicleKey, distanceKm) {
  const factor = EV_EMISSION_FACTORS[vehicleKey];
  if (!factor || !distanceKm || distanceKm <= 0) return 0;
  return parseFloat((distanceKm * factor).toFixed(2));
}

/**
 * Calculate green points earned from CO2 savings.
 * 1 kg CO2 saved = 10 green points.
 */
export function calculateGreenPoints(co2SavedKg) {
  if (!co2SavedKg || co2SavedKg <= 0) return 0;
  return Math.round(co2SavedKg * 10);
}

/**
 * Calculate EV discount amount on base fare.
 */
export function calculateEvDiscount(baseFare) {
  if (!baseFare || baseFare <= 0) return 0;
  return parseFloat((baseFare * EV_DISCOUNT_RATE).toFixed(2));
}

// ── Commission Rates ──
export const COMMISSION_RATE = 0.15; // 15% standard
export const EV_COMMISSION_RATE = 0.10; // 10% for EV drivers

/**
 * Calculate driver earnings after commission.
 * EV drivers pay 10% commission vs 15% standard.
 */
export function calculateDriverEarnings(fareAmount, isEvDriver = false) {
  const rate = isEvDriver ? EV_COMMISSION_RATE : COMMISSION_RATE;
  const commission = parseFloat((fareAmount * rate).toFixed(2));
  const earnings = parseFloat((fareAmount - commission).toFixed(2));
  return { earnings, commission, commissionRate: rate, commissionPercent: Math.round(rate * 100) };
}

// ── SaveMode Constants ──
export const SAVE_MODE_WINDOWS = [
  { hours: 4, discount: 0.20, label: '4 Hours', desc: '20% off' },
  { hours: 8, discount: 0.25, label: '8 Hours', desc: '25% off' },
  { hours: 12, discount: 0.28, label: '12 Hours', desc: '28% off' },
  { hours: 24, discount: 0.30, label: '24 Hours', desc: '30% off' },
];

export const SAVE_MODE_GREEN_POINTS = 5; // bonus points per SaveMode job

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

export function calculateFare({ sizeTier, vehicleMode, urgency = 'standard', addons = {}, distanceKm = 0, basicEquipCount = 0, isEvSelected = false, saveModeDiscount = 0 }) {
  // Prefer vehicleMode over sizeTier when available
  let baseFare;
  if (vehicleMode) {
    const vm = VEHICLE_MODES.find(v => v.key === vehicleMode);
    if (vm && vm.key !== 'special') baseFare = vm.baseFare;
  }
  const tier = SIZE_TIERS.find(t => t.key === sizeTier);
  const urg = URGENCY_MULTIPLIERS[urgency];
  if (baseFare == null) {
    if (!tier || !urg) return null;
    baseFare = tier.baseFare;
  }
  if (!urg) return null;
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

  let evDiscount = 0;
  if (isEvSelected && baseFare > 0) {
    evDiscount = calculateEvDiscount(baseFare);
  }

  let saveModeAmount = 0;
  if (saveModeDiscount > 0) {
    saveModeAmount = parseFloat(((baseWithUrgency + addonTotal + equipmentTotal + distSurcharge) * saveModeDiscount).toFixed(2));
  }

  const total = baseWithUrgency + addonTotal + equipmentTotal + distSurcharge - evDiscount - saveModeAmount;
  return {
    baseFare,
    multiplier,
    baseWithUrgency,
    addonLines,
    addonTotal: addonTotal + equipmentTotal,
    distSurcharge,
    evDiscount,
    saveModeDiscount: saveModeAmount,
    total,
    budgetMin: Math.round(total * 0.8),
    budgetMax: Math.round(total * 1.5),
  };
}
