import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({ auth: { getUser }, from }),
}));

import {
  adminRoles,
  canManageCompanySettings,
  canManageTeam,
  getAuthorizedAdminProfile,
  hasAdminRole,
} from '@/features/admin/services/authorization';

describe('admin authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aligns application roles with the Supabase admin_role enum', () => {
    expect(adminRoles).toEqual([
      'super_admin',
      'operations_admin',
      'dispatcher',
      'finance',
      'support',
    ]);
    expect(hasAdminRole('admin')).toBe(false);
  });

  it('rejects unauthenticated users without querying profiles', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getAuthorizedAdminProfile()).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('returns only an active authorized profile for the authenticated user', async () => {
    const profile = {
      user_id: '10000000-0000-4000-8000-000000000001',
      role: 'operations_admin',
      display_name: 'Operations',
      is_active: true,
    };
    getUser.mockResolvedValue({
      data: { user: { id: profile.user_id } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: profile, error: null });

    await expect(getAuthorizedAdminProfile()).resolves.toEqual(profile);
    expect(eq).toHaveBeenCalledWith('user_id', profile.user_id);
  });

  it('enforces role-based management permissions', () => {
    expect(canManageTeam('super_admin')).toBe(true);
    expect(canManageTeam('operations_admin')).toBe(false);
    expect(canManageCompanySettings('super_admin')).toBe(true);
    expect(canManageCompanySettings('operations_admin')).toBe(false);
    expect(canManageCompanySettings('dispatcher')).toBe(false);
  });

  it('rejects inactive or unknown-role profiles', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: '10000000-0000-4000-8000-000000000001' } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: { role: 'admin', is_active: true },
      error: null,
    });
    await expect(getAuthorizedAdminProfile()).resolves.toBeNull();
  });
});
