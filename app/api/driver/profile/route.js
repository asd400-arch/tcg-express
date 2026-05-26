import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

const ALLOWED_FIELDS = ['contact_name', 'phone', 'vehicle_plate'];

export async function PATCH(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Drivers only' }, { status: 403 });
    }

    const body = await request.json();
    const filtered = {};

    for (const key of ALLOWED_FIELDS) {
      if (key in body && body[key] !== undefined) {
        filtered[key] = body[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('express_users')
      .update(filtered)
      .eq('id', session.userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    const { password_hash, reset_code, reset_code_expires, verification_code, verification_code_expires, ...safeUser } = updated;
    return NextResponse.json({ data: safeUser });
  } catch (err) {
    console.error('PATCH /api/driver/profile error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
