import { handoffResponseSchema } from '@/features/handoff/schemas/handoffSchema';

export class HandoffClientError extends Error {
  constructor(message, code = 'HANDOFF_UNAVAILABLE') {
    super(message);
    this.name = 'HandoffClientError';
    this.code = code;
  }
}

export async function createHandoffLead(input) {
  const response = await fetch('/api/booking/handoff', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new HandoffClientError(
      payload?.error?.message ||
        'We could not save your hand-off request. Please try again.',
      payload?.error?.code,
    );
  }
  return handoffResponseSchema.parse(payload).data;
}
