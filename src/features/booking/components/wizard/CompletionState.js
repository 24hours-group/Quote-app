import { CheckCircle2 } from 'lucide-react';
import styles from './BookingWizard.module.css';

const messages = {
  simulated_paid: {
    title: 'Payment completed',
    copy: 'Your payment has been submitted for verification. Once verified, your booking will be confirmed and sent to the dispatch team. Keep your phone available for service updates.',
  },
  paid: {
    title: 'Payment confirmed',
    copy: 'Your payment was verified. Use the booking reference on your confirmation while the dispatch team coordinates the next steps.',
  },
  declined: {
    title: 'Thanks for checking with us',
    copy: 'Your quote was saved as declined. Come back any time if you still need roadside help.',
  },
  call_now: {
    title: 'Call when you’re ready',
    copy: 'Your details are saved for the roadside team. Calling does not confirm service availability, payment, or a refund.',
  },
  request_callback: {
    title: 'Callback requested',
    copy: 'Your callback request is queued with the appropriate roadside team. Keep your phone available for follow-up.',
  },
};

export function CompletionState({ outcome, onRestart }) {
  const message = messages[outcome] || messages.request_callback;
  return (
    <section className={styles.completion}>
      <span className={styles.completionIcon}>
        <CheckCircle2 size={34} aria-hidden="true" />
      </span>
      <h1 className={styles.completionTitle}>{message.title}</h1>
      <p className={styles.completionCopy}>{message.copy}</p>
      <button
        className={styles.restartButton}
        onClick={onRestart}
        type="button"
      >
        Start another request
      </button>
    </section>
  );
}
