import styles from './BookingControls.module.css';

export function NotesField({ label, id, helperText, ...props }) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <textarea className={styles.textarea} id={id} {...props} />
      {helperText ? <p className={styles.helper}>{helperText}</p> : null}
    </div>
  );
}
