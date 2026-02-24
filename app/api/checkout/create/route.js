import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { getStripe } from '../../../../lib/stripe';
import { rateLimiters, applyRateLimit } from '../../../../lib/rate-limiters';
import { requireUUID, requirePositiveNumber } from '../../../../lib/validate';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'client') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const blocked = applyRateLimit(rateLimiters.payment, session.userId);
    if (blocked) return blocked;

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const body = await request.json();
    const jobIdCheck = requireUUID(body.jobId, 'Job ID');
    if (jobIdCheck.error) return NextResponse.json({ error: jobIdCheck.error }, { status: 400 });
    const bidIdCheck = requireUUID(body.bidId, 'Bid ID');
    if (bidIdCheck.error) return NextResponse.json({ error: bidIdCheck.error }, { status: 400 });
    const amountCheck = requirePositiveNumber(body.amount, 'Amount');
    if (amountCheck.error) return NextResponse.json({ error: amountCheck.error }, { status: 400 });

    const jobId = jobIdCheck.value;
    const bidId = bidIdCheck.value;
    const amount = amountCheck.value;
    const platform = body.platform;

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

    // Mobile: create PaymentIntent for native Payment Sheet
    if (platform === 'mobile') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'sgd',
        metadata: {
          jobId,
          bidId,
          clientId: session.userId,
          driverId: bid.driver_id,
        },
      });

      return NextResponse.json({
        clientSecret: paymentIntent.client_secret,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      });
    }

    // Web: create Checkout Session (redirect-based)
    const origin = request.headers.get('origin')
      || (request.headers.get('host') ? `https://${request.headers.get('host')}` : '')
      || request.headers.get('referer')?.replace(/\/[^/]*$/, '')
      || '';

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
    console.error('Checkout create error:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
