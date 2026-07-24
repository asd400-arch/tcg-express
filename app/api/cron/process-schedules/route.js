import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { notify } from '../../../../lib/notify';
import { calculateFare, getSizeTierFromWeight, getSizeTierFromVolume, getHigherSizeTier } from '../../../../lib/fares';

export async function GET(req) {
  try {
    // Verify CRON_SECRET
    const authHeader = req.headers.get('authorization');
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch due schedules
    const { data: schedules, error: fetchErr } = await supabaseAdmin
      .from('express_schedules')
      .select('*')
      .eq('status', 'active')
      .lte('next_run_at', new Date().toISOString())
      .limit(50);

    if (fetchErr) {
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    let processed = 0;
    let created = 0;
    let errors = 0;

    for (const schedule of schedules || []) {
      processed++;

      try {
        // Check ends_at — if passed, mark completed and skip
        if (schedule.ends_at && new Date(schedule.ends_at) <= new Date()) {
          await supabaseAdmin
            .from('express_schedules')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', schedule.id);
          continue;
        }

        // Fare breakdown 계산
        const _r2 = v => Math.round((Number(v) || 0) * 100) / 100;
        let fareBreakdown = null;
        try {
          const fareWeight  = parseFloat(schedule.item_weight) || 0;
          const dims        = schedule.item_dimensions || {};
          const fareUrgency = ['express', 'urgent'].includes(schedule.urgency) ? schedule.urgency : 'standard';
          const fareVehicle = schedule.vehicle_required || 'any';
          const fareManpower = parseInt(schedule.manpower_count) || 1;
          const fareAddons  = fareManpower > 1 ? { extra_manpower: fareManpower - 1 } : {};
          const sizeTier    = getHigherSizeTier(
            getSizeTierFromWeight(fareWeight),
            getSizeTierFromVolume(dims.l || 0, dims.w || 0, dims.h || 0),
          ) || 'small';
          const serverFare  = calculateFare({
            sizeTier,
            vehicleMode:      fareVehicle !== 'any' ? fareVehicle : undefined,
            urgency:          fareUrgency,
            isEvSelected:     false,
            saveModeDiscount: 0,
            basicEquipment:   [],
            specialEquipment: [],
            addons:           fareAddons,
          });
          if (serverFare) {
            fareBreakdown = {
              base_fare:          _r2(serverFare.baseFare),
              urgency_surcharge:  _r2((serverFare.baseWithUrgency || 0) - (serverFare.baseFare || 0)),
              distance_surcharge: 0,
              addon_total:        _r2(serverFare.addonTotal),
              save_mode_discount: 0,
              ev_discount:        0,
              promo_discount:     0,
              total:              _r2(serverFare.total),
              source:             'server',
            };
          }
        } catch {}
        if (!fareBreakdown) {
          const budget = parseFloat(schedule.budget_min) || 0;
          if (budget > 0) {
            fareBreakdown = {
              base_fare: 0, urgency_surcharge: 0, distance_surcharge: 0,
              addon_total: 0, save_mode_discount: 0, ev_discount: 0, promo_discount: 0,
              total: _r2(budget),
              source: 'client_estimate',
            };
          }
        }

        // Insert a new job from the template
        const { data: job, error: jobErr } = await supabaseAdmin
          .from('express_jobs')
          .insert([{
            client_id: schedule.client_id,
            pickup_address: schedule.pickup_address,
            pickup_contact: schedule.pickup_contact,
            pickup_phone: schedule.pickup_phone,
            pickup_instructions: schedule.pickup_instructions,
            delivery_address: schedule.delivery_address,
            delivery_contact: schedule.delivery_contact,
            delivery_phone: schedule.delivery_phone,
            delivery_instructions: schedule.delivery_instructions,
            item_description: schedule.item_description,
            item_category: schedule.item_category,
            item_weight: schedule.item_weight,
            item_dimensions: schedule.item_dimensions,
            urgency: schedule.urgency,
            budget_min: schedule.budget_min,
            budget_max: schedule.budget_max,
            vehicle_required: schedule.vehicle_required,
            special_requirements: schedule.special_requirements,
            equipment_needed: schedule.equipment_needed || [],
            manpower_count: schedule.manpower_count || 1,
            status: 'open',
            ...(fareBreakdown ? { fare_breakdown: fareBreakdown } : {}),
          }])
          .select()
          .single();

        if (jobErr) {
          errors++;
          continue;
        }

        created++;

        // Calculate next_run_at and update schedule
        const updates = {
          last_run_at: new Date().toISOString(),
          last_job_id: job.id,
          jobs_created: (schedule.jobs_created || 0) + 1,
          updated_at: new Date().toISOString(),
        };

        if (schedule.schedule_type === 'once') {
          updates.status = 'completed';
        } else {
          // Advance from original next_run_at (not now) to prevent drift
          const nextRun = calculateNextRun(schedule);
          updates.next_run_at = nextRun.toISOString();
        }

        await supabaseAdmin
          .from('express_schedules')
          .update(updates)
          .eq('id', schedule.id);

        // Notify client
        const typeLabel = schedule.schedule_type === 'once' ? 'scheduled' : schedule.schedule_type;
        await notify(schedule.client_id, {
          type: 'job',
          category: 'job_updates',
          title: `Job #${job.job_number} auto-created`,
          message: `Job #${job.job_number} was auto-created from your ${typeLabel} schedule`,
          url: `/client/jobs/${job.id}`,
        }).catch(() => {});
      } catch (err) {
        errors++;
      }
    }

    return NextResponse.json({ processed, created, errors });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function calculateNextRun(schedule) {
  const now = new Date();
  let next = new Date(schedule.next_run_at);

  if (schedule.schedule_type === 'weekly') {
    next.setDate(next.getDate() + 7);
    // If still in the past (e.g. missed multiple runs), keep advancing
    while (next <= now) {
      next.setDate(next.getDate() + 7);
    }
  } else if (schedule.schedule_type === 'biweekly') {
    next.setDate(next.getDate() + 14);
    while (next <= now) {
      next.setDate(next.getDate() + 14);
    }
  } else if (schedule.schedule_type === 'monthly') {
    next.setMonth(next.getMonth() + 1);
    while (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}
