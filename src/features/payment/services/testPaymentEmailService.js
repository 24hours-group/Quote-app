import 'server-only';

import {
  findActiveBookingSessionByToken,
  findBookingCustomer,
} from '@/features/booking/repositories/bookingSessionRepository';
import { deliverEmailNotification } from '@/features/notifications/services/resendDeliveryService';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SERVICE_TYPE_LABELS } from '@/features/booking/constants/serviceLabels';

function getAnswer(session, key, fallback = null) {
  return session?.answers?.[key] ?? fallback;
}

function createTestPayload(session, customer, payment, quote = null) {
  const answers = session.answers || {};
  const snapshot = quote?.pricing_snapshot;
  const mergedAnswers = {
    ...answers,
    ...(snapshot?.answers || {}),
  };
  const reference =
    payment.booking?.reference ||
    `RS-${payment.paymentId.slice(0, 8).toUpperCase()}`;

  const effectiveServiceType =
    mergedAnswers.resolvedServiceType ||
    mergedAnswers.serviceType ||
    snapshot?.serviceType ||
    snapshot?.databaseServiceType ||
    getAnswer(session, 'serviceType', 'tow');

  const serviceDisplayName =
    SERVICE_TYPE_LABELS[effectiveServiceType] ||
    SERVICE_TYPE_LABELS[snapshot?.databaseServiceType] ||
    'Roadside Assistance';

  const dropoffAddress =
    snapshot?.dropoff?.formattedAddress ||
    getAnswer(session, 'dropoffAddress') ||
    mergedAnswers.dropoffAddress;

  const dropoffName =
    getAnswer(session, 'dropoffName') ||
    mergedAnswers.dropoffName ||
    null;

  const rawMiles =
    typeof snapshot?.route?.rawMiles === 'number'
      ? snapshot.route.rawMiles
      : typeof answers.towMiles === 'number'
        ? answers.towMiles
        : typeof answers.routeRawMiles === 'number'
          ? answers.routeRawMiles
          : null;

  const billableMiles =
    typeof snapshot?.route?.billableMiles === 'number'
      ? snapshot.route.billableMiles
      : typeof answers.routeBillableMiles === 'number'
        ? answers.routeBillableMiles
        : null;

  return {
    testMode: true,
    booking: {
      reference,
      status: 'paid',
    },
    customer: {
      fullName: customer.fullName,
      phoneE164: customer.phoneE164,
      phoneVerified: Boolean(customer.phoneVerifiedAt),
      receiptEmail: customer.receiptEmail,
    },
    vehicle: {
      year: snapshot?.vehicle?.year || getAnswer(session, 'year', 'Not provided'),
      make: snapshot?.vehicle?.make || getAnswer(session, 'make', 'Not provided'),
      model: snapshot?.vehicle?.model || getAnswer(session, 'model', 'Not provided'),
      color: snapshot?.vehicle?.color || getAnswer(session, 'vehicleColor', null),
    },
    service: {
      type: effectiveServiceType,
      displayName: serviceDisplayName,
      answers: mergedAnswers,
      notes: getAnswer(session, 'customerNotes') || snapshot?.customerNotes,
    },
    pickup: {
      address: snapshot?.pickup?.formattedAddress || getAnswer(session, 'locationAddress', 'Not provided'),
      latitude: snapshot?.pickup?.latitude || getAnswer(session, 'locationLatitude', 'Not provided'),
      longitude: snapshot?.pickup?.longitude || getAnswer(session, 'locationLongitude', 'Not provided'),
      landmarks: getAnswer(session, 'landmarks'),
    },
    dropoff: dropoffAddress
      ? {
          address: dropoffAddress,
          name: dropoffName,
          latitude: snapshot?.dropoff?.latitude || getAnswer(session, 'dropoffLatitude'),
          longitude: snapshot?.dropoff?.longitude || getAnswer(session, 'dropoffLongitude'),
        }
      : null,
    route: rawMiles !== null
      ? {
          rawMiles: typeof rawMiles === 'number' ? Number(rawMiles.toFixed(1)) : rawMiles,
          billableMiles: billableMiles ?? rawMiles,
        }
      : null,
    quote: {
      currency: payment.currency,
      totalCents: payment.amountCents,
      lineItems: snapshot?.quote?.lineItems || [],
    },
    payment: {
      providerReference: `sim_${payment.paymentId}`,
      status: 'succeeded',
      amountCents: payment.amountCents,
      currency: payment.currency,
    },
    company: {
      name: 'Townexa',
      supportPhone: null,
    },
  };
}

export async function sendTestPaymentEmails(token, payment) {
  const session = await findActiveBookingSessionByToken(token);
  if (!session?.customerId) {
    throw new Error(
      'A customer contact is required before sending test emails.',
    );
  }

  const customer = await findBookingCustomer(session.customerId);
  if (!customer?.receiptEmail) {
    throw new Error(
      'A customer receipt email is required before sending test emails.',
    );
  }

  const supabase = createSupabaseAdminClient();
  let quote = null;
  if (payment.paymentId) {
    const { data: dbPayment } = await supabase
      .from('payments')
      .select('quote_id')
      .eq('id', payment.paymentId)
      .maybeSingle();

    if (dbPayment?.quote_id) {
      const { data: dbQuote } = await supabase
        .from('quotes')
        .select('pricing_snapshot')
        .eq('id', dbPayment.quote_id)
        .maybeSingle();
      quote = dbQuote;
    }
  }

  const { data: settings, error } = await supabase
    .from('application_settings')
    .select('company_name, support_phone_e164, dispatch_email')
    .eq('setting_scope', 'default')
    .single();
  if (error || !settings?.dispatch_email) {
    throw new Error('A dispatch email recipient is not configured.');
  }

  const payload = createTestPayload(session, customer, payment, quote);
  payload.company = {
    name: settings.company_name,
    supportPhone: settings.support_phone_e164,
  };

  const baseIdempotencyKey = `test-payment-email:${payment.paymentId}`;
  const [dispatch, customerReceipt] = await Promise.all([
    deliverEmailNotification({
      id: `${payment.paymentId}-dispatch`,
      recipient: settings.dispatch_email,
      template_key: 'dispatch.test_booking',
      idempotency_key: `${baseIdempotencyKey}:dispatch`,
      payload,
    }),
    deliverEmailNotification({
      id: `${payment.paymentId}-customer`,
      recipient: customer.receiptEmail,
      template_key: 'customer.test_booking',
      idempotency_key: `${baseIdempotencyKey}:customer`,
      payload,
    }),
  ]);

  return {
    dispatchProviderMessageId: dispatch.providerMessageId,
    customerProviderMessageId: customerReceipt.providerMessageId,
    reference: payload.booking.reference,
  };
}
