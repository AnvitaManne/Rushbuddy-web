# Phase 4 Summary — Runner Flow (Core Loop)

## 1. Goal of the phase

Phase 4 = **implement and harden the complete runner delivery loop**, from accepting an open job through handoff code entry, payment collection, and rating — so the happy-path end-to-end flow is fully playable in the browser without manual state manipulation.

Source of truth: `docs/plans/sjt-mvp-core-loop.md`, `docs/product/core-flow-specs.md`.

Constraints locked for Phase 4:
- Runner enters the 4-digit confirmation code in-app at handoff. The receiver tells the code to the runner verbally. **The receiver does not need the RushBuddy app.**
- Pickup photo is **mandatory** for `Fragile` or `Valuable` risk items; it gates the Condition Acknowledged button. For `Low` risk the photo is optional/suggested only.
- Payment is UPI-only (Razorpay). Cash option removed to reduce ambiguity in MVP.
- Delivery is only marked `DELIVERED` after the sender pays and rates — not at code entry.
- No-answer-at-dropoff protocol is **deferred to Phase 5** (runner sees an issue button only).
- No payment/rating changes beyond the core happy path.

---

## 2. Files / folders changed

| File | What changed |
|------|--------------|
| `app/src/domain/jobTransitions.ts` | Added `PENDING_RATING` to `IN_TRANSIT` targets; added `DELIVERED` to `PENDING_RATING` targets. New happy path: `IN_TRANSIT → PENDING_RATING → DELIVERED`. |
| `app/src/domain/runnerEligibility.ts` | Added `getRunnerActiveDeliveryJob`, `getRunnerAcceptJobError` (checks login, job OPEN, no existing active delivery), `matchJobForRunner` (encapsulates accept logic). |
| `app/src/domain/types.ts` | Added `condition_note?: string` to `Job` (optional pre-existing damage note recorded at pickup). |
| `app/src/domain/postingValidation.ts` | Restored/created — full posting validation module used by `PostRequestPage`. |
| `app/src/app/context/AppContext.tsx` | Added `pendingGender` state; fixed JOB-2404 `runner_id` from `u1` → `u2` to prevent spurious auto-matched state. |
| `app/src/app/components/pages/ActiveDeliveryPage.tsx` | Major overhaul: condition note field; photo capture + mandatory gating for Fragile/Valuable; 4-digit handoff code input (OTP-style); transition `IN_TRANSIT → PENDING_RATING` on correct code; navigate to `/rate` directly. Removed `deliveredJob` snapshot state. |
| `app/src/app/components/pages/RunnerFeedPage.tsx` | Uses `matchJobForRunner`; unambiguous "no jobs / sign in" messaging; no hardcoded `u1` references. |
| `app/src/app/components/pages/TrackingPage.tsx` | Added confirmation code card (hidden once `PENDING_RATING`/`DELIVERED`/`CLOSED`); `PENDING_RATING` mapped to step 3 with "Code Verified — Payment Pending" copy and amber "Pay & Rate Now →" CTA; hardened `job` resolver (never loses DELIVERED/PENDING_RATING jobs on re-mount); `PENDING_RATING` included in active-status filter. |
| `app/src/app/components/pages/HomePage.tsx` | All job lookups use `user?.id ?? 'u1'` (not hardcoded); active job banner limited to `MATCHED`/`IN_TRANSIT`; new amber **PAYMENT PENDING** banner for `PENDING_RATING` sender jobs → `/rate`; recent job list items are now tappable (sender → `/rate` or `/sender/tracking`; runner → `/runner/active`). |
| `app/src/app/components/pages/RatingPage.tsx` | Full overhaul: UPI-only (cash removed); two-step flow — Step 1 Pay (mock Razorpay spinner) → Step 2 Rate (stars required); job lookup targets `PENDING_RATING` first; `PENDING_RATING → DELIVERED` on submit (not CLOSED directly); no-job guard ("All caught up!") prevents re-entry on already-closed jobs; tip feature removed entirely. |
| `app/src/app/components/pages/AuthPage.tsx` | Reinstated gender selection (Male / Female / Prefer not to say) before OTP send; stores selection in `AppContext.pendingGender`. |
| `app/src/app/components/pages/VerifyPage.tsx` | Pulls `pendingGender` from context and includes it in the `User` object on successful OTP verify. |
| `app/src/app/components/pages/PostRequestPage.tsx` | Restored full Phase 3 wizard (regression detected mid-phase 4): job type selector, price floor + editable price, declared value, location types, scheduled window, intercity fields, active-sender-job block/cancel. |

