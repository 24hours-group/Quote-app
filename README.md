# Roadside Quote App

A production-oriented self-service roadside quote and booking application. The customer UI implements the PDF-defined mobile-first screen flow with mock address, verification, quote, and payment providers; the normalized Supabase schema and secure server boundaries are ready for later API integration.

> The referenced “Roadside Quote App — Screen Flow v1.0” PDF was not available as a repository file during this unit. The required route flow is represented by accessible foundation screens; detailed screen implementation should be aligned to the PDF in the next approved unit.

## Stack

- Next.js 14 App Router, React, and JavaScript
- Tailwind CSS and Material UI
- Supabase PostgreSQL/Auth clients
- Google Maps JavaScript, Places (New), Geocoding, and Routes integration boundaries
- Upstash Redis, Stripe, Twilio Verify, and Resend server factories
- React Hook Form and Zod
- Vitest, Testing Library, and Playwright

## Requirements

- Node.js 20.9 or later
- npm 10 or later recommended

## Setup

```bash
npm install
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

| Route                  | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `/book`                | Customer quote-flow foundation                          |
| `/booking/[reference]` | Secure booking-status placeholder                       |
| `/payment/success`     | Stripe return-route placeholder; never proof of payment |
| `/admin`               | Admin foundation                                        |
| `/admin/settings`      | Central settings preview                                |
| `/api/health`          | Structured application health response                  |

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
    booking/               Config-driven wizard, fields, screens, hooks, mocks, and schemas
    admin/                 Admin components and authorization policy
    pricing/               Server-authoritative pricing policy boundary
  lib/
    cache/                 Upstash Redis factory
    env/                   Client and server Zod environment validation
    integrations/          Google Maps, Stripe, Twilio, and Resend boundaries
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
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

The Supabase anonymous key is public by design and must be constrained with Row Level Security. Restrict the Google browser key by HTTP referrer and enabled APIs.

### Server-only variables

Never import these into Client Components:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_SERVER_API_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

Server validation lives in `src/lib/env/server.js`, which imports `server-only`. Browser validation explicitly enumerates public values in `src/lib/env/client.js`; it never spreads `process.env` into client code.

## Security foundation

- Security response headers are configured in `next.config.js`.
- Supabase service-role access has a dedicated server-only factory.
- Every application table has forced RLS and explicit role policies.
- Guest sessions have no browser policy and are loaded server-side using only SHA-256 token hashes.
- Admin pages currently contain no sensitive data. Wire Supabase Auth session checks into routes before exposing database-backed admin functionality.
- Stripe return routes must never mark payments successful; signed webhooks and server reconciliation are required.
- Provider webhooks must verify signatures and be idempotent.
- Upstash rate limits should protect quote, verification, booking, login, and webhook-sensitive endpoints.

## Deferred by design

The following are explicitly outside this unit:

- quote calculation and pricing rules
- Google Places widgets, geocoding, route calculation, and maps
- production API orchestration for secure booking persistence
- server pricing calculation and payment provider execution
- admin authentication screens and operations
- Stripe Checkout and webhooks
- Twilio verification
- Resend transactional email
- production observability and deployment configuration

Implement these as separate reviewed units using the existing boundaries. Do not put provider calls or database queries directly in page components or route handlers.
