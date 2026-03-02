import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import {
  autoSelectVehicle, calculateFare, getSizeTierFromWeight, getSizeTierFromVolume,
  getHigherSizeTier, getVehicleModeIndex, WEIGHT_RANGES,
} from '../../../../lib/fares';

export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  // Clients can only see their own jobs, drivers can see assigned or open jobs
  if (session.role === 'client' && data.client_id !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch driver info if assigned
  if (data.assigned_driver_id) {
    const { data: driver } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating')
      .eq('id', data.assigned_driver_id)
      .single();
    if (driver) {
      data.driver_name = driver.contact_name;
      data.driver_phone = driver.phone;
      data.vehicle_type = driver.vehicle_type;
      data.vehicle_plate = driver.vehicle_plate;
      data.driver_rating = driver.driver_rating;
    }
  }

  // Fetch client info for drivers
  if (session.role === 'driver' && data.client_id) {
    const { data: client } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, phone, company_name, client_rating')
      .eq('id', data.client_id)
      .single();
    if (client) {
      data.client_name = client.contact_name;
      data.client_phone = client.phone;
      data.client_company = client.company_name;
      data.client_rating = client.client_rating;
    }
  }

  return NextResponse.json({ data });
}

// Editable fields by status group
const PRE_PICKUP_FIELDS = [
  'pickup_address', 'delivery_address',
  'pickup_contact', 'pickup_phone', 'pickup_instructions',
  'delivery_contact', 'delivery_phone', 'delivery_instructions',
  'pickup_by', 'deliver_by',
  'item_description', 'item_weight', 'item_dimensions',
  'special_requirements',
];
const PENDING_ONLY_FIELDS = ['item_weight', 'item_dimensions'];
const POST_PICKUP_FIELDS = ['delivery_phone', 'delivery_instructions', 'special_requirements'];

/**
 * Parse dimensions string like "30x20x15" or "30 x 20 x 15 cm" into {l, w, h}.
 */
function parseDimensions(dimStr) {
  if (!dimStr) return { l: 0, w: 0, h: 0 };
  const nums = String(dimStr).match(/[\d.]+/g);
  if (!nums || nums.length < 3) return { l: 0, w: 0, h: 0 };
  return { l: parseFloat(nums[0]) || 0, w: parseFloat(nums[1]) || 0, h: parseFloat(nums[2]) || 0 };
}

/**
 * Compute fare from job fields (weight string + dimensions string + existing job data).
 */
function computeFareFromJob(job, weightOverride, dimsOverride) {
  const weightKg = parseFloat(weightOverride ?? job.item_weight) || 0;
  const dims = parseDimensions(dimsOverride ?? job.item_dimensions);

  const weightSizeTier = getSizeTierFromWeight(weightKg);
  const volumeSizeTier = getSizeTierFromVolume(dims.l, dims.w, dims.h);
  const sizeTier = getHigherSizeTier(weightSizeTier, volumeSizeTier) || 'small';

  const vehicleMode = autoSelectVehicle(weightKg, dims.l, dims.w, dims.h);

  const fare = calculateFare({
    sizeTier,
    vehicleMode,
    urgency: job.urgency || 'standard',
    addons: {},
    basicEquipCount: (job.equipment_needed || []).length,
    isEvSelected: !!job.is_ev_selected,
    saveModeDiscount: 0,
  });

  return { fare, vehicleMode, sizeTier };
}

