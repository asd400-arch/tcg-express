'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import useRouting from './useRouting';

export default function LiveMap({
  jobId,
  driverId,
  isDriver = false,
  driverLocation = null,
  locationHistory: externalHistory = null,
  mapHeight = '300px',
  fullscreen = false,
  onEtaUpdate = null,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const trailLayerRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [job, setJob] = useState(null);
  // Client mode: internal location history from real-time subscription
  const [clientHistory, setClientHistory] = useState([]);
  const { routeGeometry, eta, distance, fetchRoute, clearRoute } = useRouting();

  const locationHistory = externalHistory || clientHistory;

  // Load Leaflet CSS and JS + job info
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!document.getElementById('leaflet-css')) {
      const css = document.createElement('link');
      css.id = 'leaflet-css';
      css.rel = 'stylesheet';
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
    }

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
      const map = L.map(mapRef.current).setView([1.3521, 103.8198], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      mapInstance.current = map;
    });

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

  // Client mode: load history + subscribe to real-time location
  useEffect(() => {
    if (isDriver || !driverId || !jobId) return;

    // Load full location history for trail
    const loadHistory = async () => {
      const { data } = await supabase
        .from('express_driver_locations')
        .select('latitude, longitude, heading, speed, created_at')
        .eq('driver_id', driverId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        const hist = data.map(d => ({
          lat: parseFloat(d.latitude),
          lng: parseFloat(d.longitude),
          heading: d.heading,
          speed: d.speed,
          created_at: d.created_at,
        }));
        setClientHistory(hist);
        const last = data[data.length - 1];
        updateMarker(last.latitude, last.longitude);
        setSpeed(last.speed || 0);
      }
    };
    loadHistory();

    // Subscribe to new location inserts
    const channel = supabase
      .channel(`location-${jobId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'express_driver_locations',
        filter: `job_id=eq.${jobId}`,
      }, (payload) => {
        const { latitude, longitude, speed: spd } = payload.new;
        updateMarker(latitude, longitude);
        setSpeed(spd || 0);
        setClientHistory(prev => [...prev, {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          heading: payload.new.heading,
          speed: spd,
          created_at: payload.new.created_at,
        }]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [driverId, jobId, isDriver]);

  // Add pickup/delivery markers when job loads
  useEffect(() => {
    if (!job || !mapInstance.current || !window.L) return;
    const L = window.L;
    const bounds = [];

    if (job.pickup_lat && job.pickup_lng) {
      const pos = [parseFloat(job.pickup_lat), parseFloat(job.pickup_lng)];
      const pickupIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center">📍</div>',
        iconSize: [30, 30], className: '',
      });
      L.marker(pos, { icon: pickupIcon })
        .addTo(mapInstance.current)
        .bindPopup('<b>Pickup</b><br>' + (job.pickup_address || ''));
      bounds.push(pos);
    }

    if (job.delivery_lat && job.delivery_lng) {
      const pos = [parseFloat(job.delivery_lat), parseFloat(job.delivery_lng)];
      const deliverIcon = L.divIcon({
        html: '<div style="font-size:24px;text-align:center">📦</div>',
        iconSize: [30, 30], className: '',
      });
      L.marker(pos, { icon: deliverIcon })
        .addTo(mapInstance.current)
        .bindPopup('<b>Delivery</b><br>' + (job.delivery_address || ''));
      bounds.push(pos);
    }

    // Fit bounds if fullscreen and we have markers
    if (fullscreen && bounds.length >= 2) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [job, fullscreen]);

  // Driver mode: update marker from parent-provided driverLocation
  useEffect(() => {
    if (!isDriver || !driverLocation) return;
    updateMarker(driverLocation.lat, driverLocation.lng);
    setSpeed(driverLocation.speed || 0);
  }, [driverLocation, isDriver]);

  // Fetch route when location or job changes
  useEffect(() => {
    if (!location || !job) return;

    let destLat, destLng;
    if (['assigned', 'pickup_confirmed'].includes(job.status) && job.pickup_lat && job.pickup_lng) {
      destLat = parseFloat(job.pickup_lat);
      destLng = parseFloat(job.pickup_lng);
    } else if (job.status === 'in_transit' && job.delivery_lat && job.delivery_lng) {
      destLat = parseFloat(job.delivery_lat);
      destLng = parseFloat(job.delivery_lng);
    }

    if (destLat && destLng) {
      fetchRoute(parseFloat(location.lat), parseFloat(location.lng), destLat, destLng);
    }
  }, [location, job, fetchRoute]);

  // Draw route polyline
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L;

    // Remove old route layer
    if (routeLayerRef.current) {
      mapInstance.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (routeGeometry) {
      routeLayerRef.current = L.geoJSON(routeGeometry, {
        style: { color: '#3b82f6', weight: 5, opacity: 0.8 },
      }).addTo(mapInstance.current);
    }
  }, [routeGeometry]);

  // Draw trail polyline
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L;

    // Remove old trail
    if (trailLayerRef.current) {
      mapInstance.current.removeLayer(trailLayerRef.current);
      trailLayerRef.current = null;
    }

    if (locationHistory && locationHistory.length >= 2) {
      const latlngs = locationHistory.map(p => [p.lat, p.lng]);
      trailLayerRef.current = L.polyline(latlngs, {
        color: '#94a3b8',
        weight: 3,
        opacity: 0.7,
        dashArray: '5, 10',
      }).addTo(mapInstance.current);
    }
  }, [locationHistory]);

  // Notify parent of ETA updates
  useEffect(() => {
    if (onEtaUpdate) {
      onEtaUpdate(eta, distance);
    }
  }, [eta, distance, onEtaUpdate]);

  const updateMarker = useCallback((lat, lng) => {
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

    mapInstance.current.setView(pos, mapInstance.current.getZoom() < 13 ? 15 : mapInstance.current.getZoom(), { animate: true });
    setLocation({ lat, lng });
  }, []);

  const containerStyle = fullscreen
    ? { background: 'white', overflow: 'hidden' }
    : { background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', overflow: 'hidden' };

  const speedKmh = speed ? (speed * 3.6).toFixed(0) : 0;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🗺️</span>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 }}>Live Tracking</h3>
          {location && (
            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600' }}>
              {isDriver ? 'GPS Active' : 'Driver visible'}
            </span>
          )}
          {isDriver && location && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {eta !== null && (
            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', background: '#3b82f620', color: '#3b82f6' }}>
              ETA: {eta} min
            </span>
          )}
          {distance !== null && (
            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', background: '#10b98120', color: '#10b981' }}>
              {distance} km
            </span>
          )}
          {eta === null && location && job && (
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>ETA unavailable</span>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: mapHeight, width: '100%' }}></div>

      {/* Footer */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
        <span>
          {location
            ? `📍 ${parseFloat(location.lat).toFixed(6)}, ${parseFloat(location.lng).toFixed(6)}`
            : '📍 Waiting for location...'}
        </span>
        {location && (
          <span style={{ fontWeight: '600' }}>🏎️ {speedKmh} km/h</span>
        )}
      </div>
    </div>
  );
}
