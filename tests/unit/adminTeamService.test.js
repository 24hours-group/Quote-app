import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const generateLink = vi.fn();
const listUsers = vi.fn();
const getUserById = vi.fn();
const authAdmin = {
  generateLink,
  listUsers,
  getUserById,
};

const upsert = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const order = vi.fn();
const select = vi.fn();
const single = vi.fn();
const maybeSingle = vi.fn();

const from = vi.fn((table) => {
  if (table === 'admin_profiles') {
    return {
      select: vi.fn(() => ({
        order: order.mockReturnValue({ data: [], error: null }),
        eq: vi.fn(() => ({
          single: single.mockResolvedValue({
            data: {
              user_id: 'target-1',
              role: 'dispatcher',
              display_name: 'Jane Doe',
              is_active: true,
            },
            error: null,
          }),
          maybeSingle: maybeSingle.mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      })),
      upsert: upsert.mockResolvedValue({ error: null }),
      update: update.mockReturnValue({
        eq: eq.mockResolvedValue({ error: null }),
      }),
    };
  }
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: { admin: authAdmin },
    from,
  }),
}));

vi.mock('@/features/notifications/services/resendDeliveryService', () => ({
  deliverEmailNotification: vi.fn().mockResolvedValue({ provider: 'resend', providerMessageId: 'msg_123' }),
}));

import {
  inviteAdminTeamMember,
  updateAdminTeamMember,
  resendAdminInvitation,
  listAdminTeamMembers,
} from '@/features/admin/services/adminTeamService';
import { canManageTeam } from '@/features/admin/services/authorization';

describe('adminTeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canManageTeam', () => {
    it('allows only super_admin to manage team', () => {
      expect(canManageTeam('super_admin')).toBe(true);
    });

    it('denies operations_admin, dispatcher, finance, and support from managing team', () => {
      expect(canManageTeam('operations_admin')).toBe(false);
      expect(canManageTeam('dispatcher')).toBe(false);
      expect(canManageTeam('finance')).toBe(false);
      expect(canManageTeam('support')).toBe(false);
      expect(canManageTeam('unknown')).toBe(false);
    });
  });

  describe('inviteAdminTeamMember', () => {
    it('rejects an invalid email format', async () => {
      await expect(
        inviteAdminTeamMember({
          email: 'not-an-email',
          displayName: 'Test User',
          role: 'dispatcher',
        }),
      ).rejects.toThrow(/valid email address is required/);
    });

    it('rejects an empty or overly long name', async () => {
      await expect(
        inviteAdminTeamMember({
          email: 'test@townexa.com',
          displayName: '',
          role: 'dispatcher',
        }),
      ).rejects.toThrow(/Full name must be between 1 and 120 characters/);
    });

    it('rejects an unlisted role', async () => {
      await expect(
        inviteAdminTeamMember({
          email: 'test@townexa.com',
          displayName: 'Test User',
          role: 'super_hacker',
        }),
      ).rejects.toThrow(/Invalid role/);
    });

    it('invites a new team member and saves profile', async () => {
      listUsers.mockResolvedValue({ data: { users: [] }, error: null });
      generateLink.mockResolvedValue({
        data: {
          user: { id: 'new-user-123', email: 'dispatcher1@townexa.com' },
          properties: { action_link: 'http://localhost:3000/verify?token=xyz' },
        },
        error: null,
      });

      const result = await inviteAdminTeamMember({
        email: 'DISPATCHER1@townexa.com',
        displayName: 'Alice Walker',
        role: 'dispatcher',
      });

      expect(generateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invite',
          email: 'dispatcher1@townexa.com',
        }),
      );
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'new-user-123',
          role: 'dispatcher',
          display_name: 'Alice Walker',
          is_active: true,
        }),
      );
      expect(result.email).toBe('dispatcher1@townexa.com');
      expect(result.actionLink).toBe('http://localhost:3000/verify?token=xyz');
    });
  });

  describe('updateAdminTeamMember', () => {
    it('prevents deactivating your own administrative account', async () => {
      await expect(
        updateAdminTeamMember({
          targetUserId: 'user-me',
          currentUserId: 'user-me',
          isActive: false,
        }),
      ).rejects.toThrow(/cannot deactivate your own administrative account/);
    });

    it('updates role and active status for a team member', async () => {
      const result = await updateAdminTeamMember({
        targetUserId: 'user-target',
        currentUserId: 'user-me',
        role: 'operations_admin',
        isActive: true,
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'operations_admin',
          is_active: true,
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('resendAdminInvitation', () => {
    it('generates a fresh invite link for a team member', async () => {
      getUserById.mockResolvedValue({
        data: { user: { id: 'target-1', email: 'jane@townexa.com' } },
        error: null,
      });
      generateLink.mockResolvedValue({
        data: {
          properties: { action_link: 'http://localhost:3000/verify?token=fresh' },
        },
        error: null,
      });

      const result = await resendAdminInvitation({
        targetUserId: 'target-1',
      });

      expect(generateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invite',
          email: 'jane@townexa.com',
        }),
      );
      expect(result.actionLink).toBe('http://localhost:3000/verify?token=fresh');
    });
  });
});