export async function PUT(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can edit jobs' }, { status: 403 });

  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Preview mode: return fare calculation without saving
  if (body._preview) {
    const { data: job, error: fetchErr } = await supabaseAdmin
      .from('express_jobs').select('*').eq('id', id).single();
    if (fetchErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.client_id !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const oldCalc = computeFareFromJob(job, null, null);
    const newCalc = computeFareFromJob(job, body.item_weight, body.item_dimensions);

    return NextResponse.json({
      preview: true,
      oldFare: oldCalc.fare?.total ?? 0,
      newFare: newCalc.fare?.total ?? 0,
      oldVehicle: oldCalc.vehicleMode,
      newVehicle: newCalc.vehicleMode,
      oldBudgetMin: oldCalc.fare?.budgetMin ?? 0,
      oldBudgetMax: oldCalc.fare?.budgetMax ?? 0,
      newBudgetMin: newCalc.fare?.budgetMin ?? 0,
      newBudgetMax: newCalc.fare?.budgetMax ?? 0,
      vehicleChanged: oldCalc.vehicleMode !== newCalc.vehicleMode,
      fareChanged: Math.abs((oldCalc.fare?.total ?? 0) - (newCalc.fare?.total ?? 0)) > 0.01,
    });
  }

  // Fetch current job
  const { data: job, error: fetchErr } = await supabaseAdmin
    .from('express_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.client_id !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Determine allowed fields based on status
  const prePickupStatuses = ['open', 'bidding', 'pending', 'assigned'];
  const postPickupStatuses = ['pickup_confirmed', 'in_transit', 'delivered'];
  const noEditStatuses = ['confirmed', 'completed', 'cancelled', 'disputed'];

  if (noEditStatuses.includes(job.status)) {
    return NextResponse.json({ error: 'Job cannot be edited in its current status' }, { status: 400 });
  }

  let allowedFields;
  if (prePickupStatuses.includes(job.status)) {
    allowedFields = [...PRE_PICKUP_FIELDS];
  } else if (postPickupStatuses.includes(job.status)) {
    allowedFields = [...POST_PICKUP_FIELDS];
  } else {
    return NextResponse.json({ error: 'Job cannot be edited in its current status' }, { status: 400 });
  }

  // If status is assigned, don't allow changing package dimensions/weight
  if (job.status === 'assigned') {
    allowedFields = allowedFields.filter(f => !PENDING_ONLY_FIELDS.includes(f));
  }

  // Filter to only allowed fields that were actually provided
  const updates = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  // Build audit log of what changed
  const changes = {};
  for (const [key, val] of Object.entries(updates)) {
    if (String(job[key] || '') !== String(val || '')) {
      changes[key] = { from: job[key], to: val };
    }
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ data: job, message: 'No changes detected' });
  }

  // ── Fare recalculation when weight/dimensions change (pending only) ──
  let fareChanged = false;
  let vehicleChanged = false;
  let oldFare = 0;
  let newFare = 0;
  let newVehicle = null;
  let walletAdjustment = 0; // positive = charge more, negative = refund
  let assignmentCancelled = false;

  if ((changes.item_weight || changes.item_dimensions) && ['open', 'bidding', 'pending'].includes(job.status)) {
    const oldCalc = computeFareFromJob(job, null, null);
    const newCalc = computeFareFromJob(job, updates.item_weight, updates.item_dimensions);

    oldFare = oldCalc.fare?.total ?? 0;
    newFare = newCalc.fare?.total ?? 0;
    newVehicle = newCalc.vehicleMode;

    fareChanged = Math.abs(oldFare - newFare) > 0.01;
    vehicleChanged = oldCalc.vehicleMode !== newCalc.vehicleMode;

    // Update fare-related fields on the job
    if (fareChanged || vehicleChanged) {
      updates.vehicle_required = newCalc.vehicleMode;
      updates.budget_min = newCalc.fare?.budgetMin ?? job.budget_min;
      updates.budget_max = newCalc.fare?.budgetMax ?? job.budget_max;

      // If customer already paid (wallet_paid + has transaction), adjust wallet
      if (job.wallet_paid && job.final_amount) {
        const oldPaid = parseFloat(job.final_amount);
        const fareDiff = newFare - oldFare;

        // We adjust based on final_amount vs new fare estimate
        // For open/bidding jobs that haven't been assigned, just update budget range
        // Wallet adjustment only applies if there's an active escrow
        const { data: heldTxn } = await supabaseAdmin
          .from('express_transactions')
          .select('*')
          .eq('job_id', id)
          .eq('payment_status', 'held')
          .maybeSingle();

        if (heldTxn) {
          const heldAmount = parseFloat(heldTxn.total_amount);
          // For simplicity: if fare increases, charge the difference; if decreases, refund
          walletAdjustment = newFare - heldAmount;

          if (Math.abs(walletAdjustment) > 0.01) {
            const { data: wallet } = await supabaseAdmin
              .from('wallets')
              .select('id, balance')
              .eq('user_id', session.userId)
              .single();

            if (wallet) {
              if (walletAdjustment > 0) {
                // Need to charge more — check balance
                if (wallet.balance < walletAdjustment) {
                  return NextResponse.json({
                    error: `Fare increased by $${walletAdjustment.toFixed(2)} but your wallet only has $${wallet.balance.toFixed(2)}. Please top up first.`,
                    fareIncrease: walletAdjustment,
                    walletBalance: wallet.balance,
                  }, { status: 400 });
                }
                // Debit the difference
                const { error: debitErr } = await supabaseAdmin.rpc('wallet_debit', {
                  p_wallet_id: wallet.id, p_user_id: session.userId,
                  p_amount: walletAdjustment, p_type: 'payment',
                  p_reference_type: 'job', p_reference_id: id,
                  p_description: `Fare adjustment for job ${job.job_number} (package change)`,
                });
                if (debitErr) {
                  console.error('Fare adjustment debit error:', debitErr.message);
                  return NextResponse.json({ error: 'Failed to charge fare difference from wallet' }, { status: 500 });
                }
                // Update held transaction amount
                await supabaseAdmin.from('express_transactions')
                  .update({ total_amount: newFare.toFixed(2) })
                  .eq('id', heldTxn.id);
                updates.final_amount = newFare.toFixed(2);
              } else {
                // Refund the difference
                const refundAmt = Math.abs(walletAdjustment);
                const { error: creditErr } = await supabaseAdmin.rpc('wallet_credit', {
                  p_wallet_id: wallet.id, p_user_id: session.userId,
                  p_amount: refundAmt, p_type: 'refund',
                  p_reference_type: 'job', p_reference_id: id,
                  p_description: `Fare adjustment refund for job ${job.job_number} (package change)`,
                });
                if (creditErr) {
                  console.error('Fare adjustment refund error:', creditErr.message);
                  // Non-fatal — continue with update, log the issue
                }
                // Update held transaction amount
                await supabaseAdmin.from('express_transactions')
                  .update({ total_amount: newFare.toFixed(2) })
                  .eq('id', heldTxn.id);
                updates.final_amount = newFare.toFixed(2);
              }
            }
          }
        }
      }
    }

    // If vehicle type changed and driver is assigned, cancel assignment and re-open
    if (vehicleChanged && job.assigned_driver_id) {
      assignmentCancelled = true;

      // Reject the assigned bid
      if (job.assigned_bid_id) {
        await supabaseAdmin.from('express_bids')
          .update({ status: 'rejected' })
          .eq('id', job.assigned_bid_id);
      }

      // Refund escrow if held
      const { data: heldTxn } = await supabaseAdmin
        .from('express_transactions')
        .select('*')
        .eq('job_id', id)
        .eq('payment_status', 'held')
        .maybeSingle();

      if (heldTxn) {
        const { data: wallet } = await supabaseAdmin
          .from('wallets').select('id').eq('user_id', session.userId).single();
        if (wallet) {
          await supabaseAdmin.rpc('wallet_credit', {
            p_wallet_id: wallet.id, p_user_id: session.userId,
            p_amount: parseFloat(heldTxn.total_amount), p_type: 'refund',
            p_reference_type: 'job', p_reference_id: id,
            p_description: `Escrow refund — vehicle change on job ${job.job_number}, re-opened for bidding`,
          });
        }
        await supabaseAdmin.from('express_transactions')
          .update({ payment_status: 'refunded', refunded_at: new Date().toISOString() })
          .eq('id', heldTxn.id);
      }

      // Clear assignment and re-open
      updates.assigned_driver_id = null;
      updates.assigned_bid_id = null;
      updates.final_amount = null;
      updates.wallet_paid = false;
      updates.status = 'open';
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('express_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateErr) {
    console.error('Job update error:', updateErr.message);
    return NextResponse.json({ error: `Failed to update job: ${updateErr.message}` }, { status: 500 });
  }

  // Log the edit in notifications (audit trail)
  try {
    let auditMsg = `Fields changed: ${Object.keys(changes).join(', ')}`;
    if (fareChanged) auditMsg += ` | Fare: $${oldFare.toFixed(2)} → $${newFare.toFixed(2)}`;
    if (vehicleChanged) auditMsg += ` | Vehicle changed to ${newVehicle}`;
    if (assignmentCancelled) auditMsg += ' | Driver unassigned, job re-opened';
    if (walletAdjustment > 0.01) auditMsg += ` | Wallet charged $${walletAdjustment.toFixed(2)} extra`;
    if (walletAdjustment < -0.01) auditMsg += ` | Wallet refunded $${Math.abs(walletAdjustment).toFixed(2)}`;

    await supabaseAdmin.from('express_notifications').insert({
      user_id: session.userId,
      type: 'job',
      title: `Job ${job.job_number} edited`,
      body: auditMsg,
      reference_id: id,
    });
  } catch {}

  // Notify assigned driver
  if (job.assigned_driver_id) {
    const addressChanged = changes.pickup_address || changes.delivery_address;
    const contactChanged = changes.pickup_contact || changes.pickup_phone || changes.delivery_contact || changes.delivery_phone;
    const instructionsChanged = changes.pickup_instructions || changes.delivery_instructions || changes.special_requirements;
    const packageChanged = changes.item_weight || changes.item_dimensions;

    if (addressChanged || contactChanged || instructionsChanged || packageChanged) {
      const changedLabels = [];
      if (changes.pickup_address) changedLabels.push('pickup address');
      if (changes.delivery_address) changedLabels.push('delivery address');
      if (changes.pickup_contact || changes.pickup_phone) changedLabels.push('pickup contact');
      if (changes.delivery_contact || changes.delivery_phone) changedLabels.push('delivery contact');
      if (changes.pickup_instructions) changedLabels.push('pickup instructions');
      if (changes.delivery_instructions) changedLabels.push('delivery instructions');
      if (changes.special_requirements) changedLabels.push('special requirements');
      if (changes.item_weight) changedLabels.push('package weight');
      if (changes.item_dimensions) changedLabels.push('package dimensions');

      let driverMsg = `Customer updated: ${changedLabels.join(', ')}.`;
      if (assignmentCancelled) {
        driverMsg = `You have been unassigned from job ${job.job_number} — the customer changed the package size which requires a different vehicle type. The job has been re-opened for bidding.`;
      } else if (fareChanged) {
        driverMsg += ` Fare updated: $${oldFare.toFixed(2)} → $${newFare.toFixed(2)}.`;
      }

      try {
        const { notify } = await import('../../../../lib/notify.js');
        await notify(job.assigned_driver_id, {
          type: 'job',
          category: 'job_updates',
          title: assignmentCancelled
            ? `Unassigned from ${job.job_number} — vehicle change`
            : `Job ${job.job_number} updated`,
          message: driverMsg,
          referenceId: id,
          url: '/driver/my-jobs',
        });
      } catch (e) {
        console.error('Failed to notify driver of job edit:', e.message);
      }
    }
  }

  return NextResponse.json({
    data: updated,
    changes,
    fareChanged,
    oldFare,
    newFare,
    vehicleChanged,
    newVehicle,
    assignmentCancelled,
    walletAdjustment,
  });
}
