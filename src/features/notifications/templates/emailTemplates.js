import {
  escapeHtml,
  flattenObject,
  formatMoney,
  humanize,
} from '@/features/notifications/templates/formatters';
import {
  SERVICE_TYPE_LABELS,
  MECHANIC_ISSUE_LABELS,
  TIRE_HANDLING_LABELS,
  FUEL_TYPE_LABELS,
  ORIENTATION_LABELS,
  NEUTRAL_LABELS,
} from '@/features/booking/constants/serviceLabels';

function rows(values) {
  return values
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== '',
    )
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:6px 12px 6px 0">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
}

function shell(title, intro, sections) {
  return `<!doctype html><html><body style="background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;margin:0;padding:24px"><main style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;margin:auto;max-width:680px;padding:28px"><h1 style="margin-top:0">${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>${sections.join('')}</main></body></html>`;
}

function section(title, content) {
  return `<section style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:16px"><h2 style="font-size:18px">${escapeHtml(title)}</h2>${content}</section>`;
}

function lineItemTable(payload) {
  const items = payload.quote.lineItems || [];
  return `<table width="100%">${items
    .map(
      (item) =>
        `<tr><td style="padding:5px 0">${escapeHtml(item.description)}</td><td align="right">${escapeHtml(formatMoney(item.totalAmountCents, payload.quote.currency))}${item.confirmationRequired ? ' (confirmed separately)' : ''}</td></tr>`,
    )
    .join(
      '',
    )}<tr><th align="left" style="padding-top:10px">Amount paid</th><th align="right" style="padding-top:10px">${escapeHtml(formatMoney(payload.payment.amountCents, payload.payment.currency))}</th></tr></table>`;
}

function locationRows(payload) {
  return rows([
    ['Pickup', payload.pickup.address],
    ['Coordinates', `${payload.pickup.latitude}, ${payload.pickup.longitude}`],
    ['Landmarks', payload.pickup.landmarks],
    ['Tow destination', payload.dropoff?.address],
    [
      'Google route mileage',
      payload.route
        ? `${payload.route.rawMiles} miles (${payload.route.billableMiles} billable)`
        : null,
    ],
  ]);
}

export function buildDispatchEmail(payload) {
  const customerPhone =
    payload.customer.phoneE164 || payload.customer.verifiedPhone;
  const phoneVerified =
    payload.customer.phoneVerified ?? Boolean(payload.customer.verifiedPhone);
  const serviceDisplayName =
    payload.service?.displayName ||
    SERVICE_TYPE_LABELS[payload.service?.type] ||
    humanize(payload.service?.type);
  const answerRows = rows([
    ...flattenObject(payload.service.answers),
    ...flattenObject(payload.service.specialFlags, 'Safety flag'),
  ]);
  const html = shell(
    `Paid roadside booking ${payload.booking.reference}`,
    'Payment is verified. Contact the customer to confirm timing and assign a driver outside this application.',
    [
      section(
        'Customer and vehicle',
        `<table>${rows([
          ['Status', humanize(payload.booking.status)],
          ['Customer', payload.customer.fullName],
          [phoneVerified ? 'Verified phone' : 'Phone', customerPhone],
          [
            'Vehicle',
            `${payload.vehicle.year} ${payload.vehicle.make} ${payload.vehicle.model}`,
          ],
          ['Service', serviceDisplayName],
        ])}</table>`,
      ),
      section('Location', `<table>${locationRows(payload)}</table>`),
      section(
        'Service details',
        `<table>${answerRows}</table><p><strong>Customer notes:</strong> ${escapeHtml(payload.service.notes || 'None')}</p>`,
      ),
      section(
        'Payment',
        `${lineItemTable(payload)}<p>Stripe reference: ${escapeHtml(payload.payment.providerReference)}</p>`,
      ),
    ],
  );
  return {
    subject: `PAID ${payload.booking.reference} · ${serviceDisplayName}`,
    html,
    text: `PAID ${payload.booking.reference}\nCustomer: ${payload.customer.fullName} ${customerPhone}${phoneVerified ? ' (verified)' : ''}\nVehicle: ${payload.vehicle.year} ${payload.vehicle.make} ${payload.vehicle.model}\nService: ${serviceDisplayName}\nPickup: ${payload.pickup.address}\nCoordinates: ${payload.pickup.latitude}, ${payload.pickup.longitude}\nLandmarks: ${payload.pickup.landmarks || 'None'}\nDrop-off: ${payload.dropoff?.address || 'N/A'}\nRoute: ${payload.route ? `${payload.route.rawMiles} miles (${payload.route.billableMiles} billable)` : 'N/A'}\nNotes: ${payload.service.notes || 'None'}\nPaid: ${formatMoney(payload.payment.amountCents, payload.payment.currency)}\nPayment reference: ${payload.payment.providerReference}`,
  };
}

