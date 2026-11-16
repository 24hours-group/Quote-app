import 'server-only';

import { attachUnverifiedCustomerByToken } from '@/features/booking/repositories/bookingSessionRepository';
import { bookingContactSchema } from '@/features/booking/schemas/contactSchema';

export async function saveBookingContact(token, input) {
  const contact = bookingContactSchema.parse(input);
  const result = await attachUnverifiedCustomerByToken(token, contact);

  return {
    contactAttached: true,
    version: result.version,
  };
}
