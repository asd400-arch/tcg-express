import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'client') return NextResponse.json({ error: 'Only clients can accept bids' }, { status: 403 });

    const { id } = await params;

    // Fetch the bid
    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('express_bids')
      .select('id, job_id, driver_id, amount, status')
      .eq('id', id)
      .single();

    if (bidErr || !bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    if (bid.status !== 'pending') return NextResponse.json({ error: 'Bid is no longer pending' }, { status: 400 });

    // Verify job belongs to this client + get full job info
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number, status, pickup_address, delivery_address, item_description')
      .eq('id', bid.job_id)
      .single();

    if (jobErr || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (job.client_id !== session.userId) return NextResponse.json({ error: 'Not your job' }, { status: 403 });
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
    }

    // Fetch driver and client info for detailed notifications
    const [driverRes, clientRes] = await Promise.all([
      supabaseAdmin.from('express_users').select('contact_name, phone, vehicle_type, vehicle_plate, driver_rating').eq('id', bid.driver_id).single(),
      supabaseAdmin.from('express_users').select('contact_name, phone, email, company_name').eq('id', session.userId).single(),
    ]);
    const driver = driverRes.data;
    const client = clientRes.data;

    // Get commission rate from settings (default 15%)
    let rate = 15;
    try {
      const { data: settings } = await supabaseAdmin
        .from('express_settings')
        .select('value')
        .eq('key', 'commission_rate')
        .single();
      if (settings?.value) rate = parseFloat(settings.value);
    } catch {}

    const commission = parseFloat(bid.amount) * (rate / 100);
    const payout = parseFloat(bid.amount) - commission;

    // Accept this bid
    const { error: acceptErr } = await supabaseAdmin
      .from('express_bids')
      .update({ status: 'accepted' })
      .eq('id', id);

    if (acceptErr) return NextResponse.json({ error: acceptErr.message }, { status: 500 });

    // Close other bids (outbid, not rejected — customer didn't reject them)
    await supabaseAdmin
      .from('express_bids')
      .update({ status: 'outbid' })
      .eq('job_id', bid.job_id)
      .neq('id', id)
      .eq('status', 'pending');

    // Update job: assign driver (base columns always exist)
    const { error: jobUpdateErr } = await supabaseAdmin
      .from('express_jobs')
      .update({ status: 'assigned', assigned_driver_id: bid.driver_id })
      .eq('id', bid.job_id);

    if (jobUpdateErr) {
      console.error('Job assign error:', jobUpdateErr.message);
      return NextResponse.json({ error: jobUpdateErr.message }, { status: 500 });
    }

    // Set commission/bid columns (requires add-all-missing-columns.sql migration)
    try {
      const { error: extErr } = await supabaseAdmin
        .from('express_jobs')
        .update({
          assigned_bid_id: bid.id,
          final_amount: bid.amount,
          commission_rate: rate,
          commission_amount: commission.toFixed(2),
          driver_payout: payout.toFixed(2),
        })
        .eq('id', bid.job_id);
      if (extErr) console.error('Job commission columns error (run add-all-missing-columns.sql):', extErr.message);
    } catch {}

    // Create held transaction (escrow)
    try {
      const { error: txnErr } = await supabaseAdmin.from('express_transactions').insert([{
        job_id: bid.job_id,
        client_id: session.userId,
        driver_id: bid.driver_id,
        total_amount: bid.amount,
        commission_amount: commission.toFixed(2),
        driver_payout: payout.toFixed(2),
        payment_status: 'held',
        held_at: new Date().toISOString(),
      }]);
      if (txnErr) console.error('Transaction insert error (run add-all-missing-columns.sql):', txnErr.message);
    } catch {}

    // Notify driver with client details
    try {
      const clientInfo = client
        ? `\nClient: ${client.contact_name}${client.phone ? ` (${client.phone})` : ''}${client.company_name ? ` - ${client.company_name}` : ''}`
        : '';
      const jobInfo = `\nPickup: ${job.pickup_address || 'N/A'}\nDelivery: ${job.delivery_address || 'N/A'}`;

      await notify(bid.driver_id, {
        type: 'job',
        category: 'bid_activity',
        title: `Job ${job.job_number} assigned to you!`,
        message: `Your bid of $${parseFloat(bid.amount).toFixed(2)} has been accepted.${clientInfo}${jobInfo}`,
        referenceId: bid.job_id,
        url: '/driver/my-jobs',
      });
    } catch {}

    // Notify client with driver details
    try {
      const driverInfo = driver
        ? `\nDriver: ${driver.contact_name}${driver.phone ? ` (${driver.phone})` : ''}${driver.vehicle_type ? `\nVehicle: ${driver.vehicle_type}` : ''}${driver.vehicle_plate ? ` (${driver.vehicle_plate})` : ''}${driver.driver_rating ? `\nRating: ${driver.driver_rating}/5` : ''}`
        : '';

      await notify(session.userId, {
        type: 'job',
        category: 'job_updates',
        title: `Driver assigned for ${job.job_number}`,
        message: `${driver?.contact_name || 'A driver'} has been assigned to your delivery ($${parseFloat(bid.amount).toFixed(2)}).${driverInfo}`,
        referenceId: bid.job_id,
        url: `/client/jobs/${bid.job_id}`,
      });
    } catch {}

    return NextResponse.json({ success: true, data: { job_id: bid.job_id, amount: bid.amount } });
  } catch (err) {
    console.error('Accept bid error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
