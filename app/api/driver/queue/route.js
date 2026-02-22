import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

// GET: Fetch driver's current job queue
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') return NextResponse.json({ error: 'Drivers only' }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from('driver_job_queue')
      .select('*, job:job_id(*)')
      .eq('driver_id', session.userId)
      .in('status', ['queued', 'active', 'picked_up'])
      .order('queue_position', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/driver/queue error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add job to queue or update queue item
export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') return NextResponse.json({ error: 'Drivers only' }, { status: 403 });

    const body = await request.json();
    const { action, job_id, queue_item_id } = body;

    if (action === 'add') {
      // Check current queue size
      const { data: current } = await supabaseAdmin
        .from('driver_job_queue')
        .select('id, job:job_id(delivery_mode)')
        .eq('driver_id', session.userId)
        .in('status', ['queued', 'active', 'picked_up']);

      const queueSize = (current || []).length;
      const hasSaveMode = (current || []).some(q => q.job?.delivery_mode === 'save_mode');
      const maxJobs = hasSaveMode ? 8 : 3;

      if (queueSize >= maxJobs) {
        return NextResponse.json({ error: `Queue full (max ${maxJobs} jobs)` }, { status: 400 });
      }

      // Add to queue
      const position = queueSize + 1;
      const { data, error } = await supabaseAdmin
        .from('driver_job_queue')
        .insert([{
          driver_id: session.userId,
          job_id,
          queue_position: position,
          status: position === 1 ? 'active' : 'queued',
          started_at: position === 1 ? new Date().toISOString() : null,
        }])
        .select('*, job:job_id(*)')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === 'complete') {
      // Mark current job as completed
      const { error: completeErr } = await supabaseAdmin
        .from('driver_job_queue')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', queue_item_id)
        .eq('driver_id', session.userId);

      if (completeErr) return NextResponse.json({ error: completeErr.message }, { status: 500 });

      // Auto-advance: find next queued job
      const { data: nextJobs } = await supabaseAdmin
        .from('driver_job_queue')
        .select('id, queue_position')
        .eq('driver_id', session.userId)
        .eq('status', 'queued')
        .order('queue_position', { ascending: true })
        .limit(1);

      if (nextJobs && nextJobs.length > 0) {
        await supabaseAdmin
          .from('driver_job_queue')
          .update({ status: 'active', started_at: new Date().toISOString() })
          .eq('id', nextJobs[0].id);
      }

      // Reorder remaining queue positions
      const { data: remaining } = await supabaseAdmin
        .from('driver_job_queue')
        .select('id')
        .eq('driver_id', session.userId)
        .in('status', ['queued', 'active', 'picked_up'])
        .order('queue_position', { ascending: true });

      if (remaining) {
        for (let i = 0; i < remaining.length; i++) {
          await supabaseAdmin
            .from('driver_job_queue')
            .update({ queue_position: i + 1 })
            .eq('id', remaining[i].id);
        }
      }

      return NextResponse.json({ success: true, nextJob: nextJobs?.[0] || null });
    }

    if (action === 'skip') {
      const { error } = await supabaseAdmin
        .from('driver_job_queue')
        .update({ status: 'skipped' })
        .eq('id', queue_item_id)
        .eq('driver_id', session.userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (action === 'pickup') {
      const { error } = await supabaseAdmin
        .from('driver_job_queue')
        .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
        .eq('id', queue_item_id)
        .eq('driver_id', session.userId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('POST /api/driver/queue error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
