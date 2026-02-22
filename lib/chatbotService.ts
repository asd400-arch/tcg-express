// ============================================================
// Chatbot Service - AI chatbot with FAQ knowledge base
// Uses Claude API + Supabase service role client
// ============================================================

import { supabaseAdmin } from './supabase-server';
import { HELP_CONSTANTS } from '@/types/help';
import type {
  FaqArticle,
  FaqCategory,
  ChatMessage,
  ChatbotSession,
  ChatResponse,
  TicketCreateRequest,
  SupportTicket,
  TargetAudience,
} from '@/types/help';

// ============================================================
// Constants
// ============================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CHAT_MODEL = 'claude-sonnet-4-20250514';
const CHAT_MAX_TOKENS = 1024;
const SUMMARY_MAX_TOKENS = 256;
const MAX_HISTORY_MESSAGES = 10;

const ESCALATION_KEYWORDS = [
  'human agent',
  'speak to someone',
  'talk to a person',
  'real person',
  'complaint',
  'complain',
  'refund',
  'urgent',
  'emergency',
  'escalate',
  'manager',
  'supervisor',
  'unacceptable',
  'lawsuit',
  'legal',
];

const ESCALATION_MESSAGE_THRESHOLD = 16;

const SYSTEM_PROMPT = `You are TCG Express Support Assistant, the AI helper for TCG Express — a B2B technology delivery platform operating in Singapore.

Key Facts:
- TCG Express provides on-demand and scheduled delivery services for businesses
- 9 vehicle types: Motorcycle, Car, MPV, Small Van, Large Van, 10ft Lorry, 14ft Lorry, 24ft Lorry, Refrigerated
- Payment: PayNow (free, QR-based) and credit/debit card via Stripe; wallet system for fast checkout
- Drivers earn 85% of each fare (15% platform commission); EV drivers earn 90% (10% commission)
- EV Incentives: 5% commission discount, Green Points rewards, priority matching
- SaveMode: consolidate multiple deliveries into one trip, saving 20-30% on costs
- Green Points: earned per delivery, redeemable for rewards and discounts
- Liability: capped compensation schedule from 100% (items ≤$50) up to max $1,000 for high-value items
- Support: ${HELP_CONSTANTS.SUPPORT_EMAIL}, ${HELP_CONSTANTS.SUPPORT_HOURS}

Guidelines:
- Keep responses under 200 words
- Use markdown formatting for clarity
- Base answers on the FAQ context provided — do not invent information
- If FAQ context is relevant, cite the key points; if not, provide general guidance
- For specific order issues, payment disputes, or account-specific problems, suggest the user create a support ticket or speak to a human agent
- Respond in the same language the user writes in
- Be friendly, professional, and concise`;

const FALLBACK_REPLY =
  "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment, or contact our support team at " +
  HELP_CONSTANTS.SUPPORT_EMAIL +
  ' for immediate assistance.';

// ============================================================
// 1. searchFaqArticles
// ============================================================

export async function searchFaqArticles(query: string): Promise<FaqArticle[]> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return [];

  // Build OR conditions: keywords overlap + question/answer ilike match
  const ilikeClauses = words.map((w) => `question.ilike.%${w}%,answer.ilike.%${w}%`).join(',');

  // Search by keywords array overlap
  const { data: keywordMatches } = await supabaseAdmin
    .from('faq_articles')
    .select('*')
    .eq('is_active', true)
    .overlaps('keywords', words)
    .limit(5);

  // Search by question/answer text match
  const { data: textMatches } = await supabaseAdmin
    .from('faq_articles')
    .select('*')
    .eq('is_active', true)
    .or(ilikeClauses)
    .limit(5);

  // Merge and deduplicate, keyword matches first
  const seen = new Set<string>();
  const results: FaqArticle[] = [];

  for (const article of [...(keywordMatches || []), ...(textMatches || [])]) {
    if (!seen.has(article.id)) {
      seen.add(article.id);
      results.push(article as FaqArticle);
    }
    if (results.length >= 5) break;
  }

  return results;
}

// ============================================================
// 2. buildFaqContext
// ============================================================

export function buildFaqContext(articles: FaqArticle[]): string {
  if (articles.length === 0) return '';

  const blocks = articles.map(
    (article, i) =>
      `--- FAQ ${i + 1}: ${article.question} ---\n${article.ai_context || article.answer}\n`
  );

  return `Here are relevant FAQ articles for context:\n\n${blocks.join('\n')}`;
}

