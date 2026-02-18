import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(request) {
  try {
    const { email, password, ...rest } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
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

    const { data, error } = await supabaseAdmin
      .from('express_users')
      .insert([{ email, password_hash, ...rest }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Strip password_hash before returning
    const { password_hash: _, ...safeUser } = data;
    return NextResponse.json({ data: safeUser });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