---

## 3. Slice map

| Slice | Deliverable |
|-------|-------------|
| **4.1** | Harden runner accept flow — `matchJobForRunner`, login + OPEN + no-existing-delivery checks, `OPEN → MATCHED` via `assertTransition`, navigate to Active Delivery on accept. |
| **4.2** | Optional condition note at pickup — runner can describe pre-existing damage; not required for Low risk. |
| **4.3** | Mandatory pickup photo for Fragile / Valuable — photo gates the Condition Acknowledged button; optional for Low risk. |
| **4.4** | Show 4-digit confirmation code to sender on TrackingPage — card with verbal handoff instructions; hidden once no longer needed. |
| **4.5** | Replace "Confirm Delivery" button with 4-digit code entry — OTP-style input; code mismatch → inline error and re-focus; correct code → `IN_TRANSIT → DELIVERED` (later changed to `PENDING_RATING` in post-slice work). |
| **4.6** | Core loop sanity fixes — Home uses real `user.id`; active banner limited to `MATCHED`/`IN_TRANSIT`; TrackingPage job resolver hardened; runner feed no changes needed. |
| **4.7** | This summary note. |

### Post-slice work (landed after 4.6, before 4.7)

| Feature | What was done |
|---------|---------------|
| **Payment-Gated Delivery** | Changed code-entry to go `IN_TRANSIT → PENDING_RATING` (not DELIVERED); sender immediately routed to `/rate`; RatingPage overhauled with UPI-only mock Razorpay two-step flow; Tracking shows Payment Pending state; Home shows amber banner. |
| **Tip removal** | `TIPS` constant, tip state, tip UI card, and tip-related copy removed entirely from RatingPage. |
| **DELIVERED status fix** | `handleSubmitRating` now transitions `PENDING_RATING → DELIVERED` (not CLOSED); job correctly shows DELIVERED in recent jobs list. `PENDING_RATING: ['DELIVERED', 'CLOSED', 'DISPUTED']` added to transition map. |
| **RatingPage re-entry guard** | `!job` guard at top of page renders "All caught up!" instead of the payment form when no `PENDING_RATING`/`DELIVERED` job exists — prevents clicking a CLOSED job back into the pay flow. |
| **Gender regression fix** | Gender option had disappeared from login flow; restored in `AuthPage` + `VerifyPage`. |
| **PostRequestPage regression fix** | Full Phase 3 wizard had been lost; restored (job type, price, declared value, location types, active-job block/cancel). |

---

## 4. Product decisions implemented

| Decision | Implementation |
|----------|----------------|
| Receiver does not need the app | Runner enters the code they receive verbally; no receiver UI, no receiver account, no receiver OTP. `confirmation_code` is shown only to the sender on TrackingPage. |
| Fragile / Valuable → mandatory photo at pickup | `requiresPickupPhoto` derived from `job.risk`; `canAcknowledgeCondition` blocks the Ack button unless photo is captured. Low risk: photo suggested only. |
| No cash in payment | `PAYMENT_METHODS` reduced to UPI only; "Pay via UPI · Powered by Razorpay" label; mock Razorpay spinner simulates payment confirmation. |
| Delivery not confirmed until sender pays | Code entry → `PENDING_RATING`; sender must complete pay → rate before job shows as `DELIVERED`. |
| Single active delivery per runner | `getRunnerAcceptJobError` blocks accept if runner already has a `MATCHED`/`IN_TRANSIT` job. |
| No self-transition re-entry on rating | `!job` guard in RatingPage; home and tracking no longer link to `/rate` once job leaves `PENDING_RATING`. |
| Tip removed | No tip UI or `tip_amount` logic; field remains on `Job` type at zero. |

---

## 5. Validation steps

```bash
cd app
pnpm build   # must pass with 0 errors
pnpm dev
```

Manual happy-path end-to-end:

