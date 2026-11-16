import 'server-only';

import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { createRedisClient } from '@/lib/cache/redis';
import { hashBookingSessionToken } from '@/features/booking/repositories/bookingSessionRepository';

let limits;

export class RouteRateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super('Too many route requests. Try again shortly.');
    this.name = 'RouteRateLimitError';
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

function getLimits() {
  if (limits) return limits;
  const redis = createRedisClient();
  limits = {
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '10 m'),
      prefix: 'route:compute:ip',
    }),
    session: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(12, '10 m'),
      prefix: 'route:compute:session',
    }),
  };
  return limits;
}

export async function enforceRouteLimits({ ip, token }) {
  const current = getLimits();
  const [ipResult, sessionResult] = await Promise.all([
    current.ip.limit(createHash('sha256').update(ip).digest('hex')),
    current.session.limit(hashBookingSessionToken(token).slice(2)),
  ]);
  const limited = [ipResult, sessionResult].find((result) => !result.success);
  if (limited) {
    throw new RouteRateLimitError(
      Math.ceil((limited.reset - Date.now()) / 1000),
    );
  }
}
