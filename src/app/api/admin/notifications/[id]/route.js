import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import { dismissNotification } from '@/features/admin/services/adminActionService';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin session required' },
      { status: 401 },
    );
  }

  try {
    const result = await dismissNotification(params.id);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dismiss notification log' },
      { status: 400 },
    );
  }
}

