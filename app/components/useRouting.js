'use client';
import { useState, useRef, useCallback } from 'react';

// Haversine distance in meters
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

export default function useRouting() {
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const lastFetchPos = useRef(null);

  const fetchRoute = useCallback(async (fromLat, fromLng, toLat, toLng) => {
    if (!fromLat || !fromLng || !toLat || !toLng) return;

    // 200m distance gate: skip if driver moved less than 200m from last fetch
    if (lastFetchPos.current) {
      const moved = haversineDistance(
        lastFetchPos.current.lat, lastFetchPos.current.lng,
        fromLat, fromLng
      );
      if (moved < 200) return;
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('OSRM request failed');
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        setRouteGeometry(route.geometry);
        setEta(Math.round(route.duration / 60)); // minutes
        setDistance((route.distance / 1000).toFixed(1)); // km
        lastFetchPos.current = { lat: fromLat, lng: fromLng };
      }
    } catch (err) {
      console.error('OSRM routing error:', err);
      // Keep last cached route on failure — don't clear
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRouteGeometry(null);
    setEta(null);
    setDistance(null);
    lastFetchPos.current = null;
  }, []);

  return { routeGeometry, eta, distance, fetchRoute, clearRoute };
}
