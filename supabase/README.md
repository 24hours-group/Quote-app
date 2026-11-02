# Supabase database

The Roadside Quote schema is managed exclusively through timestamped migrations in `migrations/`.

- See [`DATABASE.md`](DATABASE.md) for the data model, RLS matrix, immutable quote/payment rules, idempotency contracts, and operational guidance.
- `seed.sql` contains deterministic local-only application settings and sample pricing.
- `tests/` contains pgTAP schema, security-policy, and financial-invariant tests.
- `config.toml` configures the local Supabase stack.

With Docker running:

```bash
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
```

Never expose `SUPABASE_SERVICE_ROLE_KEY`, never store payment card details, and never add a browser policy for guest booking sessions. Guest access is mediated by trusted server code using a hash of an opaque 256-bit token.
