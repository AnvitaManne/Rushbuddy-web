# Phase 13 Summary — Jobs CRUD + Accept Race + Job Events

## 1. Goal of the phase

Persist the job core loop to Postgres when `VITE_DATA_ADAPTER=supabase`: create / list / get jobs, an **atomic** accept, and an append-only `job_events` timeline. Payments, trust, photos, and the in-flight lifecycle stay mock/local until later phases.

- Post Request create → `services.jobs.createJob` (INSERT under RLS)
- Runner Feed accept → `accept_job` RPC (single-winner, race-safe)
- AppContext hydrates real jobs after login; mock mode unchanged
- Preserve every MVP-locked Post Request field

Sources: `docs/plans/phase-13-jobs-events.md`, `notes/phase-12-summary.md`, `docs/database/schema-v1.md`, `.cursor/rules/mvp-locked-fields.mdc`.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `docs/plans/phase-13-jobs-events.md` | Slice map, accept-race design, privacy/MVP locks, acceptance |
| `supabase/migrations/0003_jobs_rls_and_accept.sql` | Caller-id helpers, `append_job_event`, create-event trigger, atomic `accept_job`, jobs/`job_events` RLS, denormalized party columns |
| `app/src/services/supabase/jobMappers.ts` | Row ↔ domain `Job`, insert/patch mappers, confirmation-code helpers |
| `app/src/services/supabase/supabaseJobService.ts` | `JobService` on Supabase (list/get/create/update/accept/remove) |
| `app/.env.local` | Local Supabase URL + anon key + `VITE_DATA_ADAPTER=supabase` (gitignored) |
| `scripts/accept_race_test.sql` | DB-level two-runner accept-race regression test |
| `notes/phase-13-summary.md` | This file |

### Changed

| File | Change |
|------|--------|
| `app/src/services/supabase/index.ts` | Export job service + mappers |
| `app/src/services/index.ts` | `createSupabaseServices()` now uses `createSupabaseJobService` |
| `app/src/app/context/AppContext.tsx` | Supabase mode seeds empty jobs; hydrates via `listJobs()` on login/restore |
| `app/src/app/components/pages/PostRequestPage.tsx` | Create goes through `services.jobs.createJob`; removed local `setJobs`/artificial delay; error surfacing |
| `app/src/app/components/pages/RunnerFeedPage.tsx` | Accept updates local state, sets active job, and refreshes feed + shows notice on lost race |

### Slice map (canonical)

| Slice | Deliverable | How it shipped |
|-------|-------------|----------------|
| **13.1** | Phase plan | `docs/plans/phase-13-jobs-events.md` |
| **13.2** | Jobs RLS + accept RPC + events | `0003_jobs_rls_and_accept.sql` |
| **13.3** | Job mappers | `jobMappers.ts` |
| **13.4** | Supabase JobService | `supabaseJobService.ts` |
| **13.5** | Registry swap | `createSupabaseServices` uses job adapter |
| **13.6** | Post Request create + hydrate | PostRequestPage + AppContext |
| **13.7** | Runner Feed list + accept race | RunnerFeedPage |
| **13.8** | Phase summary | This file |

### Not done (deferred)

- Supabase payment / trust / photo adapters + their RLS
- Wiring ActiveDelivery / Tracking / Rating lifecycle writes to Supabase (still local `setJobs`)
- Confirmation-code hashing at rest (pilot stores plaintext, sender-only read)
- Retiring the `mockJobs` seed in mock mode

---

## 3. Important concepts / architecture decisions

- **Atomic accept:** `accept_job(p_job_id)` does one conditional `UPDATE ... WHERE status='OPEN' AND runner_id IS NULL`. Zero rows updated ⇒ `RAISE EXCEPTION` (SQLSTATE `55000`) ⇒ client returns `null` and refreshes the feed. Proven with `scripts/accept_race_test.sql` (B wins, C fails).
- **Append-only events:** create writes `status_changed → OPEN` via an `AFTER INSERT` trigger; accept appends `OPEN → MATCHED`. No client INSERT policy on `job_events`; all writes are SECURITY DEFINER.
- **Confirmation-code privacy:** stored in `confirmation_code_hash` (plaintext for pilot). Feed/list projections never select it; it is returned only for the caller's own jobs (sender). `accept_job` returns **only the job id** so the runner never receives the code.
- **Denormalized party fields (pilot):** `users` RLS lets a user read only their own row, so a runner can't JOIN the sender's name (and gender must stay hidden). `jobs` carries `sender_name/hostel` + `runner_name/rating/hostel`; `accept_job` fills runner fields. TODO: normalize behind a gender-safe view later.
- **Tenant RLS:** `jobs` / `job_events` scoped by `current_app_user_org_id()`; sender inserts own job into own org; sender/runner may update their own jobs; atomic accept bypasses via SECURITY DEFINER.
- **Hybrid registry unchanged for mock:** default adapter still runs the in-memory demo (mockJobs, `__rushbuddyDev`).

---

## 4. Validation steps

1. `npx supabase db reset` (Docker running) — applies `0001` + `0002` + `0003` + seed. Confirm `accept_job`, `append_job_event`, `current_app_user_id/org_id`, `log_job_created` exist and RLS/policies on `jobs` + `job_events`.
2. Accept-race DB test: `Get-Content scripts/accept_race_test.sql -Raw | docker exec -i supabase_db_rushbuddy-web psql -U postgres -d postgres` → B wins, C fails "no longer open", 2 events.
3. `cd app && pnpm build` → clean.
4. Mock mode (`VITE_DATA_ADAPTER=mock`): demo jobs + post/accept unchanged.
5. Supabase mode (`.env.local`): sign in with a `@vitstudent.ac.in` email (OTP via Mailpit `http://127.0.0.1:54324`), post a job → row in `jobs` + `status_changed OPEN` in `job_events`; sender sees the code on Tracking. Second account accepts → `MATCHED` + second event; runner never sees the code.

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| `users` RLS blocks reading other users' name/hostel for feeds; gender must stay hidden | Denormalized `sender_*` / `runner_*` display columns on `jobs`; `accept_job` fills runner fields |
| `accept_job` returning `public.jobs` leaked the (plaintext) code to the runner | Changed RPC to `RETURNS uuid`; runner re-fetches via `getJob` (no code) |
| `listJobs` selecting the code column would leak other senders' codes over the wire | Two-query list: others without code, own jobs with code |
| Sender loses the 4-digit code across refresh if hashed | Pilot stores plaintext, returned sender-only (documented TODO to hash) |
| Accept-race SQL test showed "not authenticated" | JWT claim was statement-local under autocommit; wrapped each accept in a transaction with `SET LOCAL` |

---

*Next: lifecycle writes to Supabase (pickup/handoff/no-answer/close), then payment + trust adapters and photo/Storage. Keep MVP-locked Post Request fields and the confirmation-code privacy rule intact.*
