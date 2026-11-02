import { ArrowLeft, Check, Cloud, CloudOff } from 'lucide-react';
import styles from './BookingWizard.module.css';

export function WizardFrame({
  children,
  currentScreenId,
  progress,
  saveStatus,
  canGoBack,
  onBack,
}) {
  return (
    <div className={styles.wizard}>
      <div className={styles.topbar}>
        {canGoBack ? (
          <button className={styles.backButton} onClick={onBack} type="button">
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
            <span>
              Step {progress.currentStep} of {progress.totalSteps}
            </span>
            <span>
              {progress.substep
                ? `${progress.substep.current} of ${progress.substep.total}`
                : currentScreenId}
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
