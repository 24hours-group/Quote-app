import 'server-only';
import { Resend } from 'resend';
import { getResendServerEnv } from '@/lib/env/server';

export function createResendClient() {
  const env = getResendServerEnv();
  return {
    client: new Resend(env.RESEND_API_KEY),
    from: env.RESEND_FROM_EMAIL,
  };
}
