import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

const ALLOWED_FIELDS = ['driver_status', 'is_active'];
const ALLOWED_DRIVER_STATUSES = ['approved', 'rejected', 'suspended', 'pending'];

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, updates } = await request.json();

    if (!userId || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // Auto-verify driver on approval (admin reviewed KYC, email trust implicit)
    if (safeUpdates.driver_status === 'approved') {
      safeUpdates.is_verified = true;
      safeUpdates.verification_code = null;
      safeUpdates.verification_code_expires = null;
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
      if (safeUpdates.driver_status === 'approved') {
        notify(userId, {
          type: 'account', category: 'account_alerts',
          title: 'Account approved!',
          message: 'Your driver account has been approved. You can now accept jobs.',
          emailTemplate: 'driver_approved', emailData: {},
          url: '/driver/jobs',
        }).catch(() => {});
      } else if (safeUpdates.driver_status === 'rejected') {
        notify(userId, {
          type: 'account', category: 'account_alerts',
          title: 'Application update',
          message: 'Your driver application has been declined.',
          emailTemplate: 'driver_rejected', emailData: {},
          url: '/',
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
