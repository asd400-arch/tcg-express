import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession, requireAuth } from '../../../lib/auth';
import { VALID_VEHICLE_KEYS, getVehicleModeIndex, normalizeVehicleKey } from '../../../lib/fares';
import { findMatchingZones, calculateZoneSurcharge, isInRestrictedZone } from '../../../lib/geo';
import { sendPushToUser } from '../../../lib/web-push';

function getAreaFromAddress(addr) {
  if (!addr) return '';
  const parts = addr.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[0];
  return addr.length > 35 ? addr.slice(0, 32) + '...' : addr;
}

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');

    let query = supabaseAdmin.from('express_jobs').select('*');

    if (role === 'driver' || session.role === 'driver') {
      // Drivers see their assigned jobs
      query = query.eq('assigned_driver_id', session.userId);
    } else if (session.role === 'client') {
      query = query.eq('client_id', session.userId);
    }
    // Admins see all

    if (status === 'open') {
      // For available jobs listing (drivers browsing)
      query = supabaseAdmin.from('express_jobs').select('*').eq('status', 'open');
    } else if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/jobs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can create jobs' }, { status: 403 });

    const body = await request.json();

    // Validate and calculate voucher discount (if provided)
    let couponDiscount = 0;
    let validatedCouponId = null;
    if (body.coupon_id) {
      const { data: promo } = await supabaseAdmin
        .from('promo_codes')
        .select('*')
        .eq('id', body.coupon_id)
        .single();

      if (promo && promo.is_active) {
        const now = new Date();
        const notExpired = !promo.valid_until || new Date(promo.valid_until) >= now;
        const isStarted = !promo.valid_from || new Date(promo.valid_from) <= now;
        const withinUsageLimit = !promo.usage_limit || promo.usage_count < promo.usage_limit;

        if (notExpired && isStarted && withinUsageLimit) {
          // Per-user usage check
          let perUserOk = true;
          if (promo.per_user_limit) {
            const { count } = await supabaseAdmin
              .from('express_jobs')
              .select('id', { count: 'exact', head: true })
              .eq('coupon_id', promo.id)
              .eq('client_id', session.userId);
            if (count >= promo.per_user_limit) perUserOk = false;
          }

          // New customers only check
          let newCustomerOk = true;
          if (promo.new_customers_only) {
            const { count } = await supabaseAdmin
              .from('express_jobs')
              .select('id', { count: 'exact', head: true })
              .eq('client_id', session.userId)
              .not('status', 'eq', 'cancelled');
            if (count > 0) newCustomerOk = false;
          }

          if (perUserOk && newCustomerOk) {
            const orderAmount = parseFloat(body.budget_min) || parseFloat(body.budget) || parseFloat(body.estimated_fare) || 0;
            const meetsMinOrder = !promo.min_order_amount || orderAmount >= parseFloat(promo.min_order_amount);

            if (meetsMinOrder) {
              if (promo.discount_type === 'percentage') {
                couponDiscount = orderAmount * (parseFloat(promo.discount_value) / 100);
                if (promo.max_discount) couponDiscount = Math.min(couponDiscount, parseFloat(promo.max_discount));
              } else {
                couponDiscount = parseFloat(promo.discount_value);
              }
              couponDiscount = Math.min(couponDiscount, orderAmount);
              validatedCouponId = promo.id;
            }
          }
        }
      }
      // If validation fails silently, job still creates without discount
    }

    // Check wallet balance before allowing job creation
    const minBudget = parseFloat(body.budget_min) || parseFloat(body.budget) || parseFloat(body.estimated_fare) || 0;
    if (minBudget > 0) {
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('balance')
        .eq('user_id', session.userId)
        .single();

      const balance = parseFloat(wallet?.balance) || 0;
      if (balance < minBudget) {
        return NextResponse.json({
          error: 'Insufficient wallet balance to create this job',
          available: balance.toFixed(2),
          required: minBudget.toFixed(2),
        }, { status: 400 });
      }
    }

    // Validate pickup time is at least 30 minutes from now
    const pickupBy = body.pickup_date || body.pickup_by || null;
    if (pickupBy) {
      const pickupTime = new Date(pickupBy);
      const minPickup = new Date(Date.now() + 29 * 60000); // 29 min to allow slight clock drift
      if (pickupTime < minPickup) {
        return NextResponse.json({ error: 'Minimum pickup time is 30 minutes from now' }, { status: 400 });
      }
    }

    // Build special_requirements JSON: merge fare data + special instructions
    const fareInfo = {};
    if (body.size_tier) fareInfo.size_tier = body.size_tier;
    if (body.addons) fareInfo.addons = body.addons;
    if (body.estimated_fare != null) fareInfo.estimated_fare = parseFloat(body.estimated_fare);

    let specialReqs = body.special_instructions || body.special_requirements || '';
    if (Object.keys(fareInfo).length > 0) {
      // Store fare data as JSON alongside any text instructions
      specialReqs = JSON.stringify({
        ...(specialReqs ? { notes: specialReqs } : {}),
        ...fareInfo,
      });
    }

    // Build item description from title + description
    let itemDescription = body.title || body.item_description || '';
    if (body.title && body.description) {
      itemDescription = `${body.title} - ${body.description}`;
    }

    // Map mobile field names to database column names
    const jobData = {
      client_id: session.userId,
      status: 'open',
      item_category: body.category || body.item_category || 'general',
      item_description: itemDescription,
      pickup_address: body.pickup_address || '',
      delivery_address: body.delivery_address || '',
      pickup_contact: body.pickup_contact || '',
      pickup_phone: body.pickup_phone || '',
      pickup_instructions: body.pickup_instructions || null,
      delivery_contact: body.delivery_contact || '',
      delivery_phone: body.delivery_phone || '',
      delivery_instructions: body.delivery_instructions || null,
      item_weight: body.weight != null ? parseFloat(body.weight) : (body.item_weight != null ? parseFloat(body.item_weight) : null),
      item_dimensions: body.dimensions || body.item_dimensions || null,
      special_requirements: specialReqs || null,
      equipment_needed: body.equipment_needed || [],
      urgency: body.urgency || 'standard',
      budget_min: body.budget != null ? parseFloat(body.budget) : (body.budget_min != null ? parseFloat(body.budget_min) : null),
      budget_max: body.budget != null ? parseFloat(body.budget) : (body.budget_max != null ? parseFloat(body.budget_max) : null),
      pickup_by: body.pickup_date || body.pickup_by || null,
      deliver_by: body.deliver_by || null,
      manpower_count: body.manpower_count || 1,
      vehicle_required: body.vehicle_required || 'any',
      is_ev_selected: body.is_ev_selected || false,
      co2_saved_kg: body.co2_saved_kg != null ? parseFloat(body.co2_saved_kg) : null,
      green_points_earned: body.green_points_earned != null ? parseInt(body.green_points_earned) : null,
      job_type: body.job_type || 'spot',
      delivery_mode: body.delivery_mode || 'express',
      save_mode_window: body.save_mode_window != null ? parseInt(body.save_mode_window) : null,
      save_mode_deadline: body.save_mode_deadline || null,
      schedule_id: body.schedule_id || null,
    };

    // Apply validated voucher discount
    if (validatedCouponId) {
      jobData.coupon_id = validatedCouponId;
      jobData.coupon_discount = couponDiscount;
    }

    // Geo-fencing validation
    const hasCoords = body.pickup_lat != null || body.delivery_lat != null;
    if (hasCoords) {
      try {
        const { data: zones } = await supabaseAdmin
          .from('service_zones')
          .select('*')
          .eq('is_active', true);

        if (zones && zones.length > 0) {
          if (body.pickup_lat != null && body.pickup_lng != null) {
            if (isInRestrictedZone(body.pickup_lat, body.pickup_lng, zones)) {
              return NextResponse.json({ error: 'Pickup address is in a restricted zone' }, { status: 400 });
            }
          }
          if (body.delivery_lat != null && body.delivery_lng != null) {
            if (isInRestrictedZone(body.delivery_lat, body.delivery_lng, zones)) {
              return NextResponse.json({ error: 'Delivery address is in a restricted zone' }, { status: 400 });
            }
          }
          // Recalculate zone surcharge server-side
          const pickupSurchargeZones = body.pickup_lat != null ? findMatchingZones(body.pickup_lat, body.pickup_lng, zones).filter(z => z.zone_type === 'surcharge') : [];
          const deliverySurchargeZones = body.delivery_lat != null ? findMatchingZones(body.delivery_lat, body.delivery_lng, zones).filter(z => z.zone_type === 'surcharge') : [];
          const allZones = [...pickupSurchargeZones, ...deliverySurchargeZones].filter((z, i, arr) => arr.findIndex(x => x.id === z.id) === i);
          if (allZones.length > 0) {
            const baseFare = parseFloat(body.estimated_fare) || parseFloat(body.budget_min) || 0;
            jobData.zone_surcharge = calculateZoneSurcharge(baseFare, allZones);
          }
        }
      } catch {
        // Don't fail job creation if geo-fencing check fails
      }
    }
    if (body.pickup_lat != null) jobData.pickup_lat = parseFloat(body.pickup_lat);
    if (body.pickup_lng != null) jobData.pickup_lng = parseFloat(body.pickup_lng);
    if (body.delivery_lat != null) jobData.delivery_lat = parseFloat(body.delivery_lat);
    if (body.delivery_lng != null) jobData.delivery_lng = parseFloat(body.delivery_lng);

    // Validate vehicle_required against valid keys
    if (jobData.vehicle_required !== 'any' && !VALID_VEHICLE_KEYS.includes(jobData.vehicle_required)) {
      // Allow legacy keys for backward compat
      const legacyKeys = ['van', 'truck', 'lorry'];
      if (!legacyKeys.includes(jobData.vehicle_required)) {
        return NextResponse.json({ error: 'Invalid vehicle type' }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('express_jobs')
      .insert([jobData])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Increment voucher usage count
    if (validatedCouponId) {
      try {
        await supabaseAdmin.rpc('increment_field', { table_name: 'promo_codes', field_name: 'usage_count', row_id: validatedCouponId });
      } catch {
        // Fallback: direct update if RPC not available
        try {
          const { data: current } = await supabaseAdmin.from('promo_codes').select('usage_count').eq('id', validatedCouponId).single();
          await supabaseAdmin.from('promo_codes').update({ usage_count: (current?.usage_count || 0) + 1 }).eq('id', validatedCouponId);
        } catch {
          // Don't fail job creation if usage count update fails
        }
      }
    }

    // Push notifications FIRST (time-critical — must run before anything that could timeout)
    try {
      const { data: subs } = await supabaseAdmin
        .from('express_push_subscriptions')
        .select('user_id');

      if (subs && subs.length > 0) {
        const uniqueUserIds = [...new Set(subs.map(s => s.user_id))];
        const pickupArea = getAreaFromAddress(jobData.pickup_address);
        const deliveryArea = getAreaFromAddress(jobData.delivery_address);
        const pushBody = `${data.job_number} | $${jobData.budget_min || 0}-$${jobData.budget_max || 0} | ${pickupArea} → ${deliveryArea}`;

        console.log(`[JOB-PUSH] Sending to ${uniqueUserIds.length} subscribed users: "${pushBody}"`);

        const results = await Promise.allSettled(
          uniqueUserIds.map(userId =>
            sendPushToUser(userId, {
              title: '🚚 New Job Available',
              body: pushBody,
              url: '/driver/jobs',
            })
          )
        );
        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[JOB-PUSH] Push results: ${sent} sent, ${failed} failed`);
      } else {
        console.warn('[JOB-PUSH] No push subscriptions found — no push sent');
      }
    } catch (pushError) {
      console.error('[JOB-PUSH] Error:', pushError?.message);
    }

    // In-app notifications for all drivers
    try {
      const { data: drivers } = await supabaseAdmin
        .from('express_users')
        .select('id')
        .eq('role', 'driver');

      if (drivers && drivers.length > 0) {
        const notifications = drivers.map(d => ({
          user_id: d.id,
          type: 'new_job',
          title: `New Job: ${itemDescription.substring(0, 60)}`,
          body: `New ${jobData.item_category} delivery available. Job #${data.job_number}`,
          reference_id: String(data.id),
          is_read: false,
        }));
        await supabaseAdmin.from('express_notifications').insert(notifications);
      }
    } catch (notifErr) {
      console.error('[JOB-NOTIF] In-app notification error:', notifErr?.message);
    }

    // Record green points for EV delivery
    if (jobData.is_ev_selected && jobData.green_points_earned > 0) {
      try {
        await supabaseAdmin.from('green_points_ledger').insert([{
          user_id: session.userId,
          user_type: 'client',
          job_id: data.id,
          points_earned: jobData.green_points_earned,
          points_type: 'ev_delivery',
          co2_saved_kg: jobData.co2_saved_kg,
        }]);
      } catch {
        // Don't fail job creation if green points recording fails
      }
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('POST /api/jobs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
