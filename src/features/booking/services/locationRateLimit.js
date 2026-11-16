import 'server-only';

import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { createRedisClient } from '@/lib/cache/redis';
import { hashBookingSessionToken } from '@/features/booking/repositories/bookingSessionRepository';

let limits;

export class LocationRateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super('Too many location requests. Try again shortly.');
    this.name = 'LocationRateLimitError';
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

function getLimits() {
  if (limits) return limits;
  const redis = createRedisClient();
  limits = {
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '10 m'),
      prefix: 'location:resolve:ip',
    }),
    session: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '10 m'),
      prefix: 'location:resolve:session',
    }),
  };
  return limits;
}

export async function enforceLocationResolveLimits({ ip, token }) {
  const current = getLimits();
  const [ipResult, sessionResult] = await Promise.all([
    current.ip.limit(createHash('sha256').update(ip).digest('hex')),
    current.session.limit(hashBookingSessionToken(token).slice(2)),
  ]);
  const limited = [ipResult, sessionResult].find((result) => !result.success);
  if (limited) {
    throw new LocationRateLimitError(
      Math.ceil((limited.reset - Date.now()) / 1000),
    );
  }
}
