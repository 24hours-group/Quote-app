# Booking feature

The customer wizard implements the screen identifiers and navigation rules from `docs/Roadside_Quote_App_Screen_Flow_v1.0.pdf`:

`S0 → S1 → S2 → S4 → S5 → S6 → service path → S7 → S8A`

Existing/cancel requests skip location, service, and quote after contact/vehicle collection. Unsupported, over-limit, heavy-duty, safety, pay-by-phone, and user-requested branches route to `R` with the PDF reason code.

## Structure

- `config/bookingFlow.js`: declarative screens, mandatory fields, transitions, handoff codes, and document step numbers.
- `utils/bookingFlow.js`: pure validation, transition resolution, edit returns, and visible progress.
- `hooks/useBookingWizard.js`: history, answers, server hydration, persistence state, notices, and outcomes.
- `repositories/bookingSessionRepository.js`: service-role-only hashed-token session persistence and optimistic concurrency.
- `services/bookingDraftService.js`: client API boundary; it never receives the raw HttpOnly session token.
- `components/fields/`: reusable address, option-card, number, notes, text, and dialog controls.
- `components/screens/`: grouped screen presentation with no transition logic.
- `components/wizard/`: responsive shell, progress, sticky actions, loading, and completion states.
- `services/`: server-backed session/contact, Google location, and Google route boundaries.
- `mock-data/`: non-financial screen option catalogs used to render selectable choices.

## Integration boundaries

S2 validates US/NANP formatting on both client and server, then attaches an isolated unverified contact to the protected booking session. It does not verify ownership or deliverability. S4/W1 use Google Maps and Places (New), while W2 uses the protected Google Routes Compute Routes API. Upstash provides provider rate limiting and short-lived session-bound snapshots. Quotes are generated from versioned server pricing, and S8A uses Stripe Payment Intents and verified webhooks.

- Drafts are persisted through `/api/booking/session` into versioned Supabase `booking_sessions` rows. A 256-bit bearer token is stored only in a secure HttpOnly cookie and only its SHA-256 hash reaches PostgreSQL. Browser storage contains only a non-authoritative screen marker; payment state is excluded.
- `POST /api/booking/contact` revalidates and normalizes the name, receipt email, and US phone, authorizes by the session cookie/hash and expected version, and attaches an isolated customer record. Anonymous sessions are never matched or merged by phone number.
- `phone_verified_at` remains null for formatting-only contacts. UI, quotes, and notifications must not describe these numbers as verified. The application does not collect SMS consent or deliver SMS messages.
- Partial vehicle, location, service, and handoff answers remain in the protected session snapshot until provider-validated values can be promoted to normalized tables.
- S4 and W1 location selections are server-resolved through Google Geocoding and Time Zone APIs before they can be persisted as trusted draft values.
- W2 loads pickup/drop-off snapshots by the HttpOnly booking session, calls Google Routes with `DRIVE` and `TRAFFIC_UNAWARE`, and stores a 15-minute session-bound route snapshot. Only that snapshot supplies distance, duration, polyline, rate band, and billable miles to downstream state.
- Route provider cache keys contain only hashed coordinates and policy inputs; cached values expire after 15 minutes. Address edits invalidate route and quote state, while expired tow routes return to W2 before quote refresh.
- Quote generation is server-authoritative, snapshots the pricing version, and persists immutable line items. No browser pricing formula is implemented.
- Stripe Payment Intents are created only for the latest accepted quote. Signed webhooks, not redirects or browser state, finalize payment and enqueue dispatch.

## Tests

`tests/unit/bookingFlow.test.js` covers every screen ID, mandatory field, service branch, handoff reason, edit return, and progress path. Session tests cover sensitive-field filtering, invalid transitions, refresh restoration, serialized saves, and revocation. `tests/e2e/booking-wizard.spec.js` uses an isolated API mock to cover the customer journey and refresh restoration without contacting production data.
