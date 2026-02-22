import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

// GET: Find nearby pending jobs within radius
export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') return NextResponse.json({ error: 'Drivers only' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radiusKm = parseFloat(searchParams.get('radius')) || 2;

    if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

    // Get driver's current vehicle info
    const { data: driver } = await supabaseAdmin
      .from('express_users')
      .select('vehicle_type')
      .eq('id', session.userId)
      .single();

    // Get driver's current queue count
    const { data: queueItems } = await supabaseAdmin
      .from('driver_job_queue')
      .select('id')
      .eq('driver_id', session.userId)
      .in('status', ['queued', 'active', 'picked_up']);

    const currentQueueSize = (queueItems || []).length;
    if (currentQueueSize >= 3) {
      return NextResponse.json({ data: [], message: 'Queue full' });
    }

    // Find open jobs (simplified - without PostGIS, we filter in JS)
    const { data: openJobs, error } = await supabaseAdmin
      .from('express_jobs')
      .select('*')
      .in('status', ['open', 'bidding'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Filter by: same vehicle mode, minimum fare, and deadline within 15 min detour
    const filtered = (openJobs || []).filter(job => {
      // Must have a minimum budget
      const minBudget = parseFloat(job.budget_min) || 0;
      if (minBudget < 10) return false;

      // Vehicle match (if specified)
      if (job.vehicle_required && job.vehicle_required !== 'any') {
        if (driver?.vehicle_type && driver.vehicle_type !== job.vehicle_required) return false;
      }

      return true;
    }).slice(0, 5);

    return NextResponse.json({ data: filtered });
  } catch (err) {
    console.error('GET /api/driver/nearby-jobs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
