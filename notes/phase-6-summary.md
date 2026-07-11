# Phase 6 Summary — Payment + Closure

## 1. Goal of the phase

Phase 6 = Close the money loop. After a job is delivered, the sender must confirm payment, optionally rate the runner, and the job must reach a terminal state (CLOSED or DISPUTED).

Key constraints locked in for this phase:

- **Cash** is only allowed for Mode 1 (`mode_1_direct_p2p`) jobs in `PENDING_RATING` state — i.e. only after the runner has successfully entered the 4-digit handoff code.
- **Mode 2** (`mode_2_landmark`) is UPI / PhonePe only. Cash is unenforceable at a landmark with no physical person-to-person confirmation.
- Payment confirmation is a **separate step** from rating submission. Confirming payment does not change job status; rating submission transitions to CLOSED.
- A **2-hour dispute window** opens from `paid_at`. After it elapses, the sender can close the job manually (no backend scheduler exists yet).
- **No real payment provider** (no Razorpay, UPI verification, wallet ledger). Payment intent is recorded client-side only.
- Failure paths from Phase 5 (`ISSUE_REPORTED` / secure-drop) still owe the runner the full agreed fee and use the same `/rate` page to confirm payout.
- All status changes go through `assertTransition` — no direct mutation.

---

## 2. Files / folders added or changed

**Added:**

| File | Purpose |
|------|---------|
| `app/src/domain/paymentPolicy.ts` | Payment method visibility rules, cash eligibility, `computeDisputeWindowEndsAt`, UI copy helpers |
| `app/src/domain/closurePolicy.ts` | Dispute-window open/closed check, auto-close eligibility, `buildCloseJobPatch`, `getClosureCopy` |
| `notes/phase-6-summary.md` | This file |

**Changed:**

| File | What changed |
|------|-------------|
| `app/src/domain/enums.ts` | Added `PaymentMethod = 'upi' \| 'phonepe' \| 'cash'` and `PaymentStatus = 'unpaid' \| 'paid' \| 'disputed'` |
| `app/src/domain/types.ts` | Added `payment_method`, `payment_status`, `paid_at`, `dispute_window_ends_at`, `closed_at`, `dispute_type`, `dispute_description`, `disputed_at` to `Job` |
| `app/src/domain/index.ts` | Barrel-exported `paymentPolicy` and `closurePolicy` |
| `app/src/app/main.tsx` | Dev-only `window.__rushbuddyDev.closure` and `.payment` namespaces wired via dynamic import |
| `app/src/app/components/pages/RatingPage.tsx` | Full two-step payment + rating flow; `handlePaymentConfirm`, `handleRatingSubmit`, `handleDisputeSubmit`; payment method policy applied; dispute fields written on submit; DEV skip button |
| `app/src/app/components/pages/TrackingPage.tsx` | Post-delivery status cards per job status (PENDING_RATING, DELIVERED + window open/elapsed, CLOSED, DISPUTED); `handleCloseJob`; `devExpireWindow`; DISPUTED detail panel; `getStepIndex` fix for DISPUTED |
| `app/src/app/components/pages/HomePage.tsx` | Status badge labels (`PAYMENT PENDING`, `OPS REVIEW`, `DISPUTE WINDOW`, `CLOSING SOON`); `StatusBadge` `labelOverride` prop; DISPUTED jobs clickable → tracking; CLOSED-only dimming |

---

## 3. Slice map

