# Testing

```bash
npm run typecheck
npm test              # domain rules, encrypted store, sync queue
npm run test:db       # RLS, triggers, RPCs on real Postgres
npm run test:e2e      # iPhone-sized and desktop browser journeys
```

**Database tests** need a Postgres 15+ with `tests/db/supabase-shim.sql` then `supabase/migrations/*` applied. Set `TEST_DATABASE_URL` (default `postgres://postgres@localhost:54329/compandra`).

**Browser tests** also need PostgREST running against that database:
```bash
PGRST=/path/to/postgrest tests/e2e/start.sh &
npm run test:e2e        # PW_CHROME=/path/to/chrome to use a specific browser
```
The harness uses real Postgres and PostgREST, so RLS is genuine. Auth and Storage are stubs (Storage still enforces the real policies). OAuth and Realtime are not simulated, so test those manually with the checklist in `SETUP.md`.
