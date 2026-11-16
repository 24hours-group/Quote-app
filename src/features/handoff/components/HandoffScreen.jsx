'use client';

import { AlertTriangle, Headphones, Info, Loader2, PhoneCall } from 'lucide-react';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import {
  HANDOFF_ACTIONS,
  getHandoffReasonConfig,
  formatHandoffReason,
} from '@/features/handoff/constants/handoffReasons';
import { useHandoffLead } from '@/features/handoff/hooks/useHandoffLead';
import styles from './HandoffScreen.module.css';

const reasonGuidance = {
  EXISTING_JOB:
    'An agent will verify the booking reference before sharing status details.',
  CANCEL_JOB:
    'An agent will verify the booking and review cancellation and refund options. This request does not cancel the booking or promise a refund.',
  PAY_BY_PHONE:
    'An agent can take payment by phone. This request does not mark your quote or booking as paid.',
  OVER_LIMIT:
    'Online pricing is unavailable for this request. A dispatcher must review the details before discussing a price.',
  HEAVY_DUTY:
    'Online pricing is unavailable for heavy-duty vehicles. The team will review the equipment needed.',
  UNLISTED_SERVICE:
    'A specialist must review this service before availability or pricing can be confirmed.',
  WINCH_SPECIALIST:
    'A specialist must review the recovery conditions. This request is callback-only and does not confirm a price.',
};

export function HandoffScreen({
  answers,
  completeWith,
  editScreen,
  saveCurrentDraft,
}) {
  const reasonCode = answers.handoffReason || 'USER_REQUEST';
  const config = getHandoffReasonConfig(reasonCode);
  const callbackOnly = reasonCode === 'WINCH_SPECIALIST';
  const hasCallbackContact =
    answers.contactAttached === true &&
    Boolean(answers.fullName?.trim()) &&
    Boolean(answers.mobileNumber?.trim());
  const isUrgent =
    answers.isSafe === false || answers.childOrPetInside === true;
  const handoff = useHandoffLead();

  async function submit(action) {
    try {
      await saveCurrentDraft();
      const lead = await handoff.submit({ reasonCode, action });
      if (action === HANDOFF_ACTIONS.CALL_NOW && lead.supportPhoneE164) {
        window.location.assign(`tel:${lead.supportPhoneE164}`);
      }
      completeWith(action);
    } catch {
      // The hook exposes a safe retry message and the booking draft remains intact.
    }
  }

  return (
    <ScreenLayout
      description="Your details will be securely saved for the appropriate team. A hand-off does not confirm service availability or a price."
      screenId="R"
      title={config.headline}
    >
      <span className={styles.headerIcon}>
        <Headphones size={28} aria-hidden="true" />
      </span>
      <span className={styles.teamPill}>{config.team}</span>

      {isUrgent ? (
        <div className={styles.emergencyPanel} role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <strong>Call 911 if anyone is hurt or in immediate danger.</strong>
            <p>
              Roadside assistance is not an emergency-response service. Move to
              a safe place if you can do so safely.
            </p>
            <a href="tel:911">Call 911</a>
          </div>
        </div>
      ) : null}

      <div className={styles.reasonPanel}>
        <Info size={20} className={styles.reasonIcon} aria-hidden="true" />
        <div className={styles.reasonContent}>
          <div className={styles.reasonHeading}>
            <span className={styles.reasonValue}>
              {config.label || formatHandoffReason(reasonCode)}
            </span>
          </div>
          {config.guidance || reasonGuidance[reasonCode] ? (
            <p className={styles.reasonGuidance}>
              {config.guidance || reasonGuidance[reasonCode]}
            </p>
          ) : null}
        </div>
      </div>

      {!hasCallbackContact ? (
        <div className={styles.errorPanel} role="status">
          Add your name and phone number before requesting a callback.
        </div>
      ) : null}

      {handoff.error ? (
        <div className={styles.errorPanel} role="alert">
          {handoff.error.message}
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          className={styles.primaryAction}
          disabled={handoff.isSubmitting || !hasCallbackContact}
          onClick={() => submit(HANDOFF_ACTIONS.REQUEST_CALLBACK)}
          type="button"
        >
          {handoff.isSubmitting ? (
            <Loader2 className={styles.spinner} size={18} aria-hidden="true" />
          ) : null}
          Request a callback
        </button>
        {!hasCallbackContact ? (
          <button
            className={styles.secondaryAction}
            disabled={handoff.isSubmitting}
            onClick={() => editScreen('S2', 'R')}
            type="button"
          >
            Add contact details
          </button>
        ) : null}
        {!callbackOnly ? (
          <button
            className={styles.secondaryAction}
            disabled={handoff.isSubmitting}
            onClick={() => submit(HANDOFF_ACTIONS.CALL_NOW)}
            type="button"
          >
            <PhoneCall size={18} aria-hidden="true" /> Call now
          </button>
        ) : null}
      </div>
    </ScreenLayout>
  );
}
