# Phase 14 — Runner Lifecycle Persistence + Cross-Account Sync

**Goal:** Persist the in-flight job lifecycle (pickup → handoff → delivered, plus no-answer / secure-drop / hold-for-ops / close) to Postgres, verify the handoff code **server-side**, and sync status across accounts in real time. Fixes: runner handoff failing (runner has no local code) and sender not seeing runner-side status changes.

**Sources:** `notes/phase-13-summary.md`, `docs/database/schema-v1.md`, `supabase/migrations/0003_jobs_rls_and_accept.sql`, `.cursor/rules/mvp-locked-fields.mdc`.

---

## Problem recap (from Phase 13 testing)

- `ActiveDeliveryPage` mutates only local React state (`setJobs`) — nothing persists or syncs.
- Runner's job carries an **empty** `confirmation_code` (privacy), so `codeInput === job.confirmation_code` always fails in Supabase mode. Verification must be server-side against `confirmation_code_hash`.
- Sender reads jobs from the DB (only OPEN/MATCHED persisted), so runner actions never appear.

---

## Scope

**In:** lifecycle transitions that live on `public.jobs` columns + `job_events`, server-side handoff verification, and Supabase Realtime sync.

**Out (Phase 15+):** payments, ratings, disputes/theft escalation, photos/Storage (these live in `payments` / `ratings` / `disputes` / `photos` tables). Photo capture stays local/mock for now.

---

## Lifecycle RPCs (migration 0005, all SECURITY DEFINER)

| RPC | Actor | Transition | Writes |
|-----|-------|-----------|--------|
| `acknowledge_pickup(job)` | runner | MATCHED → IN_TRANSIT | `pickup_confirmed_at`, `condition_acknowledged`; event `pickup_acknowledged` |
| `verify_handoff(job, code)` | runner | IN_TRANSIT → PENDING_RATING | compares `code` vs `confirmation_code_hash`; on ok: `delivered_at`, `dispute_window_ends_at = now()+2h`, `runner_payout_status='earned'`; events `handoff_code_success` + `status_changed`. On mismatch: `handoff_code_attempt` event + raise |
| `report_contact_attempt(job)` | runner | (no status change) | `no_answer_contact_attempts += 1`, `no_answer_at`; event `contact_attempt` |
| `resolve_secure_drop(job, loc)` | runner (Low risk only) | IN_TRANSIT → PENDING_RATING | `no_answer_resolution='secure_drop'`, `dropoff_secure_location`, `dropoff_geotag`, delivered/dispute-window/payout; event `secure_drop` |
| `hold_for_ops(job)` | runner (Fragile/Valuable) | IN_TRANSIT → ISSUE_REPORTED | `ops_notified`, `no_answer_resolution='hold_for_ops'`, payout earned; event `hold_for_ops` |
| `report_issue(job)` | runner | → ISSUE_REPORTED | `ops_notified`; event `status_changed` |
| `close_job(job)` | sender | PENDING_RATING/DELIVERED → CLOSED | `closed_at`; event `status_changed` |

All validate caller identity (`current_app_user_id()` = job's runner or sender) and current status; return the job id (never the code). Client re-fetches via `getJob` (runner sees no code).

## Cross-account sync (polling, not Realtime)

Supabase Realtime `postgres_changes` broadcasts **full rows** — including `confirmation_code_hash` — to every subscriber RLS allows, which would leak the code to runners. So instead of subscribing, AppContext (supabase mode) refetches via `listJobs` on window focus / tab-visible and on a 20s interval. `listJobs` already withholds other users' confirmation codes, so this path is privacy-safe. (`jobs` is added to `supabase_realtime` for future use once the code is isolated into its own table.)

---

## Service layer

Promote lifecycle methods to `JobService` (base interface): `acknowledgePickup`, `completeHandoff`, `reportNoAnswer`, `reportIssue`, `closeJob`. Mock already implements most (add `reportIssue`); Supabase adapter implements via the RPCs. Pages call `services.jobs.*` (works in both modes) and merge the returned job into state; Realtime covers the other account.

---

## Slice map

| Slice | Deliverable |
|-------|-------------|
| 14.1 | This plan |
| 14.2 | `0005_job_lifecycle_and_realtime.sql` |
| 14.3 | Extend `JobService` + `supabaseJobService` lifecycle methods (+ mock `reportIssue`) |
| 14.4 | Realtime subscription in AppContext |
| 14.5 | Wire ActiveDeliveryPage to `services.jobs.*` |
| 14.6 | Wire TrackingPage close + live status |
| 14.7 | Summary + DB lifecycle test |

## Acceptance

- [ ] Migration applies on `db reset`
- [ ] Runner enters the sender's code → server verifies → both accounts show PENDING_RATING (sender via Realtime)
- [ ] Wrong code → runner sees error, no transition
- [ ] No-answer secure-drop (Low) / hold-for-ops (Fragile) persist and sync
- [ ] Sender close → CLOSED syncs to runner
- [ ] Mock mode unchanged; `pnpm build` clean
- [ ] MVP-locked Post Request fields intact
