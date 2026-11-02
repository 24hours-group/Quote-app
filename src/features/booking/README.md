# Booking feature

The customer wizard implements the screen identifiers and navigation rules from `docs/Roadside_Quote_App_Screen_Flow_v1.0.pdf`:

`S0 → S1 → S2 → S4 → S5 → S6 → service path → S7 → S8A`

Existing/cancel requests skip location, service, and quote after contact/vehicle collection. Unsupported, over-limit, heavy-duty, safety, pay-by-phone, and user-requested branches route to `R` with the PDF reason code.

## Structure

- `config/bookingFlow.js`: declarative screens, mandatory fields, transitions, handoff codes, and document step numbers.
- `utils/bookingFlow.js`: pure validation, transition resolution, edit returns, and visible progress.
- `hooks/useBookingWizard.js`: history, answers, hydration, persistence state, notices, and outcomes.
- `components/fields/`: reusable address, option-card, number, notes, text, and dialog controls.
- `components/screens/`: grouped screen presentation with no transition logic.
- `components/wizard/`: responsive shell, progress, sticky actions, loading, and completion states.
- `services/`: replaceable mock draft, quote, and payment boundaries.
- `mock-data/`: fixture quote responses and screen option catalogs.

## Mock-only boundaries

This unit intentionally does not call Google Maps, Twilio Verify, Stripe, or live quote APIs.

- Drafts use expiring, tab-scoped `sessionStorage`; verification codes and payment state are excluded. This is development continuity, not the production persistence boundary. Production must use the server-mediated hashed booking session repository and HttpOnly credentials.
- Address lookup/current location and the map are visual mocks.
- Verification accepts `123456` and preserves the three-attempt handoff rule.
- Quote fixtures imitate a server response and are marked non-authoritative. No browser pricing formula is implemented.
- Payment is a mock completion action and never collects card details.

## Tests

`tests/unit/bookingFlow.test.js` covers every screen ID, mandatory field, service branch, handoff reason, edit return, and progress path. `tests/e2e/booking-wizard.spec.js` covers the full new-request journey, validation blocking, backward answer preservation, specialist handoff, mobile sticky actions, desktop sizing, and horizontal overflow.
