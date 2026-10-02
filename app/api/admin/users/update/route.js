import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { notify } from '../../../../../lib/notify';

const ALLOWED_FIELDS = ['driver_status', 'is_active', 'cross_border_ready', 'tcg_fleet'];
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
    }

    // Cross-border (Malaysia) verification: admin checked VEP RFID, Malaysia insurance cover, passport
    if ('cross_border_ready' in safeUpdates) {
      if (typeof safeUpdates.cross_border_ready !== 'boolean') {
        return NextResponse.json({ error: 'cross_border_ready must be boolean' }, { status: 400 });
      }
      safeUpdates.cross_border_verified_at = safeUpdates.cross_border_ready ? new Date().toISOString() : null;
    }

    // TCG Express fleet membership (2 Oct 2026): fleet-only jobs reach these drivers
    if ('tcg_fleet' in safeUpdates) {
      if (typeof safeUpdates.tcg_fleet !== 'boolean') {
        return NextResponse.json({ error: 'tcg_fleet must be boolean' }, { status: 400 });
      }
      safeUpdates.tcg_fleet_since = safeUpdates.tcg_fleet ? new Date().toISOString() : null;
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
        await notify(userId, {
          type: 'account', category: 'account_alerts',
          title: 'Account approved!',
          message: 'Your driver account has been approved. You can now accept jobs.',
          emailTemplate: 'driver_approved', emailData: {},
          url: '/driver/jobs',
        }).catch(() => {});
      } else if (safeUpdates.driver_status === 'rejected') {
        await notify(userId, {
          type: 'account', category: 'account_alerts',
          title: 'Application update',
          message: 'Your driver application has been declined.',
          emailTemplate: 'driver_rejected', emailData: {},
          url: '/',
        }).catch(() => {});
      }
    }

    // Tell the driver when cross-border quoting is switched on (app only)
    if (safeUpdates.cross_border_ready === true) {
      await notify(userId, {
        type: 'account', category: 'account_alerts',
        title: 'Cross-border runs unlocked 🇲🇾',
        message: 'You can now see and quote Singapore → Johor Bahru / Kuala Lumpur jobs. Keep your VEP RFID, Malaysia insurance and passport valid.',
        url: '/driver/jobs',
        data: { type: 'account', role: 'driver' },
      }).catch(() => {});
    }

    if (safeUpdates.tcg_fleet === true) {
      await notify(userId, {
        type: 'account', category: 'account_alerts',
        title: 'Welcome to the TCG Express fleet',
        message: 'You will now also get jobs booked for the TCG Express fleet. Customers can also book you directly with your driver code (see Settings).',
        url: '/driver/jobs',
        data: { type: 'account', role: 'driver' },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
