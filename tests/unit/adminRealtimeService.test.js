import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { broadcastAdminSubmission } from '@/features/admin/services/adminRealtimeService';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

describe('broadcastAdminSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends broadcast event on admin-realtime-sync channel and removes channel', async () => {
    const mockSend = vi.fn().mockResolvedValue('ok');
    const mockChannelObj = {
      send: mockSend,
    };
    const mockRemoveChannel = vi.fn().mockResolvedValue('ok');
    const mockChannel = vi.fn().mockReturnValue(mockChannelObj);

    createSupabaseAdminClient.mockReturnValue({
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    });

    await broadcastAdminSubmission({
      entity: 'booking',
      action: 'paid',
      bookingId: 'bk-123',
    });

    expect(mockChannel).toHaveBeenCalledWith('admin-realtime-sync');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'submission_sync',
        payload: expect.objectContaining({
          entity: 'booking',
          action: 'paid',
          bookingId: 'bk-123',
        }),
      }),
    );
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelObj);
  });

  it('fails gracefully without throwing when broadcast encounters an error', async () => {
    createSupabaseAdminClient.mockImplementation(() => {
      throw new Error('Supabase client unavailable');
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      broadcastAdminSubmission({
        entity: 'handoff_lead',
        action: 'create',
      }),
    ).resolves.not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

