import { NextResponse } from 'next/server';
import { sendEmail } from '../../../../lib/email';

const templates = {
  bid_accepted: (data) => ({
    subject: `Your bid was accepted - ${data.jobNumber || 'Job'}`,
    html: `<h2>Bid Accepted!</h2><p>Your bid of <strong>$${data.amount}</strong> for job <strong>${data.jobNumber}</strong> has been accepted.</p><p>Please proceed to pickup at: ${data.pickupAddress || 'See app for details'}</p><p>— TCG Express</p>`,
  }),
  delivery_confirmed: (data) => ({
    subject: `Delivery confirmed - ${data.jobNumber || 'Job'}`,
    html: `<h2>Delivery Confirmed!</h2><p>The client has confirmed delivery for job <strong>${data.jobNumber}</strong>.</p><p>Your payout of <strong>$${data.payout}</strong> has been processed.</p><p>— TCG Express</p>`,
  }),
  driver_approved: (data) => ({
    subject: 'Your driver account has been approved!',
    html: `<h2>Account Approved!</h2><p>Congratulations! Your TCG Express driver account has been approved.</p><p>You can now start accepting delivery jobs.</p><p>— TCG Express</p>`,
  }),
  driver_rejected: (data) => ({
    subject: 'Driver application update',
    html: `<h2>Application Update</h2><p>Unfortunately, your TCG Express driver application has been declined at this time.</p><p>If you believe this is an error, please contact support.</p><p>— TCG Express</p>`,
  }),
  job_cancelled: (data) => ({
    subject: `Job cancelled - ${data.jobNumber || 'Job'}`,
    html: `<h2>Job Cancelled</h2><p>Job <strong>${data.jobNumber}</strong> has been cancelled by <strong>${data.cancelledBy || 'unknown'}</strong>.</p>${data.refundAmount ? `<p>Escrow of <strong>$${data.refundAmount}</strong> has been refunded.</p>` : ''}<p>— TCG Express</p>`,
  }),
};

export async function POST(request) {
  try {
    const { to, type, data } = await request.json();
    if (!to || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const template = templates[type];
    if (!template) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }
    const { subject, html } = template(data || {});
    await sendEmail(to, subject, html);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
