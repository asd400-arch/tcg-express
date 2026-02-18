import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(request) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();
    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('express_users')
      .select('id, password_hash')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password (supports bcrypt + legacy plain-text)
    let passwordValid = false;
    if (user.password_hash.startsWith('$2')) {
      passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
    } else {
      passwordValid = user.password_hash === currentPassword;
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    const { error: updateErr } = await supabaseAdmin
      .from('express_users')
      .update({ password_hash: hashed })
      .eq('id', userId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