1. **Register** → Auth page: fill name, hostel, gender → confirm email → enter OTP `123456` → land on Home.
2. **Post** → sender flow: pick job type, item, price (at or above floor), declared value → Post → land on Tracking.
3. Tracking shows job as **OPEN** with the 4-digit confirmation code card.
4. **Switch to runner** → Runner Feed: job visible → tap Accept → land on Active Delivery.
5. Active Delivery: tap "I've Reached Pickup Point" → Condition Check screen appears.
   - For Fragile/Valuable: camera button appears; "Condition Acknowledged" button is greyed until photo captured.
   - For Low risk: photo is optional; Ack button is enabled immediately.
6. Acknowledge condition → In Transit phase.
7. Enter the 4-digit code shown on Tracking → correct code → app navigates to `/rate`.
8. Pay & Rate page: Step 1 — "Pay ₹X via UPI" → spinner → "Payment confirmed" → advances to Step 2.
9. Step 2 — select stars (required) → "Submit Rating" → success screen "Delivered & Closed!" → navigate to Home.
10. Home: no active job banner, no payment pending banner; recent jobs list shows DELIVERED badge.
11. Navigate to `/sender/tracking` → timeline at step 4 "Delivered!" (no Pay & Rate button).
12. Navigate to `/rate` directly → "All caught up!" screen (no re-entry).
13. Runner Feed: accepted job is no longer listed (no longer OPEN).

---

## 6. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| JOB-2404 was pre-matched to `u1`, causing spurious Active Delivery on login | Changed `runner_id` to `u2` in `mockJobs`. |
| Active Delivery page re-appeared with same completed job after delivery | `activeJob` memo restricted to `MATCHED`/`IN_TRANSIT`; `setActiveJob(null)` called on completion. |
| "DELIVERED" state showed back on Home as active job | `activeJob` filter on Home now explicitly checks `['MATCHED', 'IN_TRANSIT']` — DELIVERED excluded. |
| Sender had no path back to Tracking after delivery | Recent jobs list made tappable; PENDING_RATING routes to `/rate`, others route to `/sender/tracking`. |
| TrackingPage lost DELIVERED job on re-mount | Job resolver refactored into IIFE with `never-filter-by-status` fallback; PENDING_RATING added to active-status filter. |
| `AlertCircle` not imported in ActiveDeliveryPage | Added to lucide-react import list. |
| Job jumped to CLOSED without showing DELIVERED | Changed submit to go `PENDING_RATING → DELIVERED`; `DELIVERED` added to `PENDING_RATING` allowed targets. |
| RatingPage re-opened on tapping a CLOSED job | Added `!job` early-return guard rendering "All caught up!" screen. |
| Trailing "Rate & Confirm Payment" button on Tracking re-linked to `/rate` for DELIVERED jobs | Button removed; only the `PENDING_RATING`-specific amber CTA remains. |
| Gender option disappeared from login flow | Restored gender selector in `AuthPage`; wired `pendingGender` through `AppContext` → `VerifyPage` → `User`. |
| PostRequestPage wizard regressed (job type, price floor, cancel all missing) | Full Phase 3 wizard restored; `postingValidation.ts` recreated. |
| PowerShell `&&` not supported | All shell commands use `;` separator. |

---

## 7. Gaps before Phase 5

- **No-answer-at-dropoff protocol** — runner sees a generic "Report Issue" button only. The full 20-minute wait flow, `Sender Unreachable — Holding Item` state, `no_answer_at` timestamp, and Low/Fragile/Valuable branch (unattended drop vs hold) are **not implemented**.
- **Real Razorpay integration** — payment is simulated with a setTimeout spinner. No actual UPI call, no webhook, no payout to runner.
- **Runner payout display** — runner sees no earnings update or payout confirmation after delivery.
- **Rating stored on User aggregate** — `user.rating` and `user.total_deliveries` are not updated after a job closes; RatingPage only sets `job.rating`.
- **Pre-pickup no-show / re-pool** — `MATCHED → OPEN` transition exists in the state machine but no UI triggers it (sender cannot unassign an unresponsive runner).
- **`expires_at` enforcement** — jobs do not auto-expire or show a countdown.
- **Ops dashboard / FIR export** — no ops view; all dispute/issue data is local state only.
- **Push notifications** — all async notifications (runner found, code verified, payment received) are absent.
- **Persistent state** — all state lives in React context; a page refresh resets everything to `mockJobs`.

---

*Add `notes/phase-5-summary.md` when Phase 5 is done.*
