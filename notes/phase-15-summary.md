# Phase 15 — Payments, Ratings, Disputes & Trust (cross-account)

## Goal
Persist the closing + safety layer so it syncs across accounts. Fixes the Phase 14 limitation where payment/rating/dispute were local-only: disputes never reached the runner and suspension never propagated.

## What changed

### Database — `supabase/migrations/0006_payments_disputes_trust.sql`
RLS (`SELECT` = org member) + `authenticated` grants on `payments`, `ratings`, `disputes`, `trust_events`. All writes go through `SECURITY DEFINER` RPCs:

| RPC | Actor | Effect |
|-----|-------|--------|
| `record_payment(job, method, tip)` | sender | upsert `payments` (base = agreed/posted, status `paid`); `payment_recorded` event |
| `submit_rating(job, stars)` | sender | upsert `ratings`; recompute runner `users.rating` |
| `file_dispute(job, type, desc)` | sender | insert `disputes`; job `PENDING_RATING → DISPUTED`; theft-like → `trust_events` (theft_escalation + suspension) + suspend runner in `users`; `dispute_filed` event |
| `resolve_dispute(job, outcome, unsuspend)` | sender | resolve `disputes`; job `→ CLOSED` + payout (`runner_at_fault`→withheld else earned); trust note; optional unsuspend |

`is_theft_like_dispute(text)` mirrors the domain helper ("not delivered" / theft / stolen / misappropriat).

### Service layer
- `JobService` gained `fileDispute` / `resolveDispute` (supabase → RPCs; mock → local patch).
- New `supabasePaymentService` (`record_payment` + optional `submit_rating`; reads `payments`).
- New `supabaseTrustService` — reads `trust_events` (org-readable) and **derives** a runner's suspension from those events, because `public.users` is own-row-only RLS (so a sender can't read the runner row directly, and gender stays private). Writes are no-ops (RPCs own them).
- `services/index.ts` now composes the supabase payment/trust adapters and exports `isSupabaseAdapter`.

### Front-end
- `AppContext.refreshData()` (exposed on context) pulls jobs + the signed-in user's suspension (via `getCurrentUser`) + trust events/records for runners on the user's jobs. Runs on focus / 20s poll, and pages call it after dispute actions for an immediate sync.
- `RatingPage`: payment → `recordPayment`; rate & close → `recordPayment(rating)` + `closeJob`; dispute → `fileDispute` (local theft escalation only in mock mode; supabase pulls DB truth via `refreshData`).
- `TrackingPage`: dispute resolution → `resolveDispute` (server handles trust/suspension; mock keeps local escalation). Surfaces a hint if the write doesn't persist.

## Suspension propagation
- **Runner (self):** `refreshData` re-pulls `getCurrentUser`, so `user.suspension_status` updates and the runner feed gate blocks accepts.
- **Sender (viewing runner):** derived from org-readable `trust_events`, so the theft/suspension banners render without exposing the runner's `users` row.

## Out of scope (later)
Real payment gateway, photos/Storage, FIR PDF (still mock/local), ops dashboard, no-show auto-suspension across accounts.

## Validation
- `pnpm build` clean.
- `scripts/phase15_test.sql` (DB-level, self-cleaning): accept → pickup → handoff → record_payment → submit_rating → file_dispute("Not delivered") ⇒ **runner suspended** → resolve_dispute(runner_at_fault, unsuspend) ⇒ job `CLOSED`/payout `withheld`, payment `paid`, rating `5` (runner avg 5.00), dispute `resolved`, runner `active` again, trust trail `theft_escalation, suspension, ops_note_added, unsuspension`.

## Migration note
Applied via `npx supabase migration up` (non-destructive) to preserve local test accounts.
