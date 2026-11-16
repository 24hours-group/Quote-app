# Roadside Quote App

A production-oriented self-service roadside quote and booking application. The customer UI implements the PDF-defined mobile-first screen flow with secure Supabase booking sessions, US/NANP contact formatting, Google location and route services, server-authoritative pricing, Stripe Payment Intents, and durable Resend delivery.

The business flow and initial pricing policy are defined by `docs/Roadside_Quote_App_Screen_Flow_v1.0.pdf` and its text counterpart.

## Stack

- Next.js 14 App Router, React, and JavaScript
- Tailwind CSS and Material UI
- Supabase PostgreSQL/Auth clients
- Google Maps JavaScript, Places (New), Geocoding, and Routes integration boundaries
- Upstash Redis, Stripe, and Resend server factories
- React Hook Form and Zod
- Vitest, Testing Library, and Playwright

## Requirements

- Node.js 22 or later
- npm 10 or later recommended

## Setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Provider credentials are not needed to render the foundation routes. Each integration validates its environment variables when its server-only factory is invoked.

## Commands

```bash
npm run dev          # Start local development
npm run build        # Create a production build
npm run start        # Serve the production build
npm run lint         # Run Next.js ESLint checks
npm run format       # Format the repository
npm run format:check # Check formatting
npm test             # Run Vitest once
npm run test:watch   # Run Vitest in watch mode
npm run test:e2e     # Run Playwright (install browsers first)
npm run db:start     # Start local Supabase (Docker required)
npm run db:reset     # Apply migrations and local seed
npm run db:lint      # Lint the local database
npm run db:test      # Run pgTAP database/security tests
```

Install Playwright browsers once with:

```bash
npx playwright install
```

## Routes

| Route                                 | Purpose                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `/book`                               | Customer quote-flow foundation                                |
| `/booking/[reference]`                | Session-authorized paid-booking confirmation                  |
| `/payment/success`                    | Server-reconciled Stripe return route; never proof of payment |
| `/admin`                              | Supabase-authenticated admin foundation                       |
| `/admin/settings`                     | Role-gated central settings preview                           |
| `/api/health`                         | Structured application health response                        |
| `/api/booking/session`                | Server-mediated booking draft create/load/update/revoke       |
| `/api/booking/contact`                | Session-authorized US contact normalization and attachment    |
| `/api/booking/location/*`             | Server geocoding and location confirmation endpoints          |
| `/api/booking/route`                  | Protected Google Routes calculation                           |
| `/api/booking/quote`                  | Protected authoritative quote generation                      |
| `/api/booking/payment/*`              | Session-authorized Payment Intent creation and status         |
| `/api/booking/handoff`                | Session-authorized durable human hand-off lead creation       |
| `/api/webhooks/stripe`                | Signed, idempotent Stripe payment events                      |
| `/api/internal/notifications/process` | Authenticated durable outbox worker                           |

`/` redirects to `/book`.

## Architecture

```text
src/
  app/                     App Router pages, layouts, boundaries, API handlers
    (customer)/            Customer route group
    admin/                 Admin routes (must be auth-protected before real data)
    api/                   Thin HTTP transport layer
  components/
    feedback/              Loading, empty, error, and notification states
    forms/                 React Hook Form + Material UI fields
    layout/                App shell and root providers
    ui/                    Buttons, cards, dialogs, and progress primitives
  config/                  Locale, currency, country, company, routes, availability
  features/
    booking/               Config-driven wizard, secure persistence, fields, providers, and schemas
    admin/                 Admin components and authorization policy
    pricing/               Versioned pricing engine, quote service, repository, and client hook
    payment/               Stripe Payment Element, orchestration, webhook, and status boundaries
    notifications/         Durable outbox worker, provider adapters, and versioned templates
    handoff/               Reason routing, validation, persistence client, hook, and R screen
  lib/
    cache/                 Upstash Redis factory
    env/                   Client and server Zod environment validation
    integrations/          Google Maps, Stripe, and Resend boundaries
    supabase/              Browser, authenticated server, and admin clients
    http.js                Consistent API response helpers
  styles/                  Global styles and Material UI theme
supabase/
  migrations/              Versioned PostgreSQL schema and security changes
  tests/                   pgTAP schema, RLS, and invariant tests
  seed.sql                 Deterministic local-only settings and pricing
  DATABASE.md              Schema, policy, and idempotency documentation
tests/
  unit/                    Vitest tests
  e2e/                     Playwright tests
```

