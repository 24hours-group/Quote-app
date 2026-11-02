import 'server-only';
import { z } from 'zod';

const schemas = {
  supabasePublic: z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  }),
  supabaseAdmin: z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  }),
  googleMaps: z.object({
    GOOGLE_MAPS_SERVER_API_KEY: z.string().min(1),
  }),
  upstash: z.object({
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  }),
  stripe: z.object({
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  }),
  twilio: z.object({
    TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
    TWILIO_AUTH_TOKEN: z.string().min(1),
    TWILIO_VERIFY_SERVICE_SID: z.string().startsWith('VA'),
  }),
  resend: z.object({
    RESEND_API_KEY: z.string().startsWith('re_'),
    RESEND_FROM_EMAIL: z.string().min(1),
  }),
};

const cache = new Map();

function validate(name) {
  if (!cache.has(name)) {
    cache.set(name, schemas[name].parse(process.env));
  }

  return cache.get(name);
}

export const getSupabasePublicServerEnv = () => validate('supabasePublic');
export const getSupabaseAdminEnv = () => validate('supabaseAdmin');
export const getGoogleMapsServerEnv = () => validate('googleMaps');
export const getUpstashServerEnv = () => validate('upstash');
export const getStripeServerEnv = () => validate('stripe');
export const getTwilioServerEnv = () => validate('twilio');
export const getResendServerEnv = () => validate('resend');
