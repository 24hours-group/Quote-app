'use client';

import { useState } from 'react';
import {
  X,
  Phone,
  DollarSign,
  Wrench,
  Shield,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  ExternalLink,
  Route,
  Car,
} from 'lucide-react';
import { DispatchStatusBadge } from './DispatchStatusBadge';
import { FormattedDate } from '../FormattedDate/FormattedDate';
import {
  getBookingLocations,
  formatDuration,
  getServiceDisplay,
  getServiceIssueDetails,
} from '../../utils/bookingDetails';
import styles from './BookingDetailModal.module.css';

export function BookingDetailModal({ booking, onClose, onUpdateStatus }) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  if (!booking) return null;

  async function handleStatusChange(newStatus) {
    if (updating) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update status');
      }
      onUpdateStatus(booking.id, newStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  const customerName = booking.customers?.full_name || 'Customer';
  const customerPhone = booking.customers?.phone_e164 || '';
  const serviceDisplayName = getServiceDisplay(booking);
  const issueDetails = getServiceIssueDetails(booking);
  const notes = booking.service_requests?.customer_notes;
  const paymentAmount = booking.payments?.amount_cents
    ? (booking.payments.amount_cents / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: booking.payments.currency || 'USD',
      })
    : '$0.00';

  const locations = getBookingLocations(booking);
  const durationStr = formatDuration(locations.durationSeconds);
  const hasVehicle = Boolean(
    locations.vehicle?.make ||
      locations.vehicle?.model ||
      locations.vehicle?.year ||
      locations.vehicle?.color
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.refTitle}>
              <span>{booking.reference}</span>
              <DispatchStatusBadge status={booking.dispatch_status} />
            </div>
            <div className={styles.dateSub}>
              Booked: <FormattedDate value={booking.booked_at} />
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {/* Customer Contact */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <Phone size={14} /> Customer Contact
            </div>
            <div className={styles.customerGrid}>
              <div>
                <div className={styles.fieldLabel}>Name</div>
                <div className={styles.fieldValue}>{customerName}</div>
              </div>
              <div>
                <div className={styles.fieldLabel}>Phone</div>
                <div className={styles.fieldValue}>
                  {customerPhone ? (
                    <a
                      href={`tel:${customerPhone}`}
                      className={styles.callButton}
                    >
                      <Phone size={12} />
                      {customerPhone}
                    </a>
                  ) : (
                    'No phone recorded'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trip Locations & Vehicle */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <MapPin size={14} /> Trip Locations & Route
            </div>
            <div className={styles.locationsGrid}>
              {/* Pickup */}
              <div className={styles.locationCard}>
                <div className={styles.locationHeader}>
                  <span className={styles.pickupPin}>📍 Pickup Location</span>
                </div>
                <div className={styles.locationAddress}>
                  {locations.pickupAddress || 'Address not recorded'}
                </div>
                {locations.pickupAddress ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations.pickupAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mapLink}
                  >
                    <ExternalLink size={12} /> Open in Google Maps
                  </a>
                ) : null}
              </div>

              {/* Drop-off (if tow or dropoff present) */}
              {locations.dropoffAddress ? (
                <div className={styles.locationCard}>
                  <div className={styles.locationHeader}>
                    <span className={styles.dropoffPin}>🏁 Drop-off Destination</span>
                  </div>
                  <div className={styles.locationAddress}>
                    {locations.dropoffAddress}
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locations.dropoffAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.mapLink}
                  >
                    <ExternalLink size={12} /> Open in Google Maps
                  </a>
                </div>
              ) : locations.isTow ? (
                <div className={styles.locationCard}>
                  <div className={styles.locationHeader}>
                    <span className={styles.dropoffPin}>🏁 Drop-off Destination</span>
                  </div>
                  <div className={styles.locationAddress}>Not specified</div>
                </div>
              ) : null}
            </div>

            {/* Route details & Directions */}
            {locations.rawMiles !== null || durationStr || (locations.pickupAddress && locations.dropoffAddress) ? (
              <div className={styles.routeMeta}>
                {locations.rawMiles !== null ? (
                  <span className={styles.routeBadge}>
                    <Route size={12} /> {locations.rawMiles.toFixed(1)} miles
                  </span>
                ) : null}
                {durationStr ? (
                  <span className={styles.routeBadge}>
                    <Clock size={12} /> Est. {durationStr}
                  </span>
                ) : null}
                {locations.pickupAddress && locations.dropoffAddress ? (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(locations.pickupAddress)}&destination=${encodeURIComponent(locations.dropoffAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.directionsLink}
                  >
                    <Navigation size={12} /> Get Directions
                  </a>
                ) : null}
              </div>
            ) : null}

            {/* Vehicle Information */}
            {hasVehicle ? (
              <div className={styles.vehicleBox}>
                <div className={styles.sectionTitle}>
                  <Car size={13} /> Vehicle Details
                </div>
                <div className={styles.vehicleGrid}>
                  {locations.vehicle?.year ? (
                    <div className={styles.vehicleItem}>
                      <span className={styles.vehicleLabel}>Year</span>
                      <span className={styles.vehicleVal}>{locations.vehicle.year}</span>
                    </div>
                  ) : null}
                  {locations.vehicle?.make ? (
                    <div className={styles.vehicleItem}>
                      <span className={styles.vehicleLabel}>Make</span>
                      <span className={styles.vehicleVal}>{locations.vehicle.make}</span>
                    </div>
                  ) : null}
                  {locations.vehicle?.model ? (
                    <div className={styles.vehicleItem}>
                      <span className={styles.vehicleLabel}>Model</span>
                      <span className={styles.vehicleVal}>{locations.vehicle.model}</span>
                    </div>
                  ) : null}
                  {locations.vehicle?.color ? (
                    <div className={styles.vehicleItem}>
                      <span className={styles.vehicleLabel}>Color</span>
                      <span className={styles.vehicleVal}>{locations.vehicle.color}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Service Details */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <Wrench size={14} /> Service Requested
            </div>
            <div className={styles.customerGrid}>
              <div>
                <div className={styles.fieldLabel}>Service Type</div>
                <div className={styles.fieldValue}>
                  {serviceDisplayName}
                </div>
              </div>
              <div>
                <div className={styles.fieldLabel}>Payment Status</div>
                <div className={styles.fieldValue}>
                  {booking.payment_status === 'succeeded' ? (
                    <span className={styles.paidBadge}>
                      <CheckCircle size={14} /> Paid ({paymentAmount})
                    </span>
                  ) : (
                    <span className={styles.pendingBadge}>
                      {booking.payment_status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {issueDetails.length > 0 ? (
              <div className={styles.issuesContainer}>
                <div className={styles.issuesHeader}>Service & Problem Details</div>
                <div className={styles.issuesGrid}>
                  {issueDetails.map((item, index) => (
                    <div
                      key={index}
                      className={item.urgent ? styles.issueItemUrgent : styles.issueItem}
                    >
                      <span className={item.urgent ? styles.issueLabelUrgent : styles.issueLabel}>
                        {item.label}
                      </span>
                      <span className={item.urgent ? styles.issueValUrgent : styles.issueVal}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {notes ? (
              <div className={styles.notesWrap}>
                <div className={styles.fieldLabel}>Customer Notes</div>
                <div className={styles.notesBox}>&ldquo;{notes}&rdquo;</div>
              </div>
            ) : null}
          </div>

          {/* Dispatch Operations Actions */}
          <div className={styles.actionSection}>
            <div className={styles.sectionTitle}>
              <Shield size={14} /> Update Dispatch Status
            </div>
            <p className={styles.actionHelpText}>
              Select an action to update driver assignment and customer readiness:
            </p>
            {error ? (
              <p className={styles.errorText}>{error}</p>
            ) : null}
            <div className={styles.actionGrid}>
              <button
                type="button"
                disabled={updating || booking.dispatch_status === 'assigned'}
                onClick={() => handleStatusChange('assigned')}
                className={`${styles.actionButton} ${styles.btnAssign}`}
              >
                🚚 Assign Driver / En Route
              </button>
              <button
                type="button"
                disabled={updating || booking.dispatch_status === 'completed'}
                onClick={() => handleStatusChange('completed')}
                className={`${styles.actionButton} ${styles.btnComplete}`}
              >
                ✓ Mark Job Completed
              </button>
              <button
                type="button"
                disabled={updating || booking.dispatch_status === 'ready'}
                onClick={() => handleStatusChange('ready')}
                className={`${styles.actionButton} ${styles.btnReady}`}
              >
                ↻ Reset to Ready
              </button>
              <button
                type="button"
                disabled={updating || booking.dispatch_status === 'cancelled'}
                onClick={() => handleStatusChange('cancelled')}
                className={`${styles.actionButton} ${styles.btnCancel}`}
              >
                ✕ Cancel Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

