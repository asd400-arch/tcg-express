import webpush from 'web-push';
import { supabaseAdmin } from './supabase-server';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

let configured = false;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:admin@techchainglobal.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
  configured = true;
}

export async function sendPushToUser(userId, { title, body, url }) {
  if (!configured) return;

  const { data: subs } = await supabaseAdmin
    .from('express_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        // Update last_used_at on success
        await supabaseAdmin
          .from('express_push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err) {
        // 404 or 410 = subscription expired, clean it up
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabaseAdmin
            .from('express_push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
        throw err;
      }
    })
  );

  return results;
}
