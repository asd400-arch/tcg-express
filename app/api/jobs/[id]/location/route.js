import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';

// ─── helpers ─────────────────────────────────────────────────────────────────

const TRACKABLE_STATUSES = ['assigned', 'pickup_confirmed', 'picked_up', 'in_transit'];

function validateCoords(lat, lng) {
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  if (isNaN(la) || isNaN(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { latitude: la, longitude: lo };
}

// ─── PATCH /api/jobs/[id]/location ───────────────────────────────────────────
// Driver updates their live position (upsert into express_driver_locations).
// Body: { latitude, longitude, heading?, speed?, accuracy? }

export async function PATCH(request, { params }) {
  return _handleWrite(request, params);
}

// Also support POST for backward compatibility.
export async function POST(request, { params }) {
  return _handleWrite(request, params);
}

async function _handleWrite(request, params) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Only drivers can update location' }, { status: 403 });
    }

    const blocked = applyRateLimit(rateLimiters.general, session.userId);
    if (blocked) return blocked;

    const { id } = await params;
    const body = await request.json();

    // Accept both { lat, lng } and { latitude, longitude }
    const coords = validateCoords(
      body.latitude ?? body.lat,
      body.longitude ?? body.lng,
    );
    if (!coords) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    // Verify driver is assigned to this job and it is in a trackable status
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, assigned_driver_id, status')
      .eq('id', id)
      .single();

    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }
    if (!TRACKABLE_STATUSES.includes(job.status)) {
      return NextResponse.json({ error: 'Job is not trackable in current status' }, { status: 400 });
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('express_driver_locations')
      .upsert(
        {
          job_id: id,
          driver_id: session.userId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: parseFloat(body.heading) || 0,
          speed: parseFloat(body.speed) || 0,
          accuracy: parseFloat(body.accuracy) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'job_id' },
      );

    if (upsertErr) {
      console.error('[location] upsert failed:', upsertErr);
      return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/jobs/[id]/location error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET /api/jobs/[id]/location ─────────────────────────────────────────────
// Returns driver's current location.  Only the job's client or assigned driver
// may call this.
// Response: { data: { latitude, longitude, updated_at, pickup_lat, pickup_lng,
//                      delivery_lat, delivery_lng } | null }

export async function GET(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Fetch job for permission check and pickup/delivery coords
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, assigned_driver_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng')
      .eq('id', id)
      .single();

    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (session.role === 'client' && job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }
    if (session.role === 'driver' && job.assigned_driver_id !== session.userId) {
      return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    }

    const { data: loc, error: locErr } = await supabaseAdmin
      .from('express_driver_locations')
      .select('latitude, longitude, updated_at')
      .eq('job_id', id)
      .single();

    if (locErr || !loc) return NextResponse.json({ data: null });

    return NextResponse.json({
      data: {
        latitude: Number(loc.latitude),
        longitude: Number(loc.longitude),
        updated_at: loc.updated_at,
        pickup_lat: job.pickup_lat != null ? Number(job.pickup_lat) : null,
        pickup_lng: job.pickup_lng != null ? Number(job.pickup_lng) : null,
        delivery_lat: job.delivery_lat != null ? Number(job.delivery_lat) : null,
        delivery_lng: job.delivery_lng != null ? Number(job.delivery_lng) : null,
      },
    });
  } catch (err) {
    console.error('GET /api/jobs/[id]/location error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
