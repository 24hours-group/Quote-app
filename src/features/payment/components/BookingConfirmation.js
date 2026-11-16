'use client';

import { CheckCircle2, ShieldCheck, Radio } from 'lucide-react';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';
import { formatCurrency } from '@/config/application';
import { usePaymentStatus } from '@/features/payment/hooks/usePaymentStatus';
import styles from './BookingConfirmation.module.css';

export function BookingConfirmation({ reference }) {
  const status = usePaymentStatus({ reference });

  if (status.status === 'loading') {
    return (
      <LoadingSpinner
        card
        label="Loading booking confirmation…"
        sublabel="Retrieving verified dispatch details and receipt"
      />
    );
  }
  if (status.status === 'error' || !status.data?.booking) {
    return (
      <div className={styles.errorBox} role="alert">
        This booking could not be accessed. The reference alone does not
        authorize customer details.
      </div>
    );
  }

  const booking = status.data.booking;
  const dispatchStatus = booking.dispatchStatus.replaceAll('_', ' ');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.statusTitle}>
          <span className={styles.iconBadge}>
            <CheckCircle2 size={24} />
          </span>
          Payment Confirmed
        </h2>
        <span className={styles.refChip}>
          Reference: {booking.reference}
        </span>
      </div>

      <div className={styles.alertBox}>
        <ShieldCheck size={20} className={styles.alertIcon} />
        <div>
          Your payment was verified and the Townexa dispatch team has been notified.
          A dispatcher will contact you shortly to confirm arrival details.
        </div>
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Paid Securely</span>
          <span className={styles.value}>
            {formatCurrency(status.data.amountCents)} {status.data.currency}
          </span>
        </div>
        <div className={styles.summaryRow}>
          <span className={styles.label}>Dispatch Status</span>
          <span className={styles.dispatchBadge}>
            <Radio size={12} /> {dispatchStatus}
          </span>
        </div>
      </div>

      <p className={styles.supportText}>
        Need immediate assistance? Please keep your phone available. Our dispatch team is preparing your service vehicle.
      </p>
    </div>
  );
}
