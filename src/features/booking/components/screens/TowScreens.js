'use client';

import { useMemo } from 'react';
import { Headphones, MapPin, RefreshCw, Route } from 'lucide-react';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';
import { OptionCardGroup } from '@/features/booking/components/fields/OptionCardGroup';
import { TextInput } from '@/features/booking/components/fields/TextInput';
import { TowLocationField } from '@/features/booking/components/fields/TowLocationField';
import { TowRouteMap } from '@/features/booking/components/fields/TowRouteMap';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import { toDropoffLocationAnswers } from '@/features/booking/schemas/locationSchema';
import { TOW_MAX_MILES } from '@/features/booking/schemas/routeCalculationSchema';
import { useTowRoute } from '@/features/booking/hooks/useTowRoute';
import { formatRouteDuration } from '@/features/booking/utils/routeDisplay';
import styles from './BookingScreens.module.css';

const neutralOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

function TowAddressesScreen({
  answers,
  errors,
  setAnswer,
  setAnswers,
  editScreen,
}) {
  const pickup = useMemo(
    () => ({ lat: answers.locationLatitude, lng: answers.locationLongitude }),
    [answers.locationLatitude, answers.locationLongitude],
  );
  const dropoff = useMemo(
    () => ({ lat: answers.dropoffLatitude, lng: answers.dropoffLongitude }),
    [answers.dropoffLatitude, answers.dropoffLongitude],
  );
  const hasBothLocations =
    Number.isFinite(pickup.lat) &&
    Number.isFinite(pickup.lng) &&
    Number.isFinite(dropoff.lat) &&
    Number.isFinite(dropoff.lng);

  const resolveDropoff = (location) => {
    setAnswers({
      ...toDropoffLocationAnswers(location),
      dropoffStatus:
        location.serviceAreaStatus === 'available'
          ? 'pin_moved'
          : 'unavailable',
    });
  };

  return (
    <ScreenLayout
      description="Confirm the pickup and destination. We’ll calculate the driving route automatically."
      screenId="W1"
      title="Where should we tow it?"
    >
      <div className={styles.stack}>
        <section
          className={styles.locationCard}
          aria-label="Confirmed tow pickup"
        >
          <div>
            <p className={styles.sectionLabel}>Pickup</p>
            <p className={styles.locationAddress}>
              {answers.locationAddress || 'Vehicle location not entered'}
            </p>
          </div>
          <button
            className={styles.editButton}
            onClick={() => editScreen('S4', 'W1')}
            type="button"
          >
            Change and confirm pickup
          </button>
        </section>
        <TowLocationField
          address={answers.dropoffAddress}
          error={errors.dropoffResolutionId || errors.dropoffStatus}
          onClear={() => setAnswer('dropoffResolutionId', undefined)}
          onResolved={resolveDropoff}
        />
        <TextInput
          id="dropoff-name"
          label="Drop-off name (optional)"
          onChange={(event) => setAnswer('dropoffName', event.target.value)}
          placeholder="e.g. Joe’s Auto Repair or home"
          value={answers.dropoffName || ''}
        />
        {hasBothLocations ? (
          <TowRouteMap pickup={pickup} dropoff={dropoff} />
        ) : null}
        {answers.dropoffServiceAreaStatus === 'unavailable' ? (
          <div className={styles.warningInfo} role="alert">
            This destination is outside the configured service area. Ask a
            dispatcher for help.
          </div>
        ) : null}
        {hasBothLocations &&
        answers.dropoffServiceAreaStatus === 'available' ? (
          <button
            className={styles.smallButton}
            disabled={answers.dropoffStatus === 'confirmed'}
            onClick={() => setAnswer('dropoffStatus', 'confirmed')}
            type="button"
          >
            <MapPin size={17} />
            {answers.dropoffStatus === 'confirmed'
              ? 'Drop-off confirmed'
              : 'Confirm this drop-off'}
          </button>
        ) : null}
      </div>
    </ScreenLayout>
  );
}

function TowRouteScreen({
  answers,
  errors,
  setAnswer,
  setAnswers,
  requestHandoff,
}) {
  const route = useTowRoute(answers, setAnswers);
  const pickup = useMemo(
    () => ({ lat: answers.locationLatitude, lng: answers.locationLongitude }),
    [answers.locationLatitude, answers.locationLongitude],
  );
  const dropoff = useMemo(
    () => ({ lat: answers.dropoffLatitude, lng: answers.dropoffLongitude }),
    [answers.dropoffLatitude, answers.dropoffLongitude],
  );
  const isOverLimit = answers.routeBillableMiles > TOW_MAX_MILES;

  const isRouteLoading =
    route.status === 'loading' ||
    (route.status === 'idle' && answers.routeStatus !== 'ready');

  if (isRouteLoading) {
    return (
      <LoadingSpinner
        card
        label="Calculating driving route…"
        sublabel="Fetching Google driving distance and map path"
      />
    );
  }

  if (route.status === 'error') {
    return (
      <ScreenLayout
        description="Google driving distance is calculated securely from your confirmed locations."
        screenId="W2"
        title="Review the tow route"
      >
        <div className={styles.errorPanel} role="alert">
          <p>{route.error?.message || 'No usable driving route was found.'}</p>
          <div className={styles.inlineActions}>
            <button
              className={styles.smallButton}
              onClick={route.retry}
              type="button"
            >
              <RefreshCw size={16} /> Retry route
            </button>
            <button
              className={styles.smallButton}
              onClick={requestHandoff}
              type="button"
            >
              <Headphones size={16} /> Ask a dispatcher
            </button>
          </div>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      description="Google driving distance is calculated securely from your confirmed locations."
      screenId="W2"
      title="Review the tow route"
    >
      <div className={styles.stack}>
        <div className={styles.routeSummary}>
          <Route aria-hidden="true" size={24} />
          <div>
            <strong>{answers.routeRawMiles?.toFixed(1)} driving miles</strong>
            <span>
              {formatRouteDuration(answers.routeDurationSeconds)} estimated ·{' '}
              {answers.routeBillableMiles} billable miles
            </span>
          </div>
        </div>
        <TowRouteMap
          pickup={pickup}
          dropoff={dropoff}
          encodedPolyline={answers.routeEncodedPolyline}
        />
        {isOverLimit ? (
          <div className={styles.warningInfo} role="alert">
            This route exceeds the {TOW_MAX_MILES}-mile online limit. Continue
            to have a dispatcher confirm the job.
          </div>
        ) : null}
      </div>
      {errors.routeCalculationId || errors.routeStatus ? (
        <p className={styles.error} role="alert">
          {errors.routeCalculationId || errors.routeStatus}
        </p>
      ) : null}
      <OptionCardGroup
        error={errors.neutral}
        label="Can the car be put in neutral?"
        onChange={(value) => setAnswer('neutral', value)}
        options={neutralOptions}
        value={answers.neutral}
      />
    </ScreenLayout>
  );
}

export function TowScreens(props) {
  if (props.screenId === 'W1') return <TowAddressesScreen {...props} />;
  if (props.screenId === 'W2') return <TowRouteScreen {...props} />;
  return null;
}
