import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  BookingPersistenceConfigurationError,
  BookingSessionConflictError,
  BookingSessionNotFoundError,
} from '@/features/booking/repositories/bookingSessionRepository';
import {
  BookingRateLimitError,
  enforceContactSubmissionLimits,
} from '@/features/booking/services/bookingRateLimit';
import { getBookingSessionToken } from '@/features/booking/services/bookingSessionCookie';
import { saveBookingContact } from '@/features/booking/services/contactService';
import { getRequestIp } from '@/lib/requestIp';

export const dynamic = 'force-dynamic';

function response(data, status = 200, headers = {}) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
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
          message: 'Start a booking session before saving contact details.',
        },
      },
      401,
    );
  }

  try {
    await enforceContactSubmissionLimits({
      ip: getRequestIp(request),
      token,
    });
    const data = await saveBookingContact(token, await request.json());
    return response({ success: true, data });
  } catch (error) {
    if (error instanceof BookingRateLimitError) {
      return response(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: error.message,
            retryAfterSeconds: error.retryAfterSeconds,
          },
        },
        429,
        { 'Retry-After': String(error.retryAfterSeconds) },
      );
    }
    if (error instanceof BookingSessionConflictError) {
      return response(
        {
          success: false,
          error: {
            code: 'BOOKING_SESSION_CONFLICT',
            message: 'Your booking changed. Refresh and try again.',
          },
        },
        409,
      );
    }
    if (error instanceof BookingSessionNotFoundError) {
      return response(
        {
          success: false,
          error: {
            code: 'BOOKING_SESSION_NOT_FOUND',
            message: 'Your booking session expired. Refresh to start again.',
          },
        },
        404,
      );
    }
    if (error instanceof BookingPersistenceConfigurationError) {
      console.error('Booking contact database schema is unavailable', {
        databaseCode: error.cause?.code,
        databaseMessage: error.cause?.message,
        databaseDetails: error.cause?.details,
      });
      return response(
        {
          success: false,
          error: {
            code: 'BOOKING_SCHEMA_UNAVAILABLE',
            message:
              'Booking contact setup is temporarily unavailable. Apply the latest database migrations.',
          },
        },
        503,
      );
    }
    if (error instanceof ZodError) {
      return response(
        {
          success: false,
          error: {
            code: 'INVALID_CONTACT',
            message: error.issues[0]?.message || 'Check your contact details.',
          },
        },
        422,
      );
    }

    console.error('Booking contact request failed', {
      name: error?.name,
      message: error?.message,
      databaseCode: error?.cause?.code,
      databaseMessage: error?.cause?.message,
      databaseDetails: error?.cause?.details,
    });
    return response(
      {
        success: false,
        error: {
          code: 'CONTACT_SAVE_ERROR',
          message: 'Your contact details could not be saved. Try again.',
        },
      },
      500,
    );
  }
}
