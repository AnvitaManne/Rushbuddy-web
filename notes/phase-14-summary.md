# Phase 14 — Runner Lifecycle Persistence + Cross-Account Sync

## Goal
Persist the in-flight job lifecycle to Postgres, verify the handoff code **server-side**, and sync status across accounts. Fixes the two Phase-13 testing bugs:
1. Runner handoff always failed (the runner's job carries an empty `confirmation_code` for privacy, so the old client-side `codeInput === job.confirmation_code` check could never pass).
2. Sender never saw runner-side status changes (lifecycle lived only in the runner's React state).

## What changed

### Database — `supabase/migrations/0005_job_lifecycle_and_realtime.sql`
Seven `SECURITY DEFINER` RPCs, each validating caller identity (`current_app_user_id()` = job's runner/sender) and current status, appending `job_events`, and returning the job id (never the code):

| RPC | Actor | Transition |
|-----|-------|-----------|
| `acknowledge_pickup` | runner | MATCHED → IN_TRANSIT |
| `verify_handoff(code)` | runner | IN_TRANSIT → PENDING_RATING (compares code vs stored value; raises `22023` on mismatch) |
| `report_contact_attempt` | runner | increments no-answer attempts |
| `resolve_secure_drop(loc)` | runner (Low risk) | IN_TRANSIT → PENDING_RATING + geotag/secure-drop evidence |
| `hold_for_ops` | runner (Fragile/Valuable) | IN_TRANSIT → ISSUE_REPORTED |
| `report_issue` | runner | → ISSUE_REPORTED |
| `close_job` | sender | → CLOSED |

`verify_handoff`/handoff success sets `delivered_at`, `dispute_window_ends_at = now()+2h`, `runner_payout_status='earned'`. Grants `EXECUTE` to `authenticated` only. Adds `public.jobs` to the `supabase_realtime` publication (reserved for future use).

### Service layer
- `app/src/services/types.ts` — promoted lifecycle methods onto the base `JobService` (`acknowledgePickup`, `completeHandoff`, `reportNoAnswer`, `reportIssue`, `closeJob`) + shared `ReportNoAnswerInput`.
- `app/src/services/supabase/supabaseJobService.ts` — implemented each via the RPCs; a `callLifecycleRpc` helper re-fetches the runner view (no code) after each call. `completeHandoff` returns `null` on a wrong code so the UI keeps its 3-attempt lockout.
- `app/src/services/mock/mockJobService.ts` — `MockJobService` is now just `JobService`; added `reportIssue`. Mock behaviour unchanged.

### Cross-account sync — polling, not Realtime
`app/src/app/context/AppContext.tsx` refetches jobs via `listJobs` on focus / tab-visible / every 20s (supabase mode). Realtime `postgres_changes` was **rejected** because it broadcasts full rows (including the confirmation code) to any org member; `listJobs` withholds other users' codes and is privacy-safe.

### Pages
- `ActiveDeliveryPage.tsx` — every runner action now calls `services.jobs.*` and merges the returned job (`applyJob` preserves local-only fields like `photo_url`). Removed the client-side code comparison and local transition patches.
- `RatingPage.tsx` — happy-path close persists via `services.jobs.closeJob` so the runner sees `CLOSED`. Payment/rating/dispute stay local (Phase 15).

## Out of scope (Phase 15)
Payments, ratings, disputes/theft escalation, and photos/Storage — these live in separate tables. Photo capture stays local/mock; the mock-ops dispute resolution on `TrackingPage` remains local.

## Validation
- `pnpm build` clean.
- `scripts/lifecycle_test.sql` (DB-level, self-cleaning): accept → pickup → wrong code (rejected `22023`) → right code → close ⇒ final `CLOSED`, delivered + closed timestamps set, payout `earned`, 6 `job_events` logged.

## Migration note
Applied with `npx supabase migration up` (non-destructive) to preserve existing local test accounts — **not** `db reset`.

## Follow-up fixes (post-testing)
- **Runner no longer lands on the payment page.** After handoff/secure-drop the runner stays on the "Handoff complete" screen; only the *sender* goes to `/rate`. `RatingPage` also redirects any non-sender to `/runner/active` (defense in depth).
- **Dispute/payment no longer revert to "payment pending".** The 20s poll now *merges* server jobs with local state (`mergeServerJobs` in `AppContext`) instead of replacing — it keeps the further-along status (DISPUTED / mock-ops CLOSED) and re-applies local-only fields (payment_*, dispute_*, rating), which aren't persisted until Phase 15.
- **Known limitation:** because dispute/payment are still local-only, a dispute filed by the sender is **not** visible on the runner's account yet. True cross-account dispute + payment sync (and runner suspension propagation) requires Phase 15.
