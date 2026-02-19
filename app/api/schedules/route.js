import { supabaseAdmin } from '../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../lib/auth';

const VALID_TYPES = ['once', 'weekly', 'biweekly', 'monthly'];
const REQUIRED_FIELDS = ['pickup_address', 'delivery_address', 'item_description'];

export async function GET(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabaseAdmin
      .from('express_schedules')
      .select('*, client:client_id(contact_name, company_name)')
      .order('created_at', { ascending: false });

    if (session.role !== 'admin') {
      query = query.eq('client_id', session.userId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'client') {
      return NextResponse.json({ error: 'Only clients can create schedules' }, { status: 403 });
    }

    const body = await req.json();
    const { schedule_type, next_run_at, day_of_week, day_of_month, run_time, ends_at, ...jobTemplate } = body;

    // Validate schedule type
    if (!VALID_TYPES.includes(schedule_type)) {
      return NextResponse.json({ error: 'Invalid schedule type' }, { status: 400 });
    }

    // Validate required job template fields
    for (const field of REQUIRED_FIELDS) {
      if (!jobTemplate[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    // Validate next_run_at is in the future
    if (!next_run_at) {
      return NextResponse.json({ error: 'next_run_at is required' }, { status: 400 });
    }
    const runDate = new Date(next_run_at);
    if (runDate <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    // Validate ends_at is after next_run_at if provided
    if (ends_at && new Date(ends_at) <= runDate) {
      return NextResponse.json({ error: 'End date must be after the first run date' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('express_schedules')
      .insert([{
        client_id: session.userId,
        schedule_type,
        next_run_at,
        day_of_week: day_of_week != null ? parseInt(day_of_week) : null,
        day_of_month: day_of_month != null ? parseInt(day_of_month) : null,
        run_time: run_time || null,
        ends_at: ends_at || null,
        pickup_address: jobTemplate.pickup_address,
        pickup_contact: jobTemplate.pickup_contact || null,
        pickup_phone: jobTemplate.pickup_phone || null,
        pickup_instructions: jobTemplate.pickup_instructions || null,
        delivery_address: jobTemplate.delivery_address,
        delivery_contact: jobTemplate.delivery_contact || null,
        delivery_phone: jobTemplate.delivery_phone || null,
        delivery_instructions: jobTemplate.delivery_instructions || null,
        item_description: jobTemplate.item_description,
        item_category: jobTemplate.item_category || 'general',
        item_weight: jobTemplate.item_weight ? parseFloat(jobTemplate.item_weight) : null,
        item_dimensions: jobTemplate.item_dimensions || null,
        urgency: jobTemplate.urgency || 'standard',
        budget_min: jobTemplate.budget_min ? parseFloat(jobTemplate.budget_min) : null,
        budget_max: jobTemplate.budget_max ? parseFloat(jobTemplate.budget_max) : null,
        vehicle_required: jobTemplate.vehicle_required || 'any',
        special_requirements: jobTemplate.special_requirements || null,
        equipment_needed: jobTemplate.equipment_needed || [],
        manpower_count: jobTemplate.manpower_count || 1,
        status: 'active',
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
