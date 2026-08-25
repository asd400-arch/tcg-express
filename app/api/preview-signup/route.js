import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { rateLimit } from '../../../lib/rate-limit';

const limiter = rateLimit({ interval: 60 * 1000, maxRequests: 5, name: 'preview-signup' });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const { success } = limiter.check(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const role = body.role === 'driver' ? 'driver' : 'customer';
    const company = String(body.company || '').trim().slice(0, 120) || null;
    const refCode = String(body.ref || '').trim().toUpperCase().slice(0, 32) || null;

    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('preview_signups')
      .upsert(
        { email, role, company, ref_code: refCode },
        { onConflict: 'email', ignoreDuplicates: false }
      );

    if (error) {
      console.error('[preview-signup] insert failed:', error.message);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[preview-signup] error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
