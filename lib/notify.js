import { supabaseAdmin } from './supabase-server';
import { createNotification } from './notifications';
import { sendTemplateEmail } from './send-email';
import { sendPushToUser } from './web-push';

const DEFAULT_PREFS = {
  job_updates: { email: true, push: true },
  bid_activity: { email: true, push: true },
  delivery_status: { email: true, push: true },
  account_alerts: { email: true, push: true },
};

/**
 * Unified notification dispatch.
 * Checks user preferences, then fans out to in-app + email + push.
 *
 * @param {string} userId - target user ID
 * @param {object} opts
 * @param {string} opts.type - notification type for in-app (e.g. 'job', 'bid', 'delivery', 'dispute', 'account')
 * @param {string} opts.category - preference category: 'job_updates' | 'bid_activity' | 'delivery_status' | 'account_alerts'
 * @param {string} opts.title - notification title
 * @param {string} opts.message - notification body
 * @param {string} [opts.emailTemplate] - send-email template key (omit to skip email)
 * @param {object} [opts.emailData] - data for the email template
 * @param {string} [opts.url] - URL to open on push click
 */
export async function notify(userId, { type, category, title, message, emailTemplate, emailData, url }) {
  // Fetch user prefs + email in one query
  const { data: user } = await supabaseAdmin
    .from('express_users')
    .select('email, notification_preferences')
    .eq('id', userId)
    .single();

  const prefs = user?.notification_preferences || DEFAULT_PREFS;
  const catPrefs = prefs[category] || { email: true, push: true };

  // In-app: always send
  await createNotification(userId, type, title, message);

  // Email: send if preference enabled + template provided + user has email
  if (catPrefs.email && emailTemplate && user?.email) {
    sendTemplateEmail(user.email, emailTemplate, emailData || {}).catch(() => {});
  }

  // Push: send if preference enabled
  if (catPrefs.push) {
    sendPushToUser(userId, { title, body: message, url: url || '/' }).catch(() => {});
  }
}
