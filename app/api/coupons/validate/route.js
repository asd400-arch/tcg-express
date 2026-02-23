import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, orderAmount } = await request.json();
    if (!code) return NextResponse.json({ error: 'Coupon code required' }, { status: 400 });

    const { data: promo } = await supabaseAdmin
      .from('promo_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (!promo) return NextResponse.json({ error: 'Invalid coupon code' }, { status: 404 });

    const now = new Date();
    if (promo.valid_until && new Date(promo.valid_until) < now) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 });
    }
    if (promo.valid_from && new Date(promo.valid_from) > now) {
      return NextResponse.json({ error: 'Coupon is not yet active' }, { status: 400 });
    }
    if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
      return NextResponse.json({ error: 'Coupon usage limit reached' }, { status: 400 });
    }
    if (promo.min_order_amount && orderAmount && parseFloat(orderAmount) < parseFloat(promo.min_order_amount)) {
      return NextResponse.json({ error: `Minimum order $${promo.min_order_amount} required` }, { status: 400 });
    }

    let discount = 0;
    if (orderAmount) {
      const amt = parseFloat(orderAmount);
      if (promo.discount_type === 'percentage') {
        discount = amt * (parseFloat(promo.discount_value) / 100);
        if (promo.max_discount) discount = Math.min(discount, parseFloat(promo.max_discount));
      } else {
        discount = parseFloat(promo.discount_value);
      }
      discount = Math.min(discount, amt);
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        code: promo.code,
        type: promo.discount_type,
        value: promo.discount_value,
        description: promo.description,
        min_order: promo.min_order_amount,
      },
      discount: discount.toFixed(2),
    });
  } catch (err) {
    console.error('POST /api/coupons/validate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
