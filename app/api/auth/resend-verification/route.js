import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { rateLimit } from '../../../../lib/rate-limit';
import { sendEmail } from '../../../../lib/email';

const resendLimiter = rateLimit({ interval: 3600000, maxRequests: 3, name: 'resend-verification' });

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success: allowed } = resendLimiter.check(session.userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many resend attempts. Please try again later.' }, { status: 429 });
    }

    // Check user isn't already verified
    const { data: user, error } = await supabaseAdmin
      .from('express_users')
      .select('id, email, is_verified')
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.is_verified) {
      return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
    }

    // Generate new code
    const verification_code = String(crypto.randomInt(100000, 999999));
    const verification_code_expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('express_users')
      .update({ verification_code, verification_code_expires })
      .eq('id', session.userId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to generate new code' }, { status: 500 });
    }

    // Send email
    await sendEmail(
      user.email,
      'Verify your email - TCG Express',
      `<h2>Email Verification</h2><p>Your new verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:20px;background:#f8fafc;border-radius:10px;margin:16px 0">${verification_code}</div><p>This code expires in 15 minutes.</p><p>If you did not sign up for TCG Express, please ignore this email.</p>`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
