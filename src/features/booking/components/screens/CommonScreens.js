'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { OptionCardGroup } from '@/features/booking/components/fields/OptionCardGroup';
import { TextInput } from '@/features/booking/components/fields/TextInput';
import {
  entryOptions,
  safetyOptions,
} from '@/features/booking/mock-data/screenOptions';
import { ScreenLayout } from '@/features/booking/components/wizard/ScreenLayout';

import styles from './BookingScreens.module.css';

function ContactScreen({ answers, errors, setAnswer }) {
  return (
    <ScreenLayout
      description="We’ll use these details for dispatcher calls and your payment receipt."
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
          autoComplete="email"
          error={errors.receiptEmail}
          id="receipt-email"
          inputMode="email"
          label="Receipt email"
          onChange={(event) => setAnswer('receiptEmail', event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={answers.receiptEmail || ''}
        />
        <TextInput
          autoComplete="tel-national"
          error={errors.mobileNumber || errors.contactAttached}
          id="mobile-number"
          inputMode="tel"
          label="US phone number"
          onChange={(event) => setAnswer('mobileNumber', event.target.value)}
          placeholder="(212) 555-0100"
          value={answers.mobileNumber || ''}
        />

        <div className={styles.inlineInfo}>
          <Info size={20} aria-hidden="true" />
          We validate US phone-number formatting only. This does not verify who
          owns the number or whether it is active.
        </div>
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
