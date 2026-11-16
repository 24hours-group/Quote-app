import styles from './BookingControls.module.css';

export function TextInput({ label, error, helperText, id, ...props }) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;

  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={errorId || helperId}
        aria-invalid={Boolean(error)}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        id={id}
        {...props}
      />
      {helperText ? (
        <p className={styles.helper} id={helperId}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
