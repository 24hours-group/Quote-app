'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner/LoadingSpinner';
import { NotesField } from '@/features/booking/components/fields/NotesField';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import { useAuthoritativeQuote } from '@/features/pricing/hooks/useAuthoritativeQuote';
import { transitionAuthoritativeQuote } from '@/features/pricing/services/quoteClient';
import { toQuoteWizardAnswers } from '@/features/pricing/utils/quoteAnswers';
import { formatCurrency } from '@/config/application';
import styles from './BookingScreens.module.css';
import wizardStyles from '../wizard/BookingWizard.module.css';

const serviceLabels = {
  jump_start: 'Jump start',
  flat_tire: 'Flat tire',
  tire_change: 'Tire change',
  tire_replace: 'Tire replacement',
  locked_out: 'Lockout',
  lockout: 'Lockout',
  tow: 'Tow',
  out_of_gas: 'Fuel delivery',
  fuel_delivery: 'Fuel delivery',
  mechanic_check: 'Mechanic assessment',
  stuck: 'Winch-out',
  winch_out: 'Winch-out',
  other: 'Specialist service',
};

function SummaryRow({ label, onEdit, value }) {
  return (
    <div className={styles.summaryRow}>
      <dt className={styles.summaryLabel}>{label}</dt>
      <dd className={styles.summaryValue}>{value || 'Not provided'}</dd>
      <button className={styles.editButton} onClick={onEdit} type="button">
        Edit
      </button>
    </div>
  );
}

