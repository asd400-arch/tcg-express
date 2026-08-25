import { NextResponse } from 'next/server';

export const maxDuration = 300;
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { sendEmail } from '../../../../lib/email';
import { requireAdmin } from '../../../../lib/auth';

const APP_STORE = 'https://apps.apple.com/sg/app/tcg-exress/id6785920144';
const PLAY_STORE = ''; // fill when live
const NAVY = '#070D1A';
const BLUE = '#2398EC';
const LIGHT = '#6EC8F5';

function shell(inner) {
  return `<div style="background:${NAVY};padding:32px 0;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#0C1B35;border-radius:16px;padding:32px;color:#e2e8f0">
    <div style="font-weight:800;font-size:22px;color:#fff;letter-spacing:.04em">TCG <span style="color:${LIGHT}">EXPRESS</span></div>
    ${inner}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);font-size:12px;color:#64748b">
      Tech Chain Global Pte. Ltd. · Singapore<br>
      Credits are promotional, apply to delivery fees, and are limited while the launch budget lasts.
    </div>
  </div></div>`;
}

const btn = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:${BLUE};color:#fff;font-weight:800;font-size:15px;padding:13px 22px;border-radius:10px;text-decoration:none">${label}</a>`;

function customerHtml(ref) {
  return shell(`
    <h1 style="font-size:26px;line-height:1.25;color:#fff;margin:18px 0 12px">We're live — your S$10 credit is waiting.</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px">Thanks for registering early. TCG Express is live in Singapore today: post a delivery job, receive competitive driver bids in minutes, track it door to door, and let the invoice generate itself.</p>
    <p style="margin:0 0 8px">${btn(`https://app.techchainglobal.com/signup?ref=${ref}`, 'Create your account')}</p>
    <p style="font-size:14px;line-height:1.7;margin:18px 0 0">
      • S$10 credit applied to your first delivery<br>
      • S$20 credit after your 3rd delivery, S$30 more after your 10th<br>
      • Refer another business — you both get S$20
    </p>
    <p style="font-size:14px;margin:18px 0 0">Download: <a href="${APP_STORE}" style="color:${LIGHT}">App Store</a>${PLAY_STORE ? ` · <a href="${PLAY_STORE}" style="color:${LIGHT}">Google Play</a>` : ''}</p>
    <p style="font-size:14px;margin:16px 0 0;color:#94a3b8">Questions? Just reply to this email. — Scott</p>`);
}

function driverHtml(ref) {
  return shell(`
    <h1 style="font-size:26px;line-height:1.25;color:#fff;margin:18px 0 12px">We're live — your 0% commission month starts now.</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 18px">You registered for driver preview access. The first-100 launch deal is active from today.</p>
    <p style="margin:0 0 8px">${btn(`https://app.techchainglobal.com/driver/register?ref=${ref}`, 'Register as a driver')}</p>
    <p style="font-size:14px;line-height:1.7;margin:18px 0 0">
      • 0% commission for your first 30 days — keep 100% of every delivery fee<br>
      • S$50 bonus after your first 5 completed deliveries<br>
      • Bid your own price on every job. Weekly payouts.
    </p>
    <p style="font-size:14px;margin:18px 0 0">Download: <a href="${APP_STORE}" style="color:${LIGHT}">App Store</a>${PLAY_STORE ? ` · <a href="${PLAY_STORE}" style="color:${LIGHT}">Google Play</a>` : ''}</p>
    <p style="font-size:14px;margin:16px 0 0;color:#94a3b8">First come, first served — bonuses end when the launch budget is used. — Scott</p>`);
}

// GET  ?preview=customer|driver  → returns rendered HTML (admin preview, sends nothing)
// GET  (no params)               → counts pending/sent
// POST { dry_run?: true, limit?: number, test_to?: "a@b.com" }
export async function GET(request) {
  const { error: authErr, status } = requireAdmin(request);
  if (authErr) return NextResponse.json({ error: authErr }, { status });

  const { searchParams } = new URL(request.url);
  const preview = searchParams.get('preview');
  if (preview) {
    const html = preview === 'driver' ? driverHtml('LAUNCH') : customerHtml('LAUNCH');
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  }

  const { data } = await supabaseAdmin.from('preview_signups').select('role, notified_at');
  const rows = data || [];
  return NextResponse.json({
    total: rows.length,
    pending: rows.filter(r => !r.notified_at).length,
    sent: rows.filter(r => r.notified_at).length,
    by_role: {
      customer: rows.filter(r => r.role === 'customer').length,
      driver: rows.filter(r => r.role === 'driver').length,
    },
  });
}

export async function POST(request) {
  const { error: authErr, status } = requireAdmin(request);
  if (authErr) return NextResponse.json({ error: authErr }, { status });

  const body = await request.json().catch(() => ({}));
  const { dry_run = false, limit = 500, test_to } = body;

  if (test_to) {
    await sendEmail(test_to, "We're live — TCG Express", customerHtml('LAUNCH'));
    await sendEmail(test_to, "We're live — TCG Express (driver)", driverHtml('LAUNCH'));
    return NextResponse.json({ ok: true, test_sent_to: test_to });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('preview_signups')
    .select('id, email, role, ref_code')
    .is('notified_at', null)
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (dry_run) return NextResponse.json({ dry_run: true, would_send: rows.length, rows: rows.map(r => ({ email: r.email, role: r.role })) });

  const sent = [];
  const failed = [];
  for (const r of rows) {
    const ref = r.ref_code || 'LAUNCH';
    try {
      await sendEmail(
        r.email,
        r.role === 'driver' ? "We're live — your 0% commission month starts now" : "We're live — your S$10 credit is waiting",
        r.role === 'driver' ? driverHtml(ref) : customerHtml(ref)
      );
      await supabaseAdmin.from('preview_signups').update({ notified_at: new Date().toISOString() }).eq('id', r.id);
      sent.push(r.email);
    } catch (e) {
      failed.push({ email: r.email, error: e.message });
    }
    await new Promise(res => setTimeout(res, 600)); // stay under Resend rate limit
  }
  return NextResponse.json({ sent: sent.length, failed });
}
