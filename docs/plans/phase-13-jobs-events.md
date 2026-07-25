# Phase 13 — Jobs CRUD + Accept Race + Job Events

**Goal:** When `VITE_DATA_ADAPTER=supabase`, persist job create / list / get / accept to Postgres with an append-only `job_events` timeline and an **atomic** accept. Payments, trust, photos, and the in-flight lifecycle pages stay on mocks until Phase 14+.

**Sources of truth:**

- [`notes/phase-12-summary.md`](../../notes/phase-12-summary.md) — auth/org adapters + hybrid registry
- [`docs/architecture/production-architecture.md`](../architecture/production-architecture.md) — Step E (jobs + accept race + `job_events`)
- [`docs/architecture/data-access-layer.md`](../architecture/data-access-layer.md) — `JobService` seam
- [`docs/database/schema-v1.md`](../database/schema-v1.md) — `jobs`, `job_events` columns
- [`supabase/migrations/0001_initial_schema.sql`](../../supabase/migrations/0001_initial_schema.sql) — tables + enums
- [`supabase/migrations/0002_auth_profile_and_rls.sql`](../../supabase/migrations/0002_auth_profile_and_rls.sql) — auth trigger, membership RPC, users/orgs RLS
- [`.cursor/rules/mvp-locked-fields.mdc`](../../.cursor/rules/mvp-locked-fields.mdc) — preserve Post Request UI

---

## Out of scope (Phase 13)

- Supabase `PaymentService` / `TrustService` adapters (stay mock)
- Photos / Storage, KYC, real payments, FIR persistence
- Wiring ActiveDelivery / Tracking / Rating lifecycle writes to Supabase (they may keep `setJobs` locally for in-flight jobs until Phase 14)
- Retiring the `mockJobs` seed in mock mode
- Redesigning Post Request UI (job types, location types, editable offer price stay exactly as-is)

---

## Slice map

| Slice | Deliverable | Status |
|-------|-------------|--------|
| **13.1** | This plan | done |
| **13.2** | `0003_jobs_rls_and_accept.sql` — jobs/`job_events` RLS, `append_job_event`, `accept_job` RPC | done |
| **13.3** | `jobMappers.ts` — row ↔ domain `Job`, confirmation-code handling | done |
| **13.4** | `supabaseJobService.ts` — list/get/create/accept | done |
| **13.5** | Registry: jobs adapter in supabase mode | done |
| **13.6** | Wire Post Request create + AppContext hydrate on login | done |
| **13.7** | Wire Runner Feed list + accept race | done |
| **13.8** | `notes/phase-13-summary.md` | done |

---

## Auth / data flow

```
Post Request → services.jobs.createJob(job)
  → resolve organization_id from caller's active organization_members row
  → INSERT jobs (confirmation_code_hash, NOT raw code)
  → append_job_event(status_changed { to: OPEN })
  → return domain Job (uuid id, server timestamps)

Runner Feed → services.jobs.listJobs()
  → SELECT jobs in caller's org (+ sender/runner name joins)
  → confirmation_code returned ONLY to the sender of that job; never the hash

Runner accept → services.jobs.acceptJob(jobId, runner)
  → accept_job(p_job_id) RPC (SECURITY DEFINER)
    → UPDATE jobs SET status='MATCHED', runner_id, matched_at, agreed_price=posted_price
      WHERE id=p_job_id AND status='OPEN' AND runner_id IS NULL
    → 0 rows updated ⇒ conflict (already matched) → surface gracefully
    → append_job_event(status_changed { from: OPEN, to: MATCHED })
```

---

## Confirmation code rule (privacy)

- DB stores `confirmation_code_hash` only (never the raw 4-digit code).
- Domain `Job.confirmation_code` is populated **only** when the caller is the job's sender (for the Tracking "give this to your runner" card).
- List / feed queries never select the hash and never return codes for other users' jobs.

---

## Accept race

Single-statement conditional UPDATE inside `accept_job` guarantees only one runner wins:

```sql
UPDATE public.jobs
SET status = 'MATCHED', runner_id = <me>, matched_at = now(), agreed_price = posted_price
WHERE id = p_job_id AND status = 'OPEN' AND runner_id IS NULL
RETURNING ...;
```

If no row is returned, the job was already matched → client shows "already taken" and refreshes the feed. Client still runs `canRunnerSeeJob` before calling, but the server is the source of truth.

---

## MVP locked fields (must remain on Post Request)

- Job type selector (`campus_immediate` / `campus_scheduled` / `intercity`) with locked definitions
- `campus_scheduled` window + `intercity` (`travel_date`, `corridor_landmark`, `receiver_phone`) conditional fields
- Pickup/drop location types (`general` / `mens_hostel` / `womens_hostel`) + mixed-gender rejection
- System floor + editable `posted_price` (≥ floor)
- Food "already ordered and ready" ack

Only the **write path** changes (`setJobs` → `services.jobs.createJob`). No UI/field removals.

---

## Mock mode (default)

With `VITE_DATA_ADAPTER` unset or `mock`, the app runs exactly as today: `mockJobs` seed, `__rushbuddyDev` helpers, in-memory `setJobs`. No regression.

---

## Acceptance criteria

- [ ] `0003_jobs_rls_and_accept.sql` applies on `npx supabase db reset`
- [ ] `VITE_DATA_ADAPTER=mock` → zero behavior change
- [ ] Supabase mode: posting a job inserts a `jobs` row + a `job_events` `status_changed` row (uuid id, not `JOB-24xx`)
- [ ] Supabase mode: accept is atomic; a second accept of the same job fails gracefully
- [ ] Sender sees `confirmation_code`; runner feed/list never exposes the hash or other users' codes
- [ ] Post Request MVP-locked fields all preserved
- [ ] `notes/phase-13-summary.md` written

---

## Validation

1. `npx supabase db reset` (Docker running) — applies `0001` + `0002` + `0003` + seed.
2. Mock mode smoke: post → simulate → rate/dispute unchanged.
3. Supabase mode: sign in (User A), post a job, confirm rows in Studio (`jobs`, `job_events`).
4. Sign in as User B (incognito), accept the job; confirm `MATCHED` + second event.
5. Attempt double-accept (User C) → graceful failure.
6. `cd app && pnpm build`.

---

## Related docs

| Doc | Role |
|-----|------|
| [`schema-v1.md`](../database/schema-v1.md) | Column plan for `jobs` / `job_events` |
| [`supabase-local-setup.md`](../database/supabase-local-setup.md) | `db reset` + local keys |
| [`data-access-layer.md`](../architecture/data-access-layer.md) | Migration step E |
| [`notes/phase-13-summary.md`](../../notes/phase-13-summary.md) | What shipped |
