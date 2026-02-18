import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('express_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Support both bcrypt hashes and legacy plain-text passwords
    let passwordValid = false;
    if (user.password_hash.startsWith('$2')) {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy plain-text comparison — will be removed after migration
      passwordValid = user.password_hash === password;
    }

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    if (user.role === 'driver' && user.driver_status !== 'approved') {
      return NextResponse.json({ error: 'Driver account pending approval' }, { status: 403 });
    }

    // Strip password_hash before returning
    const { password_hash, ...safeUser } = user;
    return NextResponse.json({ data: safeUser });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
