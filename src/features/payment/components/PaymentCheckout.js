'use client';

import { useEffect, useMemo, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';
import { formatCurrency } from '@/config/application';
import styles from '@/features/booking/components/screens/BookingScreens.module.css';
import { SimulatedPaymentForm } from '@/features/payment/components/SimulatedPaymentForm';
import { StripePaymentForm } from '@/features/payment/components/StripePaymentForm';
import { usePaymentIntent } from '@/features/payment/hooks/usePaymentIntent';
import { usePaymentStatus } from '@/features/payment/hooks/usePaymentStatus';
import { getStripePromise } from '@/lib/integrations/stripe/client';

export function PaymentCheckout({ quote, onSimulationComplete }) {
  const router = useRouter();
  const intent = usePaymentIntent(quote.id);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const paymentId = intent.data?.paymentId;
  const paymentStatus = usePaymentStatus(paymentId ? { paymentId } : null, {
    poll: Boolean(paymentId),
  });
  const stripePromise =
    intent.data?.mode === 'stripe' ? getStripePromise() : null;
  const options = useMemo(
    () =>
      intent.data
        ? {
            clientSecret: intent.data.clientSecret,
            appearance: { theme: 'stripe' },
          }
        : null,
    [intent.data],
  );

  useEffect(() => {
    const reference = paymentStatus.data?.booking?.reference;
    if (paymentStatus.data?.status === 'succeeded' && reference) {
      router.replace(`/booking/${reference}`);
    }
  }, [paymentStatus.data, router]);

  if (intent.status === 'loading') {
    return (
      <LoadingSpinner
        card
        label="Preparing secure checkout…"
        sublabel="Setting up encrypted payment session with Stripe"
      />
    );
  }

  if (intent.status === 'error') {
    return (
      <div className={styles.errorPanel} role="alert">
        <p>
          {intent.error?.message ||
            'Secure payment is temporarily unavailable.'}
        </p>
        <button
          className={styles.smallButton}
          onClick={intent.retry}
          type="button"
        >
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }

  const isSimulation = intent.data.mode === 'simulation';
  if (!isSimulation && !stripePromise) {
    return (
      <div className={styles.errorPanel} role="alert">
        Secure payment is not configured. Choose pay by phone or contact
        support.
      </div>
    );
  }

  const serverStatus = paymentStatus.data?.status;
  return (
    <div className={styles.paymentStack}>
      <div className={styles.acceptedQuote}>
        <span>Amount authorized by accepted quote</span>
        <strong>{formatCurrency(intent.data.amountCents)} USD</strong>
      </div>
      {awaitingConfirmation || serverStatus === 'processing' ? (
        <LoadingSpinner
          card
          label="Payment received…"
          sublabel="Waiting for verified server confirmation from Stripe"
        />
      ) : null}
      {paymentStatus.status === 'error' ? (
        <div className={styles.errorPanel} role="alert">
          <p>
            Payment status could not be refreshed. We’ll keep checking securely.
          </p>
          <button
            className={styles.smallButton}
            onClick={paymentStatus.retry}
            type="button"
          >
            <RefreshCw size={16} /> Check now
          </button>
        </div>
      ) : null}
      {serverStatus === 'cancelled' || serverStatus === 'failed' ? (
        <div className={styles.errorPanel} role="alert">
          This payment attempt was not completed. Return to the quote summary to
          start a new checkout.
        </div>
      ) : null}
      {isSimulation ? (
        <SimulatedPaymentForm
          onSimulationComplete={onSimulationComplete}
          paymentId={intent.data.paymentId}
        />
      ) : (
        <Elements options={options} stripe={stripePromise}>
          <StripePaymentForm
            onAwaitingConfirmation={() => setAwaitingConfirmation(true)}
            paymentId={intent.data.paymentId}
          />
        </Elements>
      )}
    </div>
  );
}
