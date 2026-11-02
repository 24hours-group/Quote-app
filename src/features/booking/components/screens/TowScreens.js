import { OptionCardGroup } from '@/features/booking/components/fields/OptionCardGroup';
import { TextInput } from '@/features/booking/components/fields/TextInput';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import styles from './BookingScreens.module.css';

function TowAddressesScreen({ answers, errors, setAnswer, editScreen }) {
  return (
    <ScreenLayout
      description="We share both addresses with the driver. You’ll enter your mileage estimate on the next screen."
      screenId="W1"
      title="Where should we tow it?"
    >
      <div className={styles.stack}>
        <div>
          <p className={styles.sectionLabel}>Pickup</p>
          <p>{answers.locationAddress || 'Vehicle location not entered'}</p>
          <button
            className={styles.editButton}
            onClick={() => editScreen('S4', 'W1')}
            type="button"
          >
            Change and confirm pickup
          </button>
        </div>
        <TextInput
          error={errors.dropoffAddress}
          id="dropoff-address"
          label="Drop-off address"
          onChange={(event) => setAnswer('dropoffAddress', event.target.value)}
          placeholder="Street and city"
          value={answers.dropoffAddress || ''}
        />
        <TextInput
          id="dropoff-name"
          label="Drop-off name (optional)"
          onChange={(event) => setAnswer('dropoffName', event.target.value)}
          placeholder="e.g. Joe’s Auto Repair or home"
          value={answers.dropoffName || ''}
        />
        <div className={styles.inlineInfo}>
          Addresses are for dispatch only. This prototype does not calculate
          route distance.
        </div>
      </div>
    </ScreenLayout>
  );
}

function TowMilesScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="Use your best estimate or check a maps app. The driver confirms final mileage."
      screenId="W2"
      title="How many miles from pickup to drop-off?"
    >
      <TextInput
        error={errors.towMiles}
        helperText="The app never calculates this from the addresses."
        id="tow-miles"
        inputMode="decimal"
        label="Estimated miles"
        min="0"
        onChange={(event) => setAnswer('towMiles', event.target.value)}
        placeholder="12.5"
        step="0.1"
        type="number"
        value={answers.towMiles || ''}
      />
      <OptionCardGroup
        error={errors.neutral}
        label="Can the car be put in neutral?"
        onChange={(value) => setAnswer('neutral', value)}
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
          { value: 'not_sure', label: 'Not sure' },
        ]}
        value={answers.neutral}
      />
    </ScreenLayout>
  );
}

export function TowScreens(props) {
  if (props.screenId === 'W1') return <TowAddressesScreen {...props} />;
  if (props.screenId === 'W2') return <TowMilesScreen {...props} />;
  return null;
}
