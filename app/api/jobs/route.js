import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession, requireAuth } from '../../../lib/auth';
import { VALID_VEHICLE_KEYS } from '../../../lib/fares';

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
      delivery_contact: body.delivery_contact || '',
      delivery_phone: body.delivery_phone || '',
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
    };

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

    // Notify all active drivers about the new job
    try {
      const { data: drivers } = await supabaseAdmin
        .from('express_users')
        .select('id')
        .eq('role', 'driver')
        .eq('is_active', true);

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
    } catch {
      // Don't fail the job creation if notifications fail
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
