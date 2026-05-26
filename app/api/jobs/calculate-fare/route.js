import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import {
  calculateFare,
  getSizeTierFromWeight,
  getSizeTierFromVolume,
  getHigherSizeTier,
  autoSelectVehicle,
} from '../../../../lib/fares';

const VEHICLE_ALIASES = {
  van: 'van_1_7m',
  lorry: 'lorry_10ft',
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
    const urgency = body.urgency === 'express' ? 'express' : 'standard';
    const isEvSelected = !!body.is_ev_selected || !!body.isEvSelected;

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
        ev_discount: fare.evDiscount,
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
