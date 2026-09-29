'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const NEAR_THRESHOLD_METERS = 200;
const SEND_GAP_MS = 5000; // upload at most one position every 5 s
const HEARTBEAT_MS = 30000; // and at least one every 30 s while the page is open

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
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

/**
 * Shares the driver's position for one job from the web app (drivers on Android use the browser).
 *
 * Positions go through PATCH /api/jobs/[id]/location, which keeps one row per job up to date.
 * (The old version inserted rows straight into express_driver_locations; the table allows one
 * row per job, so every insert after the first failed and the customer's map never moved.)
 *
 * Browsers pause location when the tab is hidden or the screen locks, so tracking restarts when
 * the page becomes visible again, sends a heartbeat every 30 s, and keeps the screen awake where
 * the browser supports it.
 */
export default function useGpsTracking(driverId, jobId, pickupCoords, deliveryCoords) {
  const [tracking, setTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [error, setError] = useState(null);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [proximity, setProximity] = useState({
    nearPickup: false, nearDelivery: false,
    pickupDistance: null, deliveryDistance: null,
  });
  const watchIdRef = useRef(null);
  const wantTrackingRef = useRef(false);
  const lastSentRef = useRef(0);
  const sendingRef = useRef(false);
  const wakeLockRef = useRef(null);

  // Calculate proximity whenever location or coords change
  const updateProximity = useCallback((loc) => {
    if (!loc) return;
    const newProximity = {
      nearPickup: false, nearDelivery: false,
      pickupDistance: null, deliveryDistance: null,
    };
    if (pickupCoords?.lat && pickupCoords?.lng) {
      const dist = haversineDistance(loc.lat, loc.lng, pickupCoords.lat, pickupCoords.lng);
      newProximity.pickupDistance = Math.round(dist);
      newProximity.nearPickup = dist <= NEAR_THRESHOLD_METERS;
    }
    if (deliveryCoords?.lat && deliveryCoords?.lng) {
      const dist = haversineDistance(loc.lat, loc.lng, deliveryCoords.lat, deliveryCoords.lng);
      newProximity.deliveryDistance = Math.round(dist);
      newProximity.nearDelivery = dist <= NEAR_THRESHOLD_METERS;
    }
    setProximity(newProximity);
  }, [pickupCoords, deliveryCoords]);

  // Load the last shared position for this job
  useEffect(() => {
    if (!driverId || !jobId) {
      setLocationHistory([]);
      setCurrentLocation(null);
      setLastSentAt(null);
      setProximity({ nearPickup: false, nearDelivery: false, pickupDistance: null, deliveryDistance: null });
      return;
    }

    let cancelled = false;
    fetch(`/api/jobs/${jobId}/location`)
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        const d = result?.data;
        if (cancelled || !d) return;
        const loc = { lat: Number(d.latitude), lng: Number(d.longitude), heading: d.heading || 0, speed: d.speed || 0 };
        setLocationHistory([{ ...loc, created_at: d.updated_at }]);
        setCurrentLocation(loc);
        setLastSentAt(d.updated_at ? new Date(d.updated_at).getTime() : null);
        updateProximity(loc);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [driverId, jobId]);

  // Recalculate proximity when coords change
  useEffect(() => {
    if (currentLocation) updateProximity(currentLocation);
  }, [pickupCoords, deliveryCoords]);

  const upload = useCallback(async (coords, force = false) => {
    if (!jobId || sendingRef.current) return;
    const now = Date.now();
    if (!force && now - lastSentRef.current < SEND_GAP_MS) return;
    sendingRef.current = true;
    lastSentRef.current = now;
    try {
      const res = await fetch(`/api/jobs/${jobId}/location`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          heading: Number.isFinite(coords.heading) ? coords.heading : 0,
          speed: Number.isFinite(coords.speed) ? coords.speed : 0,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
        }),
      });
      if (res.ok) setLastSentAt(Date.now());
    } catch {
      // offline for a moment; the next position or heartbeat tries again
    } finally {
      sendingRef.current = false;
    }
  }, [jobId]);

  const onPosition = useCallback((pos, force = false) => {
    const { latitude, longitude, heading, speed } = pos.coords;
    const loc = {
      lat: latitude,
      lng: longitude,
      heading: Number.isFinite(heading) ? heading : 0,
      speed: Number.isFinite(speed) ? speed : 0,
    };
    setCurrentLocation(loc);
    setLocationHistory(prev => [...prev.slice(-500), { ...loc, created_at: new Date().toISOString() }]);
    updateProximity(loc);
    upload(pos.coords, force);
  }, [updateProximity, upload]);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) lock.release().catch(() => {});
  }, []);

  const requestWakeLock = useCallback(async () => {
    // Keeps the screen on while the driver has this page open, so the browser keeps sharing.
    if (wakeLockRef.current || typeof navigator === 'undefined' || !navigator.wakeLock) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      wakeLockRef.current.addEventListener?.('release', () => { wakeLockRef.current = null; });
    } catch {
      // not allowed (battery saver, iframe, older browser) — tracking still works while visible
    }
  }, []);

  const sendFreshFix = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => onPosition(pos, true),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 },
    );
  }, [onPosition]);

  const openWatch = useCallback(() => {
    clearWatch();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null);
        onPosition(pos);
      },
      (err) => {
        console.error('GPS error:', err);
        if (err?.code === 1) {
          // PERMISSION_DENIED — nothing more we can do until the driver allows location
          setError('Location is blocked for this site. Allow location in your browser settings so the customer can follow the delivery.');
          wantTrackingRef.current = false;
          clearWatch();
          setTracking(false);
        } else {
          setError(err?.message || 'GPS error');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  }, [clearWatch, onPosition]);

  const startTracking = useCallback(() => {
    if (!driverId || !jobId) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported by your browser');
      return;
    }
    if (wantTrackingRef.current && watchIdRef.current !== null) return; // already tracking

    wantTrackingRef.current = true;
    setError(null);
    setTracking(true);
    lastSentRef.current = 0;
    openWatch();
    sendFreshFix();
    requestWakeLock();
  }, [driverId, jobId, openWatch, sendFreshFix, requestWakeLock]);

  const stopTracking = useCallback(() => {
    wantTrackingRef.current = false;
    clearWatch();
    releaseWakeLock();
    setTracking(false);
  }, [clearWatch, releaseWakeLock]);

  // Browsers pause location while the tab is hidden: restart and send a position when it's back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !wantTrackingRef.current) return;
      openWatch();
      sendFreshFix();
      requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [openWatch, sendFreshFix, requestWakeLock]);

  // Heartbeat so a driver standing still (loading at pickup) still shows as live
  useEffect(() => {
    const timer = setInterval(() => {
      if (!wantTrackingRef.current || document.visibilityState !== 'visible') return;
      if (Date.now() - lastSentRef.current >= HEARTBEAT_MS - 1000) sendFreshFix();
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [sendFreshFix]);

  // Stop tracking when the job changes or the page closes
  useEffect(() => {
    return () => {
      wantTrackingRef.current = false;
      clearWatch();
      releaseWakeLock();
      setTracking(false);
    };
  }, [jobId, clearWatch, releaseWakeLock]);

  return { tracking, currentLocation, locationHistory, startTracking, stopTracking, error, proximity, lastSentAt };
}
