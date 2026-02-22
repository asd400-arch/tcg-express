'use client';

import React, { useState } from 'react';
import useMobile from '../useMobile';
import { useCreateTicket, useFaqCategories } from '@/lib/hooks/useHelp';
import type { TicketPriority } from '@/types/help';

// ============================================================
// Constants
// ============================================================

const font = "'Inter', sans-serif";
const DESC_MAX = 5000;
const SUBJECT_MAX = 300;

const PRIORITY_OPTIONS: { value: TicketPriority; label: string; dot: string }[] = [
  { value: 'low', label: 'Low', dot: '#64748b' },
  { value: 'normal', label: 'Normal', dot: '#3b82f6' },
  { value: 'high', label: 'High', dot: '#f59e0b' },
  { value: 'urgent', label: 'Urgent', dot: '#ef4444' },
];

// ============================================================
// Props
// ============================================================

interface TicketFormProps {
  onClose: () => void;
  chatSessionId?: string | null;
  defaultSubject?: string;
  defaultCategory?: string;
}

// ============================================================
// TicketForm Component
// ============================================================

export default function TicketForm({
  onClose,
  chatSessionId,
  defaultSubject,
  defaultCategory,
}: TicketFormProps) {
  const m = useMobile();
  const { createTicket, loading, error, ticketNumber } = useCreateTicket();
  const { categories } = useFaqCategories();

  const [subject, setSubject] = useState(defaultSubject || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory || '');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [contactEmail, setContactEmail] = useState('');

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await createTicket({
      subject: subject.trim(),
      description: description.trim(),
      category: category || undefined,
      priority,
      contact_email: contactEmail.trim() || undefined,
      chat_session_id: chatSessionId || undefined,
    });
  };

  // --- Styles ---

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: m ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: m ? '0' : '20px',
  };

  const modal: React.CSSProperties = {
    background: 'white',
    borderRadius: m ? '20px 20px 0 0' : '20px',
    maxWidth: '520px',
    width: '100%',
    maxHeight: m ? '92vh' : '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
    overflow: 'hidden',
  };

  const inputBase: React.CSSProperties = {
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

  const label: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#475569',
    marginBottom: '6px',
    fontFamily: font,
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f1f5f9',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: 'white',
              }}
            >
              &#9993;
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#1e293b',
                fontFamily: font,
              }}
            >
              Create Support Ticket
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
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
            }}
          >
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {ticketNumber ? (
            /* ---------- Success State ---------- */
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  fontSize: '30px',
                  color: 'white',
                }}
              >
                &#10003;
              </div>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: '0 0 8px',
                  fontFamily: font,
                }}
              >
                Ticket Created!
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: '0 0 16px',
                  fontFamily: font,
                }}
              >
                Your ticket number is:
              </p>
              <div
                style={{
                  display: 'inline-block',
                  padding: '12px 28px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  fontSize: '22px',
                  fontWeight: '800',
                  color: '#1d4ed8',
                  fontFamily: font,
                  letterSpacing: '0.5px',
                }}
              >
                {ticketNumber}
              </div>
              <p
                style={{
                  fontSize: '14px',
                  color: '#64748b',
                  margin: '18px 0 0',
                  fontFamily: font,
                  lineHeight: '1.5',
                }}
              >
                We&apos;ll respond within <strong style={{ color: '#1e293b' }}>24 hours</strong>.
                You can track your ticket status in the Help Center.
              </p>
              <button
                onClick={onClose}
                style={{
                  marginTop: '24px',
                  padding: '13px 36px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontFamily: font,
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* ---------- Form ---------- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Chat session note */}
              {chatSessionId && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>&#128172;</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#1e40af',
                      fontFamily: font,
                    }}
                  >
                    Your chatbot conversation will be attached to this ticket.
                  </span>
                </div>
              )}

              {/* Category */}
              <div>
                <label style={label}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ ...inputBase, cursor: 'pointer', color: category ? '#1e293b' : '#94a3b8' }}
                >
                  <option value="">Select a category...</option>
                  {categories.length > 0
                    ? categories.map((cat) => (
                        <option key={cat.id} value={cat.slug}>
                          {cat.icon} {cat.title}
                        </option>
                      ))
                    : [
                        { value: 'booking', label: 'Booking & Orders' },
                        { value: 'delivery', label: 'Delivery & Tracking' },
                        { value: 'payment', label: 'Payment & Wallet' },
                        { value: 'account', label: 'Account & Settings' },
                        { value: 'safety', label: 'Safety & Insurance' },
                        { value: 'other', label: 'Other' },
                      ].map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '6px',
                  }}
                >
                  <label style={{ ...label, margin: 0 }}>
                    Subject <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span
                    style={{
                      fontSize: '11px',
                      color: subject.length > SUBJECT_MAX - 20 ? '#f59e0b' : '#cbd5e1',
                      fontFamily: font,
                    }}
                  >
                    {subject.length}/{SUBJECT_MAX}
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Brief summary of your issue"
                  value={subject}
                  onChange={(e) => {
                    if (e.target.value.length <= SUBJECT_MAX) setSubject(e.target.value);
                  }}
                  style={inputBase}
                />
              </div>

              {/* Priority */}
              <div>
                <label style={label}>Priority</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {PRIORITY_OPTIONS.map((opt) => {
                    const selected = priority === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setPriority(opt.value)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 8px',
                          borderRadius: '10px',
                          border: selected ? `2px solid ${opt.dot}` : '1px solid #e2e8f0',
                          background: selected ? `${opt.dot}0d` : 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: selected ? opt.dot : '#64748b',
                          cursor: 'pointer',
                          fontFamily: font,
                        }}
                      >
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: opt.dot,
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '6px',
                  }}
                >
                  <label style={{ ...label, margin: 0 }}>
                    Description <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span
                    style={{
                      fontSize: '11px',
                      color:
                        description.length > DESC_MAX - 100
                          ? description.length > DESC_MAX - 20
                            ? '#ef4444'
                            : '#f59e0b'
                          : '#cbd5e1',
                      fontFamily: font,
                    }}
                  >
                    {description.length.toLocaleString()}/{DESC_MAX.toLocaleString()}
                  </span>
                </div>
                <textarea
                  placeholder="Describe your issue in detail. Include any relevant order numbers, screenshots, or steps to reproduce the problem."
                  value={description}
                  onChange={(e) => {
                    if (e.target.value.length <= DESC_MAX) setDescription(e.target.value);
                  }}
                  rows={6}
                  style={{
                    ...inputBase,
                    resize: 'vertical' as const,
                    lineHeight: '1.6',
                    minHeight: '120px',
                  }}
                />
              </div>

              {/* Contact Email */}
              <div>
                <label style={label}>Contact Email (optional)</label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={inputBase}
                />
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '11px',
                    color: '#94a3b8',
                    fontFamily: font,
                  }}
                >
                  We&apos;ll use your account email if left blank.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                  }}
                >
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>&#9888;</span>
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#991b1b',
                      fontFamily: font,
                    }}
                  >
                    {error}
                  </span>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  width: '100%',
                  padding: '15px',
                  borderRadius: '12px',
                  border: 'none',
                  background: canSubmit
                    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                    : '#e2e8f0',
                  color: canSubmit ? 'white' : '#94a3b8',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  fontFamily: font,
                  marginBottom: '4px',
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
