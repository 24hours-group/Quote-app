import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/admin/services/authorization', () => ({
  getAuthorizedAdminProfile: vi.fn(),
}));
vi.mock('@/features/admin/services/adminDashboardService', () => ({
  getAdminDashboardData: vi.fn(),
}));

import { GET } from '@/app/api/admin/dashboard/route';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import { getAdminDashboardData } from '@/features/admin/services/adminDashboardService';

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    getAuthorizedAdminProfile.mockResolvedValueOnce(null);

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringMatching(/Unauthorized/),
    });
    expect(getAdminDashboardData).not.toHaveBeenCalled();
  });

  it('returns authoritative dashboard payload when authorized', async () => {
    getAuthorizedAdminProfile.mockResolvedValueOnce({
      id: 'admin-1',
      role: 'dispatcher',
      display_name: 'Alex Dispatch',
    });
    const mockDashboardData = {
      bookings: [{ id: 'b-1', reference: 'BK-100' }],
      handoffs: [{ id: 'h-1', full_name: 'John Doe' }],
      notifications: [],
      metrics: { activeDispatches: 1 },
    };
    getAdminDashboardData.mockResolvedValueOnce(mockDashboardData);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: mockDashboardData,
    });
  });

  it('handles service errors gracefully with 500', async () => {
    getAuthorizedAdminProfile.mockResolvedValueOnce({
      id: 'admin-1',
      role: 'super_admin',
    });
    getAdminDashboardData.mockRejectedValueOnce(new Error('Database timeout'));

    const res = await GET();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: 'Database timeout',
    });
  });
});

