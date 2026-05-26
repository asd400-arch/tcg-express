import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = (searchParams.get('code') || 'FIRSTCUSTOMER').toUpperCase().trim();

    const { data: promo } = await supabaseAdmin
      .from('promo_codes')
      .select('id, code, is_active')
      .eq('code', code)
      .single();

    if (!promo || !promo.is_active) {
      return NextResponse.json({ data: { code, available: false, used: true } });
    }

    const { count } = await supabaseAdmin
      .from('express_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', session.userId)
      .eq('coupon_id', promo.id);

    return NextResponse.json({
      data: {
        code,
        available: true,
        used: (count ?? 0) > 0,
      },
    });
  } catch (err) {
    console.error('GET /api/promo/check error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
