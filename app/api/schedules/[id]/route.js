import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';

export async function PATCH(req, { params }) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await req.json();

    if (!['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be pause, resume, or cancel' }, { status: 400 });
    }

    // Fetch the schedule
    const { data: schedule, error: fetchErr } = await supabaseAdmin
      .from('express_schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Verify ownership (client owns it) or admin
    if (session.role !== 'admin' && schedule.client_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate state transitions
    const updates = { updated_at: new Date().toISOString() };

    if (action === 'pause') {
      if (schedule.status !== 'active') {
        return NextResponse.json({ error: 'Can only pause active schedules' }, { status: 400 });
      }
      updates.status = 'paused';
    } else if (action === 'resume') {
      if (schedule.status !== 'paused') {
        return NextResponse.json({ error: 'Can only resume paused schedules' }, { status: 400 });
      }

      // For one-time schedules past their time, reject
      if (schedule.schedule_type === 'once' && new Date(schedule.next_run_at) <= new Date()) {
        return NextResponse.json({ error: 'This one-time schedule has passed its scheduled time and cannot be resumed' }, { status: 400 });
      }

      // If next_run_at is in the past, advance to next future occurrence
      if (new Date(schedule.next_run_at) <= new Date()) {
        const nextRun = advanceToFuture(schedule);
        updates.next_run_at = nextRun.toISOString();
      }

      updates.status = 'active';
    } else if (action === 'cancel') {
      if (!['active', 'paused'].includes(schedule.status)) {
        return NextResponse.json({ error: 'Can only cancel active or paused schedules' }, { status: 400 });
      }
      updates.status = 'cancelled';
    }

    const { data, error } = await supabaseAdmin
      .from('express_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

function advanceToFuture(schedule) {
  const now = new Date();
  let next = new Date(schedule.next_run_at);

  if (schedule.schedule_type === 'weekly') {
    while (next <= now) {
      next.setDate(next.getDate() + 7);
    }
  } else if (schedule.schedule_type === 'biweekly') {
    while (next <= now) {
      next.setDate(next.getDate() + 14);
    }
  } else if (schedule.schedule_type === 'monthly') {
    while (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}
