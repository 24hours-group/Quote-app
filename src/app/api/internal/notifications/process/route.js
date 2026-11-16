import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processNotificationBatch } from '@/features/notifications/services/notificationWorker';
import { getNotificationWorkerEnv } from '@/lib/env/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function isAuthorized(request, secret) {
  const authorization = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function processRequest(request) {
  const env = getNotificationWorkerEnv();
  const authorized = [env.NOTIFICATION_WORKER_SECRET, env.CRON_SECRET]
    .filter(Boolean)
    .some((secret) => isAuthorized(request, secret));
  if (!authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED' } },
      { status: 401 },
    );
  }

  try {
    const result = await processNotificationBatch();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Notification worker batch failed', {
      name: error?.name,
      message: error?.message,
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOTIFICATION_WORKER_ERROR',
          message: 'Notification processing failed.',
        },
      },
      { status: 500 },
    );
  }
}

export const GET = processRequest;
export const POST = processRequest;
