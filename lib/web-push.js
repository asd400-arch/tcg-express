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
    console.log('[web-push] VAPID configured successfully');
  } catch (err) {
    console.error('[web-push] VAPID setup failed:', err.message);
  }
} else {
  console.warn('[web-push] VAPID keys missing — NEXT_PUBLIC_VAPID_PUBLIC_KEY:', !!VAPID_PUBLIC, 'VAPID_PRIVATE_KEY:', !!VAPID_PRIVATE);
}

export async function sendPushToUser(userId, { title, body, url }) {
  const { data: subs, error: subsErr } = await supabaseAdmin
    .from('express_push_subscriptions')
    .select('id, endpoint, p256dh, auth, type, expo_token')
    .eq('user_id', userId);

  if (subsErr) {
    console.error(`[web-push] Error querying subscriptions for user ${userId}:`, subsErr.message);
    return [];
  }

  if (!subs || subs.length === 0) {
    console.log(`[web-push] No subscriptions found for user ${userId}`);
    return [];
  }

  console.log(`[web-push] Found ${subs.length} subscription(s) for user ${userId} — web: ${subs.filter(s => s.type !== 'expo').length}, expo: ${subs.filter(s => s.type === 'expo').length}`);

  // Split into web and expo subscriptions
  const webSubs = subs.filter(s => s.type !== 'expo');
  const expoSubs = subs.filter(s => s.type === 'expo' && s.expo_token);

  const results = [];

  // Send web push notifications
  if (!configured && webSubs.length > 0) {
    console.warn(`[web-push] VAPID not configured, skipping ${webSubs.length} web push(es) for user ${userId}`);
  }
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
    const webOk = webResults.filter(r => r.status === 'fulfilled').length;
    const webFail = webResults.filter(r => r.status === 'rejected').length;
    console.log(`[web-push] Web push results for user ${userId}: ${webOk} sent, ${webFail} failed`);
    webResults.filter(r => r.status === 'rejected').forEach(r => console.error(`[web-push] Web push error:`, r.reason?.message || r.reason));
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

      console.log(`[web-push] Expo push sent for user ${userId}: ${tickets.length} ticket(s)`);
      results.push(...tickets.map(t => ({ status: 'fulfilled', value: t })));
    } catch (err) {
      console.error(`[web-push] Expo push error for user ${userId}:`, err.message);
      results.push({ status: 'rejected', reason: err });
    }
  }

  return results;
}
