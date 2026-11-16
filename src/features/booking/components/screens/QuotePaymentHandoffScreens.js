'use client';

import { RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';
import { QuoteSummaryScreen } from '@/features/booking/components/screens/QuoteSummaryScreen';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import { PaymentCheckout } from '@/features/payment/components/PaymentCheckout';
import { HandoffScreen } from '@/features/handoff/components/HandoffScreen';
import { useAcceptedQuote } from '@/features/pricing/hooks/useAcceptedQuote';
import styles from './BookingScreens.module.css';
import wizardStyles from '../wizard/BookingWizard.module.css';

function PaymentScreen({ answers, continueWith }) {
  const acceptedQuote = useAcceptedQuote(answers.quoteId);
  const canPay = acceptedQuote.status === 'success';

  if (acceptedQuote.status === 'loading') {
    return (
      <LoadingSpinner
        card
        label="Verifying accepted quote…"
        sublabel="Connecting to secure checkout locked to your quote"
      />
    );
  }

  if (acceptedQuote.status === 'error') {
    return (
      <ScreenLayout
        description="Your secure checkout is locked to the accepted server quote. A booking is confirmed only after payment is verified."
        screenId="S8A"
        title="Payment"
      >
        <div className={styles.errorPanel} role="alert">
          <p>
            {acceptedQuote.error?.message ||
              'An accepted server quote is required before checkout.'}
          </p>
          <button
            className={styles.smallButton}
            onClick={acceptedQuote.retry}
            type="button"
          >
            <RefreshCw size={16} /> Verify quote again
          </button>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      description="Your secure checkout is locked to the accepted server quote. A booking is confirmed only after payment is verified."
      screenId="S8A"
      title="Payment"
    >
      <PaymentCheckout
        onSimulationComplete={() =>
          continueWith({ paymentStatus: 'simulated' })
        }
        quote={acceptedQuote.quote}
      />
      <div className={styles.inlineInfo}>
        <strong>When will help arrive?</strong> After payment, a dispatcher
        calls to confirm the arrival time and details.
      </div>
      <div className={styles.inlineInfo}>
        Booking contact: {answers.mobileNumber || 'your submitted phone number'}
        .
      </div>
      <button
        className={wizardStyles.secondaryAction}
        onClick={() => continueWith({ paymentStatus: 'pay_by_phone' })}
        type="button"
      >
        Pay by phone instead
      </button>
    </ScreenLayout>
  );
}

export function QuotePaymentHandoffScreens(props) {
  if (props.screenId === 'S7') return <QuoteSummaryScreen {...props} />;
  if (props.screenId === 'S8A') return <PaymentScreen {...props} />;
  if (props.screenId === 'R') return <HandoffScreen {...props} />;
  return null;
}
