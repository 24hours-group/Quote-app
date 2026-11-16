import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BookingSessionNotFoundError } from '@/features/booking/repositories/bookingSessionRepository';
import { getBookingSessionToken } from '@/features/booking/services/bookingSessionCookie';
import {
  lookupPaymentStatus,
  PaymentPersistenceError,
} from '@/features/payment/repositories/paymentRepository';
import { paymentStatusQuerySchema } from '@/features/payment/schemas/paymentSchema';

export const dynamic = 'force-dynamic';

function response(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request) {
  const token = getBookingSessionToken();
  if (!token) {
    return response(
      {
        success: false,
        error: {
          code: 'BOOKING_SESSION_NOT_FOUND',
          message: 'Your booking session expired.',
        },
      },
      404,
    );
  }
  try {
    const lookup = paymentStatusQuerySchema.parse({
      paymentId: request.nextUrl.searchParams.get('paymentId') || undefined,
      reference: request.nextUrl.searchParams.get('reference') || undefined,
    });
    const status = await lookupPaymentStatus(token, lookup);
    return response({ success: true, data: status });
  } catch (error) {
    if (error instanceof ZodError) {
      return response(
        {
          success: false,
          error: {
            code: 'INVALID_PAYMENT_LOOKUP',
            message: 'Payment lookup is invalid.',
          },
        },
        422,
      );
    }
    if (
      error instanceof BookingSessionNotFoundError ||
      error instanceof PaymentPersistenceError
    ) {
      return response(
        {
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: 'No authorized payment was found.',
          },
        },
        404,
      );
    }
    console.error('Payment status lookup failed', {
      name: error?.name,
      message: error?.message,
    });
    return response(
      {
        success: false,
        error: {
          code: 'PAYMENT_STATUS_ERROR',
          message: 'Payment status is temporarily unavailable.',
        },
      },
      500,
    );
  }
}
