import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BookingSessionNotFoundError } from '@/features/booking/repositories/bookingSessionRepository';
import { getBookingSessionToken } from '@/features/booking/services/bookingSessionCookie';
import { PaymentPersistenceError } from '@/features/payment/repositories/paymentRepository';
import { paymentIntentRequestSchema } from '@/features/payment/schemas/paymentSchema';
import { isPaymentSimulationEnabled } from '@/features/payment/services/paymentMode';
import {
  createOrLoadPaymentIntent,
  PaymentProviderError,
} from '@/features/payment/services/paymentService';
import { createOrLoadSimulatedPayment } from '@/features/payment/services/simulatedPaymentService';

export const dynamic = 'force-dynamic';

function response(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function errorResponse(error) {
  if (error instanceof ZodError) {
    return response(
      {
        success: false,
        error: {
          code: 'INVALID_PAYMENT_REQUEST',
          message: 'Select a valid accepted quote.',
        },
      },
      422,
    );
  }
  if (error instanceof BookingSessionNotFoundError) {
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
  if (error instanceof PaymentPersistenceError) {
    const status =
      error.code === 'PAYMENT_NOT_FOUND'
        ? 404
        : error.code === 'PAYMENT_CONFLICT'
          ? 409
          : 422;
    return response(
      {
        success: false,
        error: {
          code: error.code || 'PAYMENT_UNAVAILABLE',
          message: error.message,
        },
      },
      status,
    );
  }
  if (error instanceof PaymentProviderError) {
    return response(
      { success: false, error: { code: error.code, message: error.message } },
      503,
    );
  }
  console.error('Payment Intent creation failed', {
    name: error?.name,
    message: error?.message,
  });
  return response(
    {
      success: false,
      error: {
        code: 'PAYMENT_ERROR',
        message: 'Secure payment is temporarily unavailable.',
      },
    },
    500,
  );
}

export async function POST(request) {
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== request.nextUrl.origin
  ) {
    return response(
      {
        success: false,
        error: {
          code: 'INVALID_ORIGIN',
          message: 'Request origin is invalid.',
        },
      },
      403,
    );
  }
  const token = getBookingSessionToken();
  if (!token) return errorResponse(new BookingSessionNotFoundError());
  try {
    const { quoteId } = paymentIntentRequestSchema.parse(await request.json());
    const simulationEnabled = isPaymentSimulationEnabled();
    const intent = simulationEnabled
      ? await createOrLoadSimulatedPayment(token, quoteId)
      : {
          ...(await createOrLoadPaymentIntent(token, quoteId)),
          mode: 'stripe',
        };
    return response({ success: true, data: intent }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
