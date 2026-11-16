import { z } from 'zod';
import {
  HANDOFF_ACTIONS,
  HANDOFF_REASON_CODES,
} from '@/features/handoff/constants/handoffReasons';

export const handoffRequestSchema = z
  .object({
    reasonCode: z.enum(HANDOFF_REASON_CODES),
    action: z.enum(Object.values(HANDOFF_ACTIONS)),
  })
  .strict();

export const handoffLeadSchema = z.object({
  id: z.string().uuid(),
  reasonCode: z.enum(HANDOFF_REASON_CODES),
  assignedTeam: z.string().min(1),
  priority: z.enum(['normal', 'high', 'urgent']),
  paymentClassification: z.enum(['paid', 'unpaid']),
  requestedAction: z.enum(Object.values(HANDOFF_ACTIONS)),
  callbackStatus: z.enum(['new', 'queued', 'contacted', 'resolved', 'closed']),
  supportPhoneE164: z.string().nullable(),
  companyName: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
});

export const handoffResponseSchema = z.object({
  success: z.literal(true),
  data: handoffLeadSchema,
});
