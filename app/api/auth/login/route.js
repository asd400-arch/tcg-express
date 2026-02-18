import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { createSession, setSessionCookie } from '../../../../lib/auth';
import { rateLimit } from '../../../../lib/rate-limit';

const loginLimiter = rateLimit({ interval: 60000, maxRequests: 5, name: 'login' });

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Rate limit by email
    const { success: allowed } = loginLimiter.check(email.toLowerCase().trim());
    if (!allowed) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again in a minute.' }, { status: 429 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('express_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Bcrypt only
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    if (user.role === 'driver' && user.driver_status !== 'approved') {
      const statusMessages = {
        pending: 'Your driver account is pending admin approval',
        rejected: 'Your driver application has been declined',
        suspended: 'Your driver account has been suspended',
      };
      const message = statusMessages[user.driver_status] || 'Driver account not approved';
      return NextResponse.json({ error: message }, { status: 403 });
    }

    // Create session and set cookie
    const token = await createSession(user);
    const { password_hash, ...safeUser } = user;
    const response = NextResponse.json({ data: safeUser });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
