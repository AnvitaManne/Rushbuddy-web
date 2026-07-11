# Phase 6 Summary — Payment + Closure

## 1. Goal of the phase

Phase 6 = Close the money loop after delivery: sender confirms payment, rates the runner (optionally), and the job reaches a terminal state (CLOSED or DISPUTED).

Source of truth: `docs/plans/sjt-mvp-core-loop.md`, `docs/product/core-flow-specs.md`.

Constraints locked in:
- Cash only for Mode 1 (`mode_1_direct_p2p`) jobs in PENDING_RATING state.
- Mode 2 (`mode_2_landmark`) = UPI / PhonePe only. Cash is unenforceable at a landmark.
- Payment confirmation is a **separate step** from rating. Confirming payment does not change job status.
- 2-hour dispute window starts at `paid_at`. Sender can close manually after it elapses.
- No backend scheduler. No real payment provider. All intent recorded client-side only.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|--------------|
| `app/src/domain/paymentPolicy.ts` | Payment method rules per job mode/status, cash eligibility, dispute window computation, UI copy |
| `app/src/domain/closurePolicy.ts` | Dispute window open/closed check, auto-close eligibility, `buildCloseJobPatch`, closure copy |
| `notes/phase-6-summary.md` | This file |

### Changed

| File | What changed |
|------|-------------|
| `app/src/domain/enums.ts` | Added `PaymentMethod` (`upi \| phonepe \| cash`) and `PaymentStatus` (`unpaid \| paid \| disputed`) |
| `app/src/domain/types.ts` | Added `payment_method`, `payment_status`, `paid_at`, `dispute_window_ends_at`, `closed_at`, `dispute_type`, `dispute_description`, `disputed_at`, `runner_payout_status` to `Job` |
| `app/src/domain/index.ts` | Barrel-exported `paymentPolicy` and `closurePolicy` |
| `app/src/main.tsx` | Dev-only `window.__rushbuddyDev.closure` and `.payment` namespaces |
| `app/src/app/components/pages/RatingPage.tsx` | Two-step flow: Step 1 confirms payment (writes fields, no status change), Step 2 submits rating (transitions → CLOSED or DISPUTED); payment method policy applied; dispute fields written on submit |
| `app/src/app/components/pages/ActiveDeliveryPage.tsx` | Restored handoff code input — runner must enter 4-digit code before delivery can be confirmed |
| `app/src/app/components/pages/PostRequestPage.tsx` | Restored 3-way job type selector: campus\_immediate, campus\_scheduled, intercity |
| `app/src/app/components/pages/TrackingPage.tsx` | Post-delivery status cards (PENDING\_RATING, DELIVERED + window open/elapsed, CLOSED, DISPUTED); manual close button; DEV expire-window shortcut; dispute detail panel |
| `app/src/app/components/pages/HomePage.tsx` | Context-aware badge labels (`PAYMENT PENDING`, `DISPUTE WINDOW`, `OPS REVIEW`, `CLOSING SOON`); DISPUTED jobs clickable → TrackingPage; only CLOSED is dimmed/non-clickable |

### Slice map

| Slice | Deliverable |
|-------|------------|
| **6.0** | Audit `RatingPage` job lookup; add `assertTransition`; use `user.id` from context |
| **6.1** | `paymentPolicy.ts`; `PaymentMethod` / `PaymentStatus` enums; payment fields on `Job` |
| **6.2** | Apply Mode 1 / Mode 2 payment method rules in `RatingPage` |
| **6.x** | Restore handoff code entry (runner), handoff code display (sender), intercity job type |
| **6.3** | Separate payment step from rating step in `RatingPage` |
| **6.4** | `closurePolicy.ts`; barrel export |
| **6.5** | Per-status post-delivery cards in `TrackingPage`; context-aware badge labels in `HomePage` |
| **6.6** | Manual "Close Job" button; DEV expire-window shortcut; rate CTA hidden when closeable |
| **6.7** | Write dispute fields on submit; dispute detail panel; DISPUTED jobs navigable from `HomePage` |
| **6.8** | This summary |