// ============================================================
// 3. getOrCreateSession
// ============================================================

export async function getOrCreateSession(
  sessionId?: string,
  userId?: string
): Promise<ChatbotSession> {
  // Try to fetch existing session
  if (sessionId) {
    const { data: session } = await supabaseAdmin
      .from('chatbot_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (session) return session as ChatbotSession;
  }

  // Create new session
  const { data: newSession, error } = await supabaseAdmin
    .from('chatbot_sessions')
    .insert({
      user_id: userId || null,
      messages: [],
      message_count: 0,
    })
    .select('*')
    .single();

  if (error || !newSession) {
    throw new Error(`Failed to create chatbot session: ${error?.message}`);
  }

  return newSession as ChatbotSession;
}

// ============================================================
// 4. updateSession
// ============================================================

export async function updateSession(
  sessionId: string,
  messages: ChatMessage[],
  topics?: string[]
): Promise<void> {
  const updates: Record<string, unknown> = {
    messages: messages,
    message_count: messages.length,
    last_message_at: new Date().toISOString(),
  };

  if (topics && topics.length > 0) {
    updates.topics = topics;
  }

  const { error } = await supabaseAdmin
    .from('chatbot_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) {
    console.error('Failed to update chatbot session:', error.message);
  }
}

// ============================================================
// 5. processChat
// ============================================================

export async function processChat(
  userMessage: string,
  sessionId?: string,
  userId?: string
): Promise<ChatResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  // Get or create session
  const session = await getOrCreateSession(sessionId, userId);

  // Search FAQ for relevant articles
  const articles = await searchFaqArticles(userMessage);
  const faqContext = buildFaqContext(articles);

  // Build message history (last N messages from session)
  const history = (session.messages || []).slice(-MAX_HISTORY_MESSAGES);

  // Build Claude API messages array
  const apiMessages: { role: string; content: string }[] = [];

  // Add conversation history
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current user message with FAQ context
  const userContent = faqContext
    ? `${userMessage}\n\n[FAQ Context for AI — do not repeat verbatim to user]\n${faqContext}`
    : userMessage;

  apiMessages.push({ role: 'user', content: userContent });

  // Call Claude API
  let reply: string;
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: CHAT_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Claude API error:', response.status, errorBody);
      reply = FALLBACK_REPLY;
    } else {
      const data = await response.json();
      reply =
        data.content?.[0]?.type === 'text'
          ? data.content[0].text
          : FALLBACK_REPLY;
    }
  } catch (err) {
    console.error('Claude API request failed:', err);
    reply = FALLBACK_REPLY;
  }

  // Check escalation triggers
  const lowerMessage = userMessage.toLowerCase();
  const keywordEscalation = ESCALATION_KEYWORDS.some((kw) => lowerMessage.includes(kw));
  const lengthEscalation = (session.message_count || 0) + 2 >= ESCALATION_MESSAGE_THRESHOLD;
  const suggestEscalation = keywordEscalation || lengthEscalation;

  // Build updated messages
  const now = new Date().toISOString();
  const updatedMessages: ChatMessage[] = [
    ...history,
    {
      role: 'user' as const,
      content: userMessage,
      timestamp: now,
      sources: [],
    },
    {
      role: 'assistant' as const,
      content: reply,
      timestamp: now,
      sources: articles.map((a) => a.slug),
    },
  ];

  // Extract topics from matched articles
  const topics = articles
    .map((a) => a.category_id)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // Save to session
  await updateSession(session.id, updatedMessages, topics);

  return {
    reply,
    session_id: session.id,
    sources: articles,
    suggest_escalation: suggestEscalation,
  };
}

// ============================================================
// 6. createSupportTicket
// ============================================================

