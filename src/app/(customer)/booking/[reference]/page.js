import {
  clearBookingSessionToken,
  getBookingSessionToken,
} from '@/features/booking/services/bookingSessionCookie';
import { BookingConfirmation } from '@/features/payment/components/BookingConfirmation';
import styles from './BookingStatusPage.module.css';

export const metadata = {
  title: 'Booking Confirmation | Townexa',
};

export default function BookingStatusPage({ params }) {
  if (getBookingSessionToken()) {
    try {
      clearBookingSessionToken();
    } catch {
      // Ignored if response headers have already streamed
    }
  }

  return (
    <section className={styles.container}>
      <BookingConfirmation reference={params.reference} />
    </section>
  );
}
