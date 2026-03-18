'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/locale/config';

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-SG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(date) {
  if (!date) return '';
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminWalletPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [topups, setTopups] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loadingData, setLoadingData] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [refInput, setRefInput] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [stats, setStats] = useState({ pending: 0, today: 0, totalPending: 0 });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
  }, [user, loading]);

  const fetchTopups = useCallback(async () => {
    setLoadingData(true);
    let query = supabase
      .from('wallet_topups')
      .select('*, user:user_id(contact_name, email, company_name, role, locale)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query.limit(100);
    if (!error && data) {
      setTopups(data);

      // Calculate stats
      const pending = data.filter(t => t.status === 'pending');
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCompleted = data.filter(t =>
        t.status === 'completed' && new Date(t.updated_at) >= todayStart
      );

      setStats({
        pending: pending.length,
        today: todayCompleted.length,
        totalPending: pending.reduce((s, t) => s + parseFloat(t.amount || 0), 0),
      });
    }
    setLoadingData(false);
  }, [filter]);

  useEffect(() => {
    if (user?.role === 'admin') fetchTopups();
  }, [user, filter, fetchTopups]);

  // Real-time subscription for new topups
  useEffect(() => {
    const channel = supabase
      .channel('admin-topups')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wallet_topups',
      }, () => {
        fetchTopups();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchTopups]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleConfirm = async (topup) => {
    if (!refInput.trim()) {
      showToast('PayNow reference is required', 'error');
      return;
    }
    setConfirmingId(topup.id);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paynow_reference: refInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${formatCurrency(topup.amount, topup.user?.locale || 'sg')} credited to ${topup.user?.contact_name || 'user'}`);
        setShowConfirmModal(null);
        setRefInput('');
        fetchTopups();
      } else {
        showToast(data.error || 'Confirmation failed', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setConfirmingId(null);
  };

  const handleReject = async (topup) => {
    if (!confirm(`Reject ${formatCurrency(topup.amount, topup.user?.locale || 'sg')} top-up from ${topup.user?.contact_name}?`)) return;
    setRejectingId(topup.id);
    try {
      await supabase
        .from('wallet_topups')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', topup.id);
      showToast('Top-up rejected');
      fetchTopups();
    } catch {
      showToast('Failed to reject', 'error');
    }
    setRejectingId(null);
  };

  if (loading || !user) return null;

  const card = {
    background: 'white', borderRadius: '14px', padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9',
  };

  const statusColors = {
    pending: { bg: '#fef3c7', color: '#d97706', label: 'Pending' },
    completed: { bg: '#d1fae5', color: '#059669', label: 'Completed' },
    expired: { bg: '#fee2e2', color: '#dc2626', label: 'Expired' },
    failed: { bg: '#fecaca', color: '#b91c1c', label: 'Failed' },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="wallet" />
      <main style={{ flex: 1, padding: '24px 24px 24px 24px' }}>
        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
            padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
            background: toast.type === 'error' ? '#fee2e2' : '#d1fae5',
            color: toast.type === 'error' ? '#dc2626' : '#059669',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'fadeIn 0.3s ease',
          }}>
            {toast.type === 'error' ? '✕' : '✓'} {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
            💳 Wallet Top-ups
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
            Review and approve PayNow top-up requests
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ ...card, borderLeft: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Pending Approval</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f59e0b' }}>{stats.pending}</div>
          </div>
          <div style={{ ...card, borderLeft: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Pending Amount</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#3b82f6' }}>{formatCurrency(stats.totalPending, 'sg')}</div>
          </div>
          <div style={{ ...card, borderLeft: '4px solid #10b981' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Approved Today</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981' }}>{stats.today}</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[
            { key: 'pending', label: 'Pending', count: stats.pending },
            { key: 'completed', label: 'Completed' },
            { key: 'expired', label: 'Expired/Rejected' },
            { key: 'all', label: 'All' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                border: 'none', cursor: 'pointer',
                background: filter === tab.key ? '#3b82f6' : '#f1f5f9',
                color: filter === tab.key ? 'white' : '#64748b',
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  marginLeft: '6px', padding: '2px 6px', borderRadius: '10px', fontSize: '11px',
                  background: filter === tab.key ? 'rgba(255,255,255,0.3)' : '#ef4444',
                  color: 'white',
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Top-up list */}
        <div style={card}>
          {loadingData ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading...</div>
          ) : topups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              No {filter === 'all' ? '' : filter} top-ups found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                    {['User', 'Amount', 'Method', 'Reference', 'Status', 'Time', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '10px 12px', textAlign: 'left', fontWeight: '700',
                        color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topups.map(t => {
                    const sc = statusColors[t.status] || statusColors.pending;
                    return (
                      <tr key={t.id} style={{
                        borderBottom: '1px solid #f8fafc',
                        background: t.status === 'pending' ? '#fffbeb08' : 'transparent',
                      }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '600', color: '#1e293b' }}>
                            {t.user?.contact_name || '—'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {t.user?.company_name || t.user?.email || ''}
                          </div>
                          <div style={{ fontSize: '10px', color: '#cbd5e1' }}>
                            {t.user?.role}
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>
                          {formatCurrency(t.amount, t.user?.locale || 'sg')}
                        </td>
                        <td style={{ padding: '12px', color: '#64748b' }}>
                          {t.payment_method === 'paynow' ? '🏦 PayNow' : t.payment_method || '—'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                            {t.paynow_reference || t.reference || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                            background: sc.bg, color: sc.color,
                          }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{formatDate(t.created_at)}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{timeAgo(t.created_at)}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {t.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => { setShowConfirmModal(t); setRefInput(t.paynow_reference || ''); }}
                                style={{
                                  padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                  background: '#10b981', color: 'white', fontSize: '12px', fontWeight: '600',
                                }}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => handleReject(t)}
                                disabled={rejectingId === t.id}
                                style={{
                                  padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0',
                                  cursor: 'pointer', background: 'white', color: '#ef4444',
                                  fontSize: '12px', fontWeight: '600',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          {t.status === 'completed' && t.admin_verified_by && (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                              Verified ✓
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setShowConfirmModal(null)}>
            <div style={{
              background: 'white', borderRadius: '16px', padding: '28px', width: '420px',
              maxWidth: '90vw', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 20px' }}>
                Approve Top-up
              </h3>

              {/* Summary */}
              <div style={{
                background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '18px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>User</span>
                  <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>
                    {showConfirmModal.user?.contact_name || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Company</span>
                  <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>
                    {showConfirmModal.user?.company_name || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>Amount</span>
                  <span style={{ fontWeight: '800', color: '#10b981', fontSize: '18px' }}>
                    {formatCurrency(showConfirmModal.amount, showConfirmModal.user?.locale || 'sg')}
                  </span>
                </div>
              </div>

              {/* Reference input */}
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                PayNow Reference (from bank statement)
              </label>
              <input
                type="text"
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                placeholder="e.g. MEPS230001234567"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px', fontSize: '14px',
                  border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '20px',
                  boxSizing: 'border-box',
                }}
              />

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowConfirmModal(null)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                    background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirm(showConfirmModal)}
                  disabled={confirmingId === showConfirmModal.id || !refInput.trim()}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                    background: confirmingId === showConfirmModal.id ? '#94a3b8' : '#10b981',
                    color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  }}
                >
                  {confirmingId === showConfirmModal.id ? 'Processing...' : '✓ Confirm & Credit Wallet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
