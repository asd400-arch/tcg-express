import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';

export async function POST(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'driver') return NextResponse.json({ error: 'Drivers only' }, { status: 403 });

  const { id } = await params;
  const { latitude, longitude } = await request.json();

  if (latitude == null || longitude == null) {
    return NextResponse.json({ error: 'Coordinates required' }, { status: 400 });
  }

  // Upsert driver location for this job
  const { error } = await supabaseAdmin
    .from('express_job_locations')
    .upsert({
      job_id: id,
      driver_id: session.userId,
      latitude,
      longitude,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'job_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
