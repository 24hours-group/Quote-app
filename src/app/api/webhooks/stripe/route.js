import { NextResponse } from 'next/server';
import { PaymentPersistenceError } from '@/features/payment/repositories/paymentRepository';
import { processStripePaymentEvent } from '@/features/payment/services/stripeWebhookService';
import { broadcastAdminSubmission } from '@/features/admin/services/adminRealtimeService';
import { getStripeServerEnv } from '@/lib/env/server';
import { createStripeClient } from '@/lib/integrations/stripe/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const rawPayload = await request.text();
  let event;
  try {
    const stripe = createStripeClient();
    event = stripe.webhooks.constructEvent(
      rawPayload,
      signature,
      getStripeServerEnv().STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    await processStripePaymentEvent(event, rawPayload);
    if (event.type === 'payment_intent.succeeded') {
      await broadcastAdminSubmission({
        entity: 'booking',
        action: 'paid',
        providerPaymentId: event.data?.object?.id,
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Verified Stripe webhook processing failed', {
      eventId: event.id,
      eventType: event.type,
      code: error instanceof PaymentPersistenceError ? error.code : undefined,
      message: error?.message,
    });
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
