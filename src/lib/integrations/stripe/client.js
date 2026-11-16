'use client';

import { loadStripe } from '@stripe/stripe-js';
import { getClientEnv } from '@/lib/env/client';

let stripePromise;

export function getStripePromise() {
  const publishableKey = getClientEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) return null;
  stripePromise ||= loadStripe(publishableKey);
  return stripePromise;
}
