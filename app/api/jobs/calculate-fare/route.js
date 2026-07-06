import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import {
  calculateFare,
  getSizeTierFromWeight,
  getSizeTierFromVolume,
  getHigherSizeTier,
  autoSelectVehicle,
  SAVE_MODE_WINDOWS,
  BASIC_EQUIPMENT,
} from '../../../../lib/fares';

const VEHICLE_ALIASES = {
  van: 'van_1_7m',
  lorry: 'lorry_14ft',
};

function resolveVehicle(vehicle) {
  if (!vehicle) return null;
  const key = String(vehicle).toLowerCase();
  return VEHICLE_ALIASES[key] || key;
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const weight = parseFloat(body.weight) || 0;
    const length = parseFloat(body.length) || 0;
    const width = parseFloat(body.width) || 0;
    const height = parseFloat(body.height) || 0;
    const urgency = ['express', 'urgent'].includes(body.urgency) ? body.urgency : 'standard';
    const isEvSelected = !!body.is_ev_selected || !!body.isEvSelected;

    // Save mode discount
    const saveModeWindowHours = parseInt(body.save_mode_window) || 0;
    let saveModeDiscount = 0;
    if (saveModeWindowHours > 0) {
      const win = SAVE_MODE_WINDOWS.find(w => w.hours === saveModeWindowHours);
      saveModeDiscount = win?.discount || 0;
    }

    // Basic equipment (filter to known keys)
    const validEquipKeys = new Set(BASIC_EQUIPMENT.map(e => e.key));
    const rawEquipment = Array.isArray(body.basic_equipment) ? body.basic_equipment : [];
    const basicEquipmentKeys = rawEquipment.filter(k => validEquipKeys.has(k));

    // Extra manpower addon (count above 1 base)
    const manpowerCount = parseInt(body.manpower_count) || 1;
    const addons = manpowerCount > 1 ? { extra_manpower: manpowerCount - 1 } : {};

    let vehicleMode = resolveVehicle(body.vehicle || body.vehicle_required);
    if (!vehicleMode && (weight > 0 || (length && width && height))) {
      vehicleMode = autoSelectVehicle(weight, length, width, height);
    }

    const sizeFromWeight = getSizeTierFromWeight(weight);
    const sizeFromVolume = getSizeTierFromVolume(length, width, height);
    const sizeTier = getHigherSizeTier(sizeFromWeight, sizeFromVolume) || 'small';

    const fare = calculateFare({
      sizeTier,
      vehicleMode: vehicleMode || undefined,
      urgency,
      isEvSelected,
      saveModeDiscount,
      basicEquipment: basicEquipmentKeys,
      addons,
    });

    if (!fare) {
      return NextResponse.json({ error: 'Unable to calculate fare' }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        vehicle_mode: vehicleMode,
        size_tier: sizeTier,
        base_fare: fare.baseFare,
        urgency_multiplier: fare.multiplier,
        subtotal: fare.baseWithUrgency,
        addon_total: fare.addonTotal,
        ev_discount: fare.evDiscount,
        save_mode_discount: fare.saveModeDiscount,
        total: fare.total,
        budget_min: fare.budgetMin,
        budget_max: fare.budgetMax,
      },
    });
  } catch (err) {
    console.error('POST /api/jobs/calculate-fare error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
