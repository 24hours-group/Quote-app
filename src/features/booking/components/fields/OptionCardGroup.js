import styles from './BookingControls.module.css';

export function OptionCardGroup({
  label,
  value,
  options,
  onChange,
  error,
  columns = 2,
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>{label}</legend>
      <div
        className={columns === 1 ? styles.fieldset : styles.optionGrid}
        role="radiogroup"
      >
        {options.map(
          ({
            value: optionValue,
            label: optionLabel,
            description,
            icon: Icon,
          }) => {
            const isSelected = value === optionValue;
            return (
              <button
                aria-checked={isSelected}
                className={`${styles.optionCard} ${isSelected ? styles.optionCardSelected : ''}`}
                key={optionValue}
                onClick={() => onChange(optionValue)}
                role="radio"
                type="button"
              >
                {Icon ? (
                  <span className={styles.optionIcon} aria-hidden="true">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                ) : null}
                <span>
                  <span className={styles.optionLabel}>{optionLabel}</span>
                  {description ? (
                    <span className={styles.optionDescription}>
                      {description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          },
        )}
      </div>
      {error ? <span className={styles.error}>{error}</span> : null}
    </fieldset>
  );
}
