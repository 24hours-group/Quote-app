# Supabase database

The Roadside Quote schema is managed exclusively through timestamped migrations in `migrations/`.

- See [`DATABASE.md`](DATABASE.md) for the data model, RLS matrix, immutable quote/payment rules, idempotency contracts, and operational guidance.
- `seed.sql` contains deterministic local-only application settings; authoritative pricing is migration-managed.
- `tests/` contains pgTAP schema, security-policy, and financial-invariant tests.
- `config.toml` configures the local Supabase stack.

With Docker running:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or Redis tokens; never store OTP or payment card details; and never add a browser policy for guest booking sessions. Guest access is mediated by `/api/booking/session` using a secure HttpOnly 256-bit token; PostgreSQL stores only its SHA-256 hash and rejects stale draft versions.
