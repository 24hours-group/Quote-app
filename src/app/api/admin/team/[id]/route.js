import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile, canManageTeam } from '@/features/admin/services/authorization';
import { updateAdminTeamMember } from '@/features/admin/services/adminTeamService';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
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
        error: 'Forbidden: only super_admin may update team members',
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { role, is_active: isActive } = body;

    const result = await updateAdminTeamMember({
      targetUserId: params.id,
      currentUserId: profile.user_id,
      role,
      isActive,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update team member' },
      { status: 400 },
    );
  }
}

