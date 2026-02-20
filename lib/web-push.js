import webpush from 'web-push';
import { supabaseAdmin } from './supabase-server';
import { sendExpoPush } from './expo-push';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

let configured = false;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(
      'mailto:admin@techchainglobal.com',
      VAPID_PUBLIC,
      VAPID_PRIVATE
    );
    configured = true;
  } catch (err) {
    console.error('Web push VAPID setup failed:', err.message);
  }
}

export async function sendPushToUser(userId, { title, body, url }) {
  const { data: subs } = await supabaseAdmin
    .from('express_push_subscriptions')
    .select('id, endpoint, p256dh, auth, type, expo_token')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return;

  // Split into web and expo subscriptions
  const webSubs = subs.filter(s => s.type !== 'expo');
  const expoSubs = subs.filter(s => s.type === 'expo' && s.expo_token);

  const results = [];

  // Send web push notifications
  if (configured && webSubs.length > 0) {
    const payload = JSON.stringify({ title, body, url });

    const webResults = await Promise.allSettled(
      webSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          await supabaseAdmin
            .from('express_push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id);
        } catch (err) {
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
    results.push(...webResults);
  }

  // Send Expo push notifications
  if (expoSubs.length > 0) {
    try {
      const expoMessages = expoSubs.map(sub => ({
        token: sub.expo_token,
        title,
        body,
        data: { url },
      }));
      const tickets = await sendExpoPush(expoMessages);

      // Update last_used_at for expo subs
      await Promise.allSettled(
        expoSubs.map(sub =>
          supabaseAdmin
            .from('express_push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id)
        )
      );

      results.push(...tickets.map(t => ({ status: 'fulfilled', value: t })));
    } catch (err) {
      results.push({ status: 'rejected', reason: err });
    }
  }

  return results;
}
