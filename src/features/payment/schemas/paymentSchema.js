import { z } from 'zod';

export const paymentIntentRequestSchema = z
  .object({
    quoteId: z.string().uuid(),
  })
  .strict();

export const paymentSimulationRequestSchema = z
  .object({
    paymentId: z.string().uuid(),
    outcome: z.enum(['success', 'failure']),
  })
  .strict();

export const paymentStatusQuerySchema = z
  .object({
    paymentId: z.string().uuid().optional(),
    reference: z
      .string()
      .regex(/^RS-[A-Z0-9]{8,20}$/)
      .optional(),
  })
  .refine((value) => Boolean(value.paymentId) !== Boolean(value.reference), {
    message: 'Provide exactly one payment lookup identifier.',
  });

export const paymentStatusSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.enum([
    'pending',
    'processing',
    'requires_action',
    'succeeded',
    'failed',
    'partially_refunded',
    'refunded',
    'cancelled',
  ]),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  processedAt: z.string().datetime().nullable(),
  booking: z
    .object({
      id: z.string().uuid(),
      reference: z.string(),
      dispatchStatus: z.string(),
    })
    .nullable(),
});

export const paymentIntentResponseSchema = z
  .object({
    mode: z.enum(['stripe', 'simulation']).default('stripe'),
    paymentId: z.string().uuid(),
    clientSecret: z.string().min(1).optional(),
    status: paymentStatusSchema.shape.status,
    amountCents: z.number().int().positive(),
    currency: z.string().length(3),
  })
  .superRefine((value, context) => {
    if (value.mode === 'stripe' && !value.clientSecret) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientSecret'],
        message: 'Stripe payments require a client secret.',
      });
    }
  });
