import Link from 'next/link';
import { applicationConfig } from '@/config/application';
import { routes } from '@/config/routes';
import styles from './AppShell.module.css';

export function AppShell({ children, admin = false }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            className={styles.brand}
            href={admin ? routes.admin : routes.book}
          >
            {applicationConfig.company.name}
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            {admin ? (
              <Link href={routes.adminSettings}>Settings</Link>
            ) : (
              <Link href={routes.book}>Request service</Link>
            )}
          </nav>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        © {new Date().getFullYear()} {applicationConfig.company.name}
      </footer>
    </div>
  );
}
