import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env/server', () => ({
  getNotificationWorkerEnv: vi.fn(() => ({
    NOTIFICATION_WORKER_SECRET: 'a'.repeat(32),
    CRON_SECRET: 'b'.repeat(32),
  })),
}));
vi.mock('@/features/notifications/services/notificationWorker', () => ({
  processNotificationBatch: vi.fn(),
}));

import { GET, POST } from '@/app/api/internal/notifications/process/route';
import { processNotificationBatch } from '@/features/notifications/services/notificationWorker';

function request(secret, method = 'POST') {
  return new Request('http://localhost/api/internal/notifications/process', {
    method,
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
}

describe('notification worker route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processNotificationBatch.mockResolvedValue({
      claimed: 2,
      delivered: 2,
      failed: 0,
      deadLettered: 0,
    });
  });

  it('rejects unauthenticated worker invocations', async () => {
    const response = await POST(request('wrong'));
    expect(response.status).toBe(401);
    expect(processNotificationBatch).not.toHaveBeenCalled();
  });

  it('runs a batch only with the configured worker secret', async () => {
    const response = await POST(request('a'.repeat(32)));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { delivered: 2 },
    });
  });

  it('accepts authenticated Vercel Cron GET requests', async () => {
    const response = await GET(request('b'.repeat(32), 'GET'));
    expect(response.status).toBe(200);
    expect(processNotificationBatch).toHaveBeenCalledOnce();
  });
});
