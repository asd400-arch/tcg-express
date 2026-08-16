import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { notify } from '../../../../lib/notify';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function queryAudience(audience) {
  if (audience === 'test') {
    const { data } = await supabaseAdmin
      .from('express_users')
      .select('id')
      .ilike('email', '%@techchainglobal.com%');
    return data || [];
  }

  const results = [];

  if (audience === 'drivers' || audience === 'all') {
    const { data } = await supabaseAdmin
      .from('express_users')
      .select('id')
      .eq('role', 'driver')
      .eq('driver_status', 'approved')
      .eq('is_active', true);
    if (data) results.push(...data);
  }

  if (audience === 'customers' || audience === 'all') {
    const { data } = await supabaseAdmin
      .from('express_users')
      .select('id')
      .eq('role', 'client')
      .eq('is_active', true);
    if (data) results.push(...data);
  }

  return results;
}

/**
 * Count users who have an Expo push token among the given user IDs.
 * Splits .in() calls into chunks of 500 to avoid query-string limits.
 */
async function countPushEligible(userIds) {
  if (!userIds.length) return 0;
  const CHUNK = 500;
  const seen = new Set();
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const { data } = await supabaseAdmin
      .from('express_push_subscriptions')
      .select('user_id')
      .eq('type', 'expo')
      .not('expo_token', 'is', null)
      .in('user_id', chunk);
    if (data) data.forEach((r) => seen.add(r.user_id));
  }
  return seen.size;
}

// ---------------------------------------------------------------------------
// GET  — history list  OR  ?count_only=1&audience=X  → { count }
// ---------------------------------------------------------------------------

export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // Count-only mode (for confirmation dialog)
  if (searchParams.get('count_only') === '1') {
    const audience = searchParams.get('audience') || 'all';
    const users = await queryAudience(audience);
    return NextResponse.json({ count: users.length });
  }

  // Default: recent broadcast history
  const { data, error } = await supabaseAdmin
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Correct zombie rows: status='sending' with started_at > 10 minutes ago
  const TEN_MIN = 10 * 60 * 1000;
  const corrected = (data || []).map((row) => {
    if (
      row.status === 'sending' &&
      row.started_at &&
      Date.now() - new Date(row.started_at).getTime() > TEN_MIN
    ) {
      return { ...row, status: 'failed' };
    }
    return row;
  });

  return NextResponse.json({ data: corrected });
}

// ---------------------------------------------------------------------------
// POST — send broadcast
// ---------------------------------------------------------------------------

export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  let broadcastId = null;

  try {
    const { title, message, audience } = await request.json();

    if (!title || !message || !audience) {
      return NextResponse.json({ error: 'title, message, and audience are required' }, { status: 400 });
    }
    if (!['drivers', 'customers', 'all', 'test'].includes(audience)) {
      return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
    }

    // Step 2: Query audience
    const users = await queryAudience(audience);
    if (users.length === 0) {
      return NextResponse.json({ error: 'No users match this audience' }, { status: 400 });
    }

    // Step 3: Duplicate guard — same (title, message, audience) within last 2 minutes
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: dup } = await supabaseAdmin
      .from('broadcasts')
      .select('id')
      .eq('title', title)
      .eq('message', message)
      .eq('audience', audience)
      .gte('created_at', twoMinAgo)
      .limit(1);

    if (dup && dup.length > 0) {
      return NextResponse.json({ error: 'A identical broadcast was just sent' }, { status: 409 });
    }

    // Step 4: Count push-eligible users
    const userIds = users.map((u) => u.id);
    const pushEligibleCount = await countPushEligible(userIds);

    // Step 5: Pre-INSERT broadcast record before sending
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('broadcasts')
      .insert({
        admin_id: session.userId,
        title,
        message,
        audience,
        status: 'sending',
        total_count: users.length,
        push_eligible_count: pushEligibleCount,
        sent_count: 0,
        failed_count: 0,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      console.error('[broadcast] pre-insert failed:', insertErr?.message);
      return NextResponse.json({ error: 'Failed to create broadcast record' }, { status: 500 });
    }

    broadcastId = inserted.id;

    // Step 6: Dispatch in batches with time budget
    const BATCH_SIZE = 20;
    const TIME_BUDGET_MS = 45_000;
    const loopStart = Date.now();
    let sentCount = 0;
    let failedCount = 0;
    let timedOut = false;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      // Check time budget before starting next batch
      if (Date.now() - loopStart > TIME_BUDGET_MS) {
        timedOut = true;
        break;
      }

      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((u) =>
          notify(u.id, {
            type: 'account',
            category: 'account_alerts',
            title,
            message,
            inApp: true,
            push: true,
          }),
        ),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') sentCount++;
        else {
          failedCount++;
          console.error('[broadcast] notify failed:', r.reason?.message || r.reason);
        }
      }

      // Update progress after each batch
      await supabaseAdmin
        .from('broadcasts')
        .update({ sent_count: sentCount, failed_count: failedCount })
        .eq('id', broadcastId);
    }

    // Step 6b: Handle time budget exceeded
    if (timedOut) {
      const errorMsg = `time budget exceeded after ${sentCount + failedCount} users`;
      await supabaseAdmin
        .from('broadcasts')
        .update({
          status: 'partial',
          sent_count: sentCount,
          failed_count: failedCount,
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq('id', broadcastId);

      return NextResponse.json({
        broadcast_id: broadcastId,
        status: 'partial',
        sent_count: sentCount,
        failed_count: failedCount,
        total: users.length,
        push_eligible_count: pushEligibleCount,
      });
    }

    // Step 7: Normal completion
    await supabaseAdmin
      .from('broadcasts')
      .update({
        status: 'completed',
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', broadcastId);

    return NextResponse.json({
      broadcast_id: broadcastId,
      status: 'completed',
      sent_count: sentCount,
      failed_count: failedCount,
      total: users.length,
      push_eligible_count: pushEligibleCount,
    });
  } catch (err) {
    console.error('[broadcast] error:', err);

    // Step 8: Mark as failed — wrap in try/catch so original error is preserved
    if (broadcastId) {
      try {
        await supabaseAdmin
          .from('broadcasts')
          .update({
            status: 'failed',
            error_message: err.message || 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', broadcastId);
      } catch (updateErr) {
        console.error('[broadcast] failed to update status:', updateErr.message);
      }
    }

    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
