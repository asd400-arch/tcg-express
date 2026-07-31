import { createHmac } from 'crypto';

/**
 * Generate a deterministic, secret-keyed chat topic for a job.
 *
 * Format: chat:{jobId}:{hmacHex16}
 *
 * If CHAT_TOPIC_SECRET is not configured, logs an error and returns the
 * legacy topic (chat:{jobId}) so the system keeps working while the env
 * var is being rolled out.
 */
export function chatTopic(jobId) {
  const secret = process.env.CHAT_TOPIC_SECRET;
  if (!secret) {
    console.error('[chat-topic] CHAT_TOPIC_SECRET is not set — falling back to legacy topic');
    return `chat:${jobId}`;
  }
  const hex = createHmac('sha256', secret).update(String(jobId)).digest('hex').slice(0, 16);
  return `chat:${jobId}:${hex}`;
}

/** Inquiry-thread topic: deterministic per (jobId, driverId). */
export function inquiryChatTopic(jobId, driverId) {
  const secret = process.env.CHAT_TOPIC_SECRET;
  if (!secret) {
    console.error('[chat-topic] CHAT_TOPIC_SECRET is not set — falling back to legacy inquiry topic');
    return `inquiry:${jobId}:${driverId}`;
  }
  const hex = createHmac('sha256', secret)
    .update(`${jobId}:${driverId}`)
    .digest('hex')
    .slice(0, 16);
  return `inquiry:${jobId}:${driverId}:${hex}`;
}

/** Legacy topic kept for dual-publish during migration. */
export function legacyTopic(jobId) {
  return `chat:${jobId}`;
}
