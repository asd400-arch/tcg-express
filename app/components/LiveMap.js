'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export default function LiveMap({ jobId, driverId, isDriver = false }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const routeRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [watchId, setWatchId] = useState(null);
  const [job, setJob] = useState(null);

  // Load Leaflet CSS and JS
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Add Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css';
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }

    // Add Leaflet JS
    const loadLeaflet = () => {
      return new Promise((resolve) => {
        if (window.L) { resolve(window.L); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });
    };

    loadLeaflet().then((L) => {
      if (!mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current).setView([1.3521, 103.8198], 12); // Singapore
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      mapInstance.current = map;
    });

    // Load job info
    if (jobId) {
      supabase.from('express_jobs').select('*').eq('id', jobId).single().then(({ data }) => {
        if (data) setJob(data);
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [jobId]);

  // Real-time location subscription (for client viewing driver)
  useEffect(() => {
    if (isDriver || !driverId || !jobId) return;

    // Load latest location
    const loadLatest = async () => {
      const { data } = await supabase
        .from('express_driver_locations')
        .select('*')
        .eq('driver_id', driverId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) updateMarker(data.latitude, data.longitude);
    };
    loadLatest();

    // Subscribe to location updates
    const channel = supabase
      .channel(`location-${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'express_driver_locations',
        filter: `job_id=eq.${jobId}`,
      }, (payload) => {
        const { latitude, longitude } = payload.new;
        updateMarker(latitude, longitude);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [driverId, jobId, isDriver]);

  // Add pickup/delivery markers when job loads
  useEffect(() => {
    if (!job || !mapInstance.current || !window.L) return;
    const L = window.L;

    if (job.pickup_lat && job.pickup_lng) {
      const pickupIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center">📍</div>',
        iconSize: [30, 30], className: '',
      });
      L.marker([parseFloat(job.pickup_lat), parseFloat(job.pickup_lng)], { icon: pickupIcon })
        .addTo(mapInstance.current)
        .bindPopup('<b>Pickup</b><br>' + (job.pickup_address || ''));
    }

    if (job.delivery_lat && job.delivery_lng) {
      const deliverIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center">📦</div>',
        iconSize: [30, 30], className: '',
      });
      L.marker([parseFloat(job.delivery_lat), parseFloat(job.delivery_lng)], { icon: deliverIcon })
        .addTo(mapInstance.current)
        .bindPopup('<b>Delivery</b><br>' + (job.delivery_address || ''));
    }
  }, [job]);

  const updateMarker = (lat, lng) => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L;
    const pos = [parseFloat(lat), parseFloat(lng)];

    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      const driverIcon = L.divIcon({
        html: '<div style="font-size:28px;text-align:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">🚗</div>',
        iconSize: [35, 35], className: '',
      });
      markerRef.current = L.marker(pos, { icon: driverIcon }).addTo(mapInstance.current);
      markerRef.current.bindPopup('<b>Driver Location</b>');
    }

    mapInstance.current.setView(pos, 15, { animate: true });
    setLocation({ lat, lng });
  };

  // Driver: Start/stop GPS tracking
  const startTracking = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }

    setTracking(true);
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        updateMarker(latitude, longitude);

        // Save to Supabase
        await supabase.from('express_driver_locations').insert([{
          driver_id: driverId,
          job_id: jobId,
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
        }]);
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    setWatchId(id);
  };

  const stopTracking = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setTracking(false);
    setWatchId(null);
  };

  return (
    <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🗺️</span>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Live Tracking</h3>
          {tracking && (
            <>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
              <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>GPS Active</span>
            </>
          )}
          {!isDriver && location && (
            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>Driver visible</span>
          )}
        </div>
        {isDriver && (
          <button onClick={tracking ? stopTracking : startTracking} style={{
            padding: '6px 16px', borderRadius: '8px', border: 'none',
            background: tracking ? '#ef4444' : '#10b981', color: 'white',
            fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>
            {tracking ? '⏹ Stop' : '▶ Start GPS'}
          </button>
        )}
      </div>

      <div ref={mapRef} style={{ height: '300px', width: '100%' }}></div>

      {location && (
        <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#64748b' }}>
          📍 {parseFloat(location.lat).toFixed(6)}, {parseFloat(location.lng).toFixed(6)}
        </div>
      )}

    </div>
  );
}
