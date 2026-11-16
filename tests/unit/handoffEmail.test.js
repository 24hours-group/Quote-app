import { describe, expect, it } from 'vitest';
import { buildHandoffLeadEmail } from '@/features/notifications/templates/emailTemplates';

const payload = {
  lead: {
    reasonCode: 'PAY_BY_PHONE',
    assignedTeam: 'Dispatcher',
    priority: 'normal',
    paymentClassification: 'unpaid',
    requestedAction: 'request_callback',
    callbackStatus: 'queued',
  },
  details: {
    contact: {
      fullName: 'Maria Santos',
      phone: '+15555550100',
      phoneVerified: true,
    },
    vehicle: { year: 2019, make: 'Honda', model: 'CR-V' },
    pickup: {
      address: '1200 N Federal Hwy, Hollywood, FL',
      latitude: 26.021,
      longitude: -80.142,
      landmarks: 'Near the Shell station',
    },
    service: {
      type: 'tow',
      answers: {
        bookingReference: 'RS-1A2B3C4D5E',
        neutral: 'not_sure',
      },
      specialFlags: { isSafe: true },
      notes: 'Northbound shoulder',
    },
  },
};

describe('hand-off email template', () => {
  it('labels unpaid leads and avoids confirming price or payment', () => {
    const email = buildHandoffLeadEmail(payload);
    expect(email.subject).toContain('PAY_BY_PHONE');
    expect(email.text).toContain('UNPAID · no payment has been confirmed');
    expect(email.text).toContain('Maria Santos');
    expect(email.text).toContain('Near the Shell station');
    expect(email.html).toContain('RS-1A2B3C4D5E');
    expect(email.text).not.toMatch(/amount paid|refund approved/i);
  });
});
