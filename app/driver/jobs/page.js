'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthContext';
import Sidebar from '../../components/Sidebar';
import Spinner from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import { supabase } from '../../../lib/supabase';
import useMobile from '../../components/useMobile';

export default function DriverJobs() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const m = useMobile();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidTime, setBidTime] = useState('');
  const [bidMsg, setBidMsg] = useState('');
  const [bidding, setBidding] = useState(false);
  const [myBids, setMyBids] = useState({});

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'driver') router.push('/');
    if (user && user.role === 'driver') loadData();
  }, [user, loading]);

  const loadData = async () => {
    const [jobsRes, bidsRes] = await Promise.all([
      supabase.from('express_jobs').select('*').in('status', ['open', 'bidding']).order('created_at', { ascending: false }),
      supabase.from('express_bids').select('*').eq('driver_id', user.id),
    ]);
    setJobs(jobsRes.data || []);
    const bm = {};
    (bidsRes.data || []).forEach(b => { bm[b.job_id] = b; });
    setMyBids(bm);
  };

  const submitBid = async () => {
    if (!bidAmount || !selectedJob) return;
    if (parseFloat(bidAmount) <= 0) { toast.error('Bid amount must be greater than 0'); return; }
    setBidding(true);
    const { error } = await supabase.from('express_bids').insert([{
      job_id: selectedJob.id, driver_id: user.id,
      amount: parseFloat(bidAmount), estimated_time: bidTime, message: bidMsg,
    }]);
    if (error) { toast.error('Error: ' + error.message); setBidding(false); return; }
    await supabase.from('express_jobs').update({ status: 'bidding' }).eq('id', selectedJob.id).eq('status', 'open');
    // Notify client about new bid
    fetch('/api/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selectedJob.client_id, type: 'bid', title: 'New bid received', message: `A driver bid $${parseFloat(bidAmount).toFixed(2)} on ${selectedJob.item_description}` }),
    }).catch(() => {});
    setBidding(false); setSelectedJob(null); setBidAmount(''); setBidTime(''); setBidMsg('');
    loadData();
  };

  if (loading || !user) return <Spinner />;

  const card = { background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' };
  const urgencyColor = { standard: '#64748b', express: '#f59e0b', urgent: '#ef4444' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar active="Available Jobs" />
      <div style={{ flex: 1, padding: m ? '20px 16px' : '30px', overflowX: 'hidden' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>🔍 Available Jobs ({jobs.length})</h1>

        {/* Bid Modal */}
        {selectedJob && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Place Bid</h3>
                <div onClick={() => setSelectedJob(null)} style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }}>✕</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{selectedJob.item_description}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>📍 {selectedJob.pickup_address} → {selectedJob.delivery_address}</div>
                <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '700', marginTop: '6px' }}>Budget: ${selectedJob.budget_min} - ${selectedJob.budget_max}</div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Your Bid Amount ($) *</label>
                <input type="number" style={input} value={bidAmount} onChange={e => setBidAmount(e.target.value)} placeholder="Enter amount" required />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Estimated Time</label>
                <input style={input} value={bidTime} onChange={e => setBidTime(e.target.value)} placeholder="e.g. 30 mins, 1 hour" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '6px' }}>Message</label>
                <textarea style={{ ...input, height: '60px', resize: 'vertical' }} value={bidMsg} onChange={e => setBidMsg(e.target.value)} placeholder="Why should they choose you?" />
              </div>
              <button onClick={submitBid} disabled={bidding} style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif", opacity: bidding ? 0.7 : 1 }}>{bidding ? 'Submitting...' : '💰 Submit Bid'}</button>
            </div>
          </div>
        )}

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <p style={{ color: '#64748b', fontSize: '14px' }}>No available jobs right now. Check back soon!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {jobs.map(job => {
              const hasBid = myBids[job.id];
              return (
                <div key={job.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{job.item_description}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', background: `${urgencyColor[job.urgency]}15`, color: urgencyColor[job.urgency], textTransform: 'uppercase' }}>{job.urgency}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b' }}>{job.item_category} {job.item_weight ? `• ${job.item_weight}kg` : ''} {job.vehicle_required !== 'any' ? `• ${job.vehicle_required} required` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#10b981' }}>${job.budget_min} - ${job.budget_max}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#374151', marginBottom: '12px' }}>
                    <div>📍 <strong>Pickup:</strong> {job.pickup_address}</div>
                    <div>📦 <strong>Deliver:</strong> {job.delivery_address}</div>
                  </div>
                  {job.special_requirements && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>⚠️ {job.special_requirements}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{new Date(job.created_at).toLocaleString()}</span>
                    {hasBid ? (
                      <span style={{ padding: '8px 16px', borderRadius: '8px', background: '#f0fdf4', color: '#10b981', fontSize: '13px', fontWeight: '600' }}>✓ Bid: ${hasBid.amount} ({hasBid.status})</span>
                    ) : (
                      <button onClick={() => setSelectedJob(job)} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>💰 Place Bid</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
