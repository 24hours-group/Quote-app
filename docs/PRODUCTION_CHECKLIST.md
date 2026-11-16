# Roadside Quote App production checklist

Last reviewed: 2026-11-03

This checklist records what was actually verified for Unit 12. A checked item means the named automated or static check passed in this repository. It does not imply that a live third-party account was exercised unless explicitly stated.

## Release decision

**Status: conditional / not approved for unrestricted production traffic.**

The application builds and its mock-backed Vitest and Playwright suites pass. Production approval remains blocked by the items in [Launch blockers](#launch-blockers), especially the unexecuted Supabase pgTAP suite, unresolved framework advisories, unverified live-provider credentials, and hand-off abuse controls.

## Evidence summary

| Check                           | Result               | Evidence                                                                                  |
| ------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| Clean lockfile install          | Pass                 | `npm ci` completed; 646 packages installed                                                |
| ESLint                          | Pass                 | `npm run lint`; no warnings or errors                                                     |
| Prettier                        | Pass                 | `npm run format:check`                                                                    |
| Vitest                          | Pass                 | 31 files, 181 tests                                                                       |
| Playwright                      | Pass                 | 32 passed, 2 skipped across desktop and mobile projects                                   |
| Next.js production build        | Pass                 | Next.js 14.2.35; all routes compiled                                                      |
| Supabase startup                | Blocked              | Docker and Podman are unavailable on the review host                                      |
| Supabase DB lint                | Not run successfully | Local PostgreSQL refused `127.0.0.1:54322`                                                |
| Supabase pgTAP                  | Not run successfully | Local PostgreSQL refused `127.0.0.1:54322`                                                |
| Production dependency audit     | Fail                 | 7 advisories: 1 critical, 2 high, 4 low                                                   |
| Client secret-name scan         | Pass                 | No privileged environment variable names in `.next/static`                                |
| Live Google/Stripe/Resend calls | Not performed        | Automated tests use isolated provider doubles; no cost-bearing production calls were made |

The full post-change application suites were run. Repeat every command in [Release commands](#release-commands) in CI with a working Supabase stack before merging or deploying.

## Screen-flow verification

The state-machine suite covers all preserved identifiers: `S0`, `S1`, `S2`, `S4`, `S5`, `S6`, `J1`, `T1`, `L1`, `W1`, `W2`, `G1`, `M1`, `X1`, `S7`, `S8A`, and `R`.

The approved enhancement replaces customer-entered tow mileage with protected Google Routes driving distance. Server distance, not browser mileage, is used for pricing.

### Automated branch evidence

- [x] S0 safe and unsafe/911 transitions
- [x] S1 new, existing, and cancel transitions
- [x] S2 verified new/existing/cancel and three-failure hand-off transitions
- [x] S4 confirmed, unavailable, not-found, moved-pin, and reconfirmation behavior
- [x] S5 regular, heavy-duty, unknown, existing-job, and cancellation branches
- [x] S6 all seven service choices and unlisted-service hand-off
- [x] J1 battery limits
- [x] T1 spare, replacement, tow, tire-size, and over-limit branches
- [x] L1 normal and urgent child/pet branches
- [x] W1 pickup edit, destination selection, and confirmation
- [x] W2 route-required, neutral states, and over-100-mile hand-off
- [x] G1 regular fuel and diesel/not-sure hand-off
- [x] M1 issue selection with optional notes
- [x] X1 upright pricing and specialist orientations
- [x] S7 accept, edit-return, decline, and pay-by-phone transitions
- [x] S8A modeled success, failure, and pay-by-phone transitions
- [x] R actions and all nine reason codes

### Browser coverage limitations

Playwright covers the main new-request journey, server-backed US contact formatting, map pin confirmation, tow destination and route display, quote acceptance/edit/decline/pay-by-phone, selected hand-offs, draft restoration, and mobile overflow/sticky actions.

The browser suite does **not** exercise every service branch end-to-end, a live Stripe Payment Element success, real Google Maps browser scripts, or all nine hand-off presentations. Vitest and pgTAP are responsible for most branch and security invariants.

## Pricing and quote controls

- [x] Integer-cent calculations only
- [x] Day/night period uses the confirmed vehicle-location IANA timezone
- [x] Jump start battery tiers
- [x] Tire change/replacement upfront and separately confirmed charges
- [x] Lockout and mechanic day/night rates
- [x] Tow hook variants, 20-mile threshold, ceiling conversion, and 100-mile maximum
- [x] Gas base/gallons and separately confirmed excess delivery mileage
- [x] Winch included distance and additional ten-foot steps
- [x] PDF examples: 12.5 miles = $273, 20 miles = $329, 20.2 miles = $379, and 34 miles/non-neutral = $529
- [x] Quote validity, expiration, supersession, decline, and acceptance logic
- [x] Editing pricing inputs invalidates downstream route/quote state
- [x] Pay-by-phone preserves the current quote instead of falsely declining it
- [x] Checkout uses only the latest accepted server quote

## Authentication, authorization, and data isolation

- [x] Guest booking token is random, HttpOnly, and stored only as a SHA-256 hash
- [x] Booking RPCs authorize by token hash and expiry
- [x] Application tables have forced RLS and explicit policies
- [x] Anonymous table access to customer, booking, payment, hand-off, and audit data is revoked
- [x] Admin routes now require a valid Supabase user and active `admin_profiles` role
- [x] Application admin role names match the PostgreSQL `admin_role` enum
- [ ] Re-run `supabase test db` against a clean local or ephemeral database
- [ ] Verify hosted Supabase Auth site URL and redirect allowlist
- [ ] Provision at least two test administrators with different roles and verify allowed/denied operations in staging
- [ ] Add an admin sign-in route and recovery workflow before operational staff rollout

## Provider verification

### Contact phone

Automated evidence verifies US/NANP formatting, E.164 normalization, server-side session attachment, and unverified-contact labeling. S2 does not send an OTP or SMS and does not prove ownership or deliverability.

- [ ] Confirm Redis limits persist across multiple Vercel instances for provider-backed map and route requests
- [ ] Confirm the deployment-controlled client IP header cannot be spoofed

### Google Cloud

Automated evidence verifies Geocoding, Time Zone, Routes request shape, route conversion, field masks, provider failures, service-area validation, and new 10-second server request deadlines.

- [ ] Exercise current-location permission granted, denied, timeout, and inaccurate-position behavior on real mobile browsers
- [ ] Verify Places API (New) autocomplete session tokens and billing in staging
- [ ] Verify draggable Advanced Marker behavior with the production Map ID
- [ ] Verify Geocoding and Time Zone responses for all intended US service regions
- [ ] Restrict the browser key by production/preview HTTP referrers and browser APIs
- [ ] Restrict the server key to Geocoding, Time Zone, and Routes APIs; use controlled egress if IP restrictions are required

### Stripe

Automated evidence verifies server amount ownership, deterministic idempotency, signature handling, status mapping, duplicate event handling, and no booking/dispatch before succeeded payment.

- [ ] Run Stripe CLI test webhooks against staging
- [ ] Complete test Payment Element card, Apple Pay, and Google Pay journeys on supported devices/domains
- [ ] Verify failed, canceled, processing, requires-action, and succeeded Payment Intents in the Stripe test account
- [ ] Replay the same signed event and confirm one booking and one dispatch outbox event
- [ ] Confirm the production webhook endpoint and selected event types
- [ ] Confirm `/payment/success` and `/booking/[reference]` never infer payment from URL parameters

### Resend and notifications

Automated evidence verifies immutable templates, provider idempotency, retries, leases, dead-letter transitions, failure alerts, and hand-off notifications.

- [x] Notification worker invokes via Supabase `pg_cron` (`* * * * *`) or Vercel Cron with authenticated `POST` / `GET`
- [ ] Set `NOTIFICATION_WORKER_SECRET` (and optional `CRON_SECRET`) to random values of at least 32 characters
- [ ] Verify the Resend sender domain and configured From address
- [ ] Send staging dispatch, receipt, hand-off, retry, and dead-letter alert emails
- [ ] Monitor queue age, retries, and dead-letter counts

## Forbidden production paths

Static source inspection found no production workflow using:

- hardcoded OTP `123456` (test fixtures only)
- a fixed Florida current-location result (test fixtures only)
- mock quote totals
- browser-submitted/manual billable tow miles
- demo payment completion

Before each release, run:

```sh
rg "123456|RS-DEMO|submitMockPayment|useMockQuote|mock address|manualMiles" src
```

Any new production match must be reviewed. Mock provider responses are allowed only under `tests/` or isolated test helpers.

## Vercel configuration

### Project settings

- Framework preset: Next.js
- Root directory: `bookSaas` when connected to the parent repository
- Install command: `npm ci`
- Build command: `npm run build`
- Node.js runtime: 22.x
- Output directory: leave unset
- Cron: Managed in Supabase via `pg_cron` (`* * * * *`) calling `/api/internal/notifications/process` (avoids Vercel Hobby plan 1-per-day cron limitation)

### Public environment variables

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_COMPANY_NAME`
- `NEXT_PUBLIC_COMPANY_PHONE`
- `NEXT_PUBLIC_COMPANY_EMAIL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_COUNTRY`
- `NEXT_PUBLIC_GOOGLE_MAP_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Server-only environment variables

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_SERVER_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NOTIFICATION_WORKER_SECRET`
- `CRON_SECRET`

Never expose server-only values through `NEXT_PUBLIC_` variables. Configure Preview and Production separately.

## Supabase deployment

1. Create or link the production project.
2. Apply every migration in timestamp order through `20261106001600_handoff_callback_contact_guard.sql`.
3. Do not use local example seed values as production company or pricing configuration.
4. Provision real `application_settings`, pricing parameters, dispatch recipient, hand-off recipient map, support number, and messages through a controlled operator process.
5. Run `supabase db lint --linked --level warning` and the pgTAP suite against an isolated target.
6. Configure backups/PITR and retention/cleanup for expired sessions and verification records.
7. Verify all RLS policies using anon, customer-session, each admin role, and service-role contexts.

## Dependency and framework risk

The lockfile resolves Next.js 14.2.35, React 18.3.1, and Node 22-compatible Supabase packages. As of this review:

- `npm audit --package-lock-only --omit=dev` reports 7 production advisories.
- The Next.js finding has no security-clean 14.x upgrade.
- Zod and Resend fixes require major-version migrations.
- Full audit reports 33 advisories, including development tooling.

Do not run `npm audit fix --force`; it would perform unreviewed major upgrades. Schedule a dedicated migration to a supported Next.js/React combination, Zod 4, current Resend, and current test/lint tooling. Keep the application behind controlled traffic until the critical framework advisory is resolved or formally risk-accepted with compensating controls.

## Launch blockers

- [ ] Clean Supabase migration, DB lint, and pgTAP run passes
- [ ] Critical/high production dependency advisories are remediated or formally accepted
- [ ] Live staging smoke tests pass for Google, Stripe, Upstash, Resend, and Vercel Cron
- [ ] Add deployment-level bot mitigation for booking writes; application-level per-IP/session rate limits are implemented, but edge protection is still required
- [ ] Trusted proxy/client-IP behavior is verified on Vercel
- [ ] Admin sign-in/recovery is available and role behavior is staging-tested
- [ ] Notification queue, webhook errors, payment mismatch events, and dead letters have production alerts
- [ ] Content Security Policy is designed and tested with Google Maps and Stripe
- [ ] Accessibility audit is completed with keyboard, screen reader, contrast, and automated tooling; responsive Playwright checks alone are insufficient
- [ ] Real company contacts, service area, pricing version, sender identities, and dispatch recipients are approved
- [ ] All intended files and migrations are committed before Git-connected deployment

## Release commands

Run from the project root with Node 22 and a running local Supabase stack:

```sh
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run test:e2e
npm run db:lint
npm run db:test
npm audit --package-lock-only --omit=dev
```

After `npm run build`, scan `.next/static` for server-only variable names and secret values. Never copy secrets into test snapshots, browser bundles, logs, or deployment documentation.
