import { Truck, CheckCircle, PhoneCall, AlertCircle } from 'lucide-react';
import styles from './AdminKpiCards.module.css';

export function AdminKpiCards({ metrics = {} }) {
  const {
    activeDispatches = 0,
    completedCount = 0,
    openHandoffs = 0,
    failedNotifications = 0,
  } = metrics;

  return (
    <div className={styles.kpiGrid}>
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.label}>Active Dispatches</span>
          <div className={`${styles.iconWrap} ${styles.iconWrapBlue}`}>
            <Truck size={18} />
          </div>
        </div>
        <div className={styles.value}>{activeDispatches}</div>
        <p className={styles.hint}>Assigned or awaiting drivers</p>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.label}>Completed Jobs</span>
          <div className={`${styles.iconWrap} ${styles.iconWrapGreen}`}>
            <CheckCircle size={18} />
          </div>
        </div>
        <div className={styles.value}>{completedCount}</div>
        <p className={styles.hint}>Successfully delivered & completed</p>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.label}>Callback Requests</span>
          <div className={`${styles.iconWrap} ${styles.iconWrapAmber}`}>
            <PhoneCall size={18} />
          </div>
        </div>
        <div className={styles.value}>{openHandoffs}</div>
        <p className={styles.hint}>Customers waiting for phone call</p>
      </div>

      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.label}>Outbox Failures</span>
          <div className={`${styles.iconWrap} ${styles.iconWrapRose}`}>
            <AlertCircle size={18} />
          </div>
        </div>
        <div className={styles.value}>{failedNotifications}</div>
        <p className={styles.hint}>Failed delivery alerts</p>
      </div>
    </div>
  );
}
