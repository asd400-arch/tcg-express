import { supabaseAdmin } from '../../../../lib/supabase-server';
import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';
import { rateLimiters, applyRateLimit } from '../../../../lib/rate-limiters';
import { requireUUID } from '../../../../lib/validate';

export async function POST(req) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = applyRateLimit(rateLimiters.payment, session.userId);
    if (blocked) return blocked;

    const body = await req.json();
    const jobIdCheck = requireUUID(body?.jobId, 'Job ID');
    if (jobIdCheck.error) return NextResponse.json({ error: jobIdCheck.error }, { status: 400 });
    const jobId = jobIdCheck.value;

    // Verify user is the job's client
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, job_number')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.client_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ATOMIC: single RPC call does escrow verify + driver wallet credit + mark paid
    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('release_payment', {
      p_job_id: jobId,
      p_released_by: session.userId,
    });

    if (rpcErr) {
      const msg = rpcErr.message || '';
      if (msg.includes('No held escrow')) {
        return NextResponse.json({ error: 'No held payment found for this job' }, { status: 404 });
      }
      console.error('release_payment RPC error:', msg);
      return NextResponse.json({ error: 'Failed to release payment' }, { status: 500 });
    }

    // Award client green points (non-critical)
    try {
      const { data: txn } = await supabaseAdmin
        .from('express_transactions')
        .select('total_amount')
        .eq('job_id', jobId)
        .eq('payment_status', 'paid')
        .single();

      if (txn) {
        const pointsEarned = Math.floor(parseFloat(txn.total_amount) * 5);
        if (pointsEarned > 0) {
          const { data: usr } = await supabaseAdmin
            .from('express_users')
            .select('green_points_balance')
            .eq('id', session.userId)
            .single();

          if (usr) {
            const newBalance = (usr.green_points_balance || 0) + pointsEarned;
            await supabaseAdmin.from('express_users')
              .update({ green_points_balance: newBalance })
              .eq('id', session.userId);

            await supabaseAdmin.from('green_points_ledger').insert([{
              user_id: session.userId,
              user_type: 'client',
              job_id: jobId,
              points_earned: pointsEarned,
              points_type: 'loyalty',
            }]);
          }
        }
      }
    } catch (pointsErr) {
      console.error('Loyalty points award failed (non-critical):', pointsErr.message);
    }

    // Notify driver that earnings have been credited (non-critical)
    try {
      const driverPayout = parseFloat(result.driver_payout);
      await notify(result.driver_id, {
        type: 'wallet',
        category: 'earnings',
        title: 'Earnings credited!',
        message: `$${driverPayout.toFixed(2)} has been added to your wallet for job ${job.job_number || ''}`.trim(),
        referenceId: jobId,
        url: '/driver/wallet',
      });
    } catch {}

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
    }
    console.error('Transaction release error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}
