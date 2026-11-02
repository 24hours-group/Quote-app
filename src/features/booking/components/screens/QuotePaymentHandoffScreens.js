'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CreditCard,
  Headphones,
  PhoneCall,
  RefreshCw,
} from 'lucide-react';
import { NotesField } from '@/features/booking/components/fields/NotesField';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import { useMockQuote } from '@/features/booking/hooks/useMockQuote';
import { submitMockPayment } from '@/features/booking/services/mockBookingService';
import { applicationConfig, formatCurrency } from '@/config/application';
import styles from './BookingScreens.module.css';
import wizardStyles from '../wizard/BookingWizard.module.css';

const handoffContent = {
  USER_REQUEST: ['A dispatcher will help you', 'Dispatcher'],
  EXISTING_JOB: ['The agent on your job will contact you shortly', 'Job owner'],
  CANCEL_JOB: [
    'We’ll call you about cancellation and refund options',
    'Job owner',
  ],
  MISSING_INFO: [
    'A dispatcher will help you finish your request',
    'Dispatcher',
  ],
  HEAVY_DUTY: ['Our heavy-duty team will help you', 'Heavy-duty team'],
  UNLISTED_SERVICE: ['Our specialist team handles this service', 'Specialist'],
  WINCH_SPECIALIST: ['A specialist will call you back shortly', 'Specialist'],
  OVER_LIMIT: ['A dispatcher will confirm this job with you', 'Dispatcher'],
  PAY_BY_PHONE: ['An agent will take your payment by phone', 'Dispatcher'],
};

const serviceLabels = {
  jump_start: 'Jump start',
  flat_tire: 'Flat tire',
  tire_change: 'Tire change',
  tire_replace: 'Tire replacement',
  locked_out: 'Lockout',
  tow: 'Tow',
  out_of_gas: 'Fuel delivery',
  mechanic_check: 'Mechanic check',
  stuck: 'Winch-out',
};

