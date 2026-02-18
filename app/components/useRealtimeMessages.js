'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export default function useRealtimeMessages(jobId, userId) {
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    // Load existing messages
    const load = async () => {
      const { data } = await supabase
        .from('express_messages')
        .select('*, sender:sender_id(contact_name, role)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      // Mark as read
      if (userId) {
        await supabase.from('express_messages')
          .update({ is_read: true })
          .eq('job_id', jobId)
          .eq('receiver_id', userId)
          .eq('is_read', false);
      }
    };
    load();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'express_messages',
        filter: `job_id=eq.${jobId}`,
      }, async (payload) => {
        const newMsg = payload.new;
        // Fetch sender info
        const { data: sender } = await supabase
          .from('express_users')
          .select('contact_name, role')
          .eq('id', newMsg.sender_id)
          .single();
        newMsg.sender = sender;
        setMessages(prev => [...prev, newMsg]);
        if (newMsg.sender_id !== userId) {
          setUnread(prev => prev + 1);
          // Mark as read
          await supabase.from('express_messages')
            .update({ is_read: true })
            .eq('id', newMsg.id);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [jobId, userId]);

  const sendMessage = async (receiverId, content, type = 'text', attachmentUrl = null) => {
    if (!content.trim() && !attachmentUrl) return;
    const { error } = await supabase.from('express_messages').insert([{
      job_id: jobId,
      sender_id: userId,
      receiver_id: receiverId,
      content: content.trim() || (type === 'image' ? '📷 Photo' : '📎 File'),
      message_type: type,
      attachment_url: attachmentUrl,
    }]);
    return { error };
  };

  return { messages, unread, sendMessage, setUnread };
}
