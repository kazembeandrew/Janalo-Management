# Accounting Backend Recommendations

This repo contains a clean-architecture prototype under `backend/` (see `backend/src/main.ts`). The active runtime server is currently `server.ts` at the repo root.

## Recommendations (High Value)

1. Install real backend dependencies if you intend to run `backend/src/main.ts`.
   - Current TypeScript builds are satisfied via stubs in `backend/src/types/external-modules.d.ts`.
   - For production use, install and wire real packages:
     - `zod` (request validation)
     - `apollo-server-express` (GraphQL)
     - `swagger-jsdoc` and `swagger-ui-express` (OpenAPI docs)

2. Persist async job status/results.
   - `backend/src/infrastructure/async/JobProcessor.ts` keeps job state in memory.
   - If you need reliable job status across restarts, store jobs in Postgres (Supabase) and have workers update progress/results.

3. Consolidate the accounting API surface.
   - Prefer the versioned endpoints under `/api/accounting/v1/*`.
   - Keep the unversioned routes as thin compatibility wrappers, or delete them once clients migrate.

4. Define a typed Supabase `Database` schema for the frontend.
   - `src/integrations/supabase/client.ts` creates an untyped client; this pushes `any` into the UI.
   - Generate `Database` types (Supabase CLI) and use `createClient<Database>(...)` to stabilize UI typings.

5. Prefer SCAN-based key invalidation patterns and bounded keyspaces.
   - Pattern deletes now use `SCAN` in `backend/src/infrastructure/cache/RedisCache.ts`.
   - Keep key prefixes (`REDIS_KEY_PREFIX`) and TTLs set so invalidation stays bounded.

6. Align runtime accounting operations with DB-level atomicity.
   - The production audit files already recommend RPC-based atomic operations.
   - If you move posting/repayment/disbursement into backend APIs, keep the DB as the source of truth for integrity (transactions, idempotency, locks).

