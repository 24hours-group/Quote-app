import { HANDOFF_CODES } from '@/features/booking/config/bookingFlow';

export const HANDOFF_ACTIONS = Object.freeze({
  CALL_NOW: 'call_now',
  REQUEST_CALLBACK: 'request_callback',
});

export const HANDOFF_REASON_CONFIG = Object.freeze({
  [HANDOFF_CODES.USER_REQUEST]: {
    headline: 'A dispatcher will help you',
    team: 'Dispatcher',
    teamKey: 'dispatcher',
    priority: 'normal',
    label: 'Dispatcher assistance',
    guidance:
      'A dispatcher will review your request and connect with you directly to assist with your booking.',
  },
  [HANDOFF_CODES.EXISTING_JOB]: {
    headline: 'The agent responsible for your job can help',
    team: 'Job owner',
    teamKey: 'job_owner',
    priority: 'high',
    label: 'Existing booking inquiry',
    guidance:
      'An agent will verify the booking reference before sharing status details.',
  },
  [HANDOFF_CODES.CANCEL_JOB]: {
    headline: 'An agent will review your cancellation request',
    team: 'Job owner',
    teamKey: 'job_owner',
    priority: 'high',
    label: 'Cancellation request',
    guidance:
      'An agent will verify the booking and review cancellation and refund options. This request does not cancel the booking or promise a refund.',
  },
  [HANDOFF_CODES.MISSING_INFO]: {
    headline: 'A dispatcher will help you finish your request',
    team: 'Dispatcher',
    teamKey: 'dispatcher',
    priority: 'normal',
    label: 'Additional booking details',
    guidance:
      'A dispatcher will help you complete any missing details to finalize your roadside assistance request.',
  },
  [HANDOFF_CODES.HEAVY_DUTY]: {
    headline: 'Our heavy-duty team will help you',
    team: 'Heavy-duty team',
    teamKey: 'heavy_duty',
    priority: 'high',
    label: 'Heavy-duty vehicle service',
    guidance:
      'Online pricing is unavailable for heavy-duty vehicles. The team will review the equipment needed.',
  },
  [HANDOFF_CODES.UNLISTED_SERVICE]: {
    headline: 'Our specialist team handles this service',
    team: 'Specialist',
    teamKey: 'specialist',
    priority: 'high',
    label: 'Specialized service request',
    guidance:
      'A specialist must review this service before availability or pricing can be confirmed.',
  },
  [HANDOFF_CODES.WINCH_SPECIALIST]: {
    headline: 'A winch specialist will review your request',
    team: 'Specialist',
    teamKey: 'specialist',
    priority: 'high',
    callbackOnly: true,
    label: 'Winch-out recovery assessment',
    guidance:
      'A specialist must review the recovery conditions. This request is callback-only and does not confirm a price.',
  },
  [HANDOFF_CODES.OVER_LIMIT]: {
    headline: 'A dispatcher will review this request',
    team: 'Dispatcher',
    teamKey: 'dispatcher',
    priority: 'high',
    label: 'Route & distance review',
    guidance:
      'Online pricing is unavailable for this request. A dispatcher must review the details before discussing a price.',
  },
  [HANDOFF_CODES.PAY_BY_PHONE]: {
    headline: 'An agent can take your payment by phone',
    team: 'Dispatcher',
    teamKey: 'dispatcher',
    priority: 'normal',
    label: 'Payment by phone',
    guidance:
      'An agent can take payment by phone. This request does not mark your quote or booking as paid.',
  },
});

export const HANDOFF_REASON_CODES = Object.freeze(
  Object.keys(HANDOFF_REASON_CONFIG),
);

export function getHandoffReasonConfig(reasonCode) {
  return (
    HANDOFF_REASON_CONFIG[reasonCode] ||
    HANDOFF_REASON_CONFIG[HANDOFF_CODES.USER_REQUEST]
  );
}

export function formatHandoffReason(reasonCode) {
  if (!reasonCode) return 'Assistance request';
  const config = HANDOFF_REASON_CONFIG[reasonCode];
  if (config?.label) return config.label;
  return reasonCode
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
