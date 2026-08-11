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
  return NextResponse.json({ data });
}

// ---------------------------------------------------------------------------
// POST — send broadcast
// ---------------------------------------------------------------------------

export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { title, message, audience } = await request.json();

    if (!title || !message || !audience) {
      return NextResponse.json({ error: 'title, message, and audience are required' }, { status: 400 });
    }
    if (!['drivers', 'customers', 'all', 'test'].includes(audience)) {
      return NextResponse.json({ error: 'Invalid audience' }, { status: 400 });
    }

    const users = await queryAudience(audience);
    if (users.length === 0) {
      return NextResponse.json({ error: 'No users match this audience' }, { status: 400 });
    }

    // Dispatch in batches of 20 via Promise.allSettled
    const BATCH_SIZE = 20;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
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
    }

    // Record in broadcasts table
    await supabaseAdmin.from('broadcasts').insert({
      admin_id: session.userId,
      title,
      message,
      audience,
      sent_count: sentCount,
      failed_count: failedCount,
    });

    return NextResponse.json({ sent_count: sentCount, failed_count: failedCount, total: users.length });
  } catch (err) {
    console.error('[broadcast] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
