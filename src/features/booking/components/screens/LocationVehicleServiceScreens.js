import { AddressInput } from '@/features/booking/components/fields/AddressInput';
import { OptionCardGroup } from '@/features/booking/components/fields/OptionCardGroup';
import { TextInput } from '@/features/booking/components/fields/TextInput';
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

function LocationScreen({ answers, errors, setAnswer }) {
  const updateAddress = (address) => {
    setAnswer('locationAddress', address);
    setAnswer('locationStatus', address ? 'pin_moved' : undefined);
  };

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
        onAddressChange={updateAddress}
        onConfirm={() => setAnswer('locationStatus', 'confirmed')}
        onLandmarksChange={(value) => setAnswer('landmarks', value)}
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

function VehicleScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="This helps us send the right roadside vehicle. Heavy-duty vehicles are handled by a specialist team."
      screenId="S5"
      title="What are you driving?"
    >
      <div className={styles.threeColumn}>
        <TextInput
          error={errors.year}
          id="vehicle-year"
          inputMode="numeric"
          label="Year"
          maxLength={4}
          onChange={(event) => setAnswer('year', event.target.value)}
          placeholder="2019"
          value={answers.year || ''}
        />
        <TextInput
          error={errors.make}
          id="vehicle-make"
          label="Make"
          onChange={(event) => setAnswer('make', event.target.value)}
          placeholder="Honda"
          value={answers.make || ''}
        />
        <TextInput
          error={errors.model}
          id="vehicle-model"
          label="Model"
          onChange={(event) => setAnswer('model', event.target.value)}
          placeholder="CR-V"
          value={answers.model || ''}
        />
      </div>
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
