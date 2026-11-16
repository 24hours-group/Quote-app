'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, LogOut, ShieldCheck, RefreshCw } from 'lucide-react';
import styles from './AdminHeader.module.css';

export function AdminHeader({
  profile,
  isSyncing = false,
  isConnected = false,
  onManualSync,
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/admin/auth/signout', { method: 'POST' });
      router.replace('/admin-login');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const roleName = profile?.role
    ? profile.role.replaceAll('_', ' ')
    : 'Staff Member';

  return (
    <header className={styles.header}>
      <div className={styles.intro}>
        <div className={styles.eyebrow}>Townexa Operations Console</div>
        <h1 className={styles.title}>
          Welcome, {profile?.display_name || 'Dispatcher'}
        </h1>
        <p className={styles.subtitle}>
          Real-time towing dispatch, active customer bookings, and instant callback triage.
        </p>
      </div>

      <div className={styles.actions}>
        <span
          className={isConnected ? styles.syncBadge : styles.syncBadgeDisconnected}
          title={
            isConnected
              ? 'Real-time WebSocket connected'
              : 'Auto-sync heartbeat active'
          }
        >
          <span
            className={isConnected ? styles.liveDot : styles.pulseDot}
            aria-hidden="true"
          />
          {isSyncing ? 'Syncing…' : isConnected ? 'Realtime Sync' : 'Live Sync'}
        </span>

        {onManualSync ? (
          <button
            type="button"
            onClick={onManualSync}
            disabled={isSyncing}
            className={styles.syncBtn}
            title="Refresh dashboard data now"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw
              size={13}
              className={isSyncing ? styles.syncIconSpinning : styles.syncIcon}
            />
            <span>Sync</span>
          </button>
        ) : null}

        <span className={styles.badge}>
          <span className={styles.pulseDot} aria-hidden="true" />
          <ShieldCheck size={14} />
          {roleName}
        </span>

        <Link
          className={styles.viewBookingLink}
          href="/book"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={13} />
          Customer Flow
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={styles.signOutButton}
        >
          <LogOut size={13} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}

