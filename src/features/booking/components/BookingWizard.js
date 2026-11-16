'use client';

import { BookingScreenRenderer } from '@/features/booking/components/screens/BookingScreenRenderer';
import { ConfirmationDialog } from '@/features/booking/components/fields/ConfirmationDialog';
import { CompletionState } from '@/features/booking/components/wizard/CompletionState';
import { WizardActions } from '@/features/booking/components/wizard/WizardActions';
import { WizardFrame } from '@/features/booking/components/wizard/WizardFrame';
import { WizardSkeleton } from '@/features/booking/components/wizard/WizardSkeleton';
import { useBookingWizard } from '@/features/booking/hooks/useBookingWizard';
import { getBookingActionLabel } from '@/features/booking/utils/bookingActionLabel';
const customActionScreens = new Set(['S7', 'S8A', 'R']);

export function BookingWizard() {
  const wizard = useBookingWizard();

  if (wizard.isHydrating) return <WizardSkeleton />;
  if (wizard.outcome) {
    return (
      <CompletionState onRestart={wizard.restart} outcome={wizard.outcome} />
    );
  }

  const primaryLabel = getBookingActionLabel(
    wizard.currentScreenId,
    wizard.answers,
  );

  const isScreenLoading =
    (wizard.currentScreenId === 'W2' && wizard.answers.routeStatus !== 'ready') ||
    (wizard.currentScreenId === 'S7' &&
      !['active', 'accepted'].includes(wizard.answers.quoteStatus)) ||
    (wizard.currentScreenId === 'S8A' && wizard.answers.paymentStatus === 'loading');

  return (
    <WizardFrame
      canGoBack={wizard.history.length > 0}
      currentScreenId={wizard.currentScreenId}
      isScreenLoading={isScreenLoading}
      onBack={wizard.goBack}
      progress={wizard.progress}
      saveStatus={wizard.saveStatus}
    >
      <BookingScreenRenderer {...wizard} screenId={wizard.currentScreenId} />
      {!customActionScreens.has(wizard.currentScreenId) && !isScreenLoading ? (
        <WizardActions
          isLoading={wizard.isContinuing}
          onContinue={wizard.continueFlow}
          onHandoff={wizard.requestHandoff}
          primaryLabel={primaryLabel}
          showHandoff={wizard.answers.contactAttached === true}
        />
      ) : null}
      <ConfirmationDialog
        onContinue={wizard.confirmNotice}
        open={Boolean(wizard.notice)}
      />
    </WizardFrame>
  );
}