export function buildTestBookingEmail(payload, audience) {
  const isDispatch = audience === 'dispatch';
  const serviceDisplayName =
    payload.service?.displayName ||
    SERVICE_TYPE_LABELS[payload.service?.type] ||
    humanize(payload.service?.type);
  const title = isDispatch
    ? `PAID BOOKING ${payload.booking.reference} · ${serviceDisplayName}`
    : `Payment receipt · ${payload.booking.reference}`;
  const intro = isDispatch
    ? 'A customer booking has been received. Please review the details below to assign a driver.'
    : `Thank you, ${payload.customer.fullName}. Your payment has been received and dispatch has been notified.`;

  const answers = payload.service?.answers || {};
  const issueRows = [];

  if (answers.mechanicIssue) {
    issueRows.push([
      'Reported Issue',
      MECHANIC_ISSUE_LABELS[answers.mechanicIssue] || humanize(answers.mechanicIssue),
    ]);
  }
  if (answers.mechanicNotes) {
    issueRows.push(['Mechanic Notes', answers.mechanicNotes]);
  }
  if (answers.fuelType) {
    issueRows.push([
      'Fuel Type',
      FUEL_TYPE_LABELS[answers.fuelType] || humanize(answers.fuelType),
    ]);
  }
  if (answers.gallons) {
    issueRows.push(['Gallons Requested', `${answers.gallons} gallons`]);
  }
  if (answers.tireHandling) {
    issueRows.push([
      'Tire Handling',
      TIRE_HANDLING_LABELS[answers.tireHandling] || humanize(answers.tireHandling),
    ]);
  }
  if (answers.damagedTires) {
    issueRows.push([
      'Damaged Tires',
      answers.damagedTires === 1 ? '1 tire' : `${answers.damagedTires} tires`,
    ]);
  }
  if (answers.tireSize) {
    issueRows.push(['Tire Size', answers.tireSize]);
  }
  if (answers.childOrPetInside !== undefined && answers.childOrPetInside !== null) {
    issueRows.push([
      'Child / Pet Inside',
      answers.childOrPetInside ? 'YES - URGENT SAFETY ALERT' : 'No',
    ]);
  }
  if (answers.orientation) {
    issueRows.push([
      'Vehicle Position',
      ORIENTATION_LABELS[answers.orientation] || humanize(answers.orientation),
    ]);
  }
  if (answers.distanceFeet) {
    issueRows.push(['Distance from Road', `${answers.distanceFeet} ft`]);
  }
  if (answers.stuckWheels && answers.stuckWheels.length > 0) {
    issueRows.push([
      'Stuck Wheels',
      Array.isArray(answers.stuckWheels)
        ? answers.stuckWheels.join(', ')
        : String(answers.stuckWheels),
    ]);
  }
  if (answers.batteryCount) {
    issueRows.push([
      'Batteries to Jump',
      answers.batteryCount > 4 ? '5+ batteries' : `${answers.batteryCount} battery`,
    ]);
  }
  if (answers.neutral) {
    issueRows.push([
      'Can Shift to Neutral',
      NEUTRAL_LABELS[answers.neutral] || humanize(answers.neutral),
    ]);
  }

  const details = rows([
    ['Reference', payload.booking.reference],
    ['Customer', payload.customer.fullName],
    ['Customer email', payload.customer.receiptEmail],
    ['Phone', payload.customer.phoneE164],
    [
      'Vehicle',
      `${payload.vehicle.year} ${payload.vehicle.make} ${payload.vehicle.model}${payload.vehicle.color ? ` (${payload.vehicle.color})` : ''}`,
    ],
    ['Service Requested', serviceDisplayName],
    ...issueRows,
    ['Pickup Location', payload.pickup.address],
    ...(payload.dropoff?.name ? [['Drop-off Facility', payload.dropoff.name]] : []),
    ...(payload.dropoff?.address ? [['Drop-off Destination', payload.dropoff.address]] : []),
    ...(payload.route?.rawMiles ? [['Route Distance', `${payload.route.rawMiles} miles (${payload.route.billableMiles || payload.route.rawMiles} billable)`]] : []),
    ...(payload.service?.notes ? [['Customer Notes', payload.service.notes]] : []),
    [
      'Amount Paid',
      formatMoney(payload.payment.amountCents, payload.payment.currency),
    ],
  ]);

  const textDropoff = payload.dropoff?.address ? `\nDrop-off: ${payload.dropoff.address}` : '';
  const textFacility = payload.dropoff?.name ? `\nFacility: ${payload.dropoff.name}` : '';
  const textRoute = payload.route?.rawMiles ? `\nRoute: ${payload.route.rawMiles} miles` : '';
  const textNotes = payload.service?.notes ? `\nNotes: ${payload.service.notes}` : '';
  const textIssues = issueRows.map(([k, v]) => `\n${k}: ${v}`).join('');

  const message = {
    subject: title,
    html: shell(title, intro, [
      section('Booking & Dispatch Details', `<table>${details}</table>`),
    ]),
    text: `${title}\n${intro}\nReference: ${payload.booking.reference}\nCustomer: ${payload.customer.fullName}\nEmail: ${payload.customer.receiptEmail}\nPhone: ${payload.customer.phoneE164}\nVehicle: ${payload.vehicle.year} ${payload.vehicle.make} ${payload.vehicle.model}\nService: ${serviceDisplayName}${textIssues}\nPickup: ${payload.pickup.address}${textFacility}${textDropoff}${textRoute}${textNotes}\nAmount: ${formatMoney(payload.payment.amountCents, payload.payment.currency)}`,
  };
  return message;
}

