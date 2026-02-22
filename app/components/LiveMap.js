'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import useRouting from './useRouting';

// Haversine distance in meters (copied from useRouting.js)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Vehicle type configuration: color + SVG icon for each type
const VEHICLE_CONFIG = {
  motorcycle: {
    color: '#f59e0b',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="17" r="2.5" stroke="white" stroke-width="1.5"/>
      <circle cx="19" cy="17" r="2.5" stroke="white" stroke-width="1.5"/>
      <path d="M7.5 17L10 10h2.5l1 2.5H17L19 17" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 10L11 6.5h2" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
  },
  car: {
    color: '#3b82f6',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 14l1.5-1l1.5-4h5l2-3h5l2 3l1 1v4h-2a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2v-2l1 2z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="6.5" cy="16.5" r="1.5" fill="white"/>
      <circle cx="17.5" cy="16.5" r="1.5" fill="white"/>
      <line x1="9" y1="9" x2="9" y2="13" stroke="white" stroke-width="1" opacity="0.6"/>
      <line x1="14" y1="6" x2="14" y2="13" stroke="white" stroke-width="1" opacity="0.6"/>
    </svg>`,
  },
  mpv: {
    color: '#06b6d4',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 14l1.5-1l1.5-4h5l2-3h5l2 3l1 1v4h-2a2 2 0 0 1-4 0H8a2 2 0 0 1-4 0H2v-2l1 2z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="6.5" cy="16.5" r="1.5" fill="white"/>
      <circle cx="17.5" cy="16.5" r="1.5" fill="white"/>
      <line x1="9" y1="9" x2="9" y2="13" stroke="white" stroke-width="1" opacity="0.6"/>
      <line x1="14" y1="6" x2="14" y2="13" stroke="white" stroke-width="1" opacity="0.6"/>
    </svg>`,
  },
  van: {
    color: '#8b5cf6',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8h14v9H2z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M16 11h4l2 3v3h-6V11z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="6" cy="17" r="2" fill="white"/>
      <circle cx="18.5" cy="17" r="2" fill="white"/>
      <line x1="19" y1="11" x2="19" y2="14" stroke="white" stroke-width="1" opacity="0.6"/>
    </svg>`,
  },
  van_1_7m: {
    color: '#8b5cf6',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8h14v9H2z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M16 11h4l2 3v3h-6V11z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="6" cy="17" r="2" fill="white"/>
      <circle cx="18.5" cy="17" r="2" fill="white"/>
      <line x1="19" y1="11" x2="19" y2="14" stroke="white" stroke-width="1" opacity="0.6"/>
    </svg>`,
  },
  van_2_4m: {
    color: '#7c3aed',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8h14v9H2z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M16 11h4l2 3v3h-6V11z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="6" cy="17" r="2" fill="white"/>
      <circle cx="18.5" cy="17" r="2" fill="white"/>
      <line x1="19" y1="11" x2="19" y2="14" stroke="white" stroke-width="1" opacity="0.6"/>
    </svg>`,
  },
  truck: {
    color: '#10b981',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="5" width="14" height="12" rx="1.5" stroke="white" stroke-width="1.3"/>
      <path d="M15 10h5l2.5 3.5V17h-7.5V10z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="5.5" cy="17" r="2" fill="white"/>
      <circle cx="19" cy="17" r="2" fill="white"/>
      <line x1="18" y1="10" x2="18" y2="13.5" stroke="white" stroke-width="1" opacity="0.6"/>
    </svg>`,
  },
  lorry: {
    color: '#ef4444',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="15" height="13" rx="1.5" stroke="white" stroke-width="1.3"/>
      <path d="M1 8h7v9H1z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M1 8l2-2h3l2 2" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="4.5" cy="17" r="2" fill="white"/>
      <circle cx="15" cy="17" r="2" fill="white"/>
      <circle cx="20" cy="17" r="2" fill="white"/>
    </svg>`,
  },
  lorry_10ft: {
    color: '#ef4444',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="15" height="13" rx="1.5" stroke="white" stroke-width="1.3"/>
      <path d="M1 8h7v9H1z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M1 8l2-2h3l2 2" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="4.5" cy="17" r="2" fill="white"/>
      <circle cx="15" cy="17" r="2" fill="white"/>
      <circle cx="20" cy="17" r="2" fill="white"/>
    </svg>`,
  },
  lorry_14ft: {
    color: '#dc2626',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="15" height="13" rx="1.5" stroke="white" stroke-width="1.3"/>
      <path d="M1 8h7v9H1z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M1 8l2-2h3l2 2" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="4.5" cy="17" r="2" fill="white"/>
      <circle cx="15" cy="17" r="2" fill="white"/>
      <circle cx="20" cy="17" r="2" fill="white"/>
    </svg>`,
  },
  lorry_24ft: {
    color: '#991b1b',
    svg: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="4" width="15" height="13" rx="1.5" stroke="white" stroke-width="1.3"/>
      <path d="M1 8h7v9H1z" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M1 8l2-2h3l2 2" stroke="white" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="4.5" cy="17" r="2" fill="white"/>
      <circle cx="15" cy="17" r="2" fill="white"/>
      <circle cx="20" cy="17" r="2" fill="white"/>
    </svg>`,
  },
};

