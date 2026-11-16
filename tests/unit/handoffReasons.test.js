import { describe, expect, it } from 'vitest';
import { HANDOFF_CODES } from '@/features/booking/config/bookingFlow';
import {
  HANDOFF_REASON_CODES,
  HANDOFF_REASON_CONFIG,
} from '@/features/handoff/constants/handoffReasons';

const expected = [
  ['USER_REQUEST', 'Dispatcher', 'dispatcher', 'normal'],
  ['EXISTING_JOB', 'Job owner', 'job_owner', 'high'],
  ['CANCEL_JOB', 'Job owner', 'job_owner', 'high'],
  ['MISSING_INFO', 'Dispatcher', 'dispatcher', 'normal'],
  ['HEAVY_DUTY', 'Heavy-duty team', 'heavy_duty', 'high'],
  ['UNLISTED_SERVICE', 'Specialist', 'specialist', 'high'],
  ['WINCH_SPECIALIST', 'Specialist', 'specialist', 'high'],
  ['OVER_LIMIT', 'Dispatcher', 'dispatcher', 'high'],
  ['PAY_BY_PHONE', 'Dispatcher', 'dispatcher', 'normal'],
];

describe('hand-off reason routing', () => {
  it('covers exactly the nine preserved booking reason codes', () => {
    expect(HANDOFF_REASON_CODES).toEqual(Object.values(HANDOFF_CODES));
    expect(HANDOFF_REASON_CODES).toHaveLength(9);
  });

  it.each(expected)(
    'maps %s to its team and default priority',
    (reasonCode, team, teamKey, priority) => {
      expect(HANDOFF_REASON_CONFIG[reasonCode]).toMatchObject({
        team,
        teamKey,
        priority,
      });
    },
  );
});
