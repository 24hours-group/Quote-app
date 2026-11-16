import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { findActiveBookingSessionByToken, rpc } = vi.hoisted(() => ({
  findActiveBookingSessionByToken: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/features/booking/repositories/bookingSessionRepository', () => ({
  BookingSessionNotFoundError: class BookingSessionNotFoundError extends Error {},
  findActiveBookingSessionByToken,
  hashBookingSessionToken: () => 'hashed-token',
}));
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

import {
  createHandoffLeadByToken,
  HandoffActionError,
} from '@/features/handoff/repositories/handoffRepository';

const lead = {
  id: 'b0000000-0000-4000-8000-000000000001',
  reasonCode: 'EXISTING_JOB',
  assignedTeam: 'Job owner',
  priority: 'high',
  paymentClassification: 'unpaid',
  requestedAction: 'request_callback',
  callbackStatus: 'queued',
  supportPhoneE164: '+15550102020',
  companyName: 'Configured Roadside',
  createdAt: '2026-11-06T18:00:00.000Z',
};

beforeEach(() => {
  findActiveBookingSessionByToken.mockReset();
  rpc.mockReset();
});

describe('hand-off repository authorization', () => {
  it('rejects a client reason that does not match the saved flow', async () => {
    findActiveBookingSessionByToken.mockResolvedValue({
      currentScreenId: 'R',
      customerId: 'c0000000-0000-4000-8000-000000000001',
      flowRequestType: 'existing',
      answers: {
        bookingReference: 'RS-1A2B3C4D5E',
        handoffReason: 'EXISTING_JOB',
      },
    });

    await expect(
      createHandoffLeadByToken('token', {
        reasonCode: 'CANCEL_JOB',
        action: 'request_callback',
      }),
    ).rejects.toBeInstanceOf(HandoffActionError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('creates a lead for a matching saved request and reference', async () => {
    findActiveBookingSessionByToken.mockResolvedValue({
      currentScreenId: 'R',
      customerId: 'c0000000-0000-4000-8000-000000000001',
      flowRequestType: 'existing',
      answers: {
        bookingReference: 'RS-1A2B3C4D5E',
        handoffReason: 'EXISTING_JOB',
      },
    });
    rpc.mockResolvedValue({ data: lead, error: null });

    await expect(
      createHandoffLeadByToken('token', {
        reasonCode: 'EXISTING_JOB',
        action: 'request_callback',
      }),
    ).resolves.toEqual(lead);
    expect(rpc).toHaveBeenCalledWith('create_handoff_lead_by_session', {
      target_access_token_hash: 'hashed-token',
      target_reason_code: 'EXISTING_JOB',
      target_action: 'request_callback',
    });
  });
});
