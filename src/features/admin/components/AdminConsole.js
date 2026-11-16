'use client';

import { useState, useCallback, useRef } from 'react';
import { Zap, X } from 'lucide-react';
import { AdminHeader } from './AdminHeader/AdminHeader';
import { AdminKpiCards } from './AdminKpiCards/AdminKpiCards';
import { AdminTabs } from './AdminTabs/AdminTabs';
import { BookingList } from './BookingManagement/BookingList';
import { HandoffQueueList } from './HandoffManagement/HandoffQueueList';
import { PricingSettingsManager } from './PricingManagement/PricingSettingsManager';
import { NotificationOutboxList } from './NotificationManagement/NotificationOutboxList';
import { TeamManagementList } from './TeamManagement/TeamManagementList';
import { CompanySettingsManager } from './CompanySettings/CompanySettingsManager';
import { useAdminRealtimeSync } from '../hooks/useAdminRealtimeSync';
import styles from './AdminConsole.module.css';

export function AdminConsole({ initialDashboard, profile, defaultTab = 'bookings' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [bookings, setBookings] = useState(initialDashboard.bookings || []);
  const [handoffs, setHandoffs] = useState(initialDashboard.handoffs || []);
  const [notifications, setNotifications] = useState(
    initialDashboard.notifications || [],
  );
  const [liveBanner, setLiveBanner] = useState(null);
  const bannerTimerRef = useRef(null);

  const handleRealtimeSync = useCallback(
    (freshData) => {
      if (!freshData) return;

      if (freshData.bookings && freshData.bookings.length > bookings.length) {
        const newest = freshData.bookings[0];
        setLiveBanner(
          `Live update: New booking (${newest.reference || 'received'}) synced!`,
        );
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setLiveBanner(null), 6000);
      } else if (
        freshData.handoffs &&
        freshData.handoffs.length > handoffs.length
      ) {
        setLiveBanner('Live update: New callback request synced!');
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setLiveBanner(null), 6000);
      }

      if (freshData.bookings) setBookings(freshData.bookings);
      if (freshData.handoffs) setHandoffs(freshData.handoffs);
      if (freshData.notifications) setNotifications(freshData.notifications);
    },
    [bookings.length, handoffs.length],
  );

  const { isSyncing, isConnected, syncNow } = useAdminRealtimeSync({
    onSync: handleRealtimeSync,
  });

  function handleBookingStatusUpdate(bookingId, newStatus) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, dispatch_status: newStatus } : b,
      ),
    );
  }

  function handleHandoffStatusUpdate(leadId, newStatus) {
    setHandoffs((prev) =>
      prev.map((h) =>
        h.id === leadId ? { ...h, callback_status: newStatus } : h,
      ),
    );
  }

  function handleHandoffDelete(leadId) {
    setHandoffs((prev) => prev.filter((h) => h.id !== leadId));
  }

  function handleNotificationDelete(notificationId) {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }

  const activeDispatches = bookings.filter((b) =>
    ['ready', 'notified', 'acknowledged', 'assigned'].includes(
      b.dispatch_status,
    ),
  ).length;

  const completedCount = bookings.filter(
    (b) => b.dispatch_status === 'completed',
  ).length;

  const openHandoffs = handoffs.filter((h) =>
    ['new', 'queued', 'contacted'].includes(h.callback_status),
  ).length;

  const failedNotifications = notifications.filter((n) =>
    ['failed', 'dead_letter'].includes(n.delivery_status),
  ).length;

  const metrics = {
    activeDispatches,
    completedCount,
    openHandoffs,
    failedNotifications,
  };

  const counts = {
    bookingsCount: activeDispatches > 0 ? activeDispatches : bookings.length,
    callbacksCount: openHandoffs > 0 ? openHandoffs : null,
    failedCount: failedNotifications > 0 ? failedNotifications : null,
  };

  return (
    <div className={styles.container}>
      <AdminHeader
        profile={profile}
        isSyncing={isSyncing}
        isConnected={isConnected}
        onManualSync={syncNow}
      />

      {liveBanner ? (
        <div className={styles.liveAlert} role="status">
          <div className={styles.liveAlertContent}>
            <Zap size={14} />
            <span>{liveBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setLiveBanner(null)}
            className={styles.liveAlertClose}
            aria-label="Dismiss alert"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      <AdminKpiCards metrics={metrics} />

      <AdminTabs
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        counts={counts}
        currentRole={profile?.role}
      />

      <div className={styles.tabContent}>
        {activeTab === 'bookings' ? (
          <BookingList
            bookings={bookings}
            onUpdateStatus={handleBookingStatusUpdate}
          />
        ) : null}

        {activeTab === 'callbacks' ? (
          <HandoffQueueList
            handoffs={handoffs}
            onUpdateHandoff={handleHandoffStatusUpdate}
            onDeleteHandoff={handleHandoffDelete}
          />
        ) : null}

        {activeTab === 'pricing' ? (
          <PricingSettingsManager />
        ) : null}

        {activeTab === 'notifications' ? (
          <NotificationOutboxList
            notifications={notifications}
            onDeleteNotification={handleNotificationDelete}
            onRefresh={() => {
              // Optionally trigger reload or update notifications
            }}
          />
        ) : null}

        {activeTab === 'team' && profile?.role === 'super_admin' ? (
          <TeamManagementList currentProfile={profile} />
        ) : null}

        {activeTab === 'company' && profile?.role === 'super_admin' ? (
          <CompanySettingsManager />
        ) : null}
      </div>
    </div>
  );
}

