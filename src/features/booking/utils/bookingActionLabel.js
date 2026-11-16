import { getNextTransition } from '@/features/booking/utils/bookingFlow';

const SERVICE_SCREEN_IDS = new Set(['J1', 'T1', 'L1', 'W2', 'G1', 'M1', 'X1']);

export function getBookingActionLabel(screenId, answers = {}) {
  if (!SERVICE_SCREEN_IDS.has(screenId)) return 'Continue';

  const transition = getNextTransition(screenId, answers);
  if (transition.to === 'R') return 'Continue to dispatcher';
  if (transition.to === 'S7') return 'See my quote';
  return 'Continue';
}
