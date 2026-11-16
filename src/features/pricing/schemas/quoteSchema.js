import { z } from 'zod';

const lineItemSchema = z.object({
  itemCode: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitAmountCents: z.number().int().nonnegative(),
  totalAmountCents: z.number().int().nonnegative(),
  payableNow: z.boolean(),
  confirmationRequired: z.boolean(),
  metadata: z.record(z.unknown()),
});

const locationSummarySchema = z.object({
  formattedAddress: z.string().min(1),
  placeId: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().min(1),
});

const quoteSummarySchema = z.object({
  customer: z.object({
    fullName: z.string().min(1),
    phoneE164: z.string().regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/),
    phoneVerified: z.boolean(),
  }),
  vehicle: z.object({
    year: z.number().int(),
    make: z.string().min(1),
    model: z.string().min(1),
    color: z.string().min(1).nullable().optional(),
    isHeavyDuty: z.boolean(),
  }),
  serviceType: z.string().min(1),
  pickup: locationSummarySchema,
  dropoff: locationSummarySchema.nullable(),
  route: z
    .object({
      distanceMeters: z.number().int().positive(),
      rawMiles: z.number().positive(),
      billableMiles: z.number().int().positive(),
      durationSeconds: z.number().int().positive(),
    })
    .nullable(),
});

export const quoteIdSchema = z.string().uuid();

export const quoteTransitionRequestSchema = z
  .object({
    quoteId: quoteIdSchema,
    action: z.enum(['accept', 'decline', 'supersede']),
  })
  .strict();

export const quoteStatusSchema = z.enum([
  'active',
  'expired',
  'declined',
  'superseded',
  'accepted',
]);

export const authoritativeQuoteSchema = z.object({
  id: quoteIdSchema,
  status: quoteStatusSchema,
  acceptedAt: z.string().datetime({ offset: true }).nullable(),
  currency: z.literal('USD'),
  pricingVersion: z.number().int().positive(),
  pricedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  timezone: z.string().min(1),
  period: z.enum(['day', 'night']),
  lineItems: z.array(lineItemSchema).min(1),
  totalPayableNowCents: z.number().int().nonnegative(),
  separatelyConfirmedCharges: z.array(z.string()),
  summary: quoteSummarySchema,
  isAuthoritative: z.literal(true),
});
