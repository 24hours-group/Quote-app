import { routeSnapshotSchema } from '@/features/booking/schemas/routeCalculationSchema';

const ENDPOINT = '/api/booking/route';

export class RouteCalculationError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'RouteCalculationError';
    this.code = code;
    this.status = status;
  }
}

export async function calculateTowRoute(input) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new RouteCalculationError(
      payload?.error?.message || 'The driving route could not be calculated.',
      payload?.error?.code || 'ROUTE_CALCULATION_FAILED',
      response.status,
    );
  }
  return routeSnapshotSchema.parse(payload.data);
}
