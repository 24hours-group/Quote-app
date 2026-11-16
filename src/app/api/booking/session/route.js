import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import {
  BookingSessionConflictError,
  BookingSessionNotFoundError,
} from '@/features/booking/repositories/bookingSessionRepository';
import { InvalidBookingTransitionError } from '@/features/booking/schemas/bookingSessionSchema';
import {
  BookingRateLimitError,
  enforceSessionCreationLimit,
} from '@/features/booking/services/bookingRateLimit';
import {
  clearBookingSessionToken,
  getBookingSessionToken,
  setBookingSessionToken,
} from '@/features/booking/services/bookingSessionCookie';
import {
  endBookingSession,
  persistBookingSession,
  restoreBookingSession,
  startBookingSession,
} from '@/features/booking/services/bookingSessionService';
import { getRequestIp } from '@/lib/requestIp';

export const dynamic = 'force-dynamic';

const revokeSchema = z
  .object({ version: z.number().int().nonnegative() })
  .strict();

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

function errorResponse(error) {
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
          message: 'This booking was updated elsewhere. Refresh to continue.',
        },
      },
      409,
    );
  }

  if (error instanceof BookingSessionNotFoundError) {
    clearBookingSessionToken();
    return response(
      {
        success: false,
        error: {
          code: 'BOOKING_SESSION_NOT_FOUND',
          message: 'The booking session expired or is no longer available.',
        },
      },
      404,
    );
  }

  if (
    error instanceof ZodError ||
    error instanceof InvalidBookingTransitionError ||
    error instanceof RangeError
  ) {
    console.error('API /api/booking/session validation error:', {
      name: error.name,
      message: error.message,
      details: error.details,
      issues: error.issues,
    });
    return response(
      {
        success: false,
        error: {
          code: 'INVALID_BOOKING_DRAFT',
          message:
            error.message ||
            'The booking draft contains invalid or unreachable state.',
          details: error.details,
        },
      },
      422,
    );
  }

  console.error('Booking session request failed', {
    name: error?.name,
    message: error?.message,
  });
  return response(
    {
      success: false,
      error: {
        code: 'BOOKING_SESSION_ERROR',
        message: 'The booking session could not be saved. Try again.',
      },
    },
    500,
  );
}

export async function GET() {
  const token = getBookingSessionToken();
  if (!token) return response({ success: true, data: null });

  try {
    const session = await restoreBookingSession(token);
    if (!session) {
      clearBookingSessionToken();
      return response({ success: true, data: null });
    }
    return response({ success: true, data: session });
  } catch (error) {
    return errorResponse(error);
  }
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

  try {
    await enforceSessionCreationLimit({ ip: getRequestIp(request) });
    const existingToken = getBookingSessionToken();
    if (existingToken) {
      const existingSession = await restoreBookingSession(existingToken);
      if (existingSession) {
        return response({ success: true, data: existingSession });
      }
    }

    const created = await startBookingSession();
    setBookingSessionToken(created.token);
    return response({ success: true, data: created.session }, 201);
  } catch (error) {
    if (error instanceof BookingSessionNotFoundError) {
      clearBookingSessionToken();
      try {
        const created = await startBookingSession();
        setBookingSessionToken(created.token);
        return response({ success: true, data: created.session }, 201);
      } catch (creationError) {
        return errorResponse(creationError);
      }
    }
    return errorResponse(error);
  }
}

export async function PUT(request) {
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
  if (!token) return errorResponse(new BookingSessionNotFoundError());

  try {
    const input = await request.json();
    const session = await persistBookingSession(token, input);
    return response({ success: true, data: session });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request) {
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
    clearBookingSessionToken();
    return response({ success: true, data: null });
  }

  try {
    const { version } = revokeSchema.parse(await request.json());
    await endBookingSession(token, version);
    clearBookingSessionToken();
    return response({ success: true, data: null });
  } catch (error) {
    return errorResponse(error);
  }
}