| Slice | What it did |
|-------|-------------|
| **6.0** | Audit `RatingPage` job lookup; replace hardcoded `'u1'` with `user?.id ?? defaultUser.id`; add `assertTransition` guard to `handleSubmit`; add `transitionError` display |
| **6.1** | Create `paymentPolicy.ts`; add `PaymentMethod`, `PaymentStatus` enums; add payment fields to `Job` type |
| **6.2** | Apply Mode 1 / Mode 2 payment method rules in `RatingPage`; cash hidden for Mode 2; auto-select first allowed method if selection becomes invalid; policy copy displayed |
| **6.x** | Restore handoff code entry for runners (`ActiveDeliveryPage`) and sender-facing display (`TrackingPage`); restore 3-way job type selector in `PostRequestPage` (campus\_immediate, campus\_scheduled, intercity) |
| **6.3** | Split payment confirmation from rating submission in `RatingPage`: Step 1 writes payment fields (no status change), Step 2 transitions → CLOSED; dispute mode bypasses both |
| **6.4** | Create `closurePolicy.ts`: `isDisputeWindowOpen`, `canAutoCloseJob`, `buildCloseJobPatch`, `getClosureCopy`; barrel-export via `index.ts` |
| **6.5** | Surface closure state in `TrackingPage` (per-status cards) and `HomePage` (context-aware badge labels with `labelOverride`) |
| **6.6** | Add manual "Close Job" button on `TrackingPage` when `canAutoCloseJob` is true; DEV "Confirm Payment & Expire Window" shortcut on `TrackingPage`; DEV "Skip to Close Job" button on `RatingPage` payment step |
| **6.7** | Write `dispute_type`, `dispute_description`, `disputed_at`, `runner_payout_status: 'withheld'` on dispute submit; show dispute detail panel on `TrackingPage`; DISPUTED jobs made navigable from `HomePage` |
| **6.8** | This summary |

---

## 4. Product decisions implemented

### Payment method rules
- `getAllowedPaymentMethods(job)` returns:
  - `[]` if job is not in a payable state.
  - `['upi', 'phonepe']` for Mode 2 (landmark) in any payable state.
  - `['upi', 'phonepe']` for Mode 1 in DELIVERED or ISSUE_REPORTED (no confirmed code entry).
  - `['upi', 'phonepe', 'cash']` for Mode 1 in PENDING_RATING (runner entered handoff code).

### Two-step payment + rating
- **Step 1 — Confirm Payment:** writes `payment_method`, `payment_status: 'paid'`, `paid_at`, `dispute_window_ends_at` (paid_at + 2h), `tip_amount` to the job. Status stays unchanged.
- **Step 2 — Submit Rating:** writes `rating`, `closed_at`; transitions `PENDING_RATING → CLOSED` via `assertTransition`.
- Rating is blocked until payment is confirmed (unless dispute mode, which skips both).

### 2-hour dispute window
- Starts at `paid_at`; ends at `paid_at + 2h` (`DISPUTE_WINDOW_HOURS = 2`).
- `isDisputeWindowOpen(job, now)` — returns true if the clock is still running.
- `canAutoCloseJob(job, now)` — true when status is DELIVERED or PENDING_RATING, `payment_status === 'paid'`, and window has elapsed.
- `buildCloseJobPatch(job, now)` — returns `{ status: 'CLOSED', closed_at }` or `null`.

### Manual close (no backend scheduler)
- When `canAutoCloseJob` is true, `TrackingPage` shows a green "Close Job →" button.
- On click: `buildCloseJobPatch` is called, patch applied via `setJobs`.
- No `setInterval` or background job. A future Phase 7 task can add a polling hook.

### Dispute path
- Accessible from either payment step or rating step.
- Writes `status: 'DISPUTED'`, `payment_status: 'disputed'`, `runner_payout_status: 'withheld'`, `dispute_type`, `dispute_description`, `disputed_at`.
- `canAutoCloseJob` always returns false for DISPUTED (excluded from `AUTO_CLOSEABLE_STATUSES`).
- TrackingPage shows "Dispute Under Ops Review" card with filed details.
- DISPUTED jobs are clickable in Recent Jobs → navigate to TrackingPage.

### State machine transitions used
- `PENDING_RATING → CLOSED` — normal rating submit
- `PENDING_RATING → DISPUTED` — dispute from payment or rating step
- `DELIVERED → CLOSED` — manual close after dispute window
- `DISPUTED → CLOSED` — reserved for ops resolution (not wired in UI)
- `ISSUE_REPORTED → CLOSED` — failure-path rating submit

