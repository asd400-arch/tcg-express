'use client';

import { useState } from 'react';
import { formatSGD } from '@/lib/paynow';
import type { WalletTransaction } from '@/types/wallet';

const TX_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  top_up:     { icon: '⬆️', label: 'Top Up',     color: '#10b981' },
  payment:    { icon: '🛒', label: 'Payment',    color: '#ef4444' },
  earning:    { icon: '💰', label: 'Earning',    color: '#10b981' },
  withdrawal: { icon: '🏦', label: 'Withdrawal', color: '#f59e0b' },
  refund:     { icon: '↩️', label: 'Refund',     color: '#3b82f6' },
  bonus:      { icon: '🎁', label: 'Bonus',      color: '#8b5cf6' },
  commission: { icon: '📊', label: 'Commission', color: '#10b981' },
  adjustment: { icon: '⚙️', label: 'Adjustment', color: '#64748b' },
};

function groupByDate(transactions: WalletTransaction[]): Record<string, WalletTransaction[]> {
  const groups: Record<string, WalletTransaction[]> = {};
  for (const tx of transactions) {
    const date = new Date(tx.created_at).toLocaleDateString('en-SG', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
  }
  return groups;
}

interface Props {
  transactions: WalletTransaction[];
}

export default function TransactionList({ transactions }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!transactions.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>💳</div>
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#64748b' }}>No transactions yet</div>
        <div style={{ fontSize: '13px', marginTop: '4px' }}>Top up your wallet to get started</div>
      </div>
    );
  }

  const grouped = groupByDate(transactions);

  return (
    <div>
      {Object.entries(grouped).map(([date, txs]) => (
        <div key={date} style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '10px',
            paddingLeft: '4px',
          }}>
            {date}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {txs.map((tx) => {
              const config = TX_CONFIG[tx.type] || TX_CONFIG.adjustment;
              const isCredit = tx.direction === 'credit';
              const hasBreakdown = tx.type === 'payment' && tx.fare_breakdown != null;
              const isExpanded = expandedIds.has(tx.id);

              return (
                <div
                  key={tx.id}
                  style={{
                    borderRadius: '12px',
                    background: 'white',
                    overflow: 'hidden',
                  }}
                >
                  {/* Main row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      cursor: hasBreakdown ? 'pointer' : 'default',
                    }}
                    onClick={hasBreakdown ? () => toggleExpand(tx.id) : undefined}
                  >
                    {/* Icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: `${config.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0,
                    }}>
                      {config.icon}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                          {config.label}
                        </span>
                        {tx.status !== 'completed' && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: tx.status === 'pending' ? '#fef3c7' : tx.status === 'failed' ? '#fef2f2' : '#f1f5f9',
                            color: tx.status === 'pending' ? '#92400e' : tx.status === 'failed' ? '#991b1b' : '#475569',
                            textTransform: 'uppercase',
                          }}>
                            {tx.status}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {tx.description || new Date(tx.created_at).toLocaleTimeString('en-SG', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                      {hasBreakdown && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                          {isExpanded ? '▲ Hide breakdown' : '▼ Fare breakdown'}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: isCredit ? '#10b981' : '#ef4444',
                      }}>
                        {isCredit ? '+' : '-'}{formatSGD(tx.amount)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '1px' }}>
                        bal {formatSGD(tx.balance_after)}
                      </div>
                    </div>
                  </div>

                  {/* Fare breakdown panel */}
                  {hasBreakdown && isExpanded && tx.fare_breakdown && (() => {
                    const bd = tx.fare_breakdown;
                    const addonTotal = (bd.helper_fee || 0) + (bd.special_handling_fee || 0);
                    const discountTotal = (bd.save_mode_discount || 0) + (bd.ev_discount || 0) + (bd.promo_discount || 0);
                    const total = bd.total_amount > 0 ? bd.total_amount : tx.amount;

                    const rows: { label: string; value: number; isDiscount?: boolean }[] = [];
                    if (bd.base_fare > 0)          rows.push({ label: 'Base fare',        value: bd.base_fare });
                    if (bd.urgency_surcharge > 0)   rows.push({ label: 'Urgency surcharge', value: bd.urgency_surcharge });
                    if (bd.distance_surcharge > 0)  rows.push({ label: 'Distance surcharge', value: bd.distance_surcharge });
                    if (addonTotal > 0)             rows.push({ label: 'Add-ons',            value: addonTotal });
                    if (discountTotal > 0)          rows.push({ label: 'Discount',           value: discountTotal, isDiscount: true });

                    return (
                      <div style={{
                        padding: '0 12px 12px 64px',
                        borderTop: '1px solid #f1f5f9',
                      }}>
                        {rows.length > 0 ? rows.map(row => (
                          <div
                            key={row.label}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '4px 0',
                              fontSize: '12px',
                              color: '#64748b',
                            }}
                          >
                            <span>{row.label}</span>
                            <span style={{ color: row.isDiscount ? '#10b981' : undefined }}>
                              {row.isDiscount ? '-' : '+'}{formatSGD(row.value)}
                            </span>
                          </div>
                        )) : (
                          <div style={{ fontSize: '12px', color: '#94a3b8', padding: '4px 0' }}>
                            No breakdown available
                          </div>
                        )}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 0 0',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#1e293b',
                          borderTop: '1px solid #f1f5f9',
                          marginTop: '4px',
                        }}>
                          <span>Total</span>
                          <span>{formatSGD(total)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
