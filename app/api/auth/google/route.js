import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { createSession, setSessionCookie } from '../../../../lib/auth';
import { rateLimit } from '../../../../lib/rate-limit';

// Google sign-in for BUSINESS CLIENTS only.
// Client sends the Google ID token (credential). We verify it with Google,
// then find-or-create the express_users row (role=client, already verified).
// Drivers must still register with documents (KYC) — Google login is refused for them.

const limiter = rateLimit({ interval: 60000, maxRequests: 20, name: 'google-login' });

const ALLOWED_AUD = [
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.GOOGLE_IOS_CLIENT_ID,
  process.env.GOOGLE_ANDROID_CLIENT_ID,
].filter(Boolean);

async function verifyGoogleIdToken(idToken) {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
  if (!res.ok) return null;
  const p = await res.json();
  if (!p || !p.sub || !p.email) return null;
  if (p.email_verified !== 'true' && p.email_verified !== true) return null;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) return null;
  if (ALLOWED_AUD.length && !ALLOWED_AUD.includes(p.aud)) return null;
  if (Number(p.exp) * 1000 < Date.now()) return null;
  return p;
}

function genReferral() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = 'TCG-';
  for (let i = 0; i < 4; i++) c += chars[crypto.randomInt(chars.length)];
  return c;
}

export async function POST(request) {
  try {
    if (!ALLOWED_AUD.length) {
      return NextResponse.json({ error: 'Google sign-in is not configured' }, { status: 503 });
    }
    const { credential, company_name, phone, referral_code } = await request.json();
    if (!credential) return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 });

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!limiter.check(ip).success) {
      return NextResponse.json({ error: 'Too many attempts. Please try again in a minute.' }, { status: 429 });
    }

    const g = await verifyGoogleIdToken(credential);
    if (!g) return NextResponse.json({ error: 'Google sign-in could not be verified' }, { status: 401 });

    const email = String(g.email).toLowerCase().trim();

    // Existing account?
    const { data: existing } = await supabaseAdmin
      .from('express_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    let user = existing;

    if (user) {
      if (user.role === 'driver') {
        return NextResponse.json({ error: 'Driver accounts sign in with email and password.' }, { status: 403 });
      }
      if (user.is_active === false) {
        return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
      }
      // Link Google + mark verified (Google already verified the address)
      const patch = { google_sub: g.sub };
      if (!user.is_verified) { patch.is_verified = true; patch.verification_code = null; patch.verification_code_expires = null; }
      if (!user.auth_provider) patch.auth_provider = user.password_hash ? 'password+google' : 'google';
      const { data: updated } = await supabaseAdmin.from('express_users').update(patch).eq('id', user.id).select().single();
      if (updated) user = updated;
    } else {
      // New business client
      let referral;
      for (let i = 0; i < 5; i++) {
        const cand = genReferral();
        const { data: dup } = await supabaseAdmin.from('express_users').select('id').eq('referral_code', cand).maybeSingle();
        if (!dup) { referral = cand; break; }
      }
      let referred_by = null;
      if (referral_code && /^[A-Za-z0-9-]{3,20}$/.test(referral_code)) {
        const { data: ref } = await supabaseAdmin.from('express_users').select('referral_code').eq('referral_code', referral_code.toUpperCase()).maybeSingle();
        if (ref) referred_by = ref.referral_code;
      }
      const { data: created, error } = await supabaseAdmin
        .from('express_users')
        .insert([{
          email,
          password_hash: null,
          auth_provider: 'google',
          google_sub: g.sub,
          role: 'client',
          contact_name: g.name || email.split('@')[0],
          company_name: (company_name || '').trim(),
          phone: (phone || '').trim(),
          is_verified: true,
          is_active: true,
          referral_code: referral || ('TCG-' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)),
          referred_by,
          locale: 'sg',
        }])
        .select()
        .single();
      if (error) {
        console.error('[google-login] insert failed:', error.message);
        return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
      }
      user = created;
    }

    const token = await createSession(user);
    const { password_hash, verification_code, verification_code_expires, reset_code, reset_code_expires, ...safeUser } = user;
    const response = NextResponse.json({ user: safeUser, token, isNew: !existing });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error('[google-login]', err?.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