export function buildCustomerReceiptEmail(payload) {
  const serviceDisplayName =
    payload.service?.displayName ||
    SERVICE_TYPE_LABELS[payload.service?.type] ||
    humanize(payload.service?.type);
  const html = shell(
    `Payment confirmed · ${payload.booking.reference}`,
    `Thank you, ${payload.customer.fullName}. Your roadside booking is paid and the dispatch team will contact you to confirm arrival details.`,
    [
      section(
        'Booking',
        `<table>${rows([
          ['Reference', payload.booking.reference],
          ['Service', serviceDisplayName],
          [
            'Vehicle',
            `${payload.vehicle.year} ${payload.vehicle.make} ${payload.vehicle.model}`,
          ],
          ['Pickup', payload.pickup.address],
          ['Tow destination', payload.dropoff?.address],
        ])}</table>`,
      ),
      section(
        'Receipt',
        `${lineItemTable(payload)}<p>Payment reference: ${escapeHtml(payload.payment.providerReference)}</p>`,
      ),
      section(
        'Need help?',
        `<p>${escapeHtml(payload.company.name)} · ${escapeHtml(payload.company.supportPhone)}</p>`,
      ),
    ],
  );
  return {
    subject: `Payment receipt ${payload.booking.reference}`,
    html,
    text: `Payment confirmed\nBooking: ${payload.booking.reference}\nService: ${serviceDisplayName}\nVehicle: ${payload.vehicle.year} ${payload.vehicle.make} ${payload.vehicle.model}\nPickup: ${payload.pickup.address}\nAmount paid: ${formatMoney(payload.payment.amountCents, payload.payment.currency)}\nPayment reference: ${payload.payment.providerReference}\n${payload.company.name} · ${payload.company.supportPhone}`,
  };
}

export function buildHandoffLeadEmail(payload) {
  const { lead, details = {} } = payload;
  const contact = details.contact || {};
  const vehicle = details.vehicle || {};
  const pickup = details.pickup || {};
  const service = details.service || {};
  const payment = details.payment || {};
  const serviceAnswers = { ...(service.answers || {}) };
  const submittedBookingReference = serviceAnswers.bookingReference;
  delete serviceAnswers.bookingReference;
  const detailRows = rows([
    ...flattenObject(serviceAnswers),
    ...flattenObject(service.specialFlags, 'Safety flag'),
  ]);
  const paymentContext =
    lead.paymentClassification === 'paid'
      ? `PAID · booking ${payment.bookingReference || 'reference unavailable'}`
      : 'UNPAID · no payment has been confirmed';
  const actionContext =
    lead.requestedAction === 'request_callback'
      ? 'Customer requested a callback'
      : 'Customer selected call now';

  return {
    subject: `${lead.priority.toUpperCase()} hand-off · ${lead.reasonCode}`,
    html: shell(
      `Roadside hand-off · ${lead.reasonCode}`,
      `${actionContext}. Service availability, pricing, refunds, and payment must be reviewed by an authorized team member.`,
      [
        section(
          'Routing',
          `<table>${rows([
            ['Assigned team', lead.assignedTeam],
            ['Priority', humanize(lead.priority)],
            ['Payment', paymentContext],
            ['Callback status', humanize(lead.callbackStatus)],
            ['Customer-provided booking reference', submittedBookingReference],
          ])}</table>`,
        ),
        section(
          'Contact and vehicle',
          `<table>${rows([
            ['Customer', contact.fullName],
            [
              contact.phoneVerified
                ? 'Verified phone'
                : 'Unverified submitted phone',
              contact.phone,
            ],
            [
              'Vehicle',
              [vehicle.year, vehicle.make, vehicle.model]
                .filter(Boolean)
                .join(' '),
            ],
          ])}</table>`,
        ),
        section(
          'Location and request',
          `<table>${rows([
            ['Service', SERVICE_TYPE_LABELS[service.type] || humanize(service.type)],
            ['Pickup', pickup.address],
            [
              'Coordinates',
              pickup.latitude && pickup.longitude
                ? `${pickup.latitude}, ${pickup.longitude}`
                : null,
            ],
            ['Landmarks', pickup.landmarks],
            ['Tow destination', details.dropoff?.address],
            [
              'Google route mileage',
              details.route
                ? `${details.route.rawMiles} miles (${details.route.billableMiles} billable)`
                : null,
            ],
          ])}</table>${detailRows ? `<table>${detailRows}</table>` : ''}<p><strong>Customer notes:</strong> ${escapeHtml(service.notes || 'None')}</p>`,
        ),
      ],
    ),
    text: `Roadside hand-off: ${lead.reasonCode}\nTeam: ${lead.assignedTeam}\nPriority: ${lead.priority}\nAction: ${actionContext}\nPayment: ${paymentContext}\nCustomer-provided booking reference: ${submittedBookingReference || 'Not provided'}\nCustomer: ${contact.fullName || 'Not provided'}\nPhone: ${contact.phone || 'Not provided'} (${contact.phoneVerified ? 'verified' : 'not verified'})\nVehicle: ${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Not provided'}\nService: ${(SERVICE_TYPE_LABELS[service.type] || humanize(service.type)) || 'Not provided'}\nPickup: ${pickup.address || 'Not provided'}\nLandmarks: ${pickup.landmarks || 'None'}\nNotes: ${service.notes || 'None'}\nReview availability, pricing, payment, cancellation, and refund status before making any commitment.`,
  };
}

