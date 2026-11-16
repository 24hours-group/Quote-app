import { describe, expect, it } from 'vitest';
import {
  VEHICLE_COLORS,
  VEHICLE_MAKES,
  VEHICLE_YEARS,
  getVehicleModels,
} from '@/features/booking/data/usVehicleCatalog';

describe('local US vehicle catalog', () => {
  it('ships common years, makes, models, and colors with the app', () => {
    expect(VEHICLE_YEARS).toContain(new Date().getFullYear());
    expect(VEHICLE_MAKES.length).toBeGreaterThanOrEqual(60);
    expect(VEHICLE_MAKES).toContain('Honda');
    expect(getVehicleModels('Honda')).toContain('CR-V');
    expect(getVehicleModels('Pontiac')).toContain('GTO');
    expect(getVehicleModels('Saturn')).toContain('Vue');
    expect(VEHICLE_COLORS).toContain('Silver');
  });

  it('matches make names case-insensitively and permits custom fallback', () => {
    expect(getVehicleModels('  toyota ')).toContain('Camry');
    expect(getVehicleModels('Custom Coachworks')).toEqual([]);
  });
});
