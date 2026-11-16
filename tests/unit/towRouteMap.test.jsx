import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/integrations/google-maps/client', () => ({
  getGoogleMapsClientConfig: vi.fn(),
  loadGoogleMapsLibrary: vi.fn(),
}));

import { TowRouteMap } from '@/features/booking/components/fields/TowRouteMap';
import {
  getGoogleMapsClientConfig,
  loadGoogleMapsLibrary,
} from '@/lib/integrations/google-maps/client';

class MockMap {
  fitBounds() {}
}
class MockBounds {
  extend() {}
}
class MockPolyline {
  setMap() {}
}
class MockMarker {
  constructor(options) {
    this.map = options.map;
  }
}

function configureBaseLibraries() {
  getGoogleMapsClientConfig.mockReturnValue({ mapId: 'configured-map-id' });
  loadGoogleMapsLibrary.mockImplementation(async (name) => {
    if (name === 'maps') {
      return {
        Map: MockMap,
        Polyline: MockPolyline,
      };
    }
    if (name === 'core') return { LatLngBounds: MockBounds };
    if (name === 'marker') {
      return { AdvancedMarkerElement: MockMarker, Marker: MockMarker };
    }
    throw new Error('Geometry library unavailable');
  });
}

describe('tow route map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps pickup and destination visible when only the route line fails', async () => {
    configureBaseLibraries();
    render(
      <TowRouteMap
        pickup={{ lat: 26.021, lng: -80.142 }}
        dropoff={{ lat: 25.785, lng: -80.19 }}
        encodedPolyline="invalid-or-unavailable"
      />,
    );

    expect(
      screen.getByRole('application', { name: /driving route map/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/route line could not be drawn/i),
    ).toBeVisible();
    expect(
      screen.queryByText(/route map could not be loaded/i),
    ).not.toBeInTheDocument();
  });

  it('falls back to a standard map when no browser Map ID is available', async () => {
    configureBaseLibraries();
    getGoogleMapsClientConfig.mockReturnValue({ mapId: undefined });
    render(
      <TowRouteMap
        pickup={{ lat: 26.021, lng: -80.142 }}
        dropoff={{ lat: 25.785, lng: -80.19 }}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('application', { name: /driving route map/i }),
      ).toBeVisible(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(loadGoogleMapsLibrary).toHaveBeenCalledWith('core');
  });
});