export function buildFailureAlertEmail(payload) {
  return {
    subject: `Delivery failure · ${payload.bookingReference || 'Roadside notification'}`,
    html: shell(
      'Notification delivery requires attention',
      'A durable notification reached dead-letter status.',
      [
        section(
          'Failure',
          `<table>${rows([
            ['Booking', payload.bookingReference],
            ['Event', payload.eventName],
            ['Channel', payload.channel],
            ['Attempts', payload.retryCount],
            ['Error code', payload.errorCode],
          ])}</table>`,
        ),
      ],
    ),
    text: `Notification delivery failure\nBooking: ${payload.bookingReference}\nEvent: ${payload.eventName}\nChannel: ${payload.channel}\nAttempts: ${payload.retryCount}\nError: ${payload.errorCode}`,
  };
}

export function buildAdminInvitationEmail(payload) {
  const { displayName, roleLabel, actionLink, inviterName } = payload;
  const title = 'You have been invited to Townexa Operations Console';
  const intro = `${inviterName || 'An administrator'} has invited you to join the Townexa Dispatch & Operations team as ${roleLabel}.`;

  const details = rows([
    ['Staff Member', displayName],
    ['Assigned Role', roleLabel],
    ['Access Level', 'Townexa Operations Console (/admin)'],
  ]);

  const buttonHtml = `
    <div style="margin: 28px 0; text-align: center;">
      <a href="${escapeHtml(actionLink)}" style="background: #2563EB; color: #ffffff; padding: 12px 28px; border-radius: 10px; font-weight: bold; text-decoration: none; display: inline-block;">
        Accept Invitation & Set Password
      </a>
    </div>
    <p style="font-size: 12px; color: #64748b; margin-top: 16px;">
      If the button above does not work, copy and paste this link into your browser:<br/>
      <a href="${escapeHtml(actionLink)}" style="color: #2563EB; word-break: break-all;">${escapeHtml(actionLink)}</a>
    </p>
  `;

  return {
    subject: `Invitation to join Townexa Operations Console (${roleLabel})`,
    html: shell(title, intro, [
      section('Team Access Details', `<table>${details}</table>${buttonHtml}`),
    ]),
    text: `${title}\n\n${intro}\n\nRole: ${roleLabel}\nStaff: ${displayName}\n\nAccept your invitation and set your password here:\n${actionLink}\n\nTownexa Operations Team`,
  };
}

export function renderEmail(notification) {
  if (
    notification.template_key === 'admin.invitation' ||
    notification.event_name === 'admin_invitation'
  ) {
    return buildAdminInvitationEmail(notification.payload);
  }
  if (notification.template_key === 'dispatch.booking_paid') {
    return buildDispatchEmail(notification.payload);
  }
  if (notification.template_key === 'dispatch.test_booking') {
    return buildTestBookingEmail(notification.payload, 'dispatch');
  }
  if (notification.template_key === 'customer.test_booking') {
    return buildTestBookingEmail(notification.payload, 'customer');
  }
  if (notification.template_key === 'customer.payment_receipt') {
    return buildCustomerReceiptEmail(notification.payload);
  }
  if (notification.template_key === 'operations.delivery_failure') {
    return buildFailureAlertEmail(notification.payload);
  }
  if (notification.template_key === 'operations.handoff_lead') {
    return buildHandoffLeadEmail(notification.payload);
  }
  throw new Error('Unsupported email template.');
}
