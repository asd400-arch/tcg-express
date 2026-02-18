import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { rateLimit } from '../../../../lib/rate-limit';

const resetLimiter = rateLimit({ interval: 3600000, maxRequests: 10, name: 'reset-password' });

export async function POST(request) {
  try {
    const { email, code, newPassword } = await request.json();
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Rate limit by email
    const { success: allowed } = resetLimiter.check(email.toLowerCase().trim());
    if (!allowed) {
      return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 });
    }

    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('express_users')
      .select('id, reset_code, reset_code_expires, reset_attempts')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 });
    }

    // Check if attempts exceeded (5 max)
    const attempts = (user.reset_attempts || 0) + 1;
    if (attempts > 5) {
      // Clear the code after 5 failed attempts
      await supabaseAdmin
        .from('express_users')
        .update({ reset_code: null, reset_code_expires: null, reset_attempts: 0 })
        .eq('id', user.id);
      return NextResponse.json({ error: 'Too many failed attempts. Please request a new code.' }, { status: 400 });
    }

    if (!user.reset_code || user.reset_code !== code) {
      // Increment attempt counter
      await supabaseAdmin
        .from('express_users')
        .update({ reset_attempts: attempts })
        .eq('id', user.id);
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 });
    }

    if (new Date(user.reset_code_expires) < new Date()) {
      return NextResponse.json({ error: 'Reset code has expired' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    const { error: updateErr } = await supabaseAdmin
      .from('express_users')
      .update({ password_hash: hashed, reset_code: null, reset_code_expires: null, reset_attempts: 0 })
      .eq('id', user.id);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
