import { Expo } from 'expo-server-sdk';

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

  const results = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      results.push(...ticketChunk);
    } catch (err) {
      console.error('Expo push error:', err);
    }
  }

  return results;
}
