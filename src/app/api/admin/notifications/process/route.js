import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import { processNotificationBatch } from '@/features/notifications/services/notificationWorker';

export const dynamic = 'force-dynamic';

export async function POST() {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin session required' },
      { status: 401 },
    );
  }

  try {
    const result = await processNotificationBatch();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Notification processing failed' },
      { status: 500 },
    );
  }
}

