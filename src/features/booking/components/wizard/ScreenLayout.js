import styles from './BookingWizard.module.css';

export function ScreenLayout({ screenId, title, description, children }) {
  return (
    <section className={styles.card} aria-labelledby={`${screenId}-title`}>
      <span className={styles.screenId}>{screenId}</span>
      <h1 className={styles.title} id={`${screenId}-title`}>
        {title}
      </h1>
      {description ? <p className={styles.description}>{description}</p> : null}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
