import { NumberSelector } from '@/features/booking/components/fields/NumberSelector';
import { NotesField } from '@/features/booking/components/fields/NotesField';
import { OptionCardGroup } from '@/features/booking/components/fields/OptionCardGroup';
import { TextInput } from '@/features/booking/components/fields/TextInput';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import controlStyles from '../fields/BookingControls.module.css';
import styles from './BookingScreens.module.css';

const tireHandlingOptions = [
  {
    value: 'spare',
    label: 'Change my spare',
    description: 'I have a usable spare tire',
  },
  {
    value: 'replacement',
    label: 'Bring a new tire',
    description: 'The tire cost is confirmed by the dispatcher',
  },
  {
    value: 'tow',
    label: 'Just tow my car',
    description: 'Continue to tow details',
  },
];

const mechanicOptions = [
  { value: 'wont_start', label: 'Won’t start' },
  { value: 'warning_light', label: 'Warning light' },
  { value: 'strange_noise', label: 'Strange noise' },
  { value: 'overheating', label: 'Overheating' },
  { value: 'other', label: 'Other' },
];

function JumpStartScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="Most cars have one battery. Some trucks and RVs have two or more."
      screenId="J1"
      title="How many batteries need a jump?"
    >
      <NumberSelector
        error={errors.batteryCount}
        label="Battery count"
        onChange={(value) => setAnswer('batteryCount', value)}
        options={[1, 2, 3, 4, { value: 5, label: 'More than 4' }]}
        value={answers.batteryCount}
      />
    </ScreenLayout>
  );
}

function FlatTireScreen({ answers, errors, setAnswer }) {
  const needsTireCount = ['spare', 'replacement'].includes(
    answers.tireHandling,
  );
  return (
    <ScreenLayout
      description="Your choice determines whether we change, replace, or tow the vehicle."
      screenId="T1"
      title="How should we handle the tire?"
    >
      <OptionCardGroup
        columns={1}
        error={errors.tireHandling}
        label="Tire service"
        onChange={(value) => setAnswer('tireHandling', value)}
        options={tireHandlingOptions}
        value={answers.tireHandling}
      />
      {needsTireCount ? (
        <NumberSelector
          error={errors.damagedTires}
          label="How many tires are damaged?"
          onChange={(value) => setAnswer('damagedTires', value)}
          options={[
            { value: 1, label: '1 tire' },
            { value: 2, label: '2 or more' },
          ]}
          value={answers.damagedTires}
        />
      ) : null}
      {answers.tireHandling === 'replacement' ? (
        <TextInput
          error={errors.tireSize}
          helperText="Find this on the tire’s sidewall. The dispatcher confirms the tire cost."
          id="tire-size"
          label="Tire size"
          onChange={(event) => setAnswer('tireSize', event.target.value)}
          placeholder="e.g. 225/65R17"
          value={answers.tireSize || ''}
        />
      ) : null}
    </ScreenLayout>
  );
}

function LockoutScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="If yes, call 911 now. They can get there faster. You can still request roadside help here."
      screenId="L1"
      title="Is a child or pet locked inside?"
    >
      <OptionCardGroup
        error={errors.childOrPetInside}
        label="Child or pet inside"
        onChange={(value) => setAnswer('childOrPetInside', value)}
        options={[
          { value: true, label: 'Yes' },
          { value: false, label: 'No' },
        ]}
        value={answers.childOrPetInside}
      />
    </ScreenLayout>
  );
}

function GasScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="Choose the fuel type. We’ll bring enough to help you reach the nearest gas station."
      screenId="G1"
      title="What fuel does your vehicle take?"
    >
      <OptionCardGroup
        error={errors.fuelType}
        label="Fuel type"
        onChange={(value) => setAnswer('fuelType', value)}
        options={[
          { value: 'regular', label: 'Regular gasoline' },
          { value: 'diesel', label: 'Diesel' },
          { value: 'not_sure', label: 'Not sure' },
        ]}
        value={answers.fuelType}
      />
      {answers.fuelType === 'regular' ? (
        <NumberSelector
          error={errors.gallons}
          label="How many gallons do you need?"
          onChange={(value) => setAnswer('gallons', value)}
          options={[1, 2, 3, 5]}
          value={answers.gallons}
        />
      ) : null}
    </ScreenLayout>
  );
}

function MechanicScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="A mechanic will assess the problem on site. Repairs are quoted separately."
      screenId="M1"
      title="What’s going on with the vehicle?"
    >
      <OptionCardGroup
        error={errors.mechanicIssue}
        label="Vehicle issue"
        onChange={(value) => setAnswer('mechanicIssue', value)}
        options={mechanicOptions}
        value={answers.mechanicIssue}
      />
      <NotesField
        id="mechanic-notes"
        label="Describe it (optional)"
        onChange={(event) => setAnswer('mechanicNotes', event.target.value)}
        placeholder="It clicks when I turn the key"
        value={answers.mechanicNotes || ''}
      />
    </ScreenLayout>
  );
}

function WinchScreen({ answers, errors, setAnswer }) {
  const stuckWheels = answers.stuckWheels || [];
  const toggleWheel = (wheel) => {
    setAnswer(
      'stuckWheels',
      stuckWheels.includes(wheel)
        ? stuckWheels.filter((item) => item !== wheel)
        : [...stuckWheels, wheel],
    );
  };

  return (
    <ScreenLayout
      description="Distance questions appear only when the vehicle is upright on its wheels."
      screenId="X1"
      title="Is the vehicle on its wheels?"
    >
      <OptionCardGroup
        error={errors.orientation}
        label="Vehicle position"
        onChange={(value) => setAnswer('orientation', value)}
        options={[
          { value: 'wheels', label: 'Yes, on its wheels' },
          { value: 'side', label: 'On its side' },
          { value: 'upside_down', label: 'Upside down' },
        ]}
        value={answers.orientation}
      />
      {answers.orientation === 'wheels' ? (
        <div className={styles.stack}>
          <TextInput
            error={errors.distanceFeet}
            helperText="A parking space is about 18 feet long."
            id="distance-feet"
            inputMode="decimal"
            label="About how far is it from the pavement?"
            onChange={(event) => setAnswer('distanceFeet', event.target.value)}
            placeholder="14"
            type="number"
            value={answers.distanceFeet || ''}
          />
          <fieldset className={controlStyles.fieldset}>
            <legend className={controlStyles.legend}>
              Which wheels are stuck? (optional)
            </legend>
            <div className={styles.twoColumn}>
              {['Front left', 'Front right', 'Rear left', 'Rear right'].map(
                (wheel) => (
                  <label className={controlStyles.checkboxRow} key={wheel}>
                    <input
                      checked={stuckWheels.includes(wheel)}
                      className={controlStyles.checkbox}
                      onChange={() => toggleWheel(wheel)}
                      type="checkbox"
                    />
                    <span>{wheel}</span>
                  </label>
                ),
              )}
            </div>
          </fieldset>
        </div>
      ) : null}
    </ScreenLayout>
  );
}

export function RoadsideServiceScreens(props) {
  const screens = {
    J1: JumpStartScreen,
    T1: FlatTireScreen,
    L1: LockoutScreen,
    G1: GasScreen,
    M1: MechanicScreen,
    X1: WinchScreen,
  };
  const Screen = screens[props.screenId];
  return Screen ? <Screen {...props} /> : null;
}