export async function createSupportTicket(
  params: TicketCreateRequest & { user_id: string }
): Promise<SupportTicket> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // If chat_session_id provided, fetch chat history and generate AI summary
  let chatHistory: ChatMessage[] = [];
  let aiSummary: string | null = null;

  if (params.chat_session_id) {
    const { data: session } = await supabaseAdmin
      .from('chatbot_sessions')
      .select('*')
      .eq('id', params.chat_session_id)
      .single();

    if (session) {
      chatHistory = (session.messages as ChatMessage[]) || [];

      // Generate AI summary of conversation
      if (apiKey && chatHistory.length > 0) {
        try {
          const conversationText = chatHistory
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n');

          const response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: CHAT_MODEL,
              max_tokens: SUMMARY_MAX_TOKENS,
              system:
                'Summarize this customer support conversation in 2-3 concise sentences. Focus on the issue, what was discussed, and the current status. Do not include greetings.',
              messages: [{ role: 'user', content: conversationText }],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            aiSummary =
              data.content?.[0]?.type === 'text'
                ? data.content[0].text
                : null;
          }
        } catch (err) {
          console.error('Failed to generate AI summary:', err);
        }
      }
    }
  }

  // Create the support ticket (ticket_number auto-generated by DB trigger)
  const { data: ticket, error } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      user_id: params.user_id,
      subject: params.subject,
      description: params.description,
      category: params.category || 'general',
      priority: params.priority || 'normal',
      contact_email: params.contact_email || null,
      chat_history: chatHistory.length > 0 ? chatHistory : [],
      ai_summary: aiSummary,
    })
    .select('*')
    .single();

  if (error || !ticket) {
    throw new Error(`Failed to create support ticket: ${error?.message}`);
  }

  // Create initial support message with the description
  await supabaseAdmin.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_type: 'user',
    sender_id: params.user_id,
    message: params.description,
  });

  // If from a chat session, mark session as escalated
  if (params.chat_session_id) {
    await supabaseAdmin
      .from('chatbot_sessions')
      .update({ escalated_to_ticket: ticket.id })
      .eq('id', params.chat_session_id);
  }

  return ticket as SupportTicket;
}

// ============================================================
// 7. getFaqCategories
// ============================================================

export async function getFaqCategories(
  audience?: TargetAudience
): Promise<(FaqCategory & { article_count: number })[]> {
  let query = supabaseAdmin
    .from('faq_categories')
    .select('*, faq_articles(count)')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (audience && audience !== 'all') {
    query = query.in('target_audience', ['all', audience]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch FAQ categories: ${error.message}`);
  }

  // Map the count from the nested relation
  return (data || []).map((cat: any) => ({
    ...cat,
    article_count: cat.faq_articles?.[0]?.count ?? 0,
    faq_articles: undefined,
  }));
}

// ============================================================
// 8. getArticlesByCategory
// ============================================================

export async function getArticlesByCategory(slug: string): Promise<FaqArticle[]> {
  // First get the category by slug
  const { data: category } = await supabaseAdmin
    .from('faq_categories')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!category) return [];

  const { data: articles, error } = await supabaseAdmin
    .from('faq_articles')
    .select('*')
    .eq('category_id', category.id)
    .eq('is_active', true)
    .order('is_pinned', { ascending: false })
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch articles: ${error.message}`);
  }

  return (articles || []) as FaqArticle[];
}

// ============================================================
// 9. getArticle
// ============================================================

export async function getArticle(slug: string): Promise<FaqArticle | null> {
  const { data: article, error } = await supabaseAdmin
    .from('faq_articles')
    .select('*, category:faq_categories(*)')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !article) return null;

  // Increment view_count (fire-and-forget)
  supabaseAdmin
    .from('faq_articles')
    .update({ view_count: (article.view_count || 0) + 1 })
    .eq('id', article.id)
    .then(() => {});

  return article as FaqArticle;
}

// ============================================================
// 10. rateArticle
// ============================================================

export async function rateArticle(articleId: string, helpful: boolean): Promise<void> {
  // Fetch current counts
  const { data: article, error: fetchError } = await supabaseAdmin
    .from('faq_articles')
    .select('helpful_count, not_helpful_count')
    .eq('id', articleId)
    .single();

  if (fetchError || !article) {
    throw new Error(`Article not found: ${fetchError?.message}`);
  }

  const update = helpful
    ? { helpful_count: (article.helpful_count || 0) + 1 }
    : { not_helpful_count: (article.not_helpful_count || 0) + 1 };

  const { error } = await supabaseAdmin
    .from('faq_articles')
    .update(update)
    .eq('id', articleId);

  if (error) {
    throw new Error(`Failed to rate article: ${error.message}`);
  }
}
