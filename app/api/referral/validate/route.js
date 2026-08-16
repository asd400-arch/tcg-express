import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code || code.trim().length < 3) {
      return NextResponse.json({ valid: false });
    }

    const normalized = code.toUpperCase().trim();

    // 1) Check user referral code (TCG-XXXX)
    const { data: user } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, referral_code')
      .eq('referral_code', normalized)
      .maybeSingle();

    if (user) {
      return NextResponse.json({ valid: true, name: user.contact_name || 'TCG User', type: 'referral' });
    }

    // 2) Check promoter code (ZONE-Pnn) — ilike for case-insensitive match
    const { data: promoter } = await supabaseAdmin
      .from('promoters')
      .select('full_name, code')
      .ilike('code', normalized)
      .eq('is_active', true)
      .maybeSingle();

    if (promoter) {
      const firstName = (promoter.full_name || '').split(/\s+/)[0] || 'Promoter';
      return NextResponse.json({ valid: true, name: firstName, type: 'promoter' });
    }

    // 3) Check zone campaign code (promo_code or ref_code) — ilike for case-insensitive
    const { data: zone } = await supabaseAdmin
      .from('zone_campaign_zones')
      .select('zone_key')
      .or(`promo_code.ilike.${normalized},ref_code.ilike.${normalized}`)
      .limit(1)
      .maybeSingle();

    if (zone) {
      return NextResponse.json({ valid: true, name: zone.zone_key, type: 'campaign' });
    }

    return NextResponse.json({ valid: false });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
