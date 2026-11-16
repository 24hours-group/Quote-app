import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import {
  updateHandoffLeadStatus,
  deleteHandoffLead,
} from '@/features/admin/services/adminActionService';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin session required' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { callback_status: callbackStatus, assigned_team: assignedTeam } = body;

    if (!callbackStatus) {
      return NextResponse.json(
        { success: false, error: 'callback_status is required' },
        { status: 400 },
      );
    }

    const updatedLead = await updateHandoffLeadStatus({
      leadId: params.id,
      callbackStatus,
      assignedTeam,
    });

    return NextResponse.json({
      success: true,
      data: updatedLead,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update handoff lead' },
      { status: 400 },
    );
  }
}

export async function DELETE(request, { params }) {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin session required' },
      { status: 401 },
    );
  }

  try {
    const result = await deleteHandoffLead(params.id);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete handoff lead' },
      { status: 400 },
    );
  }
}

