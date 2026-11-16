import styles from './LoadingSpinner.module.css';

export function LoadingSpinner({
  label = 'Loading…',
  sublabel,
  size = 'md',
  fullPage = false,
  card = false,
  className = '',
}) {
  let sizeClass = styles.spinnerMd;
  if (size === 'sm') sizeClass = styles.spinnerSm;
  if (size === 'lg') sizeClass = styles.spinnerLg;

  const containerClasses = [
    styles.container,
    fullPage ? styles.fullPage : '',
    card ? styles.card : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={`${styles.spinnerWrap} ${sizeClass}`}>
        <svg
          className={`${styles.svgSpinner} ${sizeClass}`}
          viewBox="0 0 50 50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle
            className={styles.track}
            cx="25"
            cy="25"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
          />
          <circle
            className={styles.indicator}
            cx="25"
            cy="25"
            r="20"
            stroke="currentColor"
            strokeWidth="4"
          />
        </svg>
      </div>

      {label ? <p className={styles.label}>{label}</p> : null}
      {sublabel ? <p className={styles.sublabel}>{sublabel}</p> : null}
    </div>
  );
}

