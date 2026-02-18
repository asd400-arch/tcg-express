import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { createNotification } from '../../../../../lib/notifications';
import { sendEmail } from '../../../../../lib/email';

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

    // Send notifications for driver status changes
    if (safeUpdates.driver_status) {
      const { data: targetUser } = await supabaseAdmin
        .from('express_users')
        .select('id, email, contact_name')
        .eq('id', userId)
        .single();

      if (targetUser) {
        if (safeUpdates.driver_status === 'approved') {
          createNotification(userId, 'account', 'Account approved!', 'Your driver account has been approved. You can now accept jobs.').catch(() => {});
          if (targetUser.email) sendEmail(targetUser.email, 'Your driver account has been approved!', `<h2>Account Approved!</h2><p>Congratulations ${targetUser.contact_name}! Your TCG Express driver account has been approved.</p><p>You can now start accepting delivery jobs.</p><p>— TCG Express</p>`).catch(() => {});
        } else if (safeUpdates.driver_status === 'rejected') {
          createNotification(userId, 'account', 'Application update', 'Your driver application has been declined.').catch(() => {});
          if (targetUser.email) sendEmail(targetUser.email, 'Driver application update', `<h2>Application Update</h2><p>Hi ${targetUser.contact_name}, unfortunately your TCG Express driver application has been declined at this time.</p><p>If you believe this is an error, please contact support.</p><p>— TCG Express</p>`).catch(() => {});
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
