import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';

export async function GET(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: jobId } = await params;

    const { data: job } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id')
      .eq('id', jobId)
      .single();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (session.role === 'client' && job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('express_bids')
      .select('*, driver:driver_id(id, contact_name, phone, driver_rating, vehicle_type, vehicle_plate, total_deliveries)')
      .eq('job_id', jobId)
      .in('status', ['pending', 'accepted'])
      .order('amount', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    console.error('GET /api/jobs/[id]/bids error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
