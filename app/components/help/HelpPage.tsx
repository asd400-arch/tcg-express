'use client';

import React, { useState, useRef, useEffect } from 'react';
import useMobile from '../useMobile';
import { useFaqCategories, useFaqArticles, useFaqSearch, useChatbot, useCreateTicket } from '@/lib/hooks/useHelp';
import { HELP_CONSTANTS } from '@/types/help';
import type { FaqCategory, FaqArticle, TicketPriority } from '@/types/help';

// ============================================================
// Styles
// ============================================================

const font = "'Inter', sans-serif";

const s = {
  page: (m: boolean): React.CSSProperties => ({
    maxWidth: '900px',
    margin: '0 auto',
    padding: m ? '20px 16px' : '32px 24px',
    fontFamily: font,
  }),
  // Header
  header: (m: boolean): React.CSSProperties => ({
    textAlign: 'center' as const,
    marginBottom: m ? '24px' : '32px',
  }),
  title: (m: boolean): React.CSSProperties => ({
    fontSize: m ? '24px' : '32px',
    fontWeight: '800',
    color: '#1e293b',
    margin: '0 0 8px',
    fontFamily: font,
  }),
  subtitle: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#64748b',
    margin: 0,
    fontFamily: font,
  } as React.CSSProperties,
  // Search
  searchWrap: {
    position: 'relative' as const,
    marginBottom: '28px',
  } as React.CSSProperties,
  searchIcon: {
    position: 'absolute' as const,
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '18px',
    color: '#94a3b8',
    pointerEvents: 'none' as const,
  } as React.CSSProperties,
  searchInput: {
    width: '100%',
    padding: '14px 16px 14px 46px',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: '15px',
    fontWeight: '500',
    color: '#1e293b',
    outline: 'none',
    fontFamily: font,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    background: 'white',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    zIndex: 100,
    maxHeight: '320px',
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #f1f5f9',
    fontFamily: font,
  } as React.CSSProperties,
  // Category grid
  catGrid: (m: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: m ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
    gap: m ? '12px' : '16px',
    marginBottom: '28px',
  }),
  catCard: {
    background: 'white',
    borderRadius: '14px',
    padding: '20px 16px',
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transition: 'box-shadow 0.2s, border-color 0.2s',
    fontFamily: font,
  } as React.CSSProperties,
  catIcon: {
    fontSize: '28px',
    marginBottom: '8px',
  } as React.CSSProperties,
  catTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 4px',
    fontFamily: font,
  } as React.CSSProperties,
  catCount: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#94a3b8',
    margin: 0,
    fontFamily: font,
  } as React.CSSProperties,
  // Articles view
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: font,
    marginBottom: '16px',
  } as React.CSSProperties,
  catHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  } as React.CSSProperties,
  accordion: {
    background: 'white',
    borderRadius: '14px',
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    marginBottom: '10px',
    overflow: 'hidden',
    fontFamily: font,
  } as React.CSSProperties,
  accordionQ: (open: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '16px 18px',
    cursor: 'pointer',
    background: open ? '#f8fafc' : 'white',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    fontFamily: font,
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
  }),
  accordionA: {
    padding: '0 18px 18px',
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#475569',
    fontFamily: font,
  } as React.CSSProperties,
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9',
  } as React.CSSProperties,
  rateBtn: (active: boolean, color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '8px',
    border: active ? `1px solid ${color}` : '1px solid #e2e8f0',
    background: active ? (color === '#10b981' ? '#f0fdf4' : '#fef2f2') : 'white',
    color: active ? color : '#64748b',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: font,
  }),
  // Quick actions
  actionsGrid: (m: boolean): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: m ? '1fr' : 'repeat(3, 1fr)',
    gap: m ? '12px' : '16px',
    marginBottom: '28px',
  }),
  actionCard: (bg: string): React.CSSProperties => ({
    background: bg,
    borderRadius: '14px',
    padding: '20px',
    cursor: 'pointer',
    color: 'white',
    textAlign: 'center' as const,
    fontFamily: font,
    border: 'none',
    width: '100%',
  }),
  // Modal overlay
  overlay: (m: boolean): React.CSSProperties => ({
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: m ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: m ? '0' : '20px',
  }),
  modal: (m: boolean): React.CSSProperties => ({
    background: 'white',
    borderRadius: m ? '20px 20px 0 0' : '20px',
    padding: '0',
    maxWidth: '520px',
    width: '100%',
    maxHeight: m ? '92vh' : '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    overflow: 'hidden',
  }),
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid #f1f5f9',
  } as React.CSSProperties,
  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1e293b',
    margin: 0,
    fontFamily: font,
  } as React.CSSProperties,
  closeBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#64748b',
  } as React.CSSProperties,
  // Skeleton
  skeleton: (w: string, h: string): React.CSSProperties => ({
    width: w,
    height: h,
    borderRadius: '8px',
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  }),
};

