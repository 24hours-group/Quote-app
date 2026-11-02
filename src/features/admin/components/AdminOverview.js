import { SurfaceCard } from '@/components/ui/SurfaceCard';
import styles from './AdminOverview.module.css';

const cards = [
  ['Authentication', 'Supabase Auth foundation'],
  ['Operations', 'No active bookings'],
  ['Payments', 'Not enabled'],
];

export function AdminOverview() {
  return (
    <section>
      <header className={styles.header}>
        <h1 className={styles.title}>Admin</h1>
        <p className={styles.description}>
          Administrative routing and authorization boundaries are ready for a
          future implementation. Operational functionality is intentionally
          disabled in this unit.
        </p>
      </header>
      <div className={styles.cardsGrid}>
        {cards.map(([value, label]) => (
          <SurfaceCard key={value}>
            <p className={styles.value}>{value}</p>
            <p className={styles.label}>{label}</p>
          </SurfaceCard>
        ))}
      </div>
    </section>
  );
}
