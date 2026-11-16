import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotificationOutboxList } from '@/features/admin/components/NotificationManagement/NotificationOutboxList';

const mockNotifications = Array.from({ length: 15 }, (_, i) => ({
  id: `notif-${i + 1}`,
  event_name: 'booking.paid',
  recipient: `customer${i + 1}@example.com`,
  delivery_status: i % 2 === 0 ? 'delivered' : 'failed',
  retry_count: i % 2 === 0 ? 1 : 3,
  max_attempts: 5,
  last_error_code: i % 2 === 0 ? null : 'provider_timeout',
  created_at: new Date(2026, 10, 1, 12, i).toISOString(),
  bookings: {
    reference: `BK-100${i + 1}`,
  },
}));

describe('NotificationOutboxList component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders table with paginated notifications (default 10 per page)', () => {
    render(<NotificationOutboxList notifications={mockNotifications} />);

    expect(screen.getByText('BK-1001')).toBeInTheDocument();
    expect(screen.getByText('customer1@example.com')).toBeInTheDocument();
    expect(screen.getByText('BK-10010')).toBeInTheDocument();
    // 11th item should be on page 2, not page 1
    expect(screen.queryByText('BK-10011')).not.toBeInTheDocument();

    // Summary displays entries and pagination button is present
    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
  });

  it('navigates to page 2 when clicking page 2 button', () => {
    render(<NotificationOutboxList notifications={mockNotifications} />);

    const page2Btn = screen.getByRole('button', { name: 'Page 2' });
    fireEvent.click(page2Btn);

    expect(screen.getByText('BK-10011')).toBeInTheDocument();
    expect(screen.queryByText('BK-1001')).not.toBeInTheDocument();
  });

  it('filters deliveries and resets to page 1', () => {
    render(<NotificationOutboxList notifications={mockNotifications} />);

    const failedPill = screen.getByRole('button', { name: 'Failed' });
    fireEvent.click(failedPill);

    // Mock has 7 failed items (indices 1, 3, 5, 7, 9, 11, 13)
    expect(screen.getByText('customer2@example.com')).toBeInTheDocument();
    expect(screen.queryByText('customer1@example.com')).not.toBeInTheDocument();
  });

  it('opens ConfirmDialog when clicking delete button', () => {
    render(<NotificationOutboxList notifications={mockNotifications} />);

    const deleteButtons = screen.getAllByTitle('Delete email log');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Email Log')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete the email log/),
    ).toBeInTheDocument();
  });

  it('executes delete API and calls onDeleteNotification when confirmed', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 'notif-1' } }),
    });

    const onDeleteNotification = vi.fn();
    render(
      <NotificationOutboxList
        notifications={mockNotifications}
        onDeleteNotification={onDeleteNotification}
      />,
    );

    const deleteButtons = screen.getAllByTitle('Delete email log');
    fireEvent.click(deleteButtons[0]);

    const confirmBtn = screen.getByRole('button', { name: 'Delete Log' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/notifications/notif-1',
        { method: 'DELETE' },
      );
      expect(onDeleteNotification).toHaveBeenCalledWith('notif-1');
    });
  });

  it('closes dialog without deleting when Cancel is clicked', () => {
    const onDeleteNotification = vi.fn();
    render(
      <NotificationOutboxList
        notifications={mockNotifications}
        onDeleteNotification={onDeleteNotification}
      />,
    );

    const deleteButtons = screen.getAllByTitle('Delete email log');
    fireEvent.click(deleteButtons[0]);

    const cancelBtn = screen.getByRole('button', { name: 'Keep Log' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onDeleteNotification).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
