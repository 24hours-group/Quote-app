import { AddressInput } from '@/features/booking/components/fields/AddressInput';
import { ExistingRequestFields } from '@/features/booking/components/fields/ExistingRequestFields';
import { OptionCardGroup } from '@/features/booking/components/fields/OptionCardGroup';
import { VehicleCatalogFields } from '@/features/booking/components/fields/VehicleCatalogFields';
import { serviceOptions } from '@/features/booking/mock-data/screenOptions';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import styles from './BookingScreens.module.css';

const vehicleSizeOptions = [
  {
    value: 'heavy',
    label: 'Yes',
    description: 'Box truck, RV, bus, or larger than a 1-ton pickup',
  },
  {
    value: 'regular',
    label: 'No',
    description: 'Regular passenger vehicle or light truck',
  },
];

function LocationScreen({ answers, errors, setAnswer, setAnswers }) {
  const updateLocation = (location) => {
    setAnswers({
      locationResolutionId: location.resolutionId,
      locationAddress: location.formattedAddress,
      locationPlaceId: location.placeId,
      locationLatitude: location.latitude,
      locationLongitude: location.longitude,
      locationTimezone: location.timezone,
      locationCountryCode: location.countryCode,
      locationAccuracyMeters: location.accuracyMeters,
      locationSource: location.source,
      locationServiceAreaStatus: location.serviceAreaStatus,
      locationResolvedAt: location.resolvedAt,
      locationStatus:
        location.serviceAreaStatus === 'available'
          ? 'pin_moved'
          : 'unavailable',
    });
  };

  const clearLocation = () => setAnswer('locationResolutionId', undefined);

  return (
    <ScreenLayout
      description="An exact location gets help to you faster. Confirm the preview before continuing."
      screenId="S4"
      title="Where is your vehicle?"
    >
      <AddressInput
        address={answers.locationAddress}
        error={errors.locationStatus}
        landmarks={answers.landmarks}
        latitude={answers.locationLatitude}
        locationStatus={answers.locationStatus}
        longitude={answers.locationLongitude}
        onConfirm={() => setAnswer('locationStatus', 'confirmed')}
        onLandmarksChange={(value) => setAnswer('landmarks', value)}
        onLocationChange={updateLocation}
        onLocationClear={clearLocation}
        serviceAreaStatus={answers.locationServiceAreaStatus}
      />
      {answers.locationStatus === 'confirmed' ? (
        <div className={styles.successInfo}>Location confirmed</div>
      ) : null}
      <button
        className={styles.linkButton}
        onClick={() => setAnswer('locationStatus', 'unavailable')}
        type="button"
      >
        I can’t give a location
      </button>
    </ScreenLayout>
  );
}

function VehicleScreen({ answers, errors, setAnswer, setAnswers }) {
  const isExistingRequest = ['existing', 'cancel'].includes(
    answers.requestType,
  );

  if (isExistingRequest) {
    return (
      <ScreenLayout
        description="Enter the reference from your confirmation. For privacy, an agent will verify the booking before sharing status details, cancelling service, or discussing a refund."
        screenId="S5"
        title={
          answers.requestType === 'cancel'
            ? 'Which booking needs review?'
            : 'Which booking are you checking?'
        }
      >
        <ExistingRequestFields
          answers={answers}
          errors={errors}
          setAnswer={setAnswer}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      description="Select a suggestion or type your vehicle details if they are not listed. Heavy-duty vehicles are handled by a specialist team."
      screenId="S5"
      title="What are you driving?"
    >
      <VehicleCatalogFields
        answers={answers}
        errors={errors}
        setAnswer={setAnswer}
        setAnswers={setAnswers}
      />
      <OptionCardGroup
        error={errors.vehicleSize}
        label="Is it a box truck, RV, bus, or bigger than a 1-ton pickup?"
        onChange={(value) => setAnswer('vehicleSize', value)}
        options={vehicleSizeOptions}
        value={answers.vehicleSize}
      />
      <button
        className={styles.linkButton}
        onClick={() => setAnswer('vehicleSize', 'unknown')}
        type="button"
      >
        I don’t know my vehicle
      </button>
    </ScreenLayout>
  );
}

function ServiceScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="Choose one service. We’ll ask only the questions needed for that request."
      screenId="S6"
      title="What do you need help with?"
    >
      <OptionCardGroup
        error={errors.serviceType}
        label="Roadside service"
        onChange={(value) => {
          setAnswer('serviceType', value);
          setAnswer('resolvedServiceType', undefined);
        }}
        options={serviceOptions}
        value={answers.serviceType}
      />
    </ScreenLayout>
  );
}

export function LocationVehicleServiceScreens(props) {
  if (props.screenId === 'S4') return <LocationScreen {...props} />;
  if (props.screenId === 'S5') return <VehicleScreen {...props} />;
  if (props.screenId === 'S6') return <ServiceScreen {...props} />;
  return null;
}
