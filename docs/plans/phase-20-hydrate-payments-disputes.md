# Phase 20 — Hydrate Payments & Disputes onto Job

**Goal:** After `listJobs` / `getJob` / poll, attach payment + dispute (+ rating) from their tables onto `Job` so Ops/Tracking/Rating stay correct across refresh and accounts.

**Sources:** Phase 15 writes `payments` / `disputes` / `ratings`; `LOCAL_ONLY_JOB_FIELDS` only preserves them in the sender’s React state.

---

## Scope

**In:**
- Batch-hydrate `payment_*`, `tip_amount`, `rating`, `dispute_*` in Supabase JobService list/get (and lifecycle re-fetch)
- Narrow `LOCAL_ONLY_JOB_FIELDS` to photo URL fallback only
- Docs + build smoke

**Out:** Payment gateway, FIR PDF, strict ops RBAC, schema changes (tables already exist).

---

## Acceptance

- [x] File dispute → soft-refresh / other account Ops still shows `dispute_type`
- [x] Record payment → soft-refresh Rating still shows paid
- [x] `pnpm build` clean
