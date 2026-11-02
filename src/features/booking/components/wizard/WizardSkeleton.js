import styles from './BookingWizard.module.css';

export function WizardSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Loading saved progress">
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonHero} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLine} />
    </div>
  );
}
