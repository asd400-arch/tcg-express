import { supabaseAdmin } from './supabase-server';

export async function createNotification(userId, type, title, message, referenceId) {
  const row = { user_id: userId, type, title, body: message || null, is_read: false };
  if (referenceId) row.reference_id = String(referenceId);
  const { error } = await supabaseAdmin
    .from('express_notifications')
    .insert([row]);
  if (error) console.error('Notification error:', error.message);
}
