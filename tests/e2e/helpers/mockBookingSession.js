export async function mockBookingSessionApi(page) {
  let session = null;
  let locationSequence = 0;
  let quote = null;
  let quoteSequence = 200;

  await page.addInitScript(() => {
    const dragListeners = [];
    class MockMap {
      panTo() {}
      fitBounds() {}
    }
    class MockLatLngBounds {
      extend() {}
    }
    class MockPolyline {
      setMap() {}
    }
    class MockAdvancedMarkerElement {
      constructor(options) {
        this.position = options.position;
        this.map = options.map;
      }
      addListener(event, callback) {
        if (event === 'dragend') dragListeners.push(callback);
        return { remove() {} };
      }
    }
    class MockAutocompleteSessionToken {}
    class MockAutocompleteSuggestion {
      static async fetchAutocompleteSuggestions({ input }) {
        const isDropoff = /joe|miami|biscayne/i.test(input);
        const formattedAddress = isDropoff
          ? '1000 Biscayne Blvd, Miami, FL 33132, USA'
          : '1200 N Federal Hwy, Hollywood, FL 33020, USA';
        const latitude = isDropoff ? 25.785 : 26.021;
        const longitude = isDropoff ? -80.19 : -80.142;
        return {
          suggestions: [
            {
              placePrediction: {
                placeId: isDropoff ? 'mock-dropoff-place' : 'mock-place-id',
                text: { toString: () => formattedAddress },
                toPlace: () => ({
                  id: isDropoff ? 'mock-dropoff-place' : 'mock-place-id',
                  formattedAddress,
                  location: { lat: () => latitude, lng: () => longitude },
                  fetchFields: async () => undefined,
                }),
              },
            },
          ],
        };
      }
    }
    window.google = {
      maps: {
        importLibrary: async (name) => {
          if (name === 'places') {
            return {
              AutocompleteSessionToken: MockAutocompleteSessionToken,
              AutocompleteSuggestion: MockAutocompleteSuggestion,
            };
          }
          if (name === 'marker') {
            return { AdvancedMarkerElement: MockAdvancedMarkerElement };
          }
          if (name === 'geometry') {
            return {
              encoding: {
                decodePath: () => [
                  { lat: () => 26.021, lng: () => -80.142 },
                  { lat: () => 25.785, lng: () => -80.19 },
                ],
              },
            };
          }
          return {
            Map: MockMap,
            LatLngBounds: MockLatLngBounds,
            Polyline: MockPolyline,
          };
        },
      },
    };
    window.__triggerLocationMarkerDrag = (latitude, longitude) => {
      for (const listener of dragListeners) {
        listener({
          latLng: { lat: () => latitude, lng: () => longitude },
        });
      }
    };
  });

  await page.route('**/api/booking/location/resolve', async (route) => {
    const body = route.request().postDataJSON();
    locationSequence += 1;
    await route.fulfill({
      json: {
        success: true,
        data: {
          resolutionId: `00000000-0000-4000-8000-${String(locationSequence).padStart(12, '0')}`,
          formattedAddress:
            body.latitude === 25.785
              ? '1000 Biscayne Blvd, Miami, FL 33132, USA'
              : body.source === 'marker_drag'
                ? '1202 N Federal Hwy, Hollywood, FL 33020, USA'
                : '1200 N Federal Hwy, Hollywood, FL 33020, USA',
          placeId: `mock-place-${locationSequence}`,
          latitude: body.latitude ?? 26.021,
          longitude: body.longitude ?? -80.142,
          timezone: 'America/New_York',
          countryCode: 'US',
          serviceAreaStatus: 'available',
          source: body.source,
          accuracyMeters: body.accuracyMeters ?? null,
          resolvedAt: '2026-11-02T10:00:00.000Z',
        },
      },
    });
  });

  await page.route('**/api/booking/route', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        success: true,
        data: {
          routeCalculationId: '00000000-0000-4000-8000-000000000100',
          pickupResolutionId: body.pickupResolutionId,
          dropoffResolutionId: body.dropoffResolutionId,
          distanceMeters: 20117,
          rawMiles: 12.5,
          billableMiles: 13,
          durationSeconds: 1500,
          encodedPolyline: 'mock-polyline',
          rateBand: 'short',
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
          calculatedAt: '2026-11-02T10:00:00.000Z',
          expiresAt: '2099-11-02T10:15:00.000Z',
        },
      },
    });
  });

  await page.route('**/api/booking/quote*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const { answers } = route.request().postDataJSON();
      const serviceType = answers.resolvedServiceType || answers.serviceType;
      const isTow = serviceType === 'tow';
      const total = isTow ? 27300 : 15000;
      quoteSequence += 1;
      quote = {
        id: `00000000-0000-4000-8000-${String(quoteSequence).padStart(12, '0')}`,
        status: 'active',
        acceptedAt: null,
        currency: 'USD',
        pricingVersion: 2,
        pricedAt: '2026-11-02T10:00:00.000Z',
        validUntil: '2099-11-02T10:30:00.000Z',
        timezone: 'America/New_York',
        period: 'day',
        lineItems: [
          {
            itemCode: isTow ? 'tow_total' : 'jump_start',
            description: isTow ? 'Tow service' : 'Jump start · 1 battery',
            quantity: 1,
            unitAmountCents: total,
            totalAmountCents: total,
            payableNow: true,
            confirmationRequired: false,
            metadata: {},
          },
        ],
        totalPayableNowCents: total,
        separatelyConfirmedCharges: [],
        summary: {
          customer: {
            fullName: answers.fullName,
            phoneE164: '+15555550100',
            phoneVerified: false,
          },
          vehicle: {
            year: Number(answers.year),
            make: answers.make,
            model: answers.model,
            isHeavyDuty: false,
          },
          serviceType,
          pickup: {
            formattedAddress: '1200 N Federal Hwy, Hollywood, FL 33020, USA',
            placeId: 'mock-place-id',
            latitude: 26.021,
            longitude: -80.142,
            timezone: 'America/New_York',
          },
          dropoff: isTow
            ? {
                formattedAddress: '1000 Biscayne Blvd, Miami, FL 33132, USA',
                placeId: 'mock-dropoff-place',
                latitude: 25.785,
                longitude: -80.19,
                timezone: 'America/New_York',
              }
            : null,
          route: isTow
            ? {
                distanceMeters: 20117,
                rawMiles: 12.5,
                billableMiles: 13,
                durationSeconds: 1500,
              }
            : null,
        },
        isAuthoritative: true,
      };
      await route.fulfill({
        status: 201,
        json: { success: true, data: quote },
      });
      return;
    }

    if (!quote) {
      await route.fulfill({ status: 404 });
      return;
    }

    if (method === 'PATCH') {
      const { action } = route.request().postDataJSON();
      quote = {
        ...quote,
        status:
          action === 'accept'
            ? 'accepted'
            : action === 'decline'
              ? 'declined'
              : 'superseded',
        acceptedAt: action === 'accept' ? '2026-11-02T10:05:00.000Z' : null,
      };
    }

    await route.fulfill({ json: { success: true, data: quote } });
  });

  await page.route('**/api/booking/contact', async (route) => {
    const body = route.request().postDataJSON();
    session.version += 1;
    const contact = {
      fullName: body.fullName.trim(),
      receiptEmail: body.receiptEmail.trim().toLowerCase(),
      mobileNumber: '+15555550100',
    };
    session.answers = {
      ...session.answers,
      ...contact,
      contactAttached: true,
    };
    await route.fulfill({
      json: {
        success: true,
        data: {
          contactAttached: true,
          version: session.version,
        },
      },
    });
  });

  await page.route('**/api/booking/handoff', async (route) => {
    const { reasonCode, action } = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        success: true,
        data: {
          id: 'b0000000-0000-4000-8000-000000000001',
          reasonCode,
          assignedTeam:
            reasonCode === 'WINCH_SPECIALIST' ||
            reasonCode === 'UNLISTED_SERVICE'
              ? 'Specialist'
              : 'Dispatcher',
          priority: reasonCode === 'USER_REQUEST' ? 'normal' : 'high',
          paymentClassification: 'unpaid',
          requestedAction: action,
          callbackStatus: action === 'request_callback' ? 'queued' : 'new',
          supportPhoneE164: '+15550102020',
          companyName: 'Test Roadside',
          createdAt: '2026-11-03T10:00:00.000Z',
        },
      },
    });
  });

  await page.route('**/api/booking/session', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({ json: { success: true, data: session } });
      return;
    }

    if (method === 'POST') {
      session = {
        currentScreenId: 'S0',
        answers: {},
        history: [],
        progressPercent: 0,
        version: 0,
      };
      await route.fulfill({
        status: 201,
        json: { success: true, data: session },
      });
      return;
    }

    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      session = {
        currentScreenId: body.currentScreenId,
        answers: body.answers,
        history: body.history,
        progressPercent: 0,
        version: body.version + 1,
      };
      await route.fulfill({ json: { success: true, data: session } });
      return;
    }

    if (method === 'DELETE') {
      session = null;
      await route.fulfill({ json: { success: true, data: null } });
      return;
    }

    await route.fulfill({ status: 405 });
  });
}
