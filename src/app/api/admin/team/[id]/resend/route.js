import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile, canManageTeam } from '@/features/admin/services/authorization';
import { resendAdminInvitation } from '@/features/admin/services/adminTeamService';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin session required' },
      { status: 401 },
    );
  }

  if (!canManageTeam(profile.role)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: only super_admin may resend invitations',
      },
      { status: 403 },
    );
  }

  try {
    const result = await resendAdminInvitation({
      targetUserId: params.id,
      inviterName: profile.display_name || 'Townexa Administrator',
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resend invitation' },
      { status: 400 },
    );
  }
}