---

## 3. Important concepts learned

- **Payment method policy is derived, not stored.** `getAllowedPaymentMethods(job)` is a pure function — UI reads it fresh every render; no extra field needed.
- **Two-step payment/rating.** Confirming payment writes fields but keeps status unchanged. Rating (or dispute) is the step that causes a real status transition. This matters because the 2-hour window needs `paid_at` before a star rating is ever submitted.
- **`assertTransition` on every status change.** No page sets `status` directly. Every transition goes through the state machine or it throws. Makes illegal state impossible at runtime.
- **`canAutoCloseJob` is client-computed.** There is no backend scheduler. The component calls `canAutoCloseJob(job, new Date())` on each render and shows the Close button when true. A future Supabase Edge Function or cron can replicate the same logic server-side.
- **DEV shortcut pattern.** `import.meta.env.DEV` gates all dev buttons and `window.__rushbuddyDev`. Shortcuts (skip payment, expire window) exist only in local dev builds; prod never sees them.
- **DISPUTED is not done.** Unlike CLOSED, DISPUTED jobs remain navigable. `isDone` in `HomePage` only applies to CLOSED. Ops resolution is a future task.

---

## 4. Validation steps

```bash
cd app
pnpm build    # must exit 0
pnpm dev      # http://localhost:5173
```

**Normal flow (Mode 1, cash):**
1. Post campus job → simulate delivery progress → lands on `/rate`.
2. Step 1: pick Cash → "Confirm Payment · ₹N".
3. Step 2: pick stars → "Submit Rating" → home.
4. Recent Jobs: CLOSED badge, dimmed.

**Mode 2 (intercity) — cash hidden:**
1. Post intercity job → same flow.
2. `/rate` Step 1: only UPI and PhonePe shown. No Cash button.

**Dispute:**
1. On `/rate` → "Report an Issue Instead" → pick type → submit.
2. Recent Jobs: OPS REVIEW badge, tappable → TrackingPage shows dispute detail card.

**Manual close (DEV):**
1. Post job → simulate delivery → on `/rate` tap "DEV · Skip to Close Job (Tracking)".
2. TrackingPage shows "Close Job →" button → tap → spinner → "Job Closed" card.

---

## 5. Problems faced

| Problem | Fix |
|---------|-----|
| `closurePolicy.ts` not persisted between conversation sessions | Recreated the file in Slice 6.5; re-added barrel export to `index.ts` |
| Git merge conflict markers left in `HomePage.tsx` | Manually resolved, kept Slice 6.5 labels and `labelOverride` prop |
| DEV expire button was unreachable (flow always went to `/rate` first) | Added "DEV · Skip to Close Job (Tracking)" button directly on `RatingPage` payment step |
| "Rate & Confirm Payment" and "Close Job" both showed at the same time | Gated rate CTA on `!canAutoCloseJob(job)` — the two are now mutually exclusive |
| DISPUTED jobs were non-clickable in Recent Jobs | Removed DISPUTED from `isDone`; `handleJobClick` routes DISPUTED → TrackingPage |
| Dynamic Tailwind grid columns stripped in prod build | Switched to inline `style={{ gridTemplateColumns: \`repeat(${n}, 1fr)\` }}` |

---

## Gaps before Phase 7

- No real payment provider. UPI / PhonePe buttons record intent only.
- No backend auto-close. `canAutoCloseJob` is client-side; needs a server-side cron or Edge Function.
- No ops dispute resolution UI. DISPUTED → CLOSED transition exists in the state machine but there is no ops dashboard.
- `runner_payout_status: 'withheld'` has no unlock path in UI after a dispute is resolved.
- No live countdown for the dispute window (static timestamp only).

---

*Add `notes/phase-7-summary.md` when Phase 7 is done.*
