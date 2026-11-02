'use client';

import { useState } from 'react';
import { Crosshair, MapPin } from 'lucide-react';
import { TextInput } from './TextInput';
import styles from './BookingControls.module.css';

export function AddressInput({
  address,
  onAddressChange,
  onConfirm,
  error,
  landmarks,
  onLandmarksChange,
}) {
  const [isLocating, setIsLocating] = useState(false);

  const useCurrentLocation = () => {
    setIsLocating(true);
    setTimeout(() => {
      onAddressChange('1200 N Federal Hwy, Hollywood, FL 33020');
      setIsLocating(false);
    }, 650);
  };

  return (
    <div className={styles.fieldset}>
      <div className={styles.addressActions}>
        <button
          className={styles.secondaryButton}
          disabled={isLocating}
          onClick={useCurrentLocation}
          type="button"
        >
          <Crosshair size={18} />
          {isLocating ? 'Finding location…' : 'Use my current location'}
        </button>
      </div>
      <TextInput
        error={error}
        id="vehicle-address"
        label="Street address and city"
        onChange={(event) => onAddressChange(event.target.value)}
        placeholder="e.g. 1200 N Federal Hwy, Hollywood, FL"
        value={address || ''}
      />
      <TextInput
        id="location-landmarks"
        label="Landmarks (optional)"
        onChange={(event) => onLandmarksChange(event.target.value)}
        placeholder="Near the Shell station, northbound lane"
        value={landmarks || ''}
      />
      {address ? (
        <div
          className={styles.mapPreview}
          aria-label="Mock location map preview"
        >
          <span className={styles.mapPin}>
            <MapPin size={24} aria-hidden="true" />
          </span>
          <span className={styles.mapCaption}>
            Map preview · drag pin coming later
          </span>
        </div>
      ) : null}
      {address ? (
        <button
          className={styles.secondaryButton}
          onClick={onConfirm}
          type="button"
        >
          <MapPin size={18} /> Yes, my vehicle is here
        </button>
      ) : null}
    </div>
  );
}
