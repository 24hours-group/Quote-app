import styles from './DispatchStatusBadge.module.css';

const STATUS_LABELS = {
  ready: 'Awaiting Driver',
  notified: 'Driver Alerted',
  acknowledged: 'Driver Confirmed',
  assigned: 'Truck En Route',
  completed: 'Job Completed',
  cancelled: 'Cancelled',
  not_ready: 'Awaiting Payment',
};

export function DispatchStatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status?.replaceAll('_', ' ') || 'Unknown';
  let statusClass = styles.ready;

  if (status === 'assigned') statusClass = styles.assigned;
  else if (status === 'notified' || status === 'acknowledged') statusClass = styles.notified;
  else if (status === 'completed') statusClass = styles.completed;
  else if (status === 'cancelled') statusClass = styles.cancelled;
  else if (status === 'not_ready') statusClass = styles.notReady;

  return (
    <span className={`${styles.badge} ${statusClass}`}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}