Pages compose feature components; they do not contain business logic. Future API handlers should follow:

```text
route handler → Zod validation → auth/authorization → feature service
→ repository/provider → response mapper
```

Pricing, route distance, availability, booking creation, and payment state must always be recalculated or verified on the server. Client totals and redirect query parameters are untrusted.

## Material UI and Tailwind

Material UI owns component primitives and its `CssBaseline` owns browser normalization. Tailwind `preflight` is disabled to prevent competing resets. Tailwind utilities are composed in CSS Modules with `@apply` for layout and visual sections. MUI’s App Router cache provider is configured in `src/components/layout/Providers.js` for server-rendered styles.

## Configuration and localization

`src/config/application.js` centralizes:

- `USD` currency
- `en-US` locale
- United States address region
- `America/New_York` default timezone
- company contact details
- service availability flags

Use integer cents for money. The shape is intentionally locale-aware so country, currency, timezone, and address behavior can later be selected by deployment or tenant rather than scattered through components.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

### Public browser variables

Only these values may use the `NEXT_PUBLIC_` prefix:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_PHONE`, `NEXT_PUBLIC_COMPANY_EMAIL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_COUNTRY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

The Supabase anonymous key is public by design and must be constrained with Row Level Security. Restrict the Google browser key by HTTP referrer and enabled APIs.

### Server-only variables

Never import these into Client Components:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_SERVER_API_KEY` (restricted to server-side Geocoding, Time Zone, and Routes APIs)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `PAYMENT_SIMULATION_ENABLED` (optional; development/test only)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a sender verified in Resend)
- `NOTIFICATION_WORKER_SECRET` (at least 32 random characters)
- `CRON_SECRET` (at least 32 random characters; Vercel uses it for scheduled worker requests)

Server validation lives in `src/lib/env/server.js`, which imports `server-only`. Browser validation explicitly enumerates public values in `src/lib/env/client.js`; it never spreads `process.env` into client code.

### Local payment simulation

When Stripe is not configured outside production, the accepted-quote checkout automatically uses a clearly labeled payment simulator. Set `PAYMENT_SIMULATION_ENABLED=true` to force simulation locally even when test Stripe keys exist, or `false` to require Stripe. Simulation cannot be enabled when `NODE_ENV=production`.

The simulator never accepts an amount from the browser. It authorizes the payment identifier against the accepted server quote, then completes the local wizard with an explicit simulation-only result. It does not charge a card, mark the database payment as succeeded, create a real booking, or notify dispatch. Simulated results must never be used as proof of payment.

## Security foundation

- Security response headers are configured in `next.config.js`.
- Supabase service-role access has a dedicated server-only factory.
- Every application table has forced RLS and explicit role policies.
- Guest sessions have no browser policy. A random 256-bit token remains in a secure HttpOnly cookie, only its SHA-256 hash is stored, and updates use optimistic concurrency.
- Admin routes require a valid Supabase Auth user with an active `admin_profiles` role; database RLS remains the final authorization boundary.
- Stripe return routes never mark payments successful; signed webhooks and server reconciliation are authoritative.
- Verified payment, booking creation, and outbox enqueue occur in one idempotent database transaction.
- Notification workers use `FOR UPDATE SKIP LOCKED`, expiring leases, provider idempotency, bounded retries, dead-letter alerts, and redacted audits.
- Hand-off leads derive team, priority, paid/unpaid classification, and contact verification in PostgreSQL. Lead creation and its team notification are one idempotent transaction.
- Hand-off notification recipients use `application_settings.messages.handoff_team_emails` keys (`dispatcher`, `job_owner`, `heavy_duty`, or `specialist`) when configured, otherwise the configured `dispatch_email` central inbox is used. No contact address is invented.
- S2 validates US/NANP formatting server-side and stores the contact as unverified; it does not send OTP or SMS messages.

## Deferred by design

The following remain deferred:

- admin authentication screens and operations
- driver assignment and dispatch operations (handled by the human dispatch team)
- production observability and deployment-specific worker scheduling

Implement these as separate reviewed units using the existing boundaries. Do not put provider calls or database queries directly in page components or route handlers.

## Production readiness

See `docs/PRODUCTION_CHECKLIST.md` for verified test evidence, Vercel and provider configuration, dependency risks, staging checks, and launch blockers.
