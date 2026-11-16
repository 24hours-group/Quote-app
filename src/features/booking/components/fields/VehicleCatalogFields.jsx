import { TextInput } from '@/features/booking/components/fields/TextInput';
import {
  VEHICLE_COLORS,
  VEHICLE_MAKES,
  VEHICLE_YEARS,
  getVehicleModels,
} from '@/features/booking/data/usVehicleCatalog';
import styles from '../screens/BookingScreens.module.css';

function CatalogInput({ id, options, ...props }) {
  const listId = `${id}-options`;
  return (
    <>
      <TextInput id={id} list={listId} {...props} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}

export function VehicleCatalogFields({
  answers,
  errors,
  setAnswer,
  setAnswers,
}) {
  const models = getVehicleModels(answers.make);

  return (
    <>
      <div className={styles.threeColumn}>
        <CatalogInput
          error={errors.year}
          helperText="Select a suggested year, or type the vehicle's year."
          id="vehicle-year"
          inputMode="numeric"
          label="Year"
          maxLength={4}
          onChange={(event) => setAnswer('year', event.target.value)}
          options={VEHICLE_YEARS}
          placeholder="2019"
          value={answers.year || ''}
        />
        <CatalogInput
          error={errors.make}
          helperText="Not listed? Type the vehicle make and continue."
          id="vehicle-make"
          label="Make"
          onChange={(event) =>
            setAnswers({ make: event.target.value, model: undefined })
          }
          options={VEHICLE_MAKES}
          placeholder="Honda"
          value={answers.make || ''}
        />
        <CatalogInput
          error={errors.model}
          helperText={
            models.length
              ? 'Select a suggestion, or type any model.'
              : 'No matching catalog models. Type the vehicle model and continue.'
          }
          id="vehicle-model"
          label="Model"
          onChange={(event) => setAnswer('model', event.target.value)}
          options={models}
          placeholder="CR-V"
          value={answers.model || ''}
        />
      </div>
      <CatalogInput
        helperText="Optional. Choose a common color or type the exact color."
        id="vehicle-color"
        label="Vehicle color (optional)"
        onChange={(event) => setAnswer('vehicleColor', event.target.value)}
        options={VEHICLE_COLORS}
        placeholder="e.g. Silver"
        value={answers.vehicleColor || ''}
      />
    </>
  );
}
