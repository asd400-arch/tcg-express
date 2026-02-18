import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

const ALLOWED_FIELDS = {
  client: ['contact_name', 'phone', 'company_name'],
  driver: ['contact_name', 'phone', 'vehicle_type', 'vehicle_plate', 'license_number'],
  admin: ['contact_name', 'phone'],
};

export async function POST(request) {
  try {
    const { userId, updates } = await request.json();
    if (!userId || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'userId and updates required' }, { status: 400 });
    }

    // Look up user to get role
    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('express_users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Whitelist fields based on role
    const allowed = ALLOWED_FIELDS[user.role] || [];
    const filtered = {};
    for (const key of allowed) {
      if (key in updates) {
        filtered[key] = updates[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('express_users')
      .update(filtered)
      .eq('id', userId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    const { password_hash, reset_code, reset_code_expires, ...safeUser } = updated;
    return NextResponse.json({ data: safeUser });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
