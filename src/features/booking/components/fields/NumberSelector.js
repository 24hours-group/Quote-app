import styles from './BookingControls.module.css';

export function NumberSelector({ label, value, options, onChange, error }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.numberGrid}>
        {options.map((option) => {
          const optionValue =
            typeof option === 'object' ? option.value : option;
          const optionLabel =
            typeof option === 'object' ? option.label : option;
          return (
            <button
              aria-pressed={value === optionValue}
              className={`${styles.numberButton} ${value === optionValue ? styles.numberButtonSelected : ''}`}
              key={optionValue}
              onClick={() => onChange(optionValue)}
              type="button"
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
      {error ? <span className={styles.error}>{error}</span> : null}
    </fieldset>
  );
}
