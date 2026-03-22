import { Resend } from 'resend';

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
  console.log('[email] Resend configured');
} else {
  console.warn('[email] RESEND_API_KEY not set — emails will not be sent');
}

export async function sendEmail(to, subject, html) {
  if (!resend) {
    console.error('[email] Cannot send email — Resend not configured (missing RESEND_API_KEY)');
    throw new Error('Email service not configured');
  }
  try {
    const result = await resend.emails.send({
      from: 'TCG Express <admin@techchainglobal.com>',
      to,
      subject,
      html,
    });
    console.log(`[email] Sent to ${to}: ${subject}`);
    return result;
  } catch (err) {
    console.error(`[email] Failed to send to ${to}:`, err.message);
    throw err;
  }
}
