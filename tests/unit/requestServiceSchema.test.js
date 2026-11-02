import { describe, expect, it } from 'vitest';
import { requestServiceSchema } from '@/features/booking/schemas/requestServiceSchema';

describe('requestServiceSchema', () => {
  it('accepts a service and US-style address input', () => {
    const result = requestServiceSchema.safeParse({
      serviceType: 'tow',
      pickupAddress: '100 Main St, Austin, TX 78701',
    });

    expect(result.success).toBe(true);
  });

  it('rejects incomplete quote input', () => {
    const result = requestServiceSchema.safeParse({
      serviceType: '',
      pickupAddress: '',
    });

    expect(result.success).toBe(false);
  });
});
