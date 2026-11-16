import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  BookingSessionNotFoundError,
  findActiveBookingSessionByToken,
} from '@/features/booking/repositories/bookingSessionRepository';
import { getBookingSessionToken } from '@/features/booking/services/bookingSessionCookie';
import { GoogleRoutesProviderError } from '@/features/booking/services/googleRoutesService';
import {
  InvalidRouteLocationError,
  calculateBookingRoute,
} from '@/features/booking/services/routeCalculationService';
import {
  RouteRateLimitError,
  enforceRouteLimits,
} from '@/features/booking/services/routeRateLimit';
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
          code: 'INVALID_ROUTE_REQUEST',
          message: error.issues[0]?.message || 'Check the confirmed locations.',
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
  if (error instanceof InvalidRouteLocationError) {
    return response(
      {
        success: false,
        error: { code: 'INVALID_ROUTE_LOCATIONS', message: error.message },
      },
      409,
    );
  }
  if (error instanceof RouteRateLimitError) {
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
  if (error instanceof GoogleRoutesProviderError) {
    return response(
      { success: false, error: { code: error.code, message: error.message } },
      error.code === 'NO_DRIVING_ROUTE' ? 422 : 503,
    );
  }
  console.error('Route calculation failed', {
    name: error?.name,
    message: error?.message,
  });
  return response(
    {
      success: false,
      error: {
        code: 'ROUTE_CALCULATION_FAILED',
        message: 'The driving route could not be calculated. Try again.',
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
    await enforceRouteLimits({ ip: getRequestIp(request), token });
    const route = await calculateBookingRoute(token, await request.json());
    return response({ success: true, data: route });
  } catch (error) {
    return errorResponse(error);
  }
}
