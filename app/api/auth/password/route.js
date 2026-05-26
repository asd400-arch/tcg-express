import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

async function changePassword(request) {
  const session = getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const currentPassword = body.current_password ?? body.currentPassword;
  const newPassword = body.new_password ?? body.newPassword;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  const { data: user, error: fetchErr } = await supabaseAdmin
    .from('express_users')
    .select('id, password_hash')
    .eq('id', session.userId)
    .single();

  if (fetchErr || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const passwordValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!passwordValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  const { error: updateErr } = await supabaseAdmin
    .from('express_users')
    .update({ password_hash: hashed })
    .eq('id', session.userId);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request) {
  try {
    return await changePassword(request);
  } catch (err) {
    console.error('PATCH /api/auth/password error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    return await changePassword(request);
  } catch (err) {
    console.error('POST /api/auth/password error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
