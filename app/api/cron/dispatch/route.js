import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { runDispatchSweep } from '../../../../lib/dispatch';

/**
 * GET /api/cron/dispatch — one pass of the dispatch rules (boost nudges, "On my way" reminders,
 * automatic release of no-show drivers). See lib/dispatch.js.
 *
 * Called every 5 minutes by Supabase pg_cron (header x-dispatch-token = express_settings
 * 'dispatch_cron_token', see sql/2026-09-27-dispatch.sql) or by Vercel cron (Bearer CRON_SECRET).
 * Busy API routes also run a throttled sweep, so this is the backstop that keeps it on time.
 */

function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function authorized(req) {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && sameSecret(auth, `Bearer ${process.env.CRON_SECRET}`)) return true;

  const token = req.headers.get('x-dispatch-token') || '';
  if (token.length < 32) return false;
  const { data } = await supabaseAdmin
    .from('express_settings')
    .select('value')
    .eq('key', 'dispatch_cron_token')
    .maybeSingle();
  const raw = data?.value;
  const expected = typeof raw === 'string' ? raw.replace(/^"|"$/g, '') : raw != null ? String(raw) : '';
  return expected.length >= 32 && sameSecret(token, expected);
}

export async function GET(req) {
  try {
    if (!(await authorized(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await runDispatchSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('GET /api/cron/dispatch error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export const POST = GET;
