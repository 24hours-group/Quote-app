import { NextResponse } from 'next/server';
import { getAuthorizedAdminProfile } from '@/features/admin/services/authorization';
import { updateBookingDispatchStatus } from '@/features/admin/services/adminActionService';

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
    const { dispatch_status: dispatchStatus } = body;

    if (!dispatchStatus) {
      return NextResponse.json(
        { success: false, error: 'dispatch_status is required' },
        { status: 400 },
      );
    }

    const updatedBooking = await updateBookingDispatchStatus({
      bookingId: params.id,
      dispatchStatus,
    });

    return NextResponse.json({
      success: true,
      data: updatedBooking,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update booking' },
      { status: 400 },
    );
  }
}

