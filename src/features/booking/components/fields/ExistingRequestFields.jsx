import { TextInput } from '@/features/booking/components/fields/TextInput';

export function ExistingRequestFields({ answers, errors, setAnswer }) {
  return (
    <TextInput
      autoCapitalize="characters"
      autoComplete="off"
      error={errors.bookingReference}
      helperText="Use the reference from your payment confirmation, for example RS-1A2B3C4D5E. An agent will verify the booking before sharing details or making changes."
      id="booking-reference"
      label="Booking reference"
      maxLength={23}
      onChange={(event) =>
        setAnswer('bookingReference', event.target.value.toUpperCase())
      }
      placeholder="RS-1A2B3C4D5E"
      value={answers.bookingReference || ''}
    />
  );
}
