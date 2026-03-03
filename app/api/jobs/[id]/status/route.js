import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';
import { calculateCO2Saved, calculateGreenPoints, SAVE_MODE_GREEN_POINTS } from '../../../../../lib/fares';
import { generateInvoice } from '../../../../../lib/generate-invoice';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';
import { requireEnum, cleanString } from '../../../../../lib/validate';

const VALID_TRANSITIONS = {
  assigned: ['pickup_confirmed', 'picked_up'],
  pickup_confirmed: ['in_transit'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['confirmed', 'completed'],
};

// Normalize mobile status names to DB status names
const STATUS_ALIASES = {
  picked_up: 'pickup_confirmed',
};

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const blocked = applyRateLimit(rateLimiters.general, session.userId);
    if (blocked) return blocked;

    const { id } = await params;
    const body = await request.json();

    const allStatuses = ['pickup_confirmed', 'picked_up', 'in_transit', 'delivered', 'confirmed', 'completed'];
    const statusCheck = requireEnum(body.status, allStatuses, 'Status');
    if (statusCheck.error) return NextResponse.json({ error: statusCheck.error }, { status: 400 });
    let status = statusCheck.value;

    const photoUrl = cleanString(body.proof_photo_url || body.photo_url, 2000);

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Verify permission
    if (session.role === 'driver' && job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }
    if (session.role === 'client' && job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[job.status];
    if (!allowed || !allowed.includes(status)) {
      return NextResponse.json({ error: `Cannot transition from ${job.status} to ${status}` }, { status: 400 });
    }

    // Prevent early completion: only for scheduled/regular jobs with a future deliver_by
    // Spot/immediate deliveries (job_type='spot' or missing) are never blocked
    const isScheduledJob = job.job_type === 'scheduled' || job.job_type === 'regular';
    if (status === 'delivered' && session.role === 'driver' && isScheduledJob && job.deliver_by) {
      const scheduledDate = new Date(job.deliver_by);
      const now = new Date();
      if (scheduledDate > now) {
        const dateStr = scheduledDate.toLocaleDateString('en-SG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return NextResponse.json({
          error: `This delivery is scheduled for ${dateStr}. You cannot complete it before the scheduled date.`,
          scheduled_date: job.deliver_by,
        }, { status: 400 });
      }
    }

    // Normalize status alias
    const normalizedStatus = STATUS_ALIASES[status] || status;

    const updates = { status: normalizedStatus };
    // Save photo to the correct field based on transition
    if (photoUrl) {
      if (status === 'pickup_confirmed' || status === 'picked_up') {
        updates.pickup_photo = photoUrl;
      } else if (status === 'delivered') {
        updates.delivery_photo = photoUrl;
      }
    }
    if (normalizedStatus === 'delivered' || status === 'delivered') updates.delivered_at = new Date().toISOString();
    if (normalizedStatus === 'confirmed' || normalizedStatus === 'completed') updates.completed_at = new Date().toISOString();

    // Optimistic lock: only update if status hasn't changed since we read it
    const { data, error } = await supabaseAdmin
      .from('express_jobs')
      .update(updates)
      .eq('id', id)
      .eq('status', job.status)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Job status has already changed. Please refresh and try again.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    // Fire-and-forget PDF invoice generation on delivery
    if (normalizedStatus === 'delivered' || status === 'delivered') {
      generateInvoice(id).catch(err => console.error('Invoice gen failed:', err));
    }

    // Notify the other party with detailed status messages
    try {
      const notifyTarget = session.role === 'driver' ? job.client_id : job.assigned_driver_id;
      if (notifyTarget) {
        const statusMessages = {
          pickup_confirmed: { title: `Pickup confirmed - ${job.job_number}`, message: 'Driver has picked up your item and is heading to the delivery address.' },
          in_transit: { title: `In transit - ${job.job_number}`, message: 'Your delivery is on the way! Track it in real-time.' },
          delivered: { title: `Delivered - ${job.job_number}`, message: 'Your item has been delivered. Please confirm the delivery.' },
          confirmed: { title: `Confirmed - ${job.job_number}`, message: 'Delivery has been confirmed. Payment released to driver.' },
          completed: { title: `Completed - ${job.job_number}`, message: 'Job is now complete. Thank you for using TCG Express!' },
        };
        const msg = statusMessages[normalizedStatus] || {
          title: `Job ${job.job_number || ''} updated`,
          message: `Status: ${normalizedStatus.replace(/_/g, ' ')}`,
        };

        await notify(notifyTarget, {
          type: 'status_update',
          category: 'delivery_status',
          title: msg.title,
          message: msg.message,
          referenceId: id,
          url: `/client/jobs/${id}`,
        });
      }
    } catch {}

    // Auto-release escrow payment when job is confirmed/completed (wallet-only settlement)
    let releaseResult = null;
    if (normalizedStatus === 'confirmed' || normalizedStatus === 'completed') {
      try {
        const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('release_payment', {
          p_job_id: id,
          p_released_by: session.userId,
        });

        if (rpcErr) {
          const msg = rpcErr.message || '';
          // "No held escrow" is OK — might already be released or paid via other path
          if (!msg.includes('No held escrow')) {
            console.error('[status] release_payment FAILED:', { jobId: id, error: msg });
          }
        } else {
          releaseResult = rpcResult;

          // Notify driver of earnings (non-critical)
          try {
            const driverPayout = parseFloat(rpcResult.driver_payout);
            await notify(rpcResult.driver_id, {
              type: 'wallet', category: 'earnings',
              title: 'Earnings credited!',
              message: `$${driverPayout.toFixed(2)} has been added to your wallet for job ${job.job_number || ''}`.trim(),
              referenceId: id,
              url: '/driver/wallet',
            });
          } catch {}
        }
      } catch (releaseErr) {
        console.error('[status] release_payment exception:', releaseErr);
      }
    }

    // Award Green Points on job completion (confirmed/completed)
    if (normalizedStatus === 'confirmed' || normalizedStatus === 'completed') {
      try {
        await awardGreenPoints(job, id);
      } catch {}
    }

    return NextResponse.json({ data, release: releaseResult });
  } catch (err) {
    console.error('POST /api/jobs/[id]/status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Green Points tier thresholds
const GREEN_TIERS = [
  { key: 'bronze', minPoints: 0 },
  { key: 'silver', minPoints: 2000 },
  { key: 'gold', minPoints: 5000 },
  { key: 'platinum', minPoints: 10000 },
];

function getTierForPoints(totalPoints) {
  for (let i = GREEN_TIERS.length - 1; i >= 0; i--) {
    if (totalPoints >= GREEN_TIERS[i].minPoints) return GREEN_TIERS[i].key;
  }
  return 'bronze';
}

async function awardGreenPoints(job, jobId) {
  const ledgerEntries = [];
  const userUpdates = [];

  // Base points: 10 points per completed delivery
  const basePoints = 10;

  // EV bonus: extra points based on CO2 saved
  let evDriverPoints = 0;
  let evClientPoints = 0;
  let co2Saved = 0;

  if (job.is_ev_selected && job.vehicle_required) {
    co2Saved = calculateCO2Saved(job.vehicle_required, job.distance_km || 10);
    const greenPts = calculateGreenPoints(co2Saved);
    evDriverPoints = greenPts; // Driver gets full CO2-based points
    evClientPoints = Math.round(greenPts * 0.5); // Client gets 50% for choosing EV
  }

  // SaveMode bonus
  const saveModeBonus = job.delivery_mode === 'save_mode' ? SAVE_MODE_GREEN_POINTS : 0;

  // Driver points
  if (job.assigned_driver_id) {
    const driverTotal = basePoints + evDriverPoints + saveModeBonus;
    if (driverTotal > 0) {
      const pointsType = evDriverPoints > 0 ? 'ev_delivery' : saveModeBonus > 0 ? 'save_mode' : 'delivery';
      ledgerEntries.push({
        user_id: job.assigned_driver_id,
        user_type: 'driver',
        job_id: jobId,
        points_earned: driverTotal,
        points_type: pointsType,
        co2_saved_kg: co2Saved > 0 ? co2Saved : null,
      });
      userUpdates.push({ userId: job.assigned_driver_id, points: driverTotal });
    }
  }

  // Client points
  if (job.client_id) {
    const clientTotal = basePoints + evClientPoints + saveModeBonus;
    if (clientTotal > 0) {
      const pointsType = evClientPoints > 0 ? 'ev_delivery' : saveModeBonus > 0 ? 'save_mode' : 'delivery';
      ledgerEntries.push({
        user_id: job.client_id,
        user_type: 'client',
        job_id: jobId,
        points_earned: clientTotal,
        points_type: pointsType,
        co2_saved_kg: evClientPoints > 0 ? co2Saved : null,
      });
      userUpdates.push({ userId: job.client_id, points: clientTotal });
    }
  }

  // Insert ledger entries
  if (ledgerEntries.length > 0) {
    await supabaseAdmin.from('green_points_ledger').insert(ledgerEntries);
  }

  // Update job with green points earned
  const totalJobPoints = (basePoints + evDriverPoints + saveModeBonus) + (basePoints + evClientPoints + saveModeBonus);
  await supabaseAdmin.from('express_jobs').update({
    green_points_earned: totalJobPoints,
    co2_saved_kg: co2Saved > 0 ? co2Saved : null,
  }).eq('id', jobId);

  // Update user balances and tiers
  for (const { userId, points } of userUpdates) {
    const { data: userData } = await supabaseAdmin
      .from('express_users')
      .select('green_points_balance')
      .eq('id', userId)
      .single();

    const newBalance = (userData?.green_points_balance || 0) + points;
    const newTier = getTierForPoints(newBalance);

    await supabaseAdmin
      .from('express_users')
      .update({ green_points_balance: newBalance, green_tier: newTier })
      .eq('id', userId);
  }
}
