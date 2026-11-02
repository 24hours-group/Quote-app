import { ArrowRight, Headphones } from 'lucide-react';
import styles from './BookingWizard.module.css';

export function WizardActions({
  primaryLabel = 'Continue',
  onContinue,
  onHandoff,
  showHandoff = true,
  isLoading = false,
}) {
  return (
    <>
      <div className={styles.actionsSpacer} />
      <div className={styles.actions}>
        <div className={styles.actionsInner}>
          <button
            className={styles.primaryAction}
            disabled={isLoading}
            onClick={onContinue}
            type="button"
          >
            {isLoading ? 'Please wait…' : primaryLabel}
            {!isLoading ? <ArrowRight size={18} /> : null}
          </button>
          {showHandoff ? (
            <button
              className={styles.secondaryAction}
              onClick={onHandoff}
              type="button"
            >
              <Headphones size={18} /> Talk to a person
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
