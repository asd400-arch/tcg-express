'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export default function useGpsTracking(driverId, jobId) {
  const [tracking, setTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  // Load existing location history for this job
  useEffect(() => {
    if (!driverId || !jobId) {
      setLocationHistory([]);
      setCurrentLocation(null);
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
        setCurrentLocation({
          lat: parseFloat(last.latitude),
          lng: parseFloat(last.longitude),
          heading: last.heading,
          speed: last.speed,
        });
      }
    };

    loadHistory();
  }, [driverId, jobId]);

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
  }, [driverId, jobId]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }, []);

  return { tracking, currentLocation, locationHistory, startTracking, stopTracking, error };
}
