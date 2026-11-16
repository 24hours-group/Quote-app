import { bookingContactSchema } from '@/features/booking/schemas/contactSchema';
import { runBookingSessionOperation } from '@/features/booking/services/bookingDraftService';

export function attachBookingContact(contact) {
  return runBookingSessionOperation(async (version) => {
    const normalized = bookingContactSchema.parse({ ...contact, version });
    const response = await fetch('/api/booking/contact', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
    const payload = await response.json();

    if (!response.ok) {
      const error = new Error(
        payload?.error?.message || 'Your contact details could not be saved.',
      );
      error.code = payload?.error?.code;
      error.status = response.status;
      throw error;
    }

    return {
      ...payload.data,
      contact: {
        fullName: normalized.fullName,
        receiptEmail: normalized.receiptEmail,
        mobileNumber: normalized.mobileNumber,
      },
    };
  });
}
