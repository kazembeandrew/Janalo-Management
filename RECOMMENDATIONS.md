# Janalo Management — Recommendations

This document provides prioritized recommendations to stabilize and improve the app after a quick technical and product review.

## Executive summary

The app has strong feature coverage (loan lifecycle, accounting, administration, analytics), but it should prioritize **stability and architecture alignment** before adding more features.

---

## Priority 0 (Immediate: 1–3 days)

### 1) Restore a green TypeScript baseline
- Fix all current compile/type errors first.
- Add missing dependencies and typings used by backend modules:
  - `zod`
  - `swagger-jsdoc`
  - `swagger-ui-express`
  - `apollo-server-express`
- Resolve currently reported typing issues in:
  - accounting routes (`string | string[]` mismatch)
  - enhanced validation union narrowing
  - readonly mutation in `Permission`
  - `void` vs `JournalEntry` return contracts
  - `ioredis` options compatibility
  - missing symbols in repositories
  - frontend page type mismatches

**Why this matters:** Every future change is risky while the baseline build is red.

### 2) Decide and document the "real backend"
- Choose one of these paths:
  1. Keep `server.ts` as the production backend and move aspirational clean-architecture backend into a separate package/workspace, or
  2. Complete migration to `backend/src/main.ts` and retire root `server.ts`.
- Update README to clearly state active runtime path and supported commands.

**Why this matters:** Two backend entry points creates confusion and operational drift.

---

## Priority 1 (Near term: 1–2 weeks)

### 3) Add basic CI gates
- Add CI workflow with:
  - install
  - `npm run lint`
  - `npm run build`
- Block merges on failing checks.

### 4) Strengthen API contracts
- Introduce request/response schemas (Zod) on all mutation endpoints.
- Add a consistent error envelope and shared HTTP error mapper.

### 5) Improve observability
- Add structured request IDs and correlate logs across frontend ↔ backend.
- Add health/readiness checks for DB and cache dependencies.

---

## Priority 2 (Medium term: 2–4 weeks)

### 6) Data model and typing hardening
- Generate and use Supabase typed client models end-to-end.
- Reduce `any[]` usage in key pages (especially dashboard/statistical views).
- Create domain DTO types for charts and aggregates.

### 7) Security and permission model cleanup
- Centralize role checks (avoid ad-hoc role lists in handlers).
- Add audit events for admin-sensitive actions (role changes, password resets).
- Review request sanitization and SQL-injection middleware to avoid false positives and broken legitimate requests.

### 8) UX reliability improvements
- Add route-level loading and error boundaries for all lazy pages.
- Add explicit empty/error states for dashboard queries and realtime subscriptions.

---

## Suggested implementation sequence

1. Green TypeScript build.
2. Backend architecture decision + README correction.
3. CI gates and branch protections.
4. Contract/schema standardization.
5. Observability + audit trail.
6. Type-hardening and UX reliability pass.

---

## Success criteria

- `npm run lint` passes with zero TypeScript errors.
- Single documented backend entry point.
- CI blocks regressions.
- Consistent API validation and error format.
- Reduced production support load from typing/runtime inconsistencies.
