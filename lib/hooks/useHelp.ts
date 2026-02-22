'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  FaqCategory,
  FaqArticle,
  ChatMessage,
  TicketCreateRequest,
  TargetAudience,
} from '@/types/help';

// ============================================================
// 1. useFaqCategories — Fetch FAQ categories with article counts
// ============================================================

export function useFaqCategories(audience?: TargetAudience) {
  const [categories, setCategories] = useState<(FaqCategory & { article_count: number })[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'categories' });
      if (audience) params.set('audience', audience);

      const res = await fetch(`/api/help?${params}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to fetch categories');
      setCategories(result.data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [audience]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { categories, loading, refetch };
}

// ============================================================
// 2. useFaqArticles — Fetch articles by category slug
// ============================================================

export function useFaqArticles(categorySlug: string | null) {
  const [articles, setArticles] = useState<FaqArticle[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!categorySlug) {
      setArticles([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'articles',
        category: categorySlug,
      });
      const res = await fetch(`/api/help?${params}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to fetch articles');
      setArticles(result.data);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [categorySlug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { articles, loading, refetch };
}

// ============================================================
// 3. useFaqSearch — Debounced FAQ search (300ms)
// ============================================================

export function useFaqSearch() {
  const [results, setResults] = useState<FaqArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);

    // Clear previous debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          action: 'search',
          q: trimmed,
        });
        const res = await fetch(`/api/help?${params}`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Search failed');
        setResults(result.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { results, loading, query, search };
}

// ============================================================
// 4. useChatbot — Full chat state management
// ============================================================

interface ChatMessageUI {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
}

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessageUI[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<FaqArticle[]>([]);
  const [suggestEscalation, setSuggestEscalation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      setError(null);

      // Add user message immediately for optimistic UI
      const userMsg: ChatMessageUI = {
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await fetch('/api/help/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            session_id: sessionId,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to send message');

        const { reply, session_id, sources: articleSources, suggest_escalation } = result.data;

        // Update session ID
        if (session_id) setSessionId(session_id);

        // Add assistant response
        const assistantMsg: ChatMessageUI = {
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
          sources: (articleSources || []).map((a: FaqArticle) => a.slug),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setSources(articleSources || []);
        setSuggestEscalation(suggest_escalation || false);
      } catch (err: any) {
        setError(err.message);
        // Remove the optimistic user message on failure
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [sessionId]
  );

  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setLoading(false);
    setSources([]);
    setSuggestEscalation(false);
    setError(null);
  }, []);

  return {
    messages,
    sessionId,
    loading,
    sources,
    suggestEscalation,
    error,
    sendMessage,
    resetChat,
  };
}

// ============================================================
// 5. useCreateTicket — Create support ticket
// ============================================================

export function useCreateTicket() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const createTicket = useCallback(
    async (params: TicketCreateRequest): Promise<string | null> => {
      setLoading(true);
      setError(null);
      setTicketNumber(null);
      try {
        const res = await fetch('/api/help/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to create ticket');
        const number = result.data.ticket_number;
        setTicketNumber(number);
        return number;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createTicket, loading, error, ticketNumber };
}
