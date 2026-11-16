import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/admin/services/authorization', () => ({
  getAuthorizedAdminProfile: vi.fn(),
}));
vi.mock('@/features/admin/services/adminActionService', () => ({
  dismissNotification: vi.fn(),
}));

import { DELETE } from '@/app/api/admin/notifications/[id]/route';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import { dismissNotification } from '@/features/admin/services/adminActionService';

describe('DELETE /api/admin/notifications/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthorized access with 401', async () => {
    getAuthorizedAdminProfile.mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/admin/notifications/notif-1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: { id: 'notif-1' } });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringMatching(/Unauthorized/),
    });
    expect(dismissNotification).not.toHaveBeenCalled();
  });

  it('deletes notification log successfully when authorized', async () => {
    getAuthorizedAdminProfile.mockResolvedValueOnce({
      id: 'admin-1',
      role: 'super_admin',
    });
    dismissNotification.mockResolvedValueOnce({ id: 'notif-1', success: true });

    const req = new Request('http://localhost/api/admin/notifications/notif-1', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: { id: 'notif-1' } });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { id: 'notif-1', success: true },
    });
    expect(dismissNotification).toHaveBeenCalledWith('notif-1');
  });

  it('returns 400 when dismissNotification throws an error', async () => {
    getAuthorizedAdminProfile.mockResolvedValueOnce({
      id: 'admin-1',
      role: 'super_admin',
    });
    dismissNotification.mockRejectedValueOnce(new Error('Notification log not found.'));

    const req = new Request('http://localhost/api/admin/notifications/notif-999', {
      method: 'DELETE',
    });
    const res = await DELETE(req, { params: { id: 'notif-999' } });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: 'Notification log not found.',
    });
  });
});

