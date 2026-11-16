import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const single = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn();
const select = vi.fn(() => ({ eq, single, maybeSingle }));
eq.mockReturnValue({ select, single, maybeSingle });
const update = vi.fn(() => ({ eq }));
const upsert = vi.fn(() => ({ eq, select, single }));
const from = vi.fn(() => ({ update, select, upsert }));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from }),
}));

import {
  VALID_DISPATCH_STATUSES,
  VALID_CALLBACK_STATUSES,
  updateBookingDispatchStatus,
  updateHandoffLeadStatus,
  deleteHandoffLead,
  dismissNotification,
} from '@/features/admin/services/adminActionService';

describe('adminActionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateBookingDispatchStatus', () => {
    it('rejects an invalid dispatch status', async () => {
      await expect(
        updateBookingDispatchStatus({
          bookingId: '10000000-0000-4000-8000-000000000001',
          dispatchStatus: 'invalid_status',
        }),
      ).rejects.toThrow(/Invalid dispatch status/);
      expect(from).not.toHaveBeenCalled();
    });

    it('updates status and sets completed_at when status is completed', async () => {
      const mockResult = {
        id: '10000000-0000-4000-8000-000000000001',
        dispatch_status: 'completed',
      };
      single.mockResolvedValue({ data: mockResult, error: null });

      const result = await updateBookingDispatchStatus({
        bookingId: mockResult.id,
        dispatchStatus: 'completed',
      });

      expect(from).toHaveBeenCalledWith('bookings');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          dispatch_status: 'completed',
          completed_at: expect.any(String),
          cancelled_at: null,
        }),
      );
      expect(eq).toHaveBeenCalledWith('id', mockResult.id);
      expect(result).toEqual(mockResult);
    });

    it('updates status and sets cancelled_at when status is cancelled', async () => {
      const mockResult = {
        id: '10000000-0000-4000-8000-000000000001',
        dispatch_status: 'cancelled',
      };
      single.mockResolvedValue({ data: mockResult, error: null });

      const result = await updateBookingDispatchStatus({
        bookingId: mockResult.id,
        dispatchStatus: 'cancelled',
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          dispatch_status: 'cancelled',
          cancelled_at: expect.any(String),
          completed_at: null,
        }),
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateHandoffLeadStatus', () => {
    it('rejects an invalid callback status', async () => {
      await expect(
        updateHandoffLeadStatus({
          leadId: '20000000-0000-4000-8000-000000000001',
          callbackStatus: 'invalid_callback',
        }),
      ).rejects.toThrow(/Invalid callback status/);
    });

    it('sets resolved_at when callback status is resolved', async () => {
      const mockResult = {
        id: '20000000-0000-4000-8000-000000000001',
        callback_status: 'resolved',
      };
      single.mockResolvedValue({ data: mockResult, error: null });

      const result = await updateHandoffLeadStatus({
        leadId: mockResult.id,
        callbackStatus: 'resolved',
        assignedTeam: 'Dispatch Team',
      });

      expect(from).toHaveBeenCalledWith('handoff_leads');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          callback_status: 'resolved',
          assigned_team: 'Dispatch Team',
          resolved_at: expect.any(String),
        }),
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteHandoffLead', () => {
    it('throws when leadId is missing', async () => {
      await expect(deleteHandoffLead('')).rejects.toThrow(/Lead ID is required/);
    });

    it('soft deletes the lead and updates callback status to closed', async () => {
      const mockLead = {
        id: '20000000-0000-4000-8000-000000000001',
        collected_details: { notes: 'urgent' },
      };

      single
        .mockResolvedValueOnce({ data: mockLead, error: null })
        .mockResolvedValueOnce({ data: { id: mockLead.id }, error: null });

      const result = await deleteHandoffLead(mockLead.id);

      expect(from).toHaveBeenCalledWith('handoff_leads');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          callback_status: 'closed',
          requested_action: 'call_now',
          collected_details: expect.objectContaining({
            notes: 'urgent',
            is_deleted: true,
          }),
        }),
      );
      expect(result).toEqual({ id: mockLead.id, success: true });
    });
  });

  describe('dismissNotification', () => {
    it('throws when notificationId is missing', async () => {
      await expect(dismissNotification('')).rejects.toThrow(
        /Notification ID is required/,
      );
    });

    it('throws when notification does not exist', async () => {
      single.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });
      await expect(
        dismissNotification('30000000-0000-4000-8000-000000000001'),
      ).rejects.toThrow(/Notification log not found/);
    });

    it('adds notificationId to dismissed_notifications in application_settings', async () => {
      const notifId = '30000000-0000-4000-8000-000000000001';
      single.mockResolvedValueOnce({ data: { id: notifId }, error: null });
      maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'setting-id-1',
          messages: { dismissed_notifications: ['other-id'] },
        },
        error: null,
      });
      update.mockReturnValueOnce({ eq: vi.fn().mockResolvedValue({ error: null }) });

      const result = await dismissNotification(notifId);

      expect(from).toHaveBeenCalledWith('dispatch_notifications');
      expect(from).toHaveBeenCalledWith('application_settings');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.objectContaining({
            dismissed_notifications: ['other-id', notifId],
          }),
        }),
      );
      expect(result).toEqual({ id: notifId, success: true });
    });
  });
});

