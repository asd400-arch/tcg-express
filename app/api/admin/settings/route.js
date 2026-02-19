import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

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
    const session = getSession(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate commission_rate
    if (key === 'commission_rate') {
      const rate = parseFloat(value);
      if (isNaN(rate) || rate < 0 || rate > 50) {
        return NextResponse.json({ error: 'Commission rate must be between 0 and 50' }, { status: 400 });
      }
    }

    // Validate category_rates
    if (key === 'category_rates') {
      try {
        const rates = typeof value === 'string' ? JSON.parse(value) : value;
        if (typeof rates !== 'object' || rates === null || Array.isArray(rates)) {
          return NextResponse.json({ error: 'category_rates must be a JSON object' }, { status: 400 });
        }
        for (const [k, v] of Object.entries(rates)) {
          const num = parseFloat(v);
          if (isNaN(num) || num < 0 || num > 100000) {
            return NextResponse.json({ error: `Invalid rate for ${k}: must be 0-100000` }, { status: 400 });
          }
        }
      } catch {
        return NextResponse.json({ error: 'category_rates must be valid JSON' }, { status: 400 });
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
