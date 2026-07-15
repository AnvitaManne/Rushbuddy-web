# Phase 10 Summary — Data Access Layer + Mock Adapter

## 1. Goal of the phase

Phase 10 = introduce a **service boundary** so the UI can later move from AppContext mock state to Supabase without a rewrite.

- No Supabase client, real auth, payments, or KYC.
- Keep `AppContext` working; keep app behavior unchanged except for one wired flow.
- Add service interfaces + in-memory mock adapters first.
- Wire **one** small flow (runner accept) through `services.jobs.acceptJob`.

Sources: `notes/phase-9-summary.md`, `docs/architecture/production-architecture.md`, `docs/database/schema-v1.md`, `app/src/domain/types.ts`, `AppContext`.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `docs/architecture/data-access-layer.md` | Layering, async interfaces, mock→Supabase path, deferred surfaces |
| `app/src/services/types.ts` | `AuthService`, `JobService`, `PaymentService`, `TrustService`, `OrganizationService` |
| `app/src/services/mock/mockJobService.ts` | In-memory job lifecycle ops (accept, pickup, handoff, no-answer, close) |
| `app/src/services/mock/mockPaymentService.ts` | Payment intent on `Job` fields; `getAllowedPaymentMethods` |
| `app/src/services/mock/mockTrustService.ts` | Events + runner records; `suspendRunner` / `unsuspendRunner` |
| `app/src/services/index.ts` | `createMockServices()` + `services` registry; `bindMockJobStore` |
| `notes/phase-10-summary.md` | This file |

### Changed (minimal wire)

| File | Change |
|------|--------|
| `AppContext.tsx` | Bind React `jobs` into mock job/payment store |
| `RunnerFeedPage.tsx` | Accept uses `services.jobs.acceptJob` |

### Not done

- No Supabase SDK / migrations / RLS
- No mass UI migration off `setJobs`
- Auth/org mocks are stubs only (seed `vit-vellore` in org stub)

### Slice map

| Slice | Deliverable |
|-------|-------------|
| **10.1** | Data access layer architecture doc |
| **10.2** | Service interface types |
| **10.3** | Mock job service |
| **10.4** | Mock trust + payment services |
| **10.5** | Adapter registry (`services`) |
| **10.6** | Wire runner accept only |
| **10.7** | Phase summary |

---

## 3. Important concepts / architecture decisions

- **UI / domain / services:** Domain stays pure; services are async persistence-shaped APIs; pages should not import Supabase/mocks directly long-term.
- **AppContext remains** the live job/trust session store; mocks share jobs via `bindMockJobStore` (no second source of truth after bind).
- **Registry:** `export const services = createMockServices()` — later swap on env (`supabase` vs mock) in one place.
- **God-`Job` still mock-era:** Payment service still patches fields on `Job`; named intents (`recordPayment`) ready for `payments` table later.
- **One-flow rule:** Only runner accept is wired; other pages still use `setJobs` / trust helpers directly.

---

## 4. Validation steps

1. Confirm files under `app/src/services/` and `docs/architecture/data-access-layer.md` exist.
2. Runner feed: accept an OPEN job → status becomes MATCHED, navigates to active delivery (same as before).
3. Confirm no other pages import `@/services` yet (only RunnerFeed + AppContext bind).
4. Optional: `cd app && pnpm build`.

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| Singleton `services` held an empty job array disconnected from React | `jobStoreFacade` + `bindMockJobStore` from AppProvider |
| Auth/Org interfaces needed for `AppServices` without dedicated mock modules | Lightweight stubs in `index.ts` (VIT seed org) |
| Payment still on `Job` vs future `payments` table | `JobPaymentRecord` DTO + mock patches job fields |

---

*Next: more flows through services, then migrations / Supabase adapters. Keep MVP locked fields when touching Auth/Post.*
