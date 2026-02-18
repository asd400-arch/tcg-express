import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { createSession, setSessionCookie } from '../../../../lib/auth';
import { rateLimit } from '../../../../lib/rate-limit';
import { sendEmail } from '../../../../lib/email';

const signupLimiter = rateLimit({ interval: 3600000, maxRequests: 5, name: 'signup' });

export async function POST(request) {
  try {
    const { email, password, ...rest } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const { success: allowed } = signupLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many signup attempts. Please try again later.' }, { status: 429 });
    }

    // Check for existing user
    const { data: existing } = await supabaseAdmin
      .from('express_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Hash password with bcrypt
    const password_hash = await bcrypt.hash(password, 12);

    // Generate verification code
    const verification_code = String(crypto.randomInt(100000, 999999));
    const verification_code_expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('express_users')
      .insert([{ email, password_hash, verification_code, verification_code_expires, is_verified: false, ...rest }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send verification email
    await sendEmail(
      email,
      'Verify your email - TCG Express',
      `<h2>Email Verification</h2><p>Your verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:20px;background:#f8fafc;border-radius:10px;margin:16px 0">${verification_code}</div><p>This code expires in 15 minutes.</p><p>If you did not sign up for TCG Express, please ignore this email.</p>`
    );

    // Strip sensitive fields before returning
    const { password_hash: _, verification_code: _vc, verification_code_expires: _vce, ...safeUser } = data;

    // Set session cookie for all roles (drivers need it for KYC upload flow)
    const token = await createSession(data);
    const response = NextResponse.json({ data: safeUser, requiresVerification: true });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
