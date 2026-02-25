import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';
import { notify } from '../../../lib/notify';
import { rateLimiters, applyRateLimit } from '../../../lib/rate-limiters';
import { requireUUID, requirePositiveNumber, cleanString } from '../../../lib/validate';
import { checkVehicleFit } from '../../../lib/fares';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    // Validate jobId format if provided
    if (jobId && !UUID_RE.test(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 });
    }

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
  } catch (err) {
    console.error('GET /api/bids error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'driver') return NextResponse.json({ error: 'Only drivers can bid' }, { status: 403 });

    const blocked = applyRateLimit(rateLimiters.bids, session.userId);
    if (blocked) return blocked;

    const body = await request.json();
    const jobIdCheck = requireUUID(body.job_id, 'Job ID');
    if (jobIdCheck.error) return NextResponse.json({ error: jobIdCheck.error }, { status: 400 });
    const amountCheck = requirePositiveNumber(body.amount, 'Amount');
    if (amountCheck.error) return NextResponse.json({ error: amountCheck.error }, { status: 400 });
    if (amountCheck.value > 100000) return NextResponse.json({ error: 'Amount exceeds maximum' }, { status: 400 });

    const job_id = jobIdCheck.value;
    const amount = amountCheck.value;
    const message = cleanString(body.message, 500);

    // Validate equipment_charges if provided
    let equipment_charges = null;
    if (body.equipment_charges && Array.isArray(body.equipment_charges) && body.equipment_charges.length > 0) {
      if (body.equipment_charges.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 equipment charges allowed' }, { status: 400 });
      }
      for (const item of body.equipment_charges) {
        if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
          return NextResponse.json({ error: 'Each equipment charge must have a name' }, { status: 400 });
        }
        if (typeof item.amount !== 'number' || item.amount <= 0 || item.amount > 10000) {
          return NextResponse.json({ error: 'Each equipment charge amount must be between $0 and $10,000' }, { status: 400 });
        }
      }
      equipment_charges = body.equipment_charges.map(item => ({
        name: item.name.trim().substring(0, 100),
        amount: parseFloat(item.amount.toFixed(2)),
      }));
    }

    // Fetch driver name for notification
    const { data: driverInfo } = await supabaseAdmin
      .from('express_users')
      .select('contact_name')
      .eq('id', session.userId)
      .single();
    const driverName = driverInfo?.contact_name || 'A driver';

    // Check job exists and is open
    const { data: job } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, status, job_number, vehicle_required')
      .eq('id', job_id)
      .single();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
    }

    // Vehicle size validation: driver's vehicle must be big enough
    if (job.vehicle_required && job.vehicle_required !== 'any') {
      const { data: driver } = await supabaseAdmin
        .from('express_users')
        .select('vehicle_type')
        .eq('id', session.userId)
        .single();

      const fit = checkVehicleFit(driver?.vehicle_type, job.vehicle_required);
      if (!fit.ok) {
        return NextResponse.json({
          error: `Your vehicle is too small for this job. Required: ${fit.required}`,
        }, { status: 400 });
      }
    }

    // Check for existing bid
    const { data: existing } = await supabaseAdmin
      .from('express_bids')
      .select('id, status, amount')
      .eq('job_id', job_id)
      .eq('driver_id', session.userId)
      .single();

    if (existing) {
      // Active bid — block duplicate
      if (['pending', 'accepted'].includes(existing.status)) {
        return NextResponse.json({
          error: 'You already placed a bid on this job',
          existing_bid: { id: existing.id, amount: existing.amount, status: existing.status },
        }, { status: 409 });
      }

      // Rejected or outbid — allow re-bid by updating existing row
      if (['rejected', 'outbid'].includes(existing.status)) {
        const { data, error } = await supabaseAdmin
          .from('express_bids')
          .update({
            amount: parseFloat(amount),
            message: message || null,
            equipment_charges: equipment_charges || [],
            status: 'pending',
            created_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
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
            message: `New bid $${parseFloat(amount).toFixed(2)} from ${driverName} on job ${job.job_number || ''}`,
            url: `/client/jobs/${job_id}`,
          });
        } catch {}

        return NextResponse.json({ data });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('express_bids')
      .insert([{
        job_id,
        driver_id: session.userId,
        amount: parseFloat(amount),
        message: message || null,
        equipment_charges: equipment_charges || [],
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      // Handle race condition: duplicate bid inserted between check and insert
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You already placed a bid on this job' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

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
        message: `New bid $${parseFloat(amount).toFixed(2)} from ${driverName} on job ${job.job_number || ''}`,
        url: `/client/jobs/${job_id}`,
      });
    } catch {}

    return NextResponse.json({ data });
  } catch (err) {
    console.error('POST /api/bids error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
