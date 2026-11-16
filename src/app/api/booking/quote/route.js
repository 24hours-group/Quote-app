import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  BookingSessionConflictError,
  BookingSessionNotFoundError,
} from '@/features/booking/repositories/bookingSessionRepository';
import { InvalidBookingTransitionError } from '@/features/booking/schemas/bookingSessionSchema';
import {
  clearBookingSessionToken,
  getBookingSessionToken,
} from '@/features/booking/services/bookingSessionCookie';
import {
  QuoteLifecycleError,
  QuotePersistenceError,
  transitionAuthoritativeQuoteByToken,
} from '@/features/pricing/repositories/quoteRepository';
import {
  quoteIdSchema,
  quoteTransitionRequestSchema,
} from '@/features/pricing/schemas/quoteSchema';
import { PricingConfigurationError } from '@/features/pricing/repositories/pricingParameterRepository';
import { PricingInputError } from '@/features/pricing/services/pricingEngine';
import { generateAuthoritativeQuote } from '@/features/pricing/services/quoteService';

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

function errorResponse(error) {
  if (
    error instanceof BookingSessionNotFoundError ||
    error?.code === 'BOOKING_SESSION_NOT_FOUND'
  ) {
    clearBookingSessionToken();
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
  if (
    error instanceof ZodError ||
    error instanceof InvalidBookingTransitionError
  ) {
    console.error('API /api/booking/quote validation error:', {
      name: error.name,
      message: error.message,
      details: error.details,
      issues: error.issues,
    });
    return response(
      {
        success: false,
        error: {
          code: 'INVALID_QUOTE_REQUEST',
          message:
            error.message ||
            'Complete the required booking details before requesting a quote.',
          details: error.details,
        },
      },
      422,
    );
  }
  if (error instanceof BookingSessionConflictError) {
    return response(
      {
        success: false,
        error: {
          code: 'BOOKING_SESSION_CONFLICT',
          message: 'Your booking details changed. Request an updated quote.',
        },
      },
      409,
    );
  }
  if (error instanceof QuoteLifecycleError) {
    return response(
      { success: false, error: { code: error.code, message: error.message } },
      409,
    );
  }
  if (error instanceof PricingInputError) {
    console.error('API /api/booking/quote pricing input error:', {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return response(
      { success: false, error: { code: error.code, message: error.message } },
      error.code === 'OVER_LIMIT' ? 409 : 422,
    );
  }
  if (
    error instanceof PricingConfigurationError ||
    error instanceof QuotePersistenceError
  ) {
    console.error('Authoritative quote storage is unavailable', {
      name: error.name,
      stage: error.stage,
      databaseCode: error.cause?.code,
      databaseMessage: error.cause?.message,
      databaseDetails: error.cause?.details,
    });
    return response(
      {
        success: false,
        error: {
          code: 'QUOTE_UNAVAILABLE',
          message: 'Pricing is temporarily unavailable. Try again shortly.',
        },
      },
      503,
    );
  }
  console.error('Authoritative quote generation failed', {
    name: error?.name,
    message: error?.message,
  });
  return response(
    {
      success: false,
      error: {
        code: 'QUOTE_ERROR',
        message: 'The quote could not be generated. Try again.',
      },
    },
    500,
  );
}

export async function GET(request) {
  const token = getBookingSessionToken();
  if (!token) return errorResponse(new BookingSessionNotFoundError());
  try {
    const quoteId = quoteIdSchema.parse(
      request.nextUrl.searchParams.get('quoteId'),
    );
    const quote = await transitionAuthoritativeQuoteByToken(
      token,
      quoteId,
      'load',
    );
    return response({ success: true, data: quote });
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
  const token = getBookingSessionToken();
  if (!token) return errorResponse(new BookingSessionNotFoundError());
  try {
    const quote = await generateAuthoritativeQuote(token, await request.json());
    return response({ success: true, data: quote }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request) {
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
    const { quoteId, action } = quoteTransitionRequestSchema.parse(
      await request.json(),
    );
    const quote = await transitionAuthoritativeQuoteByToken(
      token,
      quoteId,
      action,
    );
    return response({ success: true, data: quote });
  } catch (error) {
    return errorResponse(error);
  }
}
