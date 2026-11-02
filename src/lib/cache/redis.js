import 'server-only';
import { Redis } from '@upstash/redis';
import { getUpstashServerEnv } from '@/lib/env/server';

export function createRedisClient() {
  const env = getUpstashServerEnv();
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}
