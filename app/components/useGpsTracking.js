'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const NEAR_THRESHOLD_METERS = 200;

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

export default function useGpsTracking(driverId, jobId, pickupCoords, deliveryCoords) {
  const [tracking, setTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [error, setError] = useState(null);
  const [proximity, setProximity] = useState({
    nearPickup: false, nearDelivery: false,
    pickupDistance: null, deliveryDistance: null,
  });
  const watchIdRef = useRef(null);

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

  // Load existing location history for this job
  useEffect(() => {
    if (!driverId || !jobId) {
      setLocationHistory([]);
      setCurrentLocation(null);
      setProximity({ nearPickup: false, nearDelivery: false, pickupDistance: null, deliveryDistance: null });
      return;
    }

    const loadHistory = async () => {
      const { data, error: err } = await supabase
        .from('express_driver_locations')
        .select('latitude, longitude, heading, speed, created_at')
        .eq('driver_id', driverId)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      if (err) {
        console.error('Failed to load location history:', err);
        return;
      }

      if (data && data.length > 0) {
        setLocationHistory(data.map(d => ({
          lat: parseFloat(d.latitude),
          lng: parseFloat(d.longitude),
          heading: d.heading,
          speed: d.speed,
          created_at: d.created_at,
        })));
        const last = data[data.length - 1];
        const loc = {
          lat: parseFloat(last.latitude),
          lng: parseFloat(last.longitude),
          heading: last.heading,
          speed: last.speed,
        };
        setCurrentLocation(loc);
        updateProximity(loc);
      }
    };

    loadHistory();
  }, [driverId, jobId]);

  // Recalculate proximity when coords change
  useEffect(() => {
    if (currentLocation) updateProximity(currentLocation);
  }, [pickupCoords, deliveryCoords]);

  // Stop tracking when jobId changes
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [jobId]);

  const startTracking = useCallback(() => {
    if (!driverId || !jobId) return;
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser');
      return;
    }
    if (watchIdRef.current !== null) return; // already tracking

    setError(null);
    setTracking(true);

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        const loc = {
          lat: latitude,
          lng: longitude,
          heading: heading || 0,
          speed: speed || 0,
        };

        setCurrentLocation(loc);
        setLocationHistory(prev => [...prev, { ...loc, created_at: new Date().toISOString() }]);
        updateProximity(loc);

        // Persist to database
        await supabase.from('express_driver_locations').insert([{
          driver_id: driverId,
          job_id: jobId,
          latitude,
          longitude,
          heading: heading || 0,
          speed: speed || 0,
        }]);
      },
      (err) => {
        console.error('GPS error:', err);
        setError(err.message || 'GPS error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    watchIdRef.current = id;
  }, [driverId, jobId, updateProximity]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  return { tracking, currentLocation, locationHistory, startTracking, stopTracking, error, proximity };
}
