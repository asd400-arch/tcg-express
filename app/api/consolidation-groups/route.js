import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

// GET: Fetch consolidation groups (for drivers: available groups; for admin: all)
export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'forming';

  if (session.role === 'driver') {
    // Drivers see groups assigned to them or available 'forming' groups
    const { data, error } = await supabaseAdmin
      .from('consolidation_groups')
      .select('*, jobs:express_jobs(id, job_number, pickup_address, delivery_address, item_description, delivery_mode, save_mode_window)')
      .or(`driver_id.eq.${session.userId},and(status.eq.forming,driver_id.is.null)`)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  }

  // Admin sees all
  const { data, error } = await supabaseAdmin
    .from('consolidation_groups')
    .select('*, jobs:express_jobs(id, job_number, pickup_address, delivery_address, delivery_mode, save_mode_window, status)')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

// POST: Create a consolidation group or assign a SaveMode job to a group
export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action } = body;

  // Action: create — system creates a new consolidation group for SaveMode jobs
  if (action === 'create') {
    const { vehicle_mode, max_jobs } = body;
    const { data, error } = await supabaseAdmin
      .from('consolidation_groups')
      .insert([{
        vehicle_mode: vehicle_mode || 'van_1_7m',
        status: 'forming',
        max_jobs: max_jobs || 8,
        total_jobs: 0,
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Action: assign_job — assign a SaveMode job to a consolidation group
  if (action === 'assign_job') {
    const { job_id, group_id } = body;
    if (!job_id || !group_id) return NextResponse.json({ error: 'job_id and group_id required' }, { status: 400 });

    // Verify the group exists and has capacity
    const { data: group, error: gErr } = await supabaseAdmin
      .from('consolidation_groups')
      .select('*')
      .eq('id', group_id)
      .single();

    if (gErr || !group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    if (group.total_jobs >= group.max_jobs) return NextResponse.json({ error: 'Group is full' }, { status: 400 });

    // Assign the job
    const { error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ consolidation_group_id: group_id })
      .eq('id', job_id)
      .eq('delivery_mode', 'save_mode');

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });

    // Increment total_jobs
    await supabaseAdmin
      .from('consolidation_groups')
      .update({ total_jobs: group.total_jobs + 1 })
      .eq('id', group_id);

    return NextResponse.json({ success: true });
  }

  // Action: claim — driver claims a forming group
  if (action === 'claim') {
    const { group_id } = body;
    if (!group_id) return NextResponse.json({ error: 'group_id required' }, { status: 400 });
    if (session.role !== 'driver') return NextResponse.json({ error: 'Only drivers can claim groups' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('consolidation_groups')
      .update({ driver_id: session.userId, status: 'assigned' })
      .eq('id', group_id)
      .eq('status', 'forming')
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
