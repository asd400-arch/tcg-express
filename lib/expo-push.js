import { Expo } from 'expo-server-sdk';
import { supabaseAdmin } from './supabase-server';

const expo = new Expo();

/**
 * Send push notifications via Expo Push API.
 * @param {Array<{ token: string, title: string, body: string, data?: object }>} messages
 */
export async function sendExpoPush(messages) {
  const validMessages = messages.filter(m => Expo.isExpoPushToken(m.token));

  if (validMessages.length === 0) return [];

  const chunks = expo.chunkPushNotifications(
    validMessages.map(m => ({
      to: m.token,
      sound: 'default',
      title: m.title,
      body: m.body,
      data: m.data || {},
    }))
  );

  // Keep a token→message map so we can look up the token for each ticket
  const tokenByIndex = validMessages.map(m => m.token);
  let ticketIndex = 0;

  const results = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

      // Inspect tickets for errors
      const staleTokens = [];
      for (const ticket of ticketChunk) {
        const token = tokenByIndex[ticketIndex++];
        if (ticket.status === 'error') {
          console.warn('[expo-push] Ticket error:', ticket.message, '| details:', ticket.details, '| token:', token);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            staleTokens.push(token);
          }
        } else if (ticket.status === 'ok') {
          console.log(`[expo-push] Ticket OK | receiptId: ${ticket.id} | token: ${token}`);
        }
      }

      // Remove stale tokens from both tables
      if (staleTokens.length > 0) {
        console.log('[expo-push] Removing stale tokens:', staleTokens);
        await Promise.allSettled([
          supabaseAdmin
            .from('express_push_subscriptions')
            .delete()
            .in('expo_token', staleTokens),
          supabaseAdmin
            .from('express_users')
            .update({ expo_push_token: null })
            .in('expo_push_token', staleTokens),
        ]);
      }

      results.push(...ticketChunk);
    } catch (err) {
      console.error('Expo push error:', err);
    }
  }

  return results;
}
