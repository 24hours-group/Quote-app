import { successResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return successResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
