'use client';

import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { simulatePayment } from '@/features/payment/services/paymentClient';
import styles from '@/features/booking/components/screens/BookingScreens.module.css';
import wizardStyles from '@/features/booking/components/wizard/BookingWizard.module.css';

export function SimulatedPaymentForm({ paymentId, onSimulationComplete }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await simulatePayment(paymentId, 'success');
      onSimulationComplete();
    } catch {
      setError(
        'We could not complete your payment. Review your details or use another payment method, then try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.paymentForm}>
      {/* <div className={styles.inlineInfo} role="note">
        No card will be charged online. Payment can be settled directly with your driver upon arrival or confirmed with our dispatcher.
      </div> */}
      {error ? (
        <div className={styles.errorPanel} role="alert">
          {error}
        </div>
      ) : null}
      <button
        aria-busy={submitting}
        className={wizardStyles.primaryAction}
        disabled={submitting}
        onClick={submit}
        type="button"
      >
        {submitting ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className={wizardStyles.spinner}
              size={18}
            />
            Completing payment…
          </>
        ) : (
          'Complete payment'
        )}
      </button>
    </div>
  );
}