function QuoteScreen({
  answers,
  continueWith,
  editScreen,
  completeWith,
  setAnswer,
}) {
  const effectiveServiceType =
    answers.resolvedServiceType || answers.serviceType;
  const { status, quote, error, retry } = useMockQuote(
    effectiveServiceType,
    true,
    Boolean(answers.mockQuoteFailure),
  );
  const summaryRows = [
    [
      'Vehicle',
      [answers.year, answers.make, answers.model].filter(Boolean).join(' '),
      'S5',
    ],
    ['Pickup', answers.locationAddress, 'S4'],
    [
      'Service',
      serviceLabels[effectiveServiceType] || 'Roadside service',
      'S6',
    ],
  ];

  return (
    <ScreenLayout
      description={`Review the details below, ${answers.fullName?.split(' ')[0] || 'there'}. Changes return here with a refreshed mock quote.`}
      screenId="S7"
      title="Here’s your quote"
    >
      <span className={styles.prototypeTag}>
        Prototype estimate · not authoritative
      </span>
      <dl className={styles.summaryList}>
        {summaryRows.map(([label, value, screenId]) => (
          <div className={styles.summaryRow} key={label}>
            <dt className={styles.summaryLabel}>{label}</dt>
            <dd className={styles.summaryValue}>{value || 'Not provided'}</dd>
            <button
              className={styles.editButton}
              onClick={() => editScreen(screenId)}
              type="button"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>
      {status === 'loading' ? (
        <div className={styles.loadingQuote} aria-label="Loading quote preview">
          <div className={styles.loadingLine} />
          <div className={styles.loadingLine} />
          <div className={styles.loadingLine} />
        </div>
      ) : null}
      {status === 'error' ? (
        <div className={styles.errorPanel} role="alert">
          <p>{error?.message || 'The quote preview could not be loaded.'}</p>
          <button className={styles.smallButton} onClick={retry} type="button">
            <RefreshCw size={16} /> Retry quote
          </button>
        </div>
      ) : null}
      {status === 'success' && quote ? (
        <div className={styles.quoteBox}>
          {quote.lineItems.map((item) => (
            <div className={styles.quoteLine} key={item.label}>
              <span>{item.label}</span>
              <strong>{formatCurrency(item.amountCents)}</strong>
            </div>
          ))}
          <div className={styles.quoteTotal}>
            <span>Total</span>
            <span>{formatCurrency(quote.totalCents)}</span>
          </div>
        </div>
      ) : null}
      <p className={styles.inlineInfo}>
        This mock total comes from a fixture standing in for the server quote
        API. Production pricing will use the immutable database snapshot and
        never trust a browser total.
      </p>
      <NotesField
        id="quote-notes"
        label="Anything else we should know? (optional)"
        onChange={(event) => setAnswer('customerNotes', event.target.value)}
        placeholder="Gate code, vehicle condition, or access notes"
        value={answers.customerNotes || ''}
      />
      <div className={wizardStyles.actionsSpacer} />
      <div className={wizardStyles.actions}>
        <div className={wizardStyles.actionsInner}>
          <button
            className={wizardStyles.primaryAction}
            disabled={status !== 'success'}
            onClick={() => continueWith({ quoteAction: 'accept' })}
            type="button"
          >
            Accept and continue
          </button>
          <button
            className={wizardStyles.secondaryAction}
            onClick={() => continueWith({ quoteAction: 'pay_by_phone' })}
            type="button"
          >
            Pay by phone instead
          </button>
          <button
            className={wizardStyles.secondaryAction}
            onClick={() => completeWith('declined')}
            type="button"
          >
            No thanks
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
}

function PaymentScreen({ answers, continueWith }) {
  const [paymentState, setPaymentState] = useState('idle');
  const [paymentError, setPaymentError] = useState(null);

  const handleMockPayment = async () => {
    setPaymentState('submitting');
    setPaymentError(null);
    try {
      const result = await submitMockPayment();
      continueWith({ paymentStatus: result.status });
    } catch {
      setPaymentState('error');
      setPaymentError('The mock payment could not be completed. Try again.');
    }
  };

  return (
    <ScreenLayout
      description="Real card, Apple Pay, and Google Pay fields will be hosted by the payment provider in a later unit."
      screenId="S8A"
      title="Payment"
    >
      <div className={styles.paymentPlaceholder}>
        <div>
          <CreditCard size={34} aria-hidden="true" />
          <p>
            <strong>Secure provider payment form</strong>
          </p>
          <p>No card details are collected or stored in this prototype.</p>
        </div>
      </div>
      <div className={styles.inlineInfo}>
        <strong>When will help arrive?</strong> After payment, a dispatcher
        calls to confirm the arrival time and details.
      </div>
      <div className={styles.inlineInfo}>
        We’ll text the receipt to{' '}
        {answers.mobileNumber || 'your verified mobile number'}.
      </div>
      {paymentError ? (
        <div className={styles.errorPanel} role="alert">
          {paymentError}
        </div>
      ) : null}
      <div className={wizardStyles.actionsSpacer} />
      <div className={wizardStyles.actions}>
        <div className={wizardStyles.actionsInner}>
          <button
            className={wizardStyles.primaryAction}
            disabled={paymentState === 'submitting'}
            onClick={handleMockPayment}
            type="button"
          >
            {paymentState === 'submitting'
              ? 'Processing demo…'
              : 'Complete demo payment'}
          </button>
          <button
            className={wizardStyles.secondaryAction}
            onClick={() => continueWith({ paymentStatus: 'pay_by_phone' })}
            type="button"
          >
            Pay by phone instead
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
}

function HandoffScreen({ answers, completeWith }) {
  const [headline, team] =
    handoffContent[answers.handoffReason] || handoffContent.USER_REQUEST;
  const callbackOnly = answers.handoffReason === 'WINCH_SPECIALIST';
  return (
    <ScreenLayout
      description="We’ve saved what you entered so the team can pick up where you left off. No price is shown for hand-offs."
      screenId="R"
      title={headline}
    >
      <span className={styles.handoffHeader}>
        <Headphones size={28} />
      </span>
      <span className={styles.teamPill}>{team}</span>
      <div className={styles.inlineInfo}>
        <AlertTriangle size={20} aria-hidden="true" />
        Reason: {answers.handoffReason || 'USER_REQUEST'}
      </div>
      {!callbackOnly ? (
        <a
          className={styles.phoneLink}
          href={`tel:${applicationConfig.company.phone.replace(/\s/g, '')}`}
        >
          <PhoneCall size={18} /> Call {applicationConfig.company.phone}
        </a>
      ) : null}
      <button
        className={wizardStyles.primaryAction}
        onClick={() => completeWith('request_callback')}
        type="button"
      >
        Request a callback
      </button>
    </ScreenLayout>
  );
}

export function QuotePaymentHandoffScreens(props) {
  if (props.screenId === 'S7') return <QuoteScreen {...props} />;
  if (props.screenId === 'S8A') return <PaymentScreen {...props} />;
  if (props.screenId === 'R') return <HandoffScreen {...props} />;
  return null;
}
