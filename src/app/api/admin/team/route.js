import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile, canManageTeam } from '@/features/admin/services/authorization';
import {
  listAdminTeamMembers,
  inviteAdminTeamMember,
} from '@/features/admin/services/adminTeamService';

export const dynamic = 'force-dynamic';

export async function GET() {
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
        error: 'Forbidden: only super_admin may view or manage team members',
      },
      { status: 403 },
    );
  }

  try {
    const team = await listAdminTeamMembers();
    return NextResponse.json({ success: true, data: team });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list team members' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
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
        error: 'Forbidden: only super_admin may invite team members',
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { email, displayName, role } = body;

    const result = await inviteAdminTeamMember({
      email,
      displayName,
      role,
      inviterName: profile.display_name || 'Townexa Administrator',
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to invite team member' },
      { status: 400 },
    );
  }
}

