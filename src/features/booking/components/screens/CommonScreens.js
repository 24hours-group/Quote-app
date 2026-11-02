'use client';

import { useMemo } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { OptionCardGroup } from '@/features/booking/components/fields/OptionCardGroup';
import { TextInput } from '@/features/booking/components/fields/TextInput';
import {
  entryOptions,
  safetyOptions,
} from '@/features/booking/mock-data/screenOptions';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';
import styles from './BookingScreens.module.css';
import controlStyles from '../fields/BookingControls.module.css';

function ContactScreen({ answers, errors, setAnswer }) {
  const phoneDigits = (answers.mobileNumber || '')
    .replace(/\D/g, '')
    .replace(/^1/, '');
  const canVerify = phoneDigits.length === 10;
  const attempts = answers.codeAttempts || 0;
  const isVerified = answers.codeStatus === 'verified';

  const verifyCode = () => {
    if (answers.verificationCode === '123456') {
      setAnswer('codeStatus', 'verified');
      return;
    }
    const nextAttempts = attempts + 1;
    setAnswer('codeAttempts', nextAttempts);
    setAnswer('codeStatus', nextAttempts >= 3 ? 'failed' : 'pending');
  };

  return (
    <ScreenLayout
      description="We’ll use this number for dispatcher calls, updates, and your receipt."
      screenId="S2"
      title="How can we reach you?"
    >
      <div className={styles.stack}>
        <TextInput
          autoComplete="name"
          error={errors.fullName}
          id="full-name"
          label="Full name"
          onChange={(event) => setAnswer('fullName', event.target.value)}
          placeholder="First and last name"
          value={answers.fullName || ''}
        />
        <TextInput
          autoComplete="tel"
          error={errors.mobileNumber}
          id="mobile-number"
          inputMode="tel"
          label="Mobile number"
          onChange={(event) => setAnswer('mobileNumber', event.target.value)}
          placeholder="(555) 555-0100"
          value={answers.mobileNumber || ''}
        />
        <label className={controlStyles.checkboxRow}>
          <input
            checked={Boolean(answers.textConsent)}
            className={controlStyles.checkbox}
            onChange={(event) => setAnswer('textConsent', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>Text me the invoice and job updates</strong>
            <span className={controlStyles.optionDescription}>
              Consent is required for text delivery in this flow.
            </span>
          </span>
        </label>
        {errors.textConsent ? (
          <span className={controlStyles.error}>{errors.textConsent}</span>
        ) : null}
        {canVerify ? (
          <div className={styles.stack}>
            <div className={styles.inlineInfo}>
              <Info size={20} aria-hidden="true" />
              SMS is mocked in this prototype. Use code <strong>123456</strong>.
            </div>
            {isVerified ? (
              <div className={styles.successInfo}>
                <CheckCircle2 size={18} /> Phone verified
              </div>
            ) : (
              <div className={styles.verificationRow}>
                <TextInput
                  error={errors.codeStatus}
                  id="verification-code"
                  inputMode="numeric"
                  label="6-digit code"
                  maxLength={6}
                  onChange={(event) =>
                    setAnswer(
                      'verificationCode',
                      event.target.value.replace(/\D/g, ''),
                    )
                  }
                  placeholder="------"
                  value={answers.verificationCode || ''}
                />
                <button
                  className={styles.smallButton}
                  onClick={verifyCode}
                  type="button"
                >
                  Verify code
                </button>
              </div>
            )}
            {attempts > 0 && !isVerified ? (
              <p className={controlStyles.error} role="alert">
                Code not recognized. {Math.max(0, 3 - attempts)} tries
                remaining.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </ScreenLayout>
  );
}

export function CommonScreens({ screenId, answers, errors, setAnswer }) {
  const content = useMemo(() => {
    if (screenId === 'S0') {
      return (
        <ScreenLayout
          description="If anyone is hurt or you’re in danger, call 911 first. We can help with your vehicle after."
          screenId="S0"
          title="Are you in a safe place?"
        >
          <OptionCardGroup
            columns={1}
            error={errors.isSafe}
            label="Safety status"
            onChange={(value) => setAnswer('isSafe', value)}
            options={safetyOptions}
            value={answers.isSafe}
          />
        </ScreenLayout>
      );
    }
    if (screenId === 'S1') {
      return (
        <ScreenLayout
          description="Choose the option that best matches what you need today."
          screenId="S1"
          title="What can we help you with?"
        >
          <OptionCardGroup
            columns={1}
            error={errors.requestType}
            label="Request type"
            onChange={(value) => setAnswer('requestType', value)}
            options={entryOptions}
            value={answers.requestType}
          />
        </ScreenLayout>
      );
    }
    if (screenId === 'S2') {
      return (
        <ContactScreen
          answers={answers}
          errors={errors}
          setAnswer={setAnswer}
        />
      );
    }
    return null;
  }, [answers, errors, screenId, setAnswer]);

  return content;
}