function QuoteDetails({ quote }) {
  if (!quote?.lineItems) return null;
  const payableItems = (quote.lineItems || []).filter((item) => item.payableNow);
  const confirmedItems = (quote.lineItems || []).filter(
    (item) => item.confirmationRequired,
  );

  return (
    <>
      <div className={styles.quoteBox} aria-label="Upfront quote charges">
        {payableItems.map((item) => (
          <div className={styles.quoteLine} key={item.itemCode}>
            <span>{item.description}</span>
            <strong>{formatCurrency(item.totalAmountCents)}</strong>
          </div>
        ))}
        <div className={styles.quoteTotal}>
          <span>Total payable now</span>
          <span>{formatCurrency(quote.totalPayableNowCents)}</span>
        </div>
      </div>
      {confirmedItems.length ? (
        <section className={styles.confirmedCharges}>
          <h3>Possible additional confirmed costs</h3>
          <p>
            These are not included in today’s payment. A dispatcher will confirm
            the exact cost with you before it is charged.
          </p>
          <ul>
            {confirmedItems.map((item) => (
              <li key={item.itemCode}>
                <span>{item.description}</span>
                <strong>
                  {item.totalAmountCents > 0
                    ? formatCurrency(item.totalAmountCents)
                    : 'To be confirmed'}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function getQuoteErrorDisplay(error) {
  const rawMessage = (error?.message || '').trim();
  const errorCode = error?.code;
  const blockedScreen = error?.details?.blockedScreen;

  // Unlisted service or cannot be priced online
  if (
    errorCode === 'UNLISTED_SERVICE' ||
    rawMessage.toLowerCase().includes('cannot be priced online') ||
    rawMessage.toLowerCase().includes('unlisted')
  ) {
    return {
      title: 'Specialist review needed',
      description:
        'This service requires specialist review before pricing can be confirmed.',
      message:
        'Our dispatch specialist will review your request and provide custom pricing over the phone.',
      actionScreenId: 'R',
      actionLabel: 'Speak with a specialist',
      secondaryScreenId: 'S6',
      secondaryLabel: 'Choose a different service',
      handoffReason: 'UNLISTED_SERVICE',
      hideRetry: true,
    };
  }

  // Contact details needed (S2)
  if (
    blockedScreen === 'S2' ||
    rawMessage.toLowerCase().includes('contact') ||
    rawMessage.toLowerCase().includes('name') ||
    rawMessage.toLowerCase().includes('phone')
  ) {
    return {
      title: 'Contact details needed',
      description:
        'Please confirm your contact details so we can generate your guaranteed quote.',
      message:
        rawMessage && !rawMessage.includes('not reachable')
          ? rawMessage
          : 'Save your contact details before continuing to your quote.',
      actionScreenId: 'S2',
      actionLabel: 'Review contact details',
    };
  }

  // Pickup location needed (S4)
  if (
    blockedScreen === 'S4' ||
    rawMessage.toLowerCase().includes('pickup') ||
    rawMessage.toLowerCase().includes('location')
  ) {
    return {
      title: 'Pickup location needed',
      description:
        'Please confirm your pickup location so we can calculate an accurate quote.',
      message:
        rawMessage && !rawMessage.includes('not reachable')
          ? rawMessage
          : 'Please select a valid pickup location to proceed with your quote.',
      actionScreenId: 'S4',
      actionLabel: 'Review pickup location',
    };
  }

  // Vehicle details needed (S5)
  if (
    blockedScreen === 'S5' ||
    rawMessage.toLowerCase().includes('vehicle') ||
    rawMessage.toLowerCase().includes('make') ||
    rawMessage.toLowerCase().includes('model')
  ) {
    return {
      title: 'Vehicle details needed',
      description:
        'Please confirm your vehicle details so we can calculate an accurate quote.',
      message:
        rawMessage && !rawMessage.includes('not reachable')
          ? rawMessage
          : 'Please provide your vehicle details to proceed with your quote.',
      actionScreenId: 'S5',
      actionLabel: 'Review vehicle details',
    };
  }

  // Tow destination or route needed (W1 / W2)
  if (
    blockedScreen === 'W1' ||
    blockedScreen === 'W2' ||
    rawMessage.toLowerCase().includes('dropoff') ||
    rawMessage.toLowerCase().includes('route')
  ) {
    return {
      title: 'Tow route needed',
      description:
        'Please verify your towing destination so we can calculate exact mileage and pricing.',
      message:
        rawMessage && !rawMessage.includes('not reachable')
          ? rawMessage
          : 'Please select your destination address or verify your route.',
      actionScreenId: blockedScreen || 'W1',
      actionLabel: 'Review destination',
    };
  }

  // General clean message
  let cleanMessage = rawMessage;
  if (
    !cleanMessage ||
    cleanMessage.includes('not reachable') ||
    cleanMessage.includes('Screen S')
  ) {
    cleanMessage =
      'Some required booking details are missing or need review before your quote can be generated.';
  }

  return {
    title: 'Quote unavailable',
    description: 'We were unable to calculate your quote at this moment.',
    message: cleanMessage,
    actionScreenId: null,
    actionLabel: null,
  };
}

export function QuoteSummaryScreen({
  answers,
  completeWith,
  continueWith,
  editScreen,
  moveTo,
  setAnswer,
  setAnswers,
}) {
  const [actionState, setActionState] = useState({
    status: 'idle',
    error: null,
  });
  const effectiveServiceType =
    answers.resolvedServiceType || answers.serviceType;

  useEffect(() => {
    if (effectiveServiceType !== 'tow') return undefined;
    const expiresAt = Date.parse(answers.routeExpiresAt || '');
    const refreshRoute = () => editScreen('W2', 'S7');
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      refreshRoute();
      return undefined;
    }
    const timeout = setTimeout(refreshRoute, expiresAt - Date.now());
    return () => clearTimeout(timeout);
  }, [answers.routeExpiresAt, editScreen, effectiveServiceType]);

  const { status, quote, error, retry } = useAuthoritativeQuote(answers);

  useEffect(() => {
    setActionState({ status: 'idle', error: null });
  }, [quote?.id]);

  useEffect(() => {
    if (!quote || !['active', 'accepted'].includes(quote.status)) return;
    if (
      answers.quoteId === quote.id &&
      answers.quoteStatus === quote.status &&
      answers.quoteValidUntil === quote.validUntil
    ) {
      return;
    }
    setAnswers(toQuoteWizardAnswers(quote, answers.quoteAction));
  }, [
    answers.quoteAction,
    answers.quoteId,
    answers.quoteStatus,
    answers.quoteValidUntil,
    quote,
    setAnswers,
  ]);

  const runTransition = async (action, onSuccess) => {
    if (!quote || actionState.status === 'submitting') return;
    setActionState({ status: 'submitting', error: null });
    try {
      const storedQuote = await transitionAuthoritativeQuote(quote.id, action);
      onSuccess(storedQuote);
    } catch (transitionError) {
      setActionState({ status: 'error', error: transitionError });
      if (transitionError.code === 'QUOTE_EXPIRED') retry();
    }
  };

  const editQuoteDetail = (screenId, returnTo = 'S7') => {
    if (quote?.status === 'accepted') {
      editScreen(screenId, returnTo);
      return;
    }
    runTransition('supersede', (storedQuote) => {
      setAnswers(toQuoteWizardAnswers(storedQuote));
      editScreen(screenId, returnTo);
    });
  };

  const summary = quote?.summary;
  const routeText = summary?.route
    ? `${summary.route.rawMiles.toFixed(1)} Google route miles · ${summary.route.billableMiles} billable miles`
    : null;
  const isReady =
    status === 'success' && ['active', 'accepted'].includes(quote?.status);

  const isQuoteLoading =
    status === 'loading' ||
    status === 'idle' ||
    (!quote && status !== 'error');

  if (isQuoteLoading) {
    return (
      <LoadingSpinner
        card
        label="Calculating your quote…"
        sublabel={
          effectiveServiceType === 'tow'
            ? 'Checking your route and calculating your upfront price'
            : 'Preparing your guaranteed upfront price'
        }
      />
    );
  }

  if (status === 'error') {
    const errorDisplay = getQuoteErrorDisplay(error);
    const handleActionClick = () => {
      if (errorDisplay.handoffReason) {
        if (typeof setAnswer === 'function') {
          setAnswer('handoffReason', errorDisplay.handoffReason);
          setAnswer('handoffFrom', 'S7');
        }
        if (typeof moveTo === 'function') {
          moveTo('R', {
            handoffReason: errorDisplay.handoffReason,
            handoffFrom: 'S7',
          });
          return;
        }
      }
      if (errorDisplay.actionScreenId) {
        editScreen(errorDisplay.actionScreenId, 'S7');
      }
    };

    return (
      <ScreenLayout
        description={errorDisplay.description}
        screenId="S7"
        title={errorDisplay.title}
      >
        <div className={styles.errorPanel} role="alert">
          <p className={styles.errorText}>{errorDisplay.message}</p>
          <div className={styles.errorActions}>
            {errorDisplay.actionScreenId ? (
              <button
                className={styles.actionPrimaryButton}
                onClick={handleActionClick}
                type="button"
              >
                {errorDisplay.actionLabel}
              </button>
            ) : null}
            {errorDisplay.secondaryScreenId ? (
              <button
                className={styles.actionSecondaryButton}
                onClick={() => editScreen(errorDisplay.secondaryScreenId, 'S7')}
                type="button"
              >
                {errorDisplay.secondaryLabel}
              </button>
            ) : null}
            {!errorDisplay.hideRetry ? (
              <button className={styles.smallButton} onClick={retry} type="button">
                <RefreshCw size={16} /> Retry quote
              </button>
            ) : null}
          </div>
        </div>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      description={`Review your booking details below, ${summary?.customer?.fullName?.split(' ')[0] || 'there'}. You can edit any detail before continuing.`}
      screenId="S7"
      title="Here’s your quote"
    >
      {quote ? (
        <div className={styles.quoteMeta}>
          <span className={styles.statusTag}>
            {quote.status === 'active'
              ? 'Guaranteed Quote'
              : quote.status === 'accepted'
                ? 'Accepted Quote'
                : `${quote.status} quote`}
          </span>
          <span>
            Quote #{quote.id.slice(-6).toUpperCase()} · {quote.period} rate
          </span>
          <span>
            Valid until{' '}
            {new Date(quote.validUntil).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}{' '}
            (30 min)
          </span>
        </div>
      ) : null}

      <dl className={styles.summaryList}>
        <SummaryRow
          label="Customer"
          onEdit={() => editQuoteDetail('S2')}
          value={
            summary
              ? `${summary.customer.fullName} · ${summary.customer.phoneE164}`
              : null
          }
        />
        <SummaryRow
          label="Vehicle"
          onEdit={() => editQuoteDetail('S5')}
          value={
            summary
              ? `${summary.vehicle.color ? `${summary.vehicle.color} · ` : ''}${summary.vehicle.year} ${summary.vehicle.make} ${summary.vehicle.model}`
              : null
          }
        />
        <SummaryRow
          label="Pickup"
          onEdit={() =>
            editQuoteDetail('S4', effectiveServiceType === 'tow' ? 'W2' : 'S7')
          }
          value={summary?.pickup.formattedAddress}
        />
        <SummaryRow
          label="Service"
          onEdit={() => editQuoteDetail('S6')}
          value={
            effectiveServiceType === 'mechanic_check' ||
            (summary?.serviceType === 'other' && answers.mechanicIssue)
              ? 'Mechanic assessment'
              : serviceLabels[summary?.serviceType] || 'Roadside service'
          }
        />
        {effectiveServiceType === 'tow' ? (
          <>
            <SummaryRow
              label="Destination"
              onEdit={() => editQuoteDetail('W1', 'W2')}
              value={summary?.dropoff?.formattedAddress}
            />
            <SummaryRow
              label="Route"
              onEdit={() => editQuoteDetail('W2')}
              value={routeText}
            />
          </>
        ) : null}
      </dl>

      {quote ? <QuoteDetails quote={quote} /> : null}

      <div className={styles.inlineInfo}>
        <ShieldCheck size={20} className={styles.inlineInfoIcon} aria-hidden="true" />
        <div>
          <strong>Guaranteed upfront price.</strong>{' '}
          <span className={styles.inlineInfoText}>
            No surprise fees or hidden charges when your driver arrives.
          </span>
        </div>
      </div>
      <NotesField
        id="quote-notes"
        label="Customer notes (optional)"
        onChange={(event) => setAnswer('customerNotes', event.target.value)}
        placeholder="Gate code, vehicle condition, or access notes"
        value={answers.customerNotes || ''}
      />
      {actionState.error ? (
        <div className={styles.errorPanel} role="alert">
          {actionState.error.message}
        </div>
      ) : null}

      <div className={wizardStyles.actionsSpacer} />
      <div className={wizardStyles.actions}>
        <div className={wizardStyles.actionsInner}>
          <button
            className={wizardStyles.primaryAction}
            disabled={!isReady || actionState.status === 'submitting'}
            onClick={() => {
              if (quote?.status === 'accepted') {
                continueWith(toQuoteWizardAnswers(quote, 'accept'));
                return;
              }
              runTransition('accept', (storedQuote) =>
                continueWith(toQuoteWizardAnswers(storedQuote, 'accept')),
              );
            }}
            type="button"
          >
            {actionState.status === 'submitting'
              ? 'Updating quote…'
              : quote?.status === 'accepted'
                ? 'Continue to payment'
                : 'Accept and pay'}
          </button>
          <button
            className={wizardStyles.secondaryAction}
            disabled={!isReady || actionState.status === 'submitting'}
            onClick={() =>
              continueWith(toQuoteWizardAnswers(quote, 'pay_by_phone'))
            }
            type="button"
          >
            Pay by phone instead
          </button>
          <button
            className={wizardStyles.secondaryAction}
            disabled={!isReady || actionState.status === 'submitting'}
            onClick={() => {
              if (quote?.status === 'accepted') {
                completeWith('declined');
                return;
              }
              runTransition('decline', () => completeWith('declined'));
            }}
            type="button"
          >
            No thanks
          </button>
        </div>
      </div>
    </ScreenLayout>
  );
}
