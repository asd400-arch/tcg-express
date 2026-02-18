import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(request) {
  try {
    const { email, code, newPassword } = await request.json();
    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('express_users')
      .select('id, reset_code, reset_code_expires')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 });
    }

    if (!user.reset_code || user.reset_code !== code) {
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 });
    }

    if (new Date(user.reset_code_expires) < new Date()) {
      return NextResponse.json({ error: 'Reset code has expired' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    const { error: updateErr } = await supabaseAdmin
      .from('express_users')
      .update({ password_hash: hashed, reset_code: null, reset_code_expires: null })
      .eq('id', user.id);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
