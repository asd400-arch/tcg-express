import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession, requireAuth } from '../../../lib/auth';

export async function GET(request) {
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
}

export async function POST(request) {
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
  };

  const { data, error } = await supabaseAdmin
    .from('express_jobs')
    .insert([jobData])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
