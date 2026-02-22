// ============================================================
// Help Center System - TypeScript Types
// ============================================================

// --- Union Types ---

export type TargetAudience = 'all' | 'customer' | 'driver';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

export type SenderType = 'user' | 'agent' | 'system';

export type ChatRole = 'user' | 'assistant' | 'system';

// --- Interfaces ---

export interface FaqCategory {
  id: string;
  slug: string;
  title: string;
  title_ko: string | null;
  description: string | null;
  icon: string | null;
  display_order: number;
  target_audience: TargetAudience;
  is_active: boolean;
  created_at: string;
  articles?: FaqArticle[];
  article_count?: number;
}

export interface FaqArticle {
  id: string;
  category_id: string;
  slug: string;
  question: string;
  question_ko: string | null;
  answer: string;
  answer_ko: string | null;
  keywords: string[] | null;
  ai_context: string | null;
  target_audience: TargetAudience;
  display_order: number;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  is_active: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  category?: FaqCategory;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  attachments: unknown[];
  chat_history: unknown[];
  ai_summary: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  satisfaction_rating: number | null;
  related_job_id: string | null;
  related_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  message: string;
  attachments: unknown[];
  is_internal: boolean;
  created_at: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: string;
  sources: string[];
}

export interface ChatbotSession {
  id: string;
  user_id: string | null;
  session_token: string | null;
  messages: ChatMessage[];
  message_count: number;
  resolved: boolean;
  escalated_to_ticket: string | null;
  topics: string[] | null;
  satisfaction_rating: number | null;
  started_at: string;
  last_message_at: string;
  ended_at: string | null;
}

// --- API Types ---

export interface ChatRequest {
  message: string;
  session_id?: string;
}

export interface ChatResponse {
  reply: string;
  session_id: string;
  sources: FaqArticle[];
  suggest_escalation: boolean;
}

export interface TicketCreateRequest {
  subject: string;
  description: string;
  category?: string;
  priority?: TicketPriority;
  contact_email?: string;
  chat_session_id?: string;
}

export interface SearchResult {
  articles: FaqArticle[];
  query: string;
  total: number;
}

// --- Constants ---

export const HELP_CONSTANTS = {
  MAX_CHAT_MESSAGES: 20,
  MAX_MESSAGE_LENGTH: 2000,
  SUPPORT_EMAIL: 'support@techchainglobal.com',
  SUPPORT_HOURS: '9:00 AM - 6:00 PM SGT, Mon-Fri',
} as const;

export const TICKET_PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#64748b' },
  { value: 'normal', label: 'Normal', color: '#3b82f6' },
  { value: 'high', label: 'High', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];
