import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BookingSessionNotFoundError } from '@/features/booking/repositories/bookingSessionRepository';
import {
  clearBookingSessionToken,
  getBookingSessionToken,
} from '@/features/booking/services/bookingSessionCookie';
import { PaymentPersistenceError } from '@/features/payment/repositories/paymentRepository';
import { paymentSimulationRequestSchema } from '@/features/payment/schemas/paymentSchema';
import { sendTestPaymentEmails } from '@/features/payment/services/testPaymentEmailService';
import {
  completeSimulatedPayment,
  PaymentSimulationUnavailableError,
} from '@/features/payment/services/simulatedPaymentService';
import { broadcastAdminSubmission } from '@/features/admin/services/adminRealtimeService';

export const dynamic = 'force-dynamic';

function response(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function hasValidOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request) {
  if (!hasValidOrigin(request)) {
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
    const { paymentId, outcome } = paymentSimulationRequestSchema.parse(
      await request.json(),
    );
    const status = await completeSimulatedPayment(token, paymentId, outcome);
    let emailDelivery = null;
    if (outcome === 'success') {
      try {
        clearBookingSessionToken();
      } catch {
        // Ignored
      }
      try {
        emailDelivery = {
          status: 'delivered',
          ...(await sendTestPaymentEmails(token, status)),
        };
      } catch (emailError) {
        console.error('Test payment email delivery failed', {
          name: emailError?.name,
          code: emailError?.code,
          message: emailError?.message,
          causeName: emailError?.cause?.name,
          causeCode: emailError?.cause?.code,
          causeStatus: emailError?.cause?.statusCode,
          causeMessage: emailError?.cause?.message,
        });
        emailDelivery = {
          status: 'failed',
          code: emailError?.code || 'email_delivery_failed',
        };
      }
      await broadcastAdminSubmission({
        entity: 'booking',
        action: 'paid',
        bookingId: status.booking?.id,
        reference: status.booking?.reference,
      });
    }
    return response({
      success: true,
      data: { ...status, emailDelivery },
    });
  } catch (error) {
    if (error instanceof PaymentSimulationUnavailableError) {
      return response(
        {
          success: false,
          error: { code: error.code, message: error.message },
        },
        404,
      );
    }
    if (error instanceof ZodError) {
      return response(
        {
          success: false,
          error: {
            code: 'INVALID_PAYMENT_SIMULATION',
            message: 'Choose a valid payment outcome.',
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
    console.error('Payment simulation failed', {
      name: error?.name,
      message: error?.message,
    });
    return response(
      {
        success: false,
        error: {
          code: 'PAYMENT_SIMULATION_ERROR',
          message: 'The payment could not be completed.',
        },
      },
      500,
    );
  }
}
