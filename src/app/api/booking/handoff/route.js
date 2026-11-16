import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { BookingSessionNotFoundError } from '@/features/booking/repositories/bookingSessionRepository';
import {
  BookingRateLimitError,
  enforceHandoffSubmissionLimits,
} from '@/features/booking/services/bookingRateLimit';
import { getBookingSessionToken } from '@/features/booking/services/bookingSessionCookie';
import {
  createHandoffLeadByToken,
  HandoffActionError,
  HandoffContactRequiredError,
  HandoffPersistenceError,
} from '@/features/handoff/repositories/handoffRepository';
import { handoffRequestSchema } from '@/features/handoff/schemas/handoffSchema';
import { broadcastAdminSubmission } from '@/features/admin/services/adminRealtimeService';
import { getRequestIp } from '@/lib/requestIp';

export const dynamic = 'force-dynamic';

function response(data, status = 200, headers = {}) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
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
  if (error instanceof ZodError || error instanceof HandoffActionError) {
    return response(
      {
        success: false,
        error: { code: 'INVALID_HANDOFF_REQUEST', message: error.message },
      },
      422,
    );
  }
  if (error instanceof HandoffContactRequiredError) {
    return response(
      {
        success: false,
        error: {
          code: 'HANDOFF_CONTACT_REQUIRED',
          message: error.message,
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
  if (error instanceof HandoffPersistenceError) {
    return response(
      {
        success: false,
        error: {
          code: 'HANDOFF_UNAVAILABLE',
          message: 'The team request could not be saved. Please try again.',
        },
      },
      503,
    );
  }
  console.error('Hand-off lead creation failed', {
    name: error?.name,
    message: error?.message,
  });
  return response(
    {
      success: false,
      error: {
        code: 'HANDOFF_ERROR',
        message: 'The team request could not be saved. Please try again.',
      },
    },
    500,
  );
}

export async function POST(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
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
    await enforceHandoffSubmissionLimits({
      ip: getRequestIp(request),
      token,
    });
    const input = handoffRequestSchema.parse(await request.json());
    const lead = await createHandoffLeadByToken(token, input);
    await broadcastAdminSubmission({
      entity: 'handoff_lead',
      action: 'create',
      leadId: lead?.id,
    });
    return response({ success: true, data: lead }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
