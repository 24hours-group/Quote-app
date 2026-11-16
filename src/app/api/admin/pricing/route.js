import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import {
  getActivePricingConfig,
  updatePricingConfig,
} from '@/features/admin/services/adminPricingService';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profile = await getAuthorizedAdminProfile();
  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: admin session required' },
      { status: 401 },
    );
  }

  try {
    const config = await getActivePricingConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load pricing configuration' },
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

  // Only super_admin and operations_admin can update pricing
  if (!['super_admin', 'operations_admin'].includes(profile.role)) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: only super_admin and operations_admin may update pricing' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { updates } = body;
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Updates object is required' },
        { status: 400 },
      );
    }

    const result = await updatePricingConfig({
      updates,
      userId: profile.user_id,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save pricing configuration' },
      { status: 400 },
    );
  }
}

