'use client';

import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import styles from '@/features/booking/components/screens/BookingScreens.module.css';
import wizardStyles from '@/features/booking/components/wizard/BookingWizard.module.css';

export function StripePaymentForm({ paymentId, onAwaitingConfirmation }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success?payment_id=${paymentId}`,
        },
        redirect: 'if_required',
      });

      if (result.error) {
        setError(
          result.error.message ||
            'We could not complete your payment. Review your details or use another payment method, then try again.',
        );
        setSubmitting(false);
        return;
      }

      onAwaitingConfirmation();
    } catch {
      setError(
        'We could not reach the payment provider. Check your connection and try again.',
      );
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.paymentForm} onSubmit={submit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error ? (
        <div className={styles.errorPanel} role="alert">
          {error}
        </div>
      ) : null}
      <button
        aria-busy={submitting}
        className={wizardStyles.primaryAction}
        disabled={!stripe || !elements || submitting}
        type="submit"
      >
        {submitting ? (
          <>
            <LoaderCircle
              aria-hidden="true"
              className={wizardStyles.spinner}
              size={18}
            />
            Processing payment…
          </>
        ) : (
          'Pay securely'
        )}
      </button>
    </form>
  );
}