function getVehicleConfig(type) {
  return VEHICLE_CONFIG[type] || VEHICLE_CONFIG.car;
}

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

export default function LiveMap({
  jobId,
  driverId,
  isDriver = false,
  driverLocation = null,
  locationHistory: externalHistory = null,
  mapHeight = '300px',
  fullscreen = false,
  onEtaUpdate = null,
  onLastUpdated = null,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const deliveryMarkerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const trailLayerRef = useRef(null);
  const recenterControlRef = useRef(null);
  const userHasPannedRef = useRef(false);
  const lastHeadingRef = useRef(0);
  const lastPositionRef = useRef(null);
  const [location, setLocation] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [job, setJob] = useState(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(null);
  const [timeAgoTick, setTimeAgoTick] = useState(0);
  const [driverVehicleType, setDriverVehicleType] = useState(null);
  // Client mode: internal location history from real-time subscription
  const [clientHistory, setClientHistory] = useState([]);
  const { routeGeometry, eta, distance, fetchRoute, clearRoute } = useRouting();

  const locationHistory = externalHistory || clientHistory;

  // Resolve effective vehicle type: driver's vehicle_type > job's vehicle_required > 'car'
  const effectiveVehicleType = driverVehicleType
    || (job?.vehicle_required && job.vehicle_required !== 'any' ? job.vehicle_required : null)
    || 'car';

  // Tile URLs
  const tileUrl = fullscreen
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const tileAttribution = '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';

  // Calculate heading from two positions
  const calcHeading = useCallback((lat1, lng1, lat2, lng2) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }, []);

  // Create styled driver marker HTML with vehicle-specific icon
  const createDriverMarkerHtml = useCallback((heading, vehicleType) => {
    const config = getVehicleConfig(vehicleType);
    const color = config.color;
    return `
      <div style="position:relative;width:48px;height:48px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color}30;animation:markerPulse 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;animation:vehicleBob 2s ease-in-out infinite;">
          <div style="display:flex;align-items:center;justify-content:center;margin-top:1px;">
            ${config.svg}
          </div>
        </div>
        <div style="position:absolute;top:-7px;left:50%;transform:translateX(-50%) rotate(${heading}deg);transform-origin:center 31px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:11px solid ${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></div>
      </div>
    `;
  }, []);

  // Create pickup/delivery pin HTML
  const createPinHtml = useCallback((label, color, isNearby) => {
    const pulseRing = isNearby
      ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:3px solid ${color};animation:arrivalPulse 1.5s ease-out infinite;"></div>`
      : '';
    return `
      <div style="position:relative;width:30px;height:40px;">
        ${pulseRing}
        <svg viewBox="0 0 30 40" width="30" height="40">
          <path d="M15 38 C15 38 2 22 2 14 C2 6.82 7.82 1 15 1 C22.18 1 28 6.82 28 14 C28 22 15 38 15 38Z" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="15" y="18" text-anchor="middle" fill="white" font-size="13" font-weight="700" font-family="Inter,sans-serif">${label}</text>
        </svg>
      </div>
    `;
  }, []);

  // Tick interval for "time ago" display
  useEffect(() => {
    const interval = setInterval(() => setTimeAgoTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

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
      const map = L.map(mapRef.current, {
        zoomControl: !fullscreen,
      }).setView([1.3521, 103.8198], 12);

      L.tileLayer(tileUrl, { attribution: tileAttribution }).addTo(map);
      mapInstance.current = map;

      // Track user panning
      map.on('dragstart', () => {
        userHasPannedRef.current = true;
        if (recenterControlRef.current) {
          recenterControlRef.current.getContainer().style.display = 'block';
        }
      });

      // Add recenter button (fullscreen only)
      if (fullscreen) {
        const RecenterControl = L.Control.extend({
          options: { position: 'bottomright' },
          onAdd: function () {
            const btn = L.DomUtil.create('div', '');
            btn.innerHTML = `
              <button style="
                width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;
                background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);
                box-shadow:0 2px 12px rgba(0,0,0,0.25);display:flex;align-items:center;
                justify-content:center;animation:fadeInScale 0.3s ease-out;margin-bottom:20px;
              " title="Recenter on driver">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="12" y1="2" x2="12" y2="6"/>
                  <line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="6" y2="12"/>
                  <line x1="18" y1="12" x2="22" y2="12"/>
                </svg>
              </button>
            `;
            btn.style.display = 'none';
            L.DomEvent.disableClickPropagation(btn);
            btn.querySelector('button').addEventListener('click', () => {
              userHasPannedRef.current = false;
              btn.style.display = 'none';
              if (lastPositionRef.current) {
                mapInstance.current.setView(lastPositionRef.current, mapInstance.current.getZoom(), { animate: true });
              }
            });
            return btn;
          },
        });
        const ctrl = new RecenterControl();
        ctrl.addTo(map);
        recenterControlRef.current = ctrl;
      }
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

  // Fetch driver's vehicle_type
  useEffect(() => {
    if (!driverId) return;
    supabase.from('express_users').select('vehicle_type').eq('id', driverId).single().then(({ data }) => {
      if (data?.vehicle_type) setDriverVehicleType(data.vehicle_type);
    });
  }, [driverId]);

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
        updateMarker(last.latitude, last.longitude, last.heading);
        setSpeed(last.speed || 0);
        setLastUpdatedTime(last.created_at);
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
        const { latitude, longitude, speed: spd, heading } = payload.new;
        updateMarker(latitude, longitude, heading);
        setSpeed(spd || 0);
        setLastUpdatedTime(payload.new.created_at);
        setClientHistory(prev => [...prev, {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          heading: heading,
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

    // Determine driver proximity for arrival pulse
    const driverLat = location ? parseFloat(location.lat) : null;
    const driverLng = location ? parseFloat(location.lng) : null;

    if (job.pickup_lat && job.pickup_lng) {
      const pos = [parseFloat(job.pickup_lat), parseFloat(job.pickup_lng)];
      const isNearPickup = driverLat !== null
        ? haversineDistance(driverLat, driverLng, pos[0], pos[1]) < 200
        : false;

      // Remove old marker
      if (pickupMarkerRef.current) {
        mapInstance.current.removeLayer(pickupMarkerRef.current);
      }

      const pickupIcon = L.divIcon({
        html: createPinHtml('P', '#16a34a', isNearPickup),
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        className: '',
      });
      pickupMarkerRef.current = L.marker(pos, { icon: pickupIcon })
        .addTo(mapInstance.current)
        .bindPopup(`<b>Pickup</b><br>${job.pickup_address || ''}`);
      bounds.push(pos);
    }

    if (job.delivery_lat && job.delivery_lng) {
      const pos = [parseFloat(job.delivery_lat), parseFloat(job.delivery_lng)];
      const isNearDelivery = driverLat !== null
        ? haversineDistance(driverLat, driverLng, pos[0], pos[1]) < 200
        : false;

      // Remove old marker
      if (deliveryMarkerRef.current) {
        mapInstance.current.removeLayer(deliveryMarkerRef.current);
      }

      const deliverIcon = L.divIcon({
        html: createPinHtml('D', '#dc2626', isNearDelivery),
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        className: '',
      });
      deliveryMarkerRef.current = L.marker(pos, { icon: deliverIcon })
        .addTo(mapInstance.current)
        .bindPopup(`<b>Delivery</b><br>${job.delivery_address || ''}`);
      bounds.push(pos);
    }

    // Fit bounds if fullscreen and we have markers
    if (fullscreen && bounds.length >= 2) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [job, fullscreen, location, createPinHtml]);

  // Driver mode: update marker from parent-provided driverLocation
  useEffect(() => {
    if (!isDriver || !driverLocation) return;
    updateMarker(driverLocation.lat, driverLocation.lng, driverLocation.heading);
    setSpeed(driverLocation.speed || 0);
    setLastUpdatedTime(new Date().toISOString());
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

  // Draw route polyline with status-based colors
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L;

    // Remove old route layer
    if (routeLayerRef.current) {
      mapInstance.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (routeGeometry) {
      const isToPickup = job && ['assigned', 'pickup_confirmed'].includes(job.status);
      const routeColor = isToPickup ? '#3b82f6' : '#10b981';

      routeLayerRef.current = L.geoJSON(routeGeometry, {
        style: {
          color: routeColor,
          weight: 5,
          opacity: 0.85,
          dashArray: '10, 10',
          lineCap: 'round',
          lineJoin: 'round',
        },
      }).addTo(mapInstance.current);

      // Animate dash pattern via SVG style
      try {
        routeLayerRef.current.eachLayer((layer) => {
          const el = layer.getElement();
          if (el) {
            el.style.animation = 'routeDash 1s linear infinite';
          }
        });
      } catch (e) { /* ignore if SVG animation not supported */ }
    }
  }, [routeGeometry, job]);

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
        color: fullscreen ? '#10b981' : '#94a3b8',
        weight: 3,
        opacity: 0.5,
      }).addTo(mapInstance.current);
    }
  }, [locationHistory, fullscreen]);

  // Re-render driver marker when vehicle type resolves
  useEffect(() => {
    if (!markerRef.current || !mapInstance.current || !window.L) return;
    const L = window.L;
    const heading = lastHeadingRef.current;
    const vConfig = getVehicleConfig(effectiveVehicleType);
    const driverIcon = L.divIcon({
      html: createDriverMarkerHtml(heading, effectiveVehicleType),
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      className: '',
    });
    markerRef.current.setIcon(driverIcon);
    const vLabel = effectiveVehicleType.charAt(0).toUpperCase() + effectiveVehicleType.slice(1);
    markerRef.current.setPopupContent(`<b>Driver Location</b><br><span style="color:${vConfig.color};font-weight:600">${vLabel}</span>`);
  }, [effectiveVehicleType, createDriverMarkerHtml]);

  // Notify parent of ETA updates
  useEffect(() => {
    if (onEtaUpdate) {
      onEtaUpdate(eta, distance);
    }
  }, [eta, distance, onEtaUpdate]);

  // Notify parent of last updated time
  useEffect(() => {
    if (onLastUpdated && lastUpdatedTime) {
      onLastUpdated(lastUpdatedTime);
    }
  }, [lastUpdatedTime, onLastUpdated]);

  const updateMarker = useCallback((lat, lng, gpsHeading) => {
    if (!mapInstance.current || !window.L) return;
    const L = window.L;
    const pos = [parseFloat(lat), parseFloat(lng)];

    // Calculate heading
    let heading = lastHeadingRef.current;
    if (gpsHeading != null && gpsHeading !== 0) {
      heading = gpsHeading;
    } else if (lastPositionRef.current) {
      const [prevLat, prevLng] = lastPositionRef.current;
      const dist = haversineDistance(prevLat, prevLng, pos[0], pos[1]);
      if (dist > 5) {
        heading = calcHeading(prevLat, prevLng, pos[0], pos[1]);
      }
    }
    lastHeadingRef.current = heading;
    lastPositionRef.current = pos;

    const vType = effectiveVehicleType;
    const vConfig = getVehicleConfig(vType);
    const driverIcon = L.divIcon({
      html: createDriverMarkerHtml(heading, vType),
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      className: '',
    });

    if (markerRef.current) {
      markerRef.current.setIcon(driverIcon);
      // Smooth transition
      const el = markerRef.current.getElement();
      if (el) {
        el.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      }
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos, { icon: driverIcon, zIndexOffset: 1000 }).addTo(mapInstance.current);
      const vLabel = vType.charAt(0).toUpperCase() + vType.slice(1);
      markerRef.current.bindPopup(`<b>Driver Location</b><br><span style="color:${vConfig.color};font-weight:600">${vLabel}</span>`);
    }

    if (!userHasPannedRef.current) {
      mapInstance.current.setView(pos, mapInstance.current.getZoom() < 13 ? 15 : mapInstance.current.getZoom(), { animate: true });
    }
    setLocation({ lat, lng });
  }, [calcHeading, createDriverMarkerHtml, effectiveVehicleType]);

  const containerStyle = fullscreen
    ? { background: fullscreen ? '#0f172a' : 'white', overflow: 'hidden' }
    : { background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', overflow: 'hidden' };

  const speedKmh = speed ? (speed * 3.6).toFixed(0) : 0;

  // Fullscreen mode: no header/footer (track page provides its own UI)
  if (fullscreen) {
    return (
      <div style={containerStyle}>
        <div ref={mapRef} style={{ height: mapHeight, width: '100%' }}></div>
      </div>
    );
  }

  // Embedded mode: header + map + footer
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {location && (
            <span style={{ fontWeight: '600' }}>🏎️ {speedKmh} km/h</span>
          )}
          {lastUpdatedTime && (
            <span style={{ color: '#94a3b8' }}>Updated {formatTimeAgo(lastUpdatedTime)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
