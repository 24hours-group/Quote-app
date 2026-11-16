'use client';

import { useState } from 'react';
import { Phone, CheckCircle2, Clock, UserCheck, Trash2 } from 'lucide-react';
import { FormattedDate } from '../FormattedDate/FormattedDate';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { Pagination } from '../Pagination';
import { formatHandoffReason } from '@/features/handoff/constants/handoffReasons';
import styles from './HandoffQueueList.module.css';

export function HandoffQueueList({
  handoffs = [],
  onUpdateHandoff,
  onDeleteHandoff,
}) {
  const [filter, setFilter] = useState('open');
  const [updatingId, setUpdatingId] = useState(null);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function handleFilterChange(pillId) {
    setFilter(pillId);
    setCurrentPage(1);
  }

  const filteredHandoffs = handoffs.filter((lead) => {
    if (filter === 'open') {
      return ['new', 'queued', 'contacted'].includes(lead.callback_status);
    }
    if (filter === 'resolved') {
      return ['resolved', 'closed'].includes(lead.callback_status);
    }
    return true;
  });

  const totalItems = filteredHandoffs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedHandoffs = filteredHandoffs.slice(
    startIndex,
    startIndex + pageSize,
  );

  async function handleStatusChange(leadId, newStatus) {
    if (updatingId) return;
    setUpdatingId(leadId);
    try {
      const res = await fetch(`/api/admin/handoffs/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onUpdateHandoff(leadId, newStatus);
      }
    } catch (err) {
      console.error('Failed to update lead status', err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!leadToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/handoffs/${leadToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onDeleteHandoff) {
          onDeleteHandoff(leadToDelete.id);
        }
        setLeadToDelete(null);
      } else {
        alert(data.error || 'Failed to delete callback lead');
      }
    } catch (err) {
      console.error('Failed to delete lead', err);
      alert('An unexpected error occurred while deleting the lead.');
    } finally {
      setIsDeleting(false);
    }
  }

  function getStatusBadge(status) {
    let badgeClass = styles.statusNew;
    let label = 'New Request';

    if (status === 'contacted') {
      badgeClass = styles.statusContacted;
      label = 'Contacted';
    } else if (status === 'resolved') {
      badgeClass = styles.statusResolved;
      label = 'Resolved';
    } else if (status === 'closed') {
      badgeClass = styles.statusClosed;
      label = 'Closed';
    }

    return <span className={`${styles.reasonBadge} ${badgeClass}`}>{label}</span>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.filterBar}>
        <div className={styles.filterPills}>
          {[
            { id: 'open', label: 'Open Callbacks' },
            { id: 'resolved', label: 'Resolved / Closed' },
            { id: 'all', label: 'All Requests' },
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
      </div>

      {filteredHandoffs.length === 0 ? (
        <div className={styles.emptyState}>
          No callback leads currently in this queue.
        </div>
      ) : (
        <>
          <div className={styles.leadGrid}>
            {paginatedHandoffs.map((lead) => {
            const customerName = lead.customers?.full_name || 'Customer';
            const phone = lead.customers?.phone_e164 || '';
            const reason = formatHandoffReason(lead.reason_code);

            const vehicleInfo = lead.collected_details?.vehicle
              ? `${lead.collected_details.vehicle.year || ''} ${
                  lead.collected_details.vehicle.make || ''
                } ${lead.collected_details.vehicle.model || ''}`.trim()
              : null;

            const pickupAddress =
              lead.collected_details?.pickup?.formatted_address ||
              lead.collected_details?.location?.formatted_address ||
              null;

            const customerNotes =
              lead.collected_details?.customer_notes ||
              lead.collected_details?.notes ||
              null;

            return (
              <div key={lead.id} className={styles.leadCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.customerName}>{customerName}</span>
                    <span className={styles.dateSub}>
                      Requested: <FormattedDate value={lead.created_at} />
                    </span>
                  </div>
                  {getStatusBadge(lead.callback_status)}
                </div>

                <div className={styles.body}>
                  <div className={styles.reasonRow}>
                    <span className={styles.reasonLabel}>Reason: </span>
                    <span className={styles.reasonValue}>{reason}</span>
                  </div>

                  {vehicleInfo || pickupAddress || customerNotes ? (
                    <div className={styles.detailsBox}>
                      {vehicleInfo ? (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Vehicle: </span>
                          <span>{vehicleInfo}</span>
                        </div>
                      ) : null}
                      {pickupAddress ? (
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Location: </span>
                          <span>{pickupAddress}</span>
                        </div>
                      ) : null}
                      {customerNotes ? (
                        <div>
                          <span className={styles.detailLabel}>Notes: </span>
                          <span>&ldquo;{customerNotes}&rdquo;</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className={styles.actionRow}>
                    {phone ? (
                      <a href={`tel:${phone}`} className={styles.callButton}>
                        <Phone size={12} />
                        Call {phone}
                      </a>
                    ) : (
                      <span className={styles.noPhone}>No phone provided</span>
                    )}

                    <div className={styles.buttonGroup}>
                      <span className={styles.statusLabel}>Status:</span>
                      <select
                        value={lead.callback_status}
                        disabled={updatingId === lead.id}
                        onChange={(e) =>
                          handleStatusChange(lead.id, e.target.value)
                        }
                        className={styles.statusSelect}
                        aria-label={`Update callback status for ${customerName}`}
                      >
                        <option value="new">New Request</option>
                        <option value="contacted">Contacted</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          setLeadToDelete({
                            id: lead.id,
                            customerName,
                          })
                        }
                        title="Delete callback lead"
                        aria-label={`Delete callback lead for ${customerName}`}
                        className={styles.deleteButton}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
        isOpen={Boolean(leadToDelete)}
        title="Delete Callback Request"
        description={
          leadToDelete
            ? `Are you sure you want to permanently delete the callback request for ${leadToDelete.customerName || 'this customer'}? It will be removed from the active triage queue.`
            : ''
        }
        confirmLabel="Delete Request"
        cancelLabel="Keep Request"
        variant="danger"
        isProcessing={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!isDeleting) {
            setLeadToDelete(null);
          }
        }}
      />
    </div>
  );
}

