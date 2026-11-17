'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { FormattedDate } from '../FormattedDate/FormattedDate';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { Pagination } from '../Pagination';
import styles from './NotificationOutboxList.module.css';

export function NotificationOutboxList({
  notifications = [],
  onRefresh,
  onDeleteNotification,
}) {
  const [filter, setFilter] = useState('all');
  const [retrying, setRetrying] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'failed') {
      return ['failed', 'dead_letter'].includes(item.delivery_status);
    }
    if (filter === 'delivered') {
      return item.delivery_status === 'delivered';
    }
    return true;
  });

  const totalItems = filteredNotifications.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedNotifications = filteredNotifications.slice(
    startIndex,
    startIndex + pageSize,
  );

  function handleFilterChange(pillId) {
    setFilter(pillId);
    setCurrentPage(1);
  }

  async function handleRetryBatch() {
    if (retrying) return;
    setRetrying(true);
    setResultMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/admin/notifications/process', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Retry process failed');
      }
      setResultMessage(
        `Batch processed successfully! Processed: ${
          data.data?.processed ?? 0
        }, Delivered: ${data.data?.delivered ?? 0}, Failed: ${
          data.data?.failed ?? 0
        }`,
      );
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMessage(`Error: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  }

  async function handleConfirmDelete() {
    if (!notificationToDelete || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/admin/notifications/${notificationToDelete.id}`,
        {
          method: 'DELETE',
        },
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete notification log');
      }

      if (onDeleteNotification) {
        onDeleteNotification(notificationToDelete.id);
      }
      setNotificationToDelete(null);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  function renderStatusBadge(status) {
    if (status === 'delivered') {
      return (
        <span className={styles.statusDelivered}>
          <CheckCircle size={11} /> Delivered
        </span>
      );
    }
    if (status === 'failed' || status === 'dead_letter') {
      return (
        <span className={styles.statusFailed}>
          <AlertCircle size={11} /> Failed
        </span>
      );
    }
    return (
      <span className={styles.statusPending}>
        <Clock size={11} /> Pending
      </span>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerBar}>
        <div className={styles.filterPills}>
          {[
            { id: 'all', label: 'All Deliveries' },
            { id: 'failed', label: 'Failed' },
            { id: 'delivered', label: 'Delivered' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => handleFilterChange(pill.id)}
              className={`${styles.filterPill} ${
                filter === pill.id ? styles.filterPillActive : ''
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleRetryBatch}
          disabled={retrying}
          className={styles.retryBtn}
        >
          <RefreshCw size={13} className={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Retrying Outbox…' : 'Process / Retry Outbox'}
        </button>
      </div>

      {resultMessage ? (
        <div className={styles.resultSuccess}>{resultMessage}</div>
      ) : null}

      {errorMessage ? (
        <div className={styles.resultError}>{errorMessage}</div>
      ) : null}

      {filteredNotifications.length === 0 ? (
        <div className={styles.emptyState}>
          No notifications recorded in this filter.
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thRef}>Booking Ref</th>
                  <th className={styles.thEvent}>Event Type</th>
                  <th className={styles.thRecipient}>Recipient</th>
                  <th className={styles.thStatus}>Status</th>
                  <th className={styles.thAttempts}>Attempts</th>
                  <th className={styles.thError}>Error</th>
                  <th className={styles.thDate}>Timestamp</th>
                  <th className={styles.thActions}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedNotifications.map((notif) => (
                  <tr key={notif.id}>
                    <td className={styles.bookingRef}>
                      <span className={styles.bookingRefPill}>
                        {notif.bookings?.reference || 'System'}
                      </span>
                    </td>
                    <td className={styles.eventName}>
                      {notif.event_name?.replaceAll('_', ' ')}
                    </td>
                    <td className={styles.recipientText}>{notif.recipient}</td>
                    <td className={styles.statusCell}>
                      {renderStatusBadge(notif.delivery_status)}
                    </td>
                    <td className={styles.retryCountText}>
                      {notif.retry_count} / {notif.max_attempts || 5}
                    </td>
                    <td className={styles.errorCodeText}>
                      {notif.last_error_code ? (
                        <span className={styles.errorPill}>
                          {notif.last_error_code}
                        </span>
                      ) : (
                        <span className={styles.noError}>—</span>
                      )}
                    </td>
                    <td className={styles.dateCell}>
                      <FormattedDate value={notif.created_at} />
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        type="button"
                        onClick={() => setNotificationToDelete(notif)}
                        className={styles.deleteBtn}
                        title="Delete email log"
                        aria-label={`Delete email log for ${notif.recipient}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={safeCurrentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50]}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={Boolean(notificationToDelete)}
        title="Delete Email Log"
        description={
          notificationToDelete
            ? `Are you sure you want to delete the email log for "${notificationToDelete.recipient}" (${notificationToDelete.event_name?.replaceAll(
                '_',
                ' ',
              )})? This will remove the log entry from the console.`
            : ''
        }
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete Log'}
        cancelLabel="Keep Log"
        variant="danger"
        isProcessing={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) setNotificationToDelete(null);
        }}
      />
    </div>
  );
}
