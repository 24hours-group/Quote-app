import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  BookingSessionNotFoundError,
  findActiveBookingSessionByToken,
} from '@/features/booking/repositories/bookingSessionRepository';
import { getBookingSessionToken } from '@/features/booking/services/bookingSessionCookie';
import {
  GoogleLocationProviderError,
  resolveGoogleLocation,
} from '@/features/booking/services/googleLocationService';
import {
  LocationRateLimitError,
  enforceLocationResolveLimits,
} from '@/features/booking/services/locationRateLimit';
import { storeResolvedLocation } from '@/features/booking/services/locationResolutionStore';
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

function errorResponse(error) {
  if (error instanceof ZodError) {
    return response(
      {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: error.issues[0]?.message || 'Check the selected location.',
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
          message: 'Your booking session expired. Refresh to start again.',
        },
      },
      404,
    );
  }
  if (error instanceof LocationRateLimitError) {
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
  if (error instanceof GoogleLocationProviderError) {
    return response(
      { success: false, error: { code: error.code, message: error.message } },
      error.code === 'ADDRESS_NOT_FOUND' ? 422 : 503,
    );
  }
  console.error('Location resolution failed', {
    name: error?.name,
    message: error?.message,
  });
  return response(
    {
      success: false,
      error: {
        code: 'LOCATION_RESOLUTION_FAILED',
        message: 'The location could not be confirmed. Try again.',
      },
    },
    500,
  );
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
  if (!token) return errorResponse(new BookingSessionNotFoundError());

  try {
    const session = await findActiveBookingSessionByToken(token);
    if (!session) throw new BookingSessionNotFoundError();
    await enforceLocationResolveLimits({ ip: getRequestIp(request), token });
    const location = await resolveGoogleLocation(await request.json());
    const stored = await storeResolvedLocation(token, location);
    return response({ success: true, data: stored });
  } catch (error) {
    return errorResponse(error);
  }
}
