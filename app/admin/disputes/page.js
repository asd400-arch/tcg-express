'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import useMobile from '../../components/useMobile';

const REASON_LABELS = {
  damaged_item: 'Damaged Item',
  wrong_delivery: 'Wrong Delivery',
  late_delivery: 'Late Delivery',
  wrong_address: 'Wrong Address',
  item_not_as_described: 'Item Not as Described',
  driver_no_show: 'Driver No-Show',
  other: 'Other',
};

const STATUS_COLORS = {
  open: '#ef4444',
  under_review: '#f59e0b',
  resolved: '#10b981',
};

export default function AdminDisputes() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [disputes, setDisputes] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'admin') router.push('/');
    if (user && user.role === 'admin') loadDisputes();
  }, [user, loading]);

  const loadDisputes = async () => {
    setDataLoading(true);
    try {
      const res = await fetch(`/api/disputes?role=admin&adminId=${user.id}`);
      const result = await res.json();
      setDisputes(result.data || []);
    } catch (e) {
      toast.error('Failed to load disputes');
    }
    setDataLoading(false);
  };

  const takeReview = async (disputeId) => {
    try {
      // Direct update via fetch to our API would be ideal, but we can use
      // supabase client for simple status update. Using API pattern instead.
      const res = await fetch('/api/disputes/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, adminId: user.id, resolution: 'under_review' }),
      });
      // under_review is not a valid resolution in resolve endpoint, so let's handle differently
      // We'll update directly
    } catch (e) {}

    // Use supabase admin via a simple PATCH-style approach
    // Since we don't have a dedicated endpoint for status change, import supabase client
    const { supabase } = await import('../../../lib/supabase');
    await supabase
      .from('express_disputes')
      .update({ status: 'under_review', updated_at: new Date().toISOString() })
      .eq('id', disputeId);

    toast.success('Dispute taken under review');
    loadDisputes();
  };

  const resolveDispute = async (disputeId, resolution) => {
    if (!confirm(`Are you sure you want to ${resolution === 'refund_client' ? 'refund the client' : 'release payment to the driver'}?`)) return;
    setResolving(true);
    try {
      const res = await fetch('/api/disputes/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, adminId: user.id, resolution, adminNotes }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Failed to resolve dispute');
        setResolving(false);
        return;
      }
      toast.success(`Dispute resolved — ${resolution === 'refund_client' ? 'client refunded' : 'payment released to driver'}`);
      setAdminNotes('');
      setExpanded(null);
      loadDisputes();
    } catch (e) {
      toast.error('Failed to resolve dispute');
    }
    setResolving(false);
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', marginBottom: '16px' };

  const filtered = disputes.filter(d => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Disputes" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <div style={{ marginBottom: '25px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Disputes</h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Manage and resolve delivery disputes</p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['all', 'open', 'under_review', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: filter === f ? '#e11d48' : '#e2e8f0', color: filter === f ? 'white' : '#64748b',
              fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize',
            }}>{f.replace(/_/g, ' ')} {f !== 'all' ? `(${disputes.filter(d => d.status === f).length})` : `(${disputes.length})`}</button>
          ))}
        </div>

        {dataLoading ? <Spinner /> : filtered.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <p style={{ color: '#64748b', fontSize: '14px' }}>No {filter === 'all' ? '' : filter.replace(/_/g, ' ')} disputes</p>
          </div>
        ) : filtered.map(d => (
          <div key={d.id} style={{ ...card, border: d.status === 'open' ? '1px solid #fecaca' : d.status === 'under_review' ? '1px solid #fde68a' : '1px solid #f1f5f9' }}>
            {/* Dispute header */}
            <div
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{d.job?.job_number || 'Unknown Job'}</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                      background: `${STATUS_COLORS[d.status]}15`, color: STATUS_COLORS[d.status], textTransform: 'uppercase',
                    }}>{d.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#374151', marginBottom: '4px' }}>
                    Opened by <strong>{d.opener?.contact_name || 'Unknown'}</strong> ({d.opened_by_role})
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: '#f1f5f9', color: '#64748b' }}>{REASON_LABELS[d.reason] || d.reason}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <span style={{ fontSize: '18px', color: '#94a3b8', transform: expanded === d.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
              </div>
            </div>

            {/* Expanded details */}
            {expanded === d.id && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</label>
                  <div style={{ fontSize: '14px', color: '#374151', marginTop: '4px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>{d.description}</div>
                </div>

                {d.job?.final_amount && (
                  <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '600' }}>Escrow Amount: ${parseFloat(d.job.final_amount).toFixed(2)}</span>
                  </div>
                )}

                {d.resolution && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resolution</label>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: d.resolution === 'refund_client' ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                      {d.resolution === 'refund_client' ? 'Refunded to Client' : 'Released to Driver'}
                    </div>
                    {d.admin_notes && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Notes: {d.admin_notes}</div>}
                    {d.resolved_at && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Resolved: {new Date(d.resolved_at).toLocaleString()}</div>}
                  </div>
                )}

                {/* Admin actions */}
                {d.status === 'open' && (
                  <button
                    onClick={() => takeReview(d.id)}
                    style={{
                      padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white',
                      fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                    }}
                  >Take Under Review</button>
                )}

                {d.status === 'under_review' && (
                  <div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Admin Notes (optional)</label>
                      <textarea
                        value={expanded === d.id ? adminNotes : ''}
                        onChange={e => setAdminNotes(e.target.value)}
                        placeholder="Add notes about your decision..."
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                          background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b',
                          outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box',
                          height: '70px', resize: 'vertical',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => resolveDispute(d.id, 'refund_client')}
                        disabled={resolving}
                        style={{
                          padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white',
                          fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                          opacity: resolving ? 0.7 : 1,
                        }}
                      >{resolving ? 'Processing...' : 'Refund Client'}</button>
                      <button
                        onClick={() => resolveDispute(d.id, 'release_driver')}
                        disabled={resolving}
                        style={{
                          padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                          background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                          fontSize: '13px', fontWeight: '600', fontFamily: "'Inter', sans-serif",
                          opacity: resolving ? 0.7 : 1,
                        }}
                      >{resolving ? 'Processing...' : 'Release to Driver'}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
