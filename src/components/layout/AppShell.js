import Image from 'next/image';
import Link from 'next/link';
import { applicationConfig } from '@/config/application';
import { routes } from '@/config/routes';
import styles from './AppShell.module.css';

export function AppShell({ children, admin = false }) {
  return (
    <div className={admin ? styles.adminShell : styles.shell}>
      <header className={styles.header}>
        <div className={admin ? styles.headerInnerAdmin : styles.headerInner}>
          <Link
            className={styles.brand}
            href={admin ? routes.admin : routes.book}
          >
            <Image
              alt={applicationConfig.company.name}
              className={styles.brandLogo}
              height={38}
              priority
              src="/TowNexaa-logo.png"
              width={58}
            />
            <span className={styles.brandText}>
              <span className={styles.brandName}>{applicationConfig.company.name}</span>
              <span className={styles.tagline}>
                {applicationConfig.company.tagline || 'Towing Made Simple.'}
              </span>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            <span className={styles.supportBadge}>
              <span className={styles.pulseDot} aria-hidden="true" />
              24/7 Dispatch Ready
            </span>
            {admin ? (
              <Link className={styles.navLink} href={routes.adminSettings}>
                Settings
              </Link>
            ) : (
              <Link className={styles.navLink} href={routes.book}>
                Request service
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className={admin ? styles.adminMain : styles.main}>{children}</main>
      <footer className={admin ? styles.adminFooter : styles.footer}>
        <div>
          © {new Date().getFullYear()}{' '}
          <span className={styles.footerBrand}>
            {applicationConfig.company.name}
          </span>
          . All rights reserved.
        </div>
        <div className={styles.footerTagline}>
          {applicationConfig.company.tagline || 'Towing Made Simple.'} • Fast,
          transparent roadside assistance.
        </div>
      </footer>
    </div>
  );
}
