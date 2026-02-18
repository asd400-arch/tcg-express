import { supabaseAdmin } from './supabase-server';

export async function createNotification(userId, type, title, message, data = {}) {
  const { error } = await supabaseAdmin
    .from('express_notifications')
    .insert([{ user_id: userId, type, title, message, data, is_read: false }]);
  if (error) console.error('Notification error:', error.message);
}
