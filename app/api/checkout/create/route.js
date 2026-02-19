import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { getStripe } from '../../../../lib/stripe';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'client') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const { jobId, bidId, amount } = await request.json();
    if (!jobId || !bidId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify job belongs to client
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number, status')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (!['open', 'bidding'].includes(job.status)) {
      return NextResponse.json({ error: 'Job is no longer accepting bids' }, { status: 400 });
    }

    // Verify bid is valid
    const { data: bid, error: bidErr } = await supabaseAdmin
      .from('express_bids')
      .select('id, driver_id, amount, status')
      .eq('id', bidId)
      .eq('job_id', jobId)
      .single();

    if (bidErr || !bid) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
    }
    if (bid.status !== 'pending') {
      return NextResponse.json({ error: 'Bid is no longer pending' }, { status: 400 });
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);

    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || '';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'automatic',
      },
      line_items: [{
        price_data: {
          currency: 'sgd',
          product_data: {
            name: `Delivery - ${job.job_number}`,
            description: `Escrow payment for job ${job.job_number}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      metadata: {
        jobId,
        bidId,
        clientId: session.userId,
        driverId: bid.driver_id,
      },
      success_url: `${origin}/client/jobs/${jobId}?payment=success`,
      cancel_url: `${origin}/client/jobs/${jobId}?payment=cancelled`,
    });

    return NextResponse.json({ sessionUrl: checkoutSession.url });
  } catch (err) {
    console.error('Checkout create error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
