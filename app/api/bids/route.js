import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';
import { notify } from '../../../lib/notify';

export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  let query = supabaseAdmin.from('express_bids').select('*, driver:driver_id(contact_name, driver_rating, vehicle_type, total_deliveries)');

  if (jobId) {
    query = query.eq('job_id', jobId);
  } else if (session.role === 'driver') {
    query = query.eq('driver_id', session.userId);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten driver info
  const bids = (data || []).map(bid => ({
    ...bid,
    driver_name: bid.driver?.contact_name,
    driver_rating: bid.driver?.driver_rating,
    vehicle_type: bid.driver?.vehicle_type,
    total_deliveries: bid.driver?.total_deliveries,
    driver: undefined,
  }));

  return NextResponse.json({ data: bids });
}

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'driver') return NextResponse.json({ error: 'Only drivers can bid' }, { status: 403 });

  const { job_id, amount, message } = await request.json();
  if (!job_id || !amount) return NextResponse.json({ error: 'Job ID and amount required' }, { status: 400 });

  // Check job exists and is open
  const { data: job } = await supabaseAdmin
    .from('express_jobs')
    .select('id, client_id, status, job_number')
    .eq('id', job_id)
    .single();

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (!['open', 'bidding'].includes(job.status)) {
    return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
  }

  // Check for existing bid
  const { data: existing } = await supabaseAdmin
    .from('express_bids')
    .select('id')
    .eq('job_id', job_id)
    .eq('driver_id', session.userId)
    .eq('status', 'pending')
    .single();

  if (existing) return NextResponse.json({ error: 'You already have a pending bid on this job' }, { status: 409 });

  const { data, error } = await supabaseAdmin
    .from('express_bids')
    .insert([{
      job_id,
      driver_id: session.userId,
      amount: parseFloat(amount),
      message: message || null,
      status: 'pending',
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update job status to bidding if still open
  if (job.status === 'open') {
    await supabaseAdmin.from('express_jobs').update({ status: 'bidding' }).eq('id', job_id);
  }

  // Notify client
  try {
    await notify(job.client_id, {
      type: 'new_bid',
      category: 'bid_activity',
      title: 'New bid received',
      message: `A driver bid $${parseFloat(amount).toFixed(2)} on job ${job.job_number || ''}`,
    });
  } catch {}

  return NextResponse.json({ data });
}
