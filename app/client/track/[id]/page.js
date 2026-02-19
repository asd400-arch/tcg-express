'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthContext';
import LiveMap from '../../../components/LiveMap';
import CallButtons from '../../../components/CallButtons';
import Spinner from '../../../components/Spinner';
import { supabase } from '../../../../lib/supabase';
import { use } from 'react';

function formatTimeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

const TIMELINE_STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'pickup_confirmed', label: 'Pickup' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'confirmed', label: 'Confirmed' },
];

function StatusTimeline({ status }) {
  const statusOrder = TIMELINE_STEPS.map(s => s.key);
  const currentIdx = statusOrder.indexOf(status);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 4px', marginBottom: '16px' }}>
      {TIMELINE_STEPS.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isActive = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
            {/* Connector line (before this step) */}
            {i > 0 && (
              <div style={{
                position: 'absolute', top: '12px', right: '50%', width: '100%', height: '3px',
                background: isCompleted || isActive ? '#10b981' : '#e2e8f0',
                zIndex: 0,
              }} />
            )}

            {/* Circle */}
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0,
              background: isCompleted ? '#10b981' : isActive ? 'white' : '#f1f5f9',
              border: isActive ? '3px solid #3b82f6' : isCompleted ? 'none' : '2px solid #e2e8f0',
              animation: isCompleted ? 'stepComplete 0.4s ease-out' : 'none',
            }}>
              {isCompleted && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {isActive && (
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} />
              )}
            </div>

            {/* Label */}
            <span style={{
              fontSize: '10px', fontWeight: isActive ? '700' : '600', marginTop: '6px',
              color: isCompleted ? '#10b981' : isActive ? '#3b82f6' : '#94a3b8',
              textAlign: 'center', lineHeight: '1.2',
            }}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ClientTrackPage({ params }) {
  const resolvedParams = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [jobId] = useState(resolvedParams.id);
  const [job, setJob] = useState(null);
  const [driver, setDriver] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [delivered, setDelivered] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [timeAgoTick, setTimeAgoTick] = useState(0);
  const [copied, setCopied] = useState(false);

  // Tick interval for live "time ago"
  useEffect(() => {
    const interval = setInterval(() => setTimeAgoTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && user.role !== 'client') router.push('/');
  }, [user, loading]);

  useEffect(() => {
    if (!jobId || !user) return;

    const loadData = async () => {
      const { data: jobData } = await supabase
        .from('express_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!jobData || jobData.client_id !== user.id) {
        router.push('/client/jobs');
        return;
      }
      setJob(jobData);
      if (jobData.status === 'delivered' || jobData.status === 'confirmed' || jobData.status === 'completed') {
        setDelivered(true);
      }

      if (jobData.assigned_driver_id) {
        const { data: driverData } = await supabase
          .from('express_users')
          .select('id, contact_name, phone, vehicle_type, vehicle_plate, driver_rating')
          .eq('id', jobData.assigned_driver_id)
          .single();
        setDriver(driverData);
      }
    };
    loadData();
  }, [jobId, user]);

  // Real-time job status subscription
  useEffect(() => {
    if (!jobId) return;
    const channel = supabase
      .channel(`track-job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'express_jobs',
        filter: `id=eq.${jobId}`,
      }, (payload) => {
        setJob(payload.new);
        if (payload.new.status === 'delivered' || payload.new.status === 'confirmed' || payload.new.status === 'completed') {
          setDelivered(true);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [jobId]);

  const handleEtaUpdate = useCallback((newEta, newDistance) => {
    setEta(newEta);
    setDistance(newDistance);
  }, []);

  const handleLastUpdated = useCallback((time) => {
    setLastUpdated(time);
  }, []);

  const handleShareLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || !user || !job) return <Spinner />;

  const statusColor = { assigned: '#f59e0b', pickup_confirmed: '#f59e0b', in_transit: '#06b6d4', delivered: '#10b981', confirmed: '#10b981', completed: '#059669' };
  const vehicleColor = { motorcycle: '#f59e0b', car: '#3b82f6', van: '#8b5cf6', truck: '#10b981', lorry: '#ef4444' };
  const vehicleEmoji = { motorcycle: '🏍️', car: '🚗', van: '🚐', truck: '🚚', lorry: '🚛' };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
      {/* Minimal Header */}
      <div style={{
        height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href={`/client/jobs/${jobId}`} style={{ color: '#64748b', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>← Back</a>
          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{job.job_number}</span>
        </div>
        <span style={{
          padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
          background: `${statusColor[job.status] || '#94a3b8'}15`,
          color: statusColor[job.status] || '#94a3b8',
          textTransform: 'uppercase',
        }}>
          {job.status.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Delivered banner */}
      {delivered && (
        <div style={{
          padding: '14px 20px', background: 'linear-gradient(135deg, #10b981, #059669)',
          color: 'white', textAlign: 'center', fontSize: '15px', fontWeight: '700', flexShrink: 0,
        }}>
          ✅ Delivery Complete!
          <a href={`/client/jobs/${jobId}`} style={{ color: 'white', marginLeft: '12px', textDecoration: 'underline', fontSize: '13px' }}>View Details</a>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <LiveMap
          jobId={jobId}
          driverId={job.assigned_driver_id}
          isDriver={false}
          fullscreen={true}
          mapHeight="100%"
          onEtaUpdate={handleEtaUpdate}
          onLastUpdated={handleLastUpdated}
        />
      </div>

      {/* Bottom overlay panel */}
      <div style={{
        flexShrink: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid #e2e8f0', padding: '20px',
        borderRadius: '20px 20px 0 0', maxHeight: '50vh', overflowY: 'auto',
      }}>
        {/* Status Timeline */}
        <StatusTimeline status={job.status} />

        {driver ? (
          <div>
            {/* Driver info row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', fontWeight: '700', color: 'white', flexShrink: 0,
              }}>
                {driver.contact_name?.[0] || 'D'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>{driver.contact_name}</div>
                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {driver.vehicle_type && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                      background: `${vehicleColor[driver.vehicle_type] || '#64748b'}15`,
                      color: vehicleColor[driver.vehicle_type] || '#64748b',
                      textTransform: 'capitalize',
                    }}>
                      {vehicleEmoji[driver.vehicle_type] || '🚗'} {driver.vehicle_type}
                    </span>
                  )}
                  {driver.vehicle_plate && <span>• {driver.vehicle_plate}</span>}
                  {driver.driver_rating && <span>• ⭐ {driver.driver_rating}</span>}
                </div>
                {lastUpdated && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    Last updated {formatTimeAgo(lastUpdated)}
                  </div>
                )}
              </div>
            </div>

            {/* Call Buttons */}
            {driver.phone && (
              <div style={{ marginBottom: '14px' }}>
                <CallButtons phone={driver.phone} name={driver.contact_name} compact />
              </div>
            )}

            {/* Pickup & Delivery addresses */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              {job.pickup_address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '6px', background: '#16a34a',
                    color: 'white', fontSize: '12px', fontWeight: '700', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>P</span>
                  <span style={{ fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>{job.pickup_address}</span>
                </div>
              )}
              {job.delivery_address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '6px', background: '#dc2626',
                    color: 'white', fontSize: '12px', fontWeight: '700', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>D</span>
                  <span style={{ fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>{job.delivery_address}</span>
                </div>
              )}
            </div>

            {/* ETA / Distance / Status row */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <div style={{ flex: 1, padding: '10px', background: '#f1f5f9', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>ETA</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                  {eta !== null ? `${eta} min` : '--'}
                </div>
              </div>
              <div style={{ flex: 1, padding: '10px', background: '#f1f5f9', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Distance</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
                  {distance !== null ? `${distance} km` : '--'}
                </div>
              </div>
              <div style={{ flex: 1, padding: '10px', background: '#f1f5f9', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>Status</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: statusColor[job.status] || '#64748b', textTransform: 'capitalize' }}>
                  {job.status.replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            {/* Share Tracking Link */}
            <button
              onClick={handleShareLink}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0',
                background: copied ? '#10b981' : 'white', color: copied ? 'white' : '#475569',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.3s ease',
              }}
            >
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Link Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Share Tracking Link
                </>
              )}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '14px' }}>
            Loading driver info...
          </div>
        )}
      </div>
    </div>
  );
}
