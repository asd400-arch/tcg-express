import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

const ALLOWED_FIELDS = {
  client: ['contact_name', 'phone', 'company_name', 'notification_preferences'],
  driver: ['contact_name', 'phone', 'vehicle_type', 'vehicle_plate', 'license_number', 'driver_type', 'nric_number', 'business_reg_number', 'nric_front_url', 'nric_back_url', 'license_photo_url', 'business_reg_cert_url', 'vehicle_insurance_url', 'notification_preferences'],
  admin: ['contact_name', 'phone', 'notification_preferences'],
};

const VALID_PREF_CATEGORIES = ['job_updates', 'bid_activity', 'delivery_status', 'account_alerts'];

function validateNotificationPreferences(prefs) {
  if (typeof prefs !== 'object' || prefs === null || Array.isArray(prefs)) return false;
  for (const key of Object.keys(prefs)) {
    if (!VALID_PREF_CATEGORIES.includes(key)) return false;
    const val = prefs[key];
    if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
    if (typeof val.email !== 'boolean' || typeof val.push !== 'boolean') return false;
  }
  return true;
}

async function handleProfileUpdate(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // Support both { updates: {...} } (web) and flat body (mobile)
    const updates = body.updates || body;
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates required' }, { status: 400 });
    }

    // Look up user to get role
    const { data: user, error: fetchErr } = await supabaseAdmin
      .from('express_users')
      .select('id, role')
      .eq('id', session.userId)
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

    // Validate notification_preferences shape
    if ('notification_preferences' in filtered) {
      if (!validateNotificationPreferences(filtered.notification_preferences)) {
        return NextResponse.json({ error: 'Invalid notification preferences format' }, { status: 400 });
      }
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('express_users')
      .update(filtered)
      .eq('id', session.userId)
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

export async function POST(request) {
  return handleProfileUpdate(request);
}

export async function PUT(request) {
  return handleProfileUpdate(request);
}