---

## 5. Validation steps

```bash
cd app
pnpm build    # must exit 0
pnpm dev      # http://localhost:5173
```

**Normal Mode 1 delivery → payment → rating → close:**
1. Post campus job → TrackingPage → "Demo: Simulate Delivery Progress" → lands on `/rate`.
2. Step 1: choose tip, confirm payment method (cash visible), tap "Confirm Payment · ₹N".
3. Step 2: select stars → "Submit Rating · N Stars" → success screen → auto-navigate home.
4. Recent Jobs: job shows CLOSED badge, dimmed, non-clickable.

**Mode 2 (intercity) — cash hidden:**
1. Post intercity job → complete same flow.
2. On `/rate` Step 1: only UPI and PhonePe visible. No cash button.

**Dispute flow:**
1. Any point before or after payment on `/rate` → "Report an Issue Instead".
2. Pick issue type, optionally write description → "Submit Dispute".
3. Recent Jobs: DISPUTED badge (OPS REVIEW label), tappable.
4. TrackingPage: "Dispute Under Ops Review" card with issue type, filed timestamp.
5. No "Close Job" button visible.

**Manual close after dispute window (DEV):**
1. Post job → simulate delivery → land on `/rate`.
2. Tap "DEV · Skip to Close Job (Tracking)" → navigates to TrackingPage.
3. Green "Dispute Window Closed · Close Job →" card appears.
4. Tap "Close Job →" → spinner → "Job Closed" card with `closed_at` timestamp.

---

## 6. Problems faced

| Problem | Fix |
|---------|-----|
| `closurePolicy.ts` Write not persisted between sessions | Recreated file in Slice 6.5; added barrel export to `index.ts` |
| Git merge conflict markers in `HomePage.tsx` | Resolved by keeping HEAD version (Slice 6.5 labels + `labelOverride` prop) |
| DEV expire button unreachable — simulate always navigates to `/rate` | Added "DEV · Skip to Close Job (Tracking)" button directly on `RatingPage` payment step |
| "Close Job" and "Rate & Confirm Payment" both showed simultaneously | Gated rate CTA on `!canAutoCloseJob(job)` so both are mutually exclusive |
| DISPUTED jobs non-clickable in Recent Jobs | Removed DISPUTED from `isDone`; added DISPUTED → TrackingPage in `handleJobClick` |
| Dynamic Tailwind grid columns purged in prod | Switched to inline `style={{ gridTemplateColumns: repeat(N, 1fr) }}` |
| CLOSED/DISPUTED jobs could re-open RatingPage | Job lookup in RatingPage restricted to `['PENDING_RATING', 'DELIVERED', 'ISSUE_REPORTED']` only |

---

## 7. Gaps before Phase 7

- **No real payment provider.** UPI / PhonePe buttons record intent only. Razorpay or a UPI deep-link would be a Phase 7 backend task.
- **No backend auto-close scheduler.** `canAutoCloseJob` is evaluated on the client. A server-side cron or Supabase Edge Function is needed for unattended auto-close after the 2-hour window.
- **Dispute resolution ops UI is absent.** DISPUTED → CLOSED transition exists in the state machine but no ops dashboard screen has been built. Ops resolution is a manual DB operation for now.
- **`runner_payout_status: 'withheld'` has no unlock path in UI.** Once a dispute is filed, the runner's payout is marked withheld but there is no screen to mark it as earned or released after ops resolves.
- **Payment is unverified for all methods.** Cash is recorded as intent only. UPI / PhonePe have no webhook or receipt. Escrow or receipt verification is deferred.
- **No dispute window countdown UI.** The window close time is shown as a static HH:MM string. A live countdown (`useEffect` with `setInterval`) would improve UX.
- **`dispute_window_ends_at` is written at payment confirm but the job stays in PENDING_RATING.** If the rating step is never completed (user pays then leaves), the window elapses with no rating, and "Close Job" will close the job without a star rating recorded.
