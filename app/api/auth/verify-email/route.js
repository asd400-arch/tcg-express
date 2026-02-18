import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession, createSession, setSessionCookie } from '../../../../lib/auth';
import { rateLimit } from '../../../../lib/rate-limit';

const verifyLimiter = rateLimit({ interval: 3600000, maxRequests: 10, name: 'verify-email' });

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success: allowed } = verifyLimiter.check(session.userId);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('express_users')
      .select('id, verification_code, verification_code_expires, is_verified, role, email')
      .eq('id', session.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.is_verified) {
      return NextResponse.json({ error: 'Email already verified' }, { status: 400 });
    }

    if (!user.verification_code || !user.verification_code_expires) {
      return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 });
    }

    if (new Date(user.verification_code_expires) < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    if (user.verification_code !== String(code).trim()) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Mark as verified and clear code
    const { error: updateError } = await supabaseAdmin
      .from('express_users')
      .update({ is_verified: true, verification_code: null, verification_code_expires: null })
      .eq('id', session.userId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
    }

    // Reissue session token with isVerified: true
    const newToken = await createSession({ id: user.id, role: user.role, email: user.email, is_verified: true });
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, newToken);
    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
