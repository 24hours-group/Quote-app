import { CheckCircle2 } from 'lucide-react';
import styles from './BookingWizard.module.css';

const messages = {
  paid: {
    title: 'Payment confirmed',
    copy: 'A dispatcher will call you shortly to confirm the arrival time. Your demo reference is RS-DEMO-2401.',
  },
  declined: {
    title: 'Thanks for checking with us',
    copy: 'Your quote was saved as declined. Come back any time if you still need roadside help.',
  },
  call_now: {
    title: 'Call when you’re ready',
    copy: 'Your details are saved for the roadside team. Use the support number shown on the previous screen.',
  },
  request_callback: {
    title: 'Callback requested',
    copy: 'Your details are saved. The appropriate roadside team will call you shortly.',
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
