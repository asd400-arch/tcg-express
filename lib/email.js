import { Resend } from 'resend';

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

export async function sendEmail(to, subject, html) {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: 'TCG Express <admin@techchainglobal.com>',
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
}
