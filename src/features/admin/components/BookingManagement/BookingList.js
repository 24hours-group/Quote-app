'use client';

import { useState } from 'react';
import { Search, Phone, ExternalLink, MapPin, Navigation } from 'lucide-react';
import { DispatchStatusBadge } from './DispatchStatusBadge';
import { BookingDetailModal } from './BookingDetailModal';
import { FormattedDate } from '../FormattedDate/FormattedDate';
import { Pagination } from '../Pagination';
import {
  getBookingLocations,
  getServiceDisplay,
  getServiceIssueSummary,
} from '../../utils/bookingDetails';
import styles from './BookingList.module.css';

export function BookingList({ bookings = [], onUpdateStatus }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function handleSearchChange(e) {
    setSearch(e.target.value);
    setCurrentPage(1);
  }

  function handleStatusFilterChange(pillId) {
    setStatusFilter(pillId);
    setCurrentPage(1);
  }

  const filteredBookings = bookings.filter((item) => {
    // Filter by status pill
    if (statusFilter === 'needs_dispatch') {
      if (!['ready', 'notified'].includes(item.dispatch_status)) return false;
    } else if (statusFilter === 'en_route') {
      if (!['assigned', 'acknowledged'].includes(item.dispatch_status)) return false;
    } else if (statusFilter === 'completed') {
      if (item.dispatch_status !== 'completed') return false;
    } else if (statusFilter === 'cancelled') {
      if (item.dispatch_status !== 'cancelled') return false;
    }

    // Filter by search text
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    const ref = (item.reference || '').toLowerCase();
    const customer = (item.customers?.full_name || '').toLowerCase();
    const phone = (item.customers?.phone_e164 || '').toLowerCase();
    const serviceName = getServiceDisplay(item).toLowerCase();
    const issueSummary = (getServiceIssueSummary(item) || '').toLowerCase();
    const locs = getBookingLocations(item);
    const pickup = (locs.pickupAddress || '').toLowerCase();
    const dropoff = (locs.dropoffAddress || '').toLowerCase();
    const vehicle = `${locs.vehicle?.year || ''} ${locs.vehicle?.make || ''} ${locs.vehicle?.model || ''}`.toLowerCase();

    return (
      ref.includes(query) ||
      customer.includes(query) ||
      phone.includes(query) ||
      serviceName.includes(query) ||
      issueSummary.includes(query) ||
      pickup.includes(query) ||
      dropoff.includes(query) ||
      vehicle.includes(query)
    );
  });

  const totalItems = filteredBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedBookings = filteredBookings.slice(
    startIndex,
    startIndex + pageSize,
  );

  async function handleQuickStatusChange(bookingId, newStatus) {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onUpdateStatus(bookingId, newStatus);
      }
    } catch (err) {
      console.error('Quick status update failed', err);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search reference, customer, phone, pickup, drop-off, vehicle…"
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterPills}>
          {[
            { id: 'all', label: 'All' },
            { id: 'needs_dispatch', label: 'Needs Dispatch' },
            { id: 'en_route', label: 'En Route' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => handleStatusFilterChange(pill.id)}
              className={`${styles.filterPill} ${
                statusFilter === pill.id ? styles.filterPillActive : ''
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <div className={styles.emptyState}>
          No bookings match your current search or filter.
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Service & Vehicle</th>
                <th>Pickup & Drop-off</th>
                <th>Payment</th>
                <th>Dispatch Status</th>
                <th>Booked At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedBookings.map((booking) => {
                const locs = getBookingLocations(booking);
                const amount = booking.payments?.amount_cents
                  ? (booking.payments.amount_cents / 100).toLocaleString('en-US', {
                      style: 'currency',
                      currency: booking.payments.currency || 'USD',
                    })
                  : '—';

                return (
                  <tr key={booking.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className={styles.refCode}
                        title="View trip details"
                      >
                        {booking.reference}
                      </button>
                    </td>
                    <td>
                      <div className={styles.customerBlock}>
                        <span className={styles.customerName}>
                          {booking.customers?.full_name || 'Customer'}
                        </span>
                        {booking.customers?.phone_e164 ? (
                          <a
                            href={`tel:${booking.customers.phone_e164}`}
                            className={styles.customerPhone}
                          >
                            <Phone size={10} />
                            {booking.customers.phone_e164}
                          </a>
                        ) : (
                          <span className={styles.noPhone}>No phone</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.serviceBlock}>
                        <span className={styles.serviceName}>
                          {getServiceDisplay(booking)}
                        </span>
                        {getServiceIssueSummary(booking) ? (
                          <span className={styles.serviceDetailSubtitle}>
                            {getServiceIssueSummary(booking)}
                          </span>
                        ) : null}
                        {locs.vehicle?.make ? (
                          <span className={styles.vehicleSubtitle}>
                            {locs.vehicle.year} {locs.vehicle.make} {locs.vehicle.model}
                          </span>
                        ) : (
                          <span className={styles.noPhone}>No vehicle</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.locationsCell}>
                        <div className={styles.locItem}>
                          <MapPin size={12} className={styles.pickupPin} />
                          <span className={styles.locLabel}>Pick</span>
                          <span className={styles.locText} title={locs.pickupAddress || 'Address on file'}>
                            {locs.pickupAddress || 'Address on file'}
                          </span>
                        </div>
                        {locs.isTow && locs.dropoffAddress ? (
                          <div className={styles.locItem}>
                            <Navigation size={12} className={styles.dropoffPin} />
                            <span className={styles.locLabel}>Drop</span>
                            <span className={styles.locText} title={locs.dropoffAddress}>
                              {locs.dropoffAddress}
                            </span>
                            {locs.rawMiles !== null ? (
                              <span className={styles.milePill}>
                                {locs.rawMiles.toFixed(1)} mi
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className={styles.paymentBlock}>
                        <span className={styles.amountPrimary}>
                          {amount}
                        </span>
                        <span
                          className={
                            booking.payment_status === 'succeeded'
                              ? styles.paymentSuccess
                              : styles.paymentPending
                          }
                        >
                          {booking.payment_status}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.dispatchGroup}>
                        <DispatchStatusBadge status={booking.dispatch_status} />
                        <select
                          value={booking.dispatch_status}
                          onChange={(e) =>
                            handleQuickStatusChange(booking.id, e.target.value)
                          }
                          className={styles.quickSelect}
                          aria-label={`Change status for ${booking.reference}`}
                        >
                          <option value="ready">Awaiting Driver</option>
                          <option value="notified">Driver Alerted</option>
                          <option value="assigned">En Route</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className={styles.dateCell}>
                        <FormattedDate value={booking.booked_at} />
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className={styles.manageBtn}
                      >
                        <ExternalLink size={12} />
                        Trip Details
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      {selectedBooking ? (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={(id, status) => {
            onUpdateStatus(id, status);
            setSelectedBooking((prev) =>
              prev ? { ...prev, dispatch_status: status } : null,
            );
          }}
        />
      ) : null}
    </div>
  );
}
