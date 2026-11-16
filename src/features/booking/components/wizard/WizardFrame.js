import { ArrowLeft, Check, Cloud, CloudOff } from 'lucide-react';
import { getScreenLabel } from '@/features/booking/utils/bookingFlow';
import styles from './BookingWizard.module.css';

export function WizardFrame({
  children,
  currentScreenId,
  progress,
  saveStatus,
  canGoBack,
  onBack,
  isScreenLoading = false,
}) {
  return (
    <div className={styles.wizard}>
      <div className={styles.topbar}>
        {canGoBack ? (
          <button
            aria-disabled={isScreenLoading}
            className={styles.backButton}
            disabled={isScreenLoading}
            onClick={onBack}
            type="button"
          >
            <ArrowLeft size={18} /> Back
          </button>
        ) : (
          <span />
        )}
        <span className={styles.saveStatus} aria-live="polite">
          {saveStatus === 'saving' ? <Cloud size={15} /> : null}
          {saveStatus === 'saved' ? <Check size={15} /> : null}
          {saveStatus === 'error' ? <CloudOff size={15} /> : null}
          {saveStatus === 'saving' ? 'Saving…' : null}
          {saveStatus === 'saved' ? 'Progress saved' : null}
          {saveStatus === 'error' ? 'Save unavailable' : null}
        </span>
      </div>
      {progress.currentStep ? (
        <div className={styles.progressWrap}>
          <div className={styles.progressMeta}>
            <span className={styles.stepBadge}>
              Step {progress.currentStep} of {progress.totalSteps}
            </span>
            <span className={styles.screenLabel}>
              {progress.substep
                ? `${getScreenLabel(currentScreenId)} ${progress.substep.current} of ${progress.substep.total}`
                : getScreenLabel(currentScreenId)}
            </span>
          </div>
          <progress
            aria-label={`Step ${progress.currentStep} of ${progress.totalSteps}`}
            className={styles.progressTrack}
            max={progress.totalSteps}
            value={progress.currentStep}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
