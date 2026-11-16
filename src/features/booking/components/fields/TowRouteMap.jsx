'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getGoogleMapsClientConfig,
  loadGoogleMapsLibrary,
} from '@/lib/integrations/google-maps/client';
import styles from './BookingControls.module.css';

export function TowRouteMap({ pickup, dropoff, encodedPolyline }) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [routeLineError, setRouteLineError] = useState(false);

  useEffect(() => {
    let active = true;
    const markers = [];
    let routeLine;

    async function renderMap() {
      setError(null);
      setRouteLineError(false);
      try {
        const { mapId } = getGoogleMapsClientConfig();
        const [
          { Map, Polyline },
          { LatLngBounds },
          { AdvancedMarkerElement, Marker },
        ] = await Promise.all([
          loadGoogleMapsLibrary('maps'),
          loadGoogleMapsLibrary('core'),
          loadGoogleMapsLibrary('marker'),
        ]);
        if (!active || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: pickup,
          ...(mapId ? { mapId } : {}),
          zoom: 12,
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const MarkerConstructor = mapId ? AdvancedMarkerElement : Marker;
        if (!MarkerConstructor) {
          throw new Error(
            'Google Maps did not provide a marker implementation.',
          );
        }
        markers.push(
          new MarkerConstructor({
            map,
            position: pickup,
            title: 'Tow pickup',
          }),
          new MarkerConstructor({
            map,
            position: dropoff,
            title: 'Tow drop-off',
          }),
        );
        const bounds = new LatLngBounds();
        bounds.extend(pickup);
        bounds.extend(dropoff);

        if (encodedPolyline) {
          try {
            const geometry = await loadGoogleMapsLibrary('geometry');
            const path = geometry.encoding.decodePath(encodedPolyline);
            if (!path.length) throw new Error('The decoded route is empty.');
            routeLine = new Polyline({
              map,
              path,
              strokeColor: '#2563eb',
              strokeOpacity: 0.9,
              strokeWeight: 5,
            });
            for (const point of path) bounds.extend(point);
          } catch (routeError) {
            console.error('Google route polyline rendering failed', {
              name: routeError?.name,
              message: routeError?.message,
            });
            if (active) setRouteLineError(true);
          }
        }
        map.fitBounds(bounds, 40);
      } catch (mapError) {
        console.error('Google tow map initialization failed', {
          name: mapError?.name,
          message: mapError?.message,
        });
        if (active) {
          setError(
            'The route map could not be loaded. Check the browser Maps API configuration and try again.',
          );
        }
      }
    }

    renderMap();
    return () => {
      active = false;
      for (const marker of markers) marker.map = null;
      routeLine?.setMap(null);
    };
  }, [dropoff, encodedPolyline, pickup]);

  if (error)
    return (
      <div className={styles.mapError} role="alert">
        {error}
      </div>
    );
  return (
    <div className={styles.mapWrapper}>
      <div
        aria-label="Tow pickup, drop-off, and driving route map"
        className={styles.mapPreview}
        ref={containerRef}
        role="application"
      />
      {routeLineError ? (
        <p className={styles.mapCaption} role="status">
          Pickup and destination are shown, but the route line could not be
          drawn. The server-calculated driving distance remains authoritative.
        </p>
      ) : null}
    </div>
  );
}
