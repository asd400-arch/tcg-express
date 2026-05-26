import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import { cleanString } from '../../../../lib/validate';

export async function PATCH(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'client') {
      return NextResponse.json({ error: 'Clients only' }, { status: 403 });
    }

    const body = await request.json();
    const updates = {};

    if (body.company_name != null) {
      updates.company_name = cleanString(body.company_name, 200);
    }
    if (body.contact_name != null) {
      updates.contact_name = cleanString(body.contact_name, 200);
    }
    if (body.phone != null) {
      updates.phone = cleanString(body.phone, 30);
    }
    if (body.billing_address != null) {
      updates.billing_address = cleanString(body.billing_address, 500);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('express_users')
      .update(updates)
      .eq('id', session.userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { password_hash, reset_code, reset_code_expires, verification_code, verification_code_expires, ...safeUser } = data;
    return NextResponse.json({ data: safeUser });
  } catch (err) {
    console.error('PATCH /api/client/profile error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
