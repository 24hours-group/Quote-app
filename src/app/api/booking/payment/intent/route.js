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
  console.error('API /api/booking/payment/intent error:', error);

  if (error instanceof ZodError) {
    return response(
      {
        success: false,
        error: {
          code: 'PAYMENT_CONFIG_ERROR',
          message:
            'Stripe payment configuration error. Check that STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are configured.',
        },
      },
      500,
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
          : error.code === 'QUOTE_NOT_PAYABLE'
            ? 422
            : 500;
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
  const expectedOrigin = request.nextUrl?.origin || new URL(request.url).origin;
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== expectedOrigin
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

  let quoteId;
  try {
    const body = await request.json();
    const parsed = paymentIntentRequestSchema.parse(body);
    quoteId = parsed.quoteId;
  } catch (parseError) {
    console.error('API /api/booking/payment/intent invalid request body:', parseError);
    return response(
      {
        success: false,
        error: {
          code: 'INVALID_PAYMENT_REQUEST',
          message: 'Booking details could not be verified. Please refresh and try again.',
        },
      },
      422,
    );
  }

  try {
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
