import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, orderAmount } = await request.json();
    if (!code) return NextResponse.json({ error: 'Coupon code required' }, { status: 400 });

    const { data: coupon } = await supabaseAdmin
      .from('express_coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!coupon) return NextResponse.json({ error: 'Invalid coupon code' }, { status: 404 });

    const now = new Date();
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 });
    }
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return NextResponse.json({ error: 'Coupon usage limit reached' }, { status: 400 });
    }
    if (coupon.min_order && orderAmount && parseFloat(orderAmount) < parseFloat(coupon.min_order)) {
      return NextResponse.json({ error: `Minimum order $${coupon.min_order} required` }, { status: 400 });
    }

    // Check if user already used
    const { count } = await supabaseAdmin
      .from('express_coupon_usages')
      .select('id', { count: 'exact' })
      .eq('coupon_id', coupon.id)
      .eq('user_id', session.userId);

    if (count > 0) {
      return NextResponse.json({ error: 'You have already used this coupon' }, { status: 400 });
    }

    let discount = 0;
    if (orderAmount) {
      const amt = parseFloat(orderAmount);
      if (coupon.type === 'percent') {
        discount = amt * (parseFloat(coupon.value) / 100);
        if (coupon.max_discount) discount = Math.min(discount, parseFloat(coupon.max_discount));
      } else {
        discount = parseFloat(coupon.value);
      }
      discount = Math.min(discount, amt);
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        description: coupon.description,
        min_order: coupon.min_order,
      },
      discount: discount.toFixed(2),
    });
  } catch (err) {
    console.error('POST /api/coupons/validate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
