import { describe, expect, it } from 'vitest';
import {
  bookingContactSchema,
  normalizeUsPhoneNumber,
} from '@/features/booking/schemas/contactSchema';

describe('US booking contact validation', () => {
  it.each([
    ['(212) 555-0100', '+12125550100'],
    ['212-555-0100', '+12125550100'],
    ['2125550100', '+12125550100'],
    ['1 212 555 0100', '+12125550100'],
    ['+1 212 555 0100', '+12125550100'],
  ])('normalizes %s to E.164', (input, expected) => {
    expect(normalizeUsPhoneNumber(input)).toBe(expected);
  });

  it.each([
    '555-0100',
    '+44 20 7946 0958',
    '112-555-0100',
    '212-155-0100',
    '212-555-0100 x123',
    '1-800-FLOWERS',
    '121255501001',
  ])('rejects invalid, extended, or non-US number %s', (input) => {
    expect(() => normalizeUsPhoneNumber(input)).toThrow(
      'Enter a valid US phone number.',
    );
  });

  it('normalizes contact data without collecting SMS consent', () => {
    expect(
      bookingContactSchema.parse({
        fullName: ' Maria Santos ',
        receiptEmail: 'Maria@Example.COM',
        mobileNumber: '(212) 555-0100',
        version: 2,
      }),
    ).toEqual({
      fullName: 'Maria Santos',
      receiptEmail: 'maria@example.com',
      mobileNumber: '+12125550100',
      version: 2,
    });
  });
});
