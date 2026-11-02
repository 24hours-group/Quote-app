import 'server-only';
import Stripe from 'stripe';
import { getStripeServerEnv } from '@/lib/env/server';

export function createStripeClient() {
  const env = getStripeServerEnv();
  return new Stripe(env.STRIPE_SECRET_KEY);
}
