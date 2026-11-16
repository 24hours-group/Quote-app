import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/booking/repositories/bookingSessionRepository', () => ({
  attachUnverifiedCustomerByToken: vi.fn(),
}));

import { attachUnverifiedCustomerByToken } from '@/features/booking/repositories/bookingSessionRepository';
import { saveBookingContact } from '@/features/booking/services/contactService';

describe('booking contact service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes contact data before the authorized repository write', async () => {
    attachUnverifiedCustomerByToken.mockResolvedValue({
      sessionId: '00000000-0000-4000-8000-000000000001',
      customerId: '00000000-0000-4000-8000-000000000002',
      version: 4,
    });

    const result = await saveBookingContact('secure-session-token', {
      fullName: ' Maria Santos ',
      receiptEmail: 'MARIA@EXAMPLE.COM',
      mobileNumber: '(212) 555-0100',
      version: 3,
    });

    expect(attachUnverifiedCustomerByToken).toHaveBeenCalledWith(
      'secure-session-token',
      {
        fullName: 'Maria Santos',
        receiptEmail: 'maria@example.com',
        mobileNumber: '+12125550100',
        version: 3,
      },
    );
    expect(result).toEqual({
      contactAttached: true,
      version: 4,
    });
  });

  it('rejects invalid formatting before persistence', async () => {
    await expect(
      saveBookingContact('secure-session-token', {
        fullName: 'Maria Santos',
        receiptEmail: 'maria@example.com',
        mobileNumber: '+44 20 7946 0958',
        version: 3,
      }),
    ).rejects.toThrow('Enter a valid US phone number.');
    expect(attachUnverifiedCustomerByToken).not.toHaveBeenCalled();
  });
});
