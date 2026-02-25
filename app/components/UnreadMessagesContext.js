'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';

const UnreadMessagesContext = createContext({ unreadByJob: {}, totalUnread: 0, markJobRead: () => {}, setActiveChat: () => {} });

const STORAGE_KEY = 'tcg_msg_read_at';

function getReadTimestamps() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1046, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

export function UnreadMessagesProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [unreadByJob, setUnreadByJob] = useState({});
  const channelRef = useRef(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const activeChatJobRef = useRef(null);

  const userId = user?.id;
  const totalUnread = Object.values(unreadByJob).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!userId) return;

    // Load initial unread counts
    (async () => {
      const timestamps = getReadTimestamps();
      const { data } = await supabase
        .from('express_messages')
        .select('id, job_id, created_at')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false });

      if (!data) return;

      const counts = {};
      data.forEach(msg => {
        const lastRead = timestamps[msg.job_id];
        if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
          counts[msg.job_id] = (counts[msg.job_id] || 0) + 1;
        }
      });
      setUnreadByJob(counts);
    })();

    // Subscribe to new messages for this user
    const channel = supabase
      .channel(`unread-msgs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'express_messages',
        filter: `receiver_id=eq.${userId}`,
      }, async (payload) => {
        const msg = payload.new;

        // Update unread count
        setUnreadByJob(prev => ({
          ...prev,
          [msg.job_id]: (prev[msg.job_id] || 0) + 1,
        }));

        // Skip toast/sound/notification if user is viewing this chat
        const isActiveChat = activeChatJobRef.current === msg.job_id;

        if (!isActiveChat) {
          // Fetch sender name for notification
          const { data: sender } = await supabase
            .from('express_users')
            .select('contact_name')
            .eq('id', msg.sender_id)
            .single();
          const name = sender?.contact_name || 'Someone';
          const preview = msg.content?.substring(0, 60) + (msg.content?.length > 60 ? '...' : '');

          // Toast
          toastRef.current?.info(`${name}: ${preview}`);

          // Browser notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`Message from ${name}`, {
                body: msg.content?.substring(0, 100),
                icon: '/icons/icon-192.svg',
                tag: `msg-${msg.job_id}`,
              });
            } catch {}
          }

          // Sound
          playNotificationSound();
        }
      })
      .subscribe();

    channelRef.current = channel;

    // Request notification permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [userId]);

  const markJobRead = useCallback((jobId) => {
    const timestamps = getReadTimestamps();
    timestamps[jobId] = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
    setUnreadByJob(prev => {
      const updated = { ...prev };
      delete updated[jobId];
      return updated;
    });
  }, []);

  const setActiveChat = useCallback((jobId) => {
    activeChatJobRef.current = jobId;
  }, []);

  return (
    <UnreadMessagesContext.Provider value={{ unreadByJob, totalUnread, markJobRead, setActiveChat }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
}

export function useUnreadMessages() {
  return useContext(UnreadMessagesContext);
}
