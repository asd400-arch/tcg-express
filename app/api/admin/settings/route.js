import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

// GET — read settings (no auth required for reading commission rate)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('express_settings')
      .select('key, value');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert to key-value object
    const settings = {};
    (data || []).forEach(row => { settings[row.key] = row.value; });
    return NextResponse.json({ data: settings });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — update settings (admin only)
export async function POST(request) {
  try {
    const { adminId, key, value } = await request.json();

    if (!adminId || !key || value === undefined) {
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

    // Validate commission_rate
    if (key === 'commission_rate') {
      const rate = parseFloat(value);
      if (isNaN(rate) || rate < 0 || rate > 50) {
        return NextResponse.json({ error: 'Commission rate must be between 0 and 50' }, { status: 400 });
      }
    }

    const { error } = await supabaseAdmin
      .from('express_settings')
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
