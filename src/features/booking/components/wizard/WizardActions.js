import { ArrowRight, Headphones, LoaderCircle } from 'lucide-react';
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
            aria-busy={isLoading}
            className={styles.primaryAction}
            disabled={isLoading}
            onClick={onContinue}
            type="button"
          >
            {isLoading ? (
              <>
                <LoaderCircle
                  aria-hidden="true"
                  className={styles.spinner}
                  size={18}
                />
                Continuing…
              </>
            ) : (
              <>
                {primaryLabel}
                <ArrowRight aria-hidden="true" size={18} />
              </>
            )}
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