// ============================================================
// Main HelpPage Component
// ============================================================

export default function HelpPage() {
  const m = useMobile();
  const { categories, loading: catLoading } = useFaqCategories();
  const { results, loading: searchLoading, query, search } = useFaqSearch();

  const [selectedCategory, setSelectedCategory] = useState<(FaqCategory & { article_count: number }) | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const showDropdown = searchFocused && query.trim().length > 0;

  return (
    <div style={s.page(m)}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={s.header(m)}>
        <h1 style={s.title(m)}>Help Center</h1>
        <p style={s.subtitle}>How can we help you today?</p>
      </div>

      {/* Search Bar */}
      <div style={s.searchWrap}>
        <span style={s.searchIcon}>&#128269;</span>
        <input
          type="text"
          placeholder="Search for help..."
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          style={s.searchInput}
        />
        {showDropdown && (
          <div style={s.dropdown}>
            {searchLoading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', fontFamily: font }}>
                Searching...
              </div>
            ) : results.length > 0 ? (
              results.map((article) => {
                const cat = categories.find((c) => c.id === article.category_id);
                return (
                  <div
                    key={article.id}
                    style={s.dropdownItem}
                    onMouseDown={() => {
                      if (cat) {
                        setSelectedCategory(cat);
                      }
                      search('');
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{cat?.icon || '📄'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', fontFamily: font }}>
                        {article.question}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontFamily: font, marginTop: '2px' }}>
                        {cat?.title || 'General'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', fontFamily: font }}>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                  No results found for &ldquo;{query}&rdquo;
                </div>
                <button
                  onClick={() => { search(''); setShowChat(true); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: font,
                  }}
                >
                  Try AI Chatbot
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Articles View */}
      {selectedCategory ? (
        <CategoryArticlesView
          category={selectedCategory}
          onBack={() => setSelectedCategory(null)}
          m={m}
        />
      ) : (
        <>
          {/* FAQ Categories Grid */}
          {catLoading ? (
            <div style={s.catGrid(m)}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} style={{ ...s.catCard, padding: '24px 16px' }}>
                  <div style={{ ...s.skeleton('40px', '40px'), margin: '0 auto 12px', borderRadius: '50%' }} />
                  <div style={{ ...s.skeleton('80%', '14px'), margin: '0 auto 8px' }} />
                  <div style={{ ...s.skeleton('40%', '12px'), margin: '0 auto' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={s.catGrid(m)}>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  style={s.catCard}
                  onClick={() => setSelectedCategory(cat)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#f1f5f9';
                  }}
                >
                  <div style={s.catIcon}>{cat.icon || '📁'}</div>
                  <p style={s.catTitle}>{cat.title}</p>
                  <p style={s.catCount}>{cat.article_count} article{cat.article_count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div style={s.actionsGrid(m)}>
            <button
              style={s.actionCard('linear-gradient(135deg, #3b82f6, #1d4ed8)')}
              onClick={() => setShowChat(true)}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#128172;</div>
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>AI Chat Support</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>Get instant answers 24/7</div>
            </button>
            <button
              style={s.actionCard('linear-gradient(135deg, #8b5cf6, #6d28d9)')}
              onClick={() => setShowTicket(true)}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#9993;</div>
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Email Support</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>Create a support ticket</div>
            </button>
            <a
              href={`mailto:${HELP_CONSTANTS.SUPPORT_EMAIL}`}
              style={{ ...s.actionCard('linear-gradient(135deg, #10b981, #059669)'), textDecoration: 'none' }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>&#128222;</div>
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Contact Us</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>{HELP_CONSTANTS.SUPPORT_HOURS}</div>
            </a>
          </div>
        </>
      )}

      {/* Chat Widget Modal */}
      {showChat && (
        <ChatWidget m={m} onClose={() => setShowChat(false)} onEscalate={() => { setShowChat(false); setShowTicket(true); }} />
      )}

      {/* Ticket Form Modal */}
      {showTicket && (
        <TicketForm m={m} onClose={() => setShowTicket(false)} />
      )}
    </div>
  );
}

// ============================================================
// Category Articles View (Accordion)
// ============================================================

function CategoryArticlesView({
  category,
  onBack,
  m,
}: {
  category: FaqCategory & { article_count: number };
  onBack: () => void;
  m: boolean;
}) {
  const { articles, loading } = useFaqArticles(category.slug);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rated, setRated] = useState<Record<string, 'up' | 'down'>>({});

  const handleRate = async (articleId: string, helpful: boolean) => {
    setRated((prev) => ({ ...prev, [articleId]: helpful ? 'up' : 'down' }));
    try {
      await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, helpful }),
      });
    } catch { /* silent */ }
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      <button style={s.backBtn} onClick={onBack}>
        &#8592; All Categories
      </button>

      <div style={s.catHeader}>
        <span style={{ fontSize: '32px' }}>{category.icon || '📁'}</span>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b', fontFamily: font }}>
            {category.title}
          </h2>
          {category.description && (
            <p style={{ margin: '2px 0 0', fontSize: '14px', color: '#64748b', fontFamily: font }}>
              {category.description}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        [1, 2, 3].map((i) => (
          <div key={i} style={{ ...s.accordion, padding: '18px' }}>
            <div style={s.skeleton('75%', '16px')} />
          </div>
        ))
      ) : articles.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '14px', fontFamily: font }}>
          No articles in this category yet.
        </div>
      ) : (
        articles.map((article) => {
          const isOpen = openId === article.id;
          return (
            <div key={article.id} style={s.accordion}>
              <button
                style={s.accordionQ(isOpen)}
                onClick={() => setOpenId(isOpen ? null : article.id)}
              >
                <span style={{ flex: 1 }}>
                  {article.is_pinned && <span style={{ color: '#f59e0b', marginRight: '6px' }}>&#9733;</span>}
                  {article.question}
                </span>
                <span style={{ fontSize: '12px', color: '#94a3b8', flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  &#9660;
                </span>
              </button>
              {isOpen && (
                <div style={s.accordionA}>
                  <ArticleContent answer={article.answer} />
                  <div style={s.ratingRow}>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: font }}>Was this helpful?</span>
                    <button
                      style={s.rateBtn(rated[article.id] === 'up', '#10b981')}
                      onClick={() => handleRate(article.id, true)}
                      disabled={!!rated[article.id]}
                    >
                      &#128077; Yes
                    </button>
                    <button
                      style={s.rateBtn(rated[article.id] === 'down', '#ef4444')}
                      onClick={() => handleRate(article.id, false)}
                      disabled={!!rated[article.id]}
                    >
                      &#128078; No
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// ArticleContent — simple markdown-ish renderer
// ============================================================

function ArticleContent({ answer }: { answer: string }) {
  // Simple markdown: headings, bold, lists, tables, line breaks
  const lines = answer.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  const flushTable = () => {
    if (tableHeader.length > 0) {
      elements.push(
        <div key={`t-${elements.length}`} style={{ overflowX: 'auto', margin: '12px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: font }}>
            <thead>
              <tr>
                {tableHeader.map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', fontWeight: '600', color: '#1e293b' }}>
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableRows = [];
    tableHeader = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
      // Separator row
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Heading
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={i} style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: '16px 0 8px', fontFamily: font }}>{renderInline(trimmed.slice(4))}</h4>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i} style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '16px 0 8px', fontFamily: font }}>{renderInline(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('# ')) {
      elements.push(<h2 key={i} style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '16px 0 8px', fontFamily: font }}>{renderInline(trimmed.slice(2))}</h2>);
    }
    // Numbered list
    else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(<div key={i} style={{ paddingLeft: '8px', margin: '4px 0', display: 'flex', gap: '8px' }}><span style={{ color: '#3b82f6', fontWeight: '600', flexShrink: 0 }}>{trimmed.match(/^\d+/)![0]}.</span><span>{renderInline(trimmed.replace(/^\d+\.\s*/, ''))}</span></div>);
    }
    // Bullet list
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const indent = line.search(/\S/);
      elements.push(<div key={i} style={{ paddingLeft: `${Math.max(8, indent * 4)}px`, margin: '4px 0', display: 'flex', gap: '8px' }}><span style={{ color: '#3b82f6', flexShrink: 0 }}>&#8226;</span><span>{renderInline(trimmed.slice(2))}</span></div>);
    }
    // Empty line
    else if (!trimmed) {
      elements.push(<div key={i} style={{ height: '8px' }} />);
    }
    // Normal paragraph
    else {
      elements.push(<p key={i} style={{ margin: '4px 0' }}>{renderInline(trimmed)}</p>);
    }
  }

  if (inTable) flushTable();

  return <>{elements}</>;
}

// Bold + code inline renderer
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} style={{ fontWeight: '700', color: '#1e293b' }}>{match[2]}</strong>);
    } else if (match[4]) {
      parts.push(<code key={match.index} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontSize: '13px', color: '#7c3aed' }}>{match[4]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ============================================================
// ChatWidget Modal
// ============================================================

function ChatWidget({ m, onClose, onEscalate }: { m: boolean; onClose: () => void; onEscalate: () => void }) {
  const { messages, loading, suggestEscalation, error, sendMessage, resetChat } = useChatbot();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div style={s.overlay(m)} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal(m)}>
        {/* Header */}
        <div style={s.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'white' }}>
              &#129302;
            </div>
            <div>
              <p style={s.modalTitle}>AI Support</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#10b981', fontWeight: '500', fontFamily: font }}>
                Online
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {messages.length > 0 && (
              <button
                style={s.closeBtn}
                onClick={() => resetChat()}
                title="New chat"
              >
                &#8635;
              </button>
            )}
            <button style={s.closeBtn} onClick={onClose}>&#10005;</button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '14px', fontFamily: font }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>&#129302;</div>
              <p style={{ margin: '0 0 4px', fontWeight: '600', color: '#64748b' }}>Hi! I&apos;m TCG Express Support Bot</p>
              <p style={{ margin: 0, fontSize: '13px' }}>Ask me anything about deliveries, payments, or your account.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : '#f1f5f9',
                color: msg.role === 'user' ? 'white' : '#1e293b',
                fontSize: '14px',
                lineHeight: '1.6',
                fontFamily: font,
                wordBreak: 'break-word',
              }}>
                {msg.role === 'assistant' ? <ArticleContent answer={msg.content} /> : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '12px 16px', borderRadius: '14px 14px 14px 4px', background: '#f1f5f9', color: '#94a3b8', fontSize: '14px', fontFamily: font }}>
                <span style={{ display: 'inline-block', animation: 'shimmer 1s infinite' }}>Thinking...</span>
              </div>
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#ef4444', fontFamily: font }}>
              {error}
            </div>
          )}
          {suggestEscalation && !loading && (
            <div style={{ textAlign: 'center', padding: '12px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#92400e', fontFamily: font }}>
                Would you like to speak with a support agent?
              </p>
              <button
                onClick={onEscalate}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: font,
                }}
              >
                Create Support Ticket
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            maxLength={HELP_CONSTANTS.MAX_MESSAGE_LENGTH}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '14px',
              color: '#1e293b',
              outline: 'none',
              fontFamily: font,
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              background: input.trim() && !loading ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : '#e2e8f0',
              color: input.trim() && !loading ? 'white' : '#94a3b8',
              fontSize: '18px',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            &#10148;
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TicketForm Modal
// ============================================================

const TICKET_CATEGORIES = [
  { value: 'booking', label: 'Booking & Orders' },
  { value: 'delivery', label: 'Delivery & Tracking' },
  { value: 'payment', label: 'Payment & Wallet' },
  { value: 'account', label: 'Account & Settings' },
  { value: 'safety', label: 'Safety & Insurance' },
  { value: 'other', label: 'Other' },
];

function TicketForm({ m, onClose }: { m: boolean; onClose: () => void }) {
  const { createTicket, loading, error, ticketNumber } = useCreateTicket();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [contactEmail, setContactEmail] = useState('');

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) return;
    await createTicket({
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority,
      contact_email: contactEmail.trim() || undefined,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
    fontFamily: font,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '6px',
    fontFamily: font,
  };

  return (
    <div style={s.overlay(m)} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal(m)}>
        <div style={s.modalHeader}>
          <p style={s.modalTitle}>Create Support Ticket</p>
          <button style={s.closeBtn} onClick={onClose}>&#10005;</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {ticketNumber ? (
            /* Success State */
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: '28px', color: 'white',
              }}>
                &#10003;
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px', fontFamily: font }}>
                Ticket Created
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 12px', fontFamily: font }}>
                Your ticket number is:
              </p>
              <div style={{
                display: 'inline-block', padding: '10px 24px', borderRadius: '10px',
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                fontSize: '18px', fontWeight: '700', color: '#059669',
                fontFamily: font, letterSpacing: '0.5px',
              }}>
                {ticketNumber}
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '16px 0 0', fontFamily: font }}>
                Our team will respond within 24 hours.
              </p>
              <button
                onClick={onClose}
                style={{
                  marginTop: '20px', padding: '12px 32px', borderRadius: '12px',
                  border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white', fontSize: '14px', fontWeight: '700',
                  cursor: 'pointer', fontFamily: font,
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* Form */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Subject *</label>
                <input
                  type="text"
                  placeholder="Brief summary of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={300}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description *</label>
                <textarea
                  placeholder="Describe your issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical' as const, lineHeight: '1.6' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Contact Email (optional)</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ fontSize: '13px', color: '#ef4444', fontFamily: font }}>{error}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!subject.trim() || !description.trim() || loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: subject.trim() && description.trim() && !loading
                    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                    : '#e2e8f0',
                  color: subject.trim() && description.trim() && !loading ? 'white' : '#94a3b8',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: subject.trim() && description.trim() && !loading ? 'pointer' : 'not-allowed',
                  fontFamily: font,
                }}
              >
                {loading ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
