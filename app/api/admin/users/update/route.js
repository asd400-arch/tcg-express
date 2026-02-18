import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';

const ALLOWED_FIELDS = ['driver_status', 'is_active'];
const ALLOWED_DRIVER_STATUSES = ['approved', 'rejected', 'suspended', 'pending'];

export async function POST(request) {
  try {
    const { adminId, userId, updates } = await request.json();

    if (!adminId || !userId || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify admin
    const { data: admin } = await supabaseAdmin
      .from('express_users')
      .select('id, role')
      .eq('id', adminId)
      .single();

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only allow whitelisted fields
    const safeUpdates = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate driver_status values
    if (safeUpdates.driver_status && !ALLOWED_DRIVER_STATUSES.includes(safeUpdates.driver_status)) {
      return NextResponse.json({ error: 'Invalid driver status' }, { status: 400 });
    }

    // Validate is_active is boolean
    if ('is_active' in safeUpdates && typeof safeUpdates.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be boolean' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('express_users')
      .update(safeUpdates)
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
