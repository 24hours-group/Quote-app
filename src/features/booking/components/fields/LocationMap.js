'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getGoogleMapsClientConfig,
  loadGoogleMapsLibrary,
} from '@/lib/integrations/google-maps/client';
import styles from './BookingControls.module.css';

export function LocationMap({ latitude, longitude, onMarkerMoved }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onMarkerMovedRef = useRef(onMarkerMoved);
  const initialPositionRef = useRef({ lat: latitude, lng: longitude });
  const [error, setError] = useState(null);

  useEffect(() => {
    onMarkerMovedRef.current = onMarkerMoved;
  }, [onMarkerMoved]);

  useEffect(() => {
    let active = true;
    let dragListener;

    async function initialize() {
      try {
        const { mapId } = getGoogleMapsClientConfig();
        const [{ Map }, { AdvancedMarkerElement, Marker }] = await Promise.all([
          loadGoogleMapsLibrary('maps'),
          loadGoogleMapsLibrary('marker'),
        ]);
        if (!active || !containerRef.current) return;
        const position = initialPositionRef.current;
        mapRef.current = new Map(containerRef.current, {
          center: position,
          ...(mapId ? { mapId } : {}),
          zoom: 17,
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
        markerRef.current = new MarkerConstructor({
          map: mapRef.current,
          position,
          ...(mapId ? { gmpDraggable: true } : { draggable: true }),
          title: 'Vehicle location. Drag to adjust.',
        });
        dragListener = markerRef.current.addListener('dragend', (event) => {
          if (!event.latLng) return;
          onMarkerMovedRef.current({
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          });
        });
      } catch {
        if (active) setError('The map could not be loaded. Try again.');
      }
    }

    initialize();
    return () => {
      active = false;
      dragListener?.remove();
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const position = { lat: latitude, lng: longitude };
    if (markerRef.current) markerRef.current.position = position;
    mapRef.current?.panTo(position);
  }, [latitude, longitude]);

  if (error)
    return (
      <div className={styles.mapError} role="alert">
        {error}
      </div>
    );

  return (
    <div className={styles.mapWrapper}>
      <div
        aria-label="Interactive vehicle location map"
        className={styles.mapPreview}
        ref={containerRef}
        role="application"
      />
      <p className={styles.mapCaption}>
        Drag the pin to your vehicle’s exact location
      </p>
    </div>
  );
}
