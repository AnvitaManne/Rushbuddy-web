# Phase 15 — Payments, Ratings, Disputes & Trust (cross-account)

**Goal:** persist the closing + safety layer so it syncs across accounts. Fixes the Phase 14 limitations: payment/rating/dispute were local-only, so a dispute filed by the sender never reached the runner and runner suspension never propagated.

**Sources:** `notes/phase-14-summary.md`, `supabase/migrations/0001_initial_schema.sql` (payments/ratings/disputes/trust_events tables already exist), `app/src/domain/trustOps.ts`, `.cursor/rules/mvp-locked-fields.mdc`.

---

## Scope

**In:**
- Payment persistence (`payments` table) + tip.
- Rating persistence (`ratings` table) + runner rating aggregate.
- Dispute persistence (`disputes` table): file → job `DISPUTED`; resolve → `CLOSED`.
- Theft escalation: theft-like dispute inserts `trust_events` and **suspends the runner** in `public.users`.
- Suspension propagation: runner's `suspension_status` (already loaded by `getCurrentUser`) is refreshed so the runner feed blocks accepts; sender sees the escalation/suspension banners from persisted `trust_events`.

**Out (later):** real payment gateway, photos/Storage, FIR PDF generation (still mock/local), ops dashboard, no-show auto-suspension wiring across accounts (helper exists; UI trigger later).

---

## RPCs (migration 0006, SECURITY DEFINER; writes bypass RLS)

| RPC | Actor | Effect |
|-----|-------|--------|
| `record_payment(job, method, tip)` | sender | upsert `payments` (payer=sender, payee=runner, base=agreed/posted, status `paid`); event `payment_recorded` |
| `submit_rating(job, stars)` | sender | upsert `ratings` (rater=sender, ratee=runner); recompute runner `users.rating` |
| `file_dispute(job, type, description)` | sender | insert `disputes` (status `open`); job `PENDING_RATING → DISPUTED`; if theft-like → `trust_events` (theft_escalation + suspension) + suspend runner; event `dispute_filed` |
| `resolve_dispute(job, outcome, unsuspend)` | sender/ops | resolve `disputes`; job `→ CLOSED` + payout (`runner_at_fault`→withheld else earned); `trust_events` ops note; optional unsuspend runner; event `status_changed` |

Theft-like test mirrors `isTheftLikeDispute`: type = "not delivered" or contains theft/stolen/misappropriat.

## RLS + grants
Enable RLS on `payments`, `ratings`, `disputes`, `trust_events`; `SELECT` policy = org member (`organization_id = current_app_user_org_id()`). `GRANT SELECT` to `authenticated`; all writes go through the SECURITY DEFINER RPCs (no INSERT grant).

---

## Service layer
- `PaymentService` (supabase): `recordPayment` → `record_payment` (+ `submit_rating` when a rating is passed); `getPaymentForJob` → select.
- `TrustService` (supabase): reads `getEventsForRunner`, `getRunnerRecord`; writes are no-ops (RPCs own them).
- `JobService`: add `fileDispute(job, type, desc)` and `resolveDispute(job, outcome, unsuspend)` → RPCs, return the updated `Job`.

## Front-end
- `AppContext`: on the existing 20s poll also (a) refresh the current user (suspension) and (b) load `trust_events` for the user's jobs into `trustEvents`, so the sender's theft/suspension banners and the runner's feed gate stay in sync from the DB.
- `RatingPage`: payment/rating/dispute call the services; drop the local-only mutations.
- `TrackingPage`: dispute resolution calls `resolveDispute`.

---

## Slice map
| Slice | Deliverable |
|-------|-------------|
| 15.1 | This plan |
| 15.2 | `0006_payments_disputes_trust.sql` |
| 15.3 | supabase payment/trust adapters + `JobService` dispute methods (+ mock parity) |
| 15.4 | AppContext user/trust refresh + dispute wiring |
| 15.5 | RatingPage → services |
| 15.6 | TrackingPage resolve → services |
| 15.7 | Summary + DB test |

## Acceptance
- [ ] Migration applies via `migration up` (non-destructive)
- [ ] Sender pays/rates → persists; survives reload without the merge hack
- [ ] Sender files "Not delivered" → runner's account shows DISPUTED and runner is **suspended** (feed blocks accept)
- [ ] Sender resolves → both accounts show CLOSED with correct payout
- [ ] Mock mode unchanged; `pnpm build` clean
- [ ] MVP-locked Post Request fields intact
