'use client';

import { BookingScreenRenderer } from '@/features/booking/components/screens/BookingScreenRenderer';
import { ConfirmationDialog } from '@/features/booking/components/fields/ConfirmationDialog';
import { CompletionState } from '@/features/booking/components/wizard/CompletionState';
import { WizardActions } from '@/features/booking/components/wizard/WizardActions';
import { WizardFrame } from '@/features/booking/components/wizard/WizardFrame';
import { WizardSkeleton } from '@/features/booking/components/wizard/WizardSkeleton';
import { useBookingWizard } from '@/features/booking/hooks/useBookingWizard';

const serviceScreens = new Set(['J1', 'T1', 'L1', 'W2', 'G1', 'M1', 'X1']);
const customActionScreens = new Set(['S7', 'S8A', 'R']);

export function BookingWizard() {
  const wizard = useBookingWizard();

  if (wizard.isHydrating) return <WizardSkeleton />;
  if (wizard.outcome) {
    return (
      <CompletionState onRestart={wizard.restart} outcome={wizard.outcome} />
    );
  }

  const primaryLabel = serviceScreens.has(wizard.currentScreenId)
    ? 'See my quote'
    : 'Continue';

  return (
    <WizardFrame
      canGoBack={wizard.history.length > 0}
      currentScreenId={wizard.currentScreenId}
      onBack={wizard.goBack}
      progress={wizard.progress}
      saveStatus={wizard.saveStatus}
    >
      <BookingScreenRenderer {...wizard} screenId={wizard.currentScreenId} />
      {!customActionScreens.has(wizard.currentScreenId) ? (
        <WizardActions
          onContinue={wizard.continueFlow}
          onHandoff={wizard.requestHandoff}
          primaryLabel={primaryLabel}
        />
      ) : null}
      <ConfirmationDialog
        onContinue={wizard.confirmNotice}
        open={Boolean(wizard.notice)}
      />
    </WizardFrame>
  );
}
