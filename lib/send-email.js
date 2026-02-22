import { sendEmail } from './email';

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
  job_disputed: (data) => ({
    subject: `Dispute opened — ${data.jobNumber || 'Job'}`,
    html: `<h2>Dispute Opened</h2><p>A dispute has been opened on job <strong>${data.jobNumber}</strong> by <strong>${data.openerName || 'unknown'}</strong> (${data.openerRole || 'user'}).</p><p><strong>Reason:</strong> ${data.reason || 'Not specified'}</p><p><strong>Details:</strong> ${data.description || 'No details provided'}</p><p>The escrow has been frozen until an admin resolves this dispute.</p><p>— TCG Express</p>`,
  }),
  dispute_resolved: (data) => ({
    subject: `Dispute resolved — ${data.jobNumber || 'Job'}`,
    html: `<h2>Dispute Resolved</h2><p>The dispute on job <strong>${data.jobNumber}</strong> has been resolved.</p><p><strong>Outcome:</strong> ${data.resolution || 'Unknown'}</p>${data.adminNotes ? `<p><strong>Admin Notes:</strong> ${data.adminNotes}</p>` : ''}<p>— TCG Express</p>`,
  }),
};

export async function sendTemplateEmail(to, type, data) {
  const template = templates[type];
  if (!template) return;
  const { subject, html } = template(data || {});
  await sendEmail(to, subject, html);
}
