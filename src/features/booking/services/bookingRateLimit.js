import 'server-only';

import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { hashBookingSessionToken } from '@/features/booking/repositories/bookingSessionRepository';
import { createRedisClient } from '@/lib/cache/redis';

let limits;

export class BookingRateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super('Too many booking requests. Try again shortly.');
    this.name = 'BookingRateLimitError';
    this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
  }
}

function getLimits() {
  if (limits) return limits;
  const redis = createRedisClient();
  limits = {
    sessionIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      prefix: 'booking:session:ip',
    }),
    contactIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 m'),
      prefix: 'booking:contact:ip',
    }),
    contactSession: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'booking:contact:session',
    }),
    handoffIp: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, '10 m'),
      prefix: 'booking:handoff:ip',
    }),
    handoffSession: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(4, '10 m'),
      prefix: 'booking:handoff:session',
    }),
  };
  return limits;
}

function hashIp(ip) {
  return createHash('sha256').update(ip).digest('hex');
}

function sessionKey(token) {
  return hashBookingSessionToken(token).slice(2);
}

function assertAllowed(results) {
  const limited = results.find((result) => !result.success);
  if (limited) {
    throw new BookingRateLimitError(
      Math.ceil((limited.reset - Date.now()) / 1000),
    );
  }
}

export async function enforceSessionCreationLimit({ ip }) {
  const result = await getLimits().sessionIp.limit(hashIp(ip));
  assertAllowed([result]);
}

export async function enforceContactSubmissionLimits({ ip, token }) {
  const current = getLimits();
  assertAllowed(
    await Promise.all([
      current.contactIp.limit(hashIp(ip)),
      current.contactSession.limit(sessionKey(token)),
    ]),
  );
}

export async function enforceHandoffSubmissionLimits({ ip, token }) {
  const current = getLimits();
  assertAllowed(
    await Promise.all([
      current.handoffIp.limit(hashIp(ip)),
      current.handoffSession.limit(sessionKey(token)),
    ]),
  );
}
