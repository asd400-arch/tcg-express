import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { sendEmail } from '../../../../lib/email';
import { rateLimit } from '../../../../lib/rate-limit';

const forgotLimiter = rateLimit({ interval: 3600000, maxRequests: 3, name: 'forgot-password' });

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({ success: true });

    // Rate limit by email
    const { success: allowed } = forgotLimiter.check(email.toLowerCase().trim());
    if (!allowed) {
      return successResponse; // Don't reveal rate limit to prevent enumeration
    }

    const { data: user } = await supabaseAdmin
      .from('express_users')
      .select('id, email, contact_name')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (!user) return successResponse;

    // Generate 6-digit code using crypto.randomInt
    const code = String(crypto.randomInt(100000, 999999));
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('express_users')
      .update({ reset_code: code, reset_code_expires: expires, reset_attempts: 0 })
      .eq('id', user.id);

    await sendEmail(
      user.email,
      'TCG Express — Password Reset Code',
      `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Password Reset</h2>
        <p>Hi ${user.contact_name || 'there'},</p>
        <p>Your password reset code is:</p>
        <div style="background: #f1f5f9; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #3b82f6;">${code}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
        <p style="color: #94a3b8; font-size: 12px;">— TCG Express</p>
      </div>`
    );

    return successResponse;
  } catch (err) {
    // Still return success to prevent enumeration
    return NextResponse.json({ success: true });
  }
}
