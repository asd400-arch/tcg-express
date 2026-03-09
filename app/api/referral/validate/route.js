import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    if (!code || code.trim().length < 4) {
      return NextResponse.json({ valid: false });
    }

    const { data: user } = await supabaseAdmin
      .from('express_users')
      .select('contact_name, referral_code')
      .eq('referral_code', code.toUpperCase().trim())
      .single();

    if (!user) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true, name: user.contact_name || 'TCG User' });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
