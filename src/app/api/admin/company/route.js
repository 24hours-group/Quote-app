import { NextResponse } from 'next/server';
import {
  getAuthorizedAdminProfile,
  canManageCompanySettings,
} from '@/features/admin/services/authorization';
import {
  getCompanySettings,
  updateCompanySettings,
} from '@/features/admin/services/adminCompanyService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin session required' },
      { status: 401 },
    );
  }

  if (!canManageCompanySettings(profile.role)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: only super_admin may view company settings',
      },
      { status: 403 },
    );
  }

  try {
    const settings = await getCompanySettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load company settings',
      },
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

  if (!canManageCompanySettings(profile.role)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: only super_admin may modify company settings',
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const updates = body.updates || body;

    const result = await updateCompanySettings({
      updates,
      updatedByUserId: profile.user_id,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update company settings',
        fieldErrors: error.fieldErrors || null,
      },
      { status: 400 },
    );
  }
}

