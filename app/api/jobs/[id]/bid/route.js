import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';
import { requirePositiveNumber, cleanString } from '../../../../../lib/validate';
import { checkVehicleFit } from '../../../../../lib/fares';

const DISMANTLE_KEYS = new Set(['dismantlement', 'installation']);

/**
 * Validates and normalizes P6 new-structure equipment_charges.
 * Returns { error } on failure or { normalized } on success.
 * Legacy arrays and null are passed through unchanged.
 */
function validateAndNormalizeEC(ec, claimedAmount) {
  if (ec == null || Array.isArray(ec)) return { normalized: ec };
  if (typeof ec !== 'object') return { error: 'Invalid equipment_charges format' };

  const base        = parseFloat(ec.base)        || 0;
  const dismantling = parseFloat(ec.dismantling)  || 0;
  const assembly    = parseFloat(ec.assembly)     || 0;

  if (base < 0 || dismantling < 0 || assembly < 0) {
    return { error: 'equipment_charges values cannot be negative' };
  }

  let equipTotal = 0;
  const normalizedEquipment = [];
  for (const eq of (ec.equipment || [])) {
    // offered_price missing → fall back to base_price
    const offered = parseFloat(eq.offered_price ?? eq.base_price ?? 0);
    if (offered < 0) return { error: 'Equipment offered_price cannot be negative' };
    equipTotal += offered;
    normalizedEquipment.push({
      key:           String(eq.key || '').slice(0, 50),
      base_price:    parseFloat(eq.base_price) || 0,
      offered_price: offered,
    });
  }

  const breakdownTotal = base + dismantling + assembly + equipTotal;
  const diff = Math.abs(breakdownTotal - parseFloat(claimedAmount));
  if (diff > 0.10) {
    return {
      error: `Bid amount ($${parseFloat(claimedAmount).toFixed(2)}) does not match breakdown total ($${breakdownTotal.toFixed(2)})`,
    };
  }

  return {
    normalized: { base, dismantling, assembly, equipment: normalizedEquipment },
  };
}

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Only drivers can bid' }, { status: 403 });
    }

    const blocked = applyRateLimit(rateLimiters.bids, session.userId);
    if (blocked) return blocked;

    const { id: job_id } = await params;
    const body = await request.json();

    const amountCheck = requirePositiveNumber(body.amount, 'Amount');
    if (amountCheck.error) return NextResponse.json({ error: amountCheck.error }, { status: 400 });
    if (amountCheck.value > 100000) {
      return NextResponse.json({ error: 'Amount exceeds maximum' }, { status: 400 });
    }

    const amount = amountCheck.value;
    const message = cleanString(body.note ?? body.message, 500);

    const { data: driverInfo } = await supabaseAdmin
      .from('express_users')
      .select('contact_name')
      .eq('id', session.userId)
      .single();
    const driverName = driverInfo?.contact_name || 'A driver';

    const { data: job } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, status, job_number, vehicle_required, budget_min, budget_max, equipment_needed')
      .eq('id', job_id)
      .single();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
    }

    const min = parseFloat(job.budget_min) || 0;
    const max = parseFloat(job.budget_max) || 0;

    if (min > 0 && amount < min) {
      return NextResponse.json({ error: `Bid must be at least $${min.toFixed(2)}` }, { status: 400 });
    }

    // Skip upper bound check for jobs with dismantlement/assembly (driver-quoted pricing)
    const hasDismantleEquip = Array.isArray(job.equipment_needed) &&
      job.equipment_needed.some(k => DISMANTLE_KEYS.has(k));
    if (!hasDismantleEquip && max > 0 && amount > max) {
      return NextResponse.json({ error: `Bid must not exceed $${max.toFixed(2)}` }, { status: 400 });
    }

    if (job.vehicle_required && job.vehicle_required !== 'any') {
      const { data: driver } = await supabaseAdmin
        .from('express_users')
        .select('vehicle_type')
        .eq('id', session.userId)
        .single();

      const fit = checkVehicleFit(driver?.vehicle_type, job.vehicle_required);
      if (!fit.ok) {
        const msg = fit.reason === 'exclusive'
          ? `This job is for small vehicles only. Required: ${fit.required}`
          : `Your vehicle (${fit.driverVehicle}) is too small. Required: ${fit.required}`;
        return NextResponse.json({ error: msg }, { status: 403 });
      }
    }

    // Validate and normalize equipment_charges (P6 new structure)
    const ecResult = validateAndNormalizeEC(body.equipment_charges, amount);
    if (ecResult.error) {
      return NextResponse.json({ error: ecResult.error }, { status: 400 });
    }
    const equipment_charges = ecResult.normalized ?? null;

    const { data: existing } = await supabaseAdmin
      .from('express_bids')
      .select('id, status, amount')
      .eq('job_id', job_id)
      .eq('driver_id', session.userId)
      .single();

    if (existing && ['pending', 'accepted'].includes(existing.status)) {
      return NextResponse.json({
        error: 'You already placed a bid on this job',
        existing_bid: { id: existing.id, amount: existing.amount, status: existing.status },
      }, { status: 409 });
    }

    if (existing && ['rejected', 'outbid'].includes(existing.status)) {
      const { data, error } = await supabaseAdmin
        .from('express_bids')
        .update({
          amount: parseFloat(amount),
          message: message || null,
          equipment_charges: equipment_charges || [],
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (job.status === 'open') {
        await supabaseAdmin.from('express_jobs').update({ status: 'bidding' }).eq('id', job_id);
      }

      try {
        await notify(job.client_id, {
          type: 'new_bid',
          category: 'bid_activity',
          title: 'New bid received',
          message: `New bid $${parseFloat(amount).toFixed(2)} from ${driverName} on job ${job.job_number || ''}`,
          referenceId: job_id,
          url: `/client/jobs/${job_id}`,
          data: { job_id, role: 'client' },
        });
      } catch (notifyErr) {
        console.error('[notify-dispatch] bid (rebid) failed:', notifyErr?.message);
      }

      return NextResponse.json({ data, message: 'Bid placed successfully!' });
    }

    const { data, error } = await supabaseAdmin
      .from('express_bids')
      .insert([{
        job_id,
        driver_id: session.userId,
        amount: parseFloat(amount),
        message: message || null,
        equipment_charges: equipment_charges || [],
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You already placed a bid on this job' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (job.status === 'open') {
      await supabaseAdmin.from('express_jobs').update({ status: 'bidding' }).eq('id', job_id);
    }

    try {
      await notify(job.client_id, {
        type: 'new_bid',
        category: 'bid_activity',
        title: 'New bid received',
        message: `New bid $${parseFloat(amount).toFixed(2)} from ${driverName} on job ${job.job_number || ''}`,
        referenceId: job_id,
        url: `/client/jobs/${job_id}`,
      });
    } catch (notifyErr) {
      console.error('[notify-dispatch] bid (new) failed:', notifyErr?.message);
    }

    return NextResponse.json({ data, message: 'Bid placed successfully!' });
  } catch (err) {
    console.error('POST /api/jobs/[id]/bid error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
