import 'server-only';
import twilio from 'twilio';
import { getTwilioServerEnv } from '@/lib/env/server';

export function createTwilioClient() {
  const env = getTwilioServerEnv();
  return {
    client: twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN),
    verifyServiceSid: env.TWILIO_VERIFY_SERVICE_SID,
  };
}
