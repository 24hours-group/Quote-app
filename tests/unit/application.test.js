import { describe, expect, it } from 'vitest';
import { applicationConfig, formatCurrency } from '@/config/application';

describe('application configuration', () => {
  it('uses the initial US locale and currency', () => {
    expect(applicationConfig.country.code).toBe('US');
    expect(applicationConfig.currency).toBe('USD');
    expect(applicationConfig.locale).toBe('en-US');
  });

  it('formats integer cents without floating point pricing input', () => {
    expect(formatCurrency(12550)).toBe('$125.50');
  });
});
