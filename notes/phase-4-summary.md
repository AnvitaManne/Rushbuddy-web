# Phase 4 Summary — Runner Flow (Core Loop)

## 1. Goal of the phase

Phase 4 = **Make the runner delivery loop fully playable end-to-end**, from accepting a job through photo check, handoff code entry, UPI payment, and rating — so the complete happy path works in the browser without any manual state edits.

---

## 2. Files / folders added or changed

**Domain layer**

- `domain/jobTransitions.ts` — added `PENDING_RATING` to `IN_TRANSIT` targets; added `DELIVERED` to `PENDING_RATING` targets
- `domain/runnerEligibility.ts` — added `matchJobForRunner`, `getRunnerActiveDeliveryJob`, `getRunnerAcceptJobError`
- `domain/types.ts` — added `condition_note?: string` to `Job`
- `domain/postingValidation.ts` — restored/created (posting validation logic)

**Pages**

- `pages/ActiveDeliveryPage.tsx` — condition note + photo gating (Fragile/Valuable mandatory) + 4-digit handoff code input + `IN_TRANSIT → PENDING_RATING` on correct code + navigate to `/rate`
- `pages/RunnerFeedPage.tsx` — uses `matchJobForRunner`; unambiguous sign-in/no-jobs messaging
- `pages/TrackingPage.tsx` — confirmation code card; `PENDING_RATING` state with "Pay & Rate Now" CTA; hardened job resolver
- `pages/HomePage.tsx` — user-scoped job lookups (no hardcoded `u1`); amber PAYMENT PENDING banner; recent jobs tappable
- `pages/RatingPage.tsx` — UPI-only (cash removed); two-step Pay → Rate flow; `PENDING_RATING → DELIVERED` on submit; no-job guard
- `pages/AuthPage.tsx` — reinstated gender selection before OTP
- `pages/VerifyPage.tsx` — wires `pendingGender` into `User` on verify
- `pages/PostRequestPage.tsx` — restored full Phase 3 wizard (regression fix)

**Context**

- `context/AppContext.tsx` — added `pendingGender`; fixed JOB-2404 `runner_id` (`u1` → `u2`)

---

## 3. Important concepts

- **State machine is the source of truth** — every status change goes through `assertTransition`; if the transition isn't in `ALLOWED_TRANSITIONS`, the UI cannot do it
- **PENDING_RATING = code verified, payment not yet collected** — job is not "delivered" until the sender pays and rates; `DELIVERED` is the post-payment state
- **Receiver needs no app** — the 4-digit code is spoken verbally by whoever receives the package; the runner types it in; no receiver account or OTP needed
- **Photo gating is domain-driven** — `risk === 'Fragile' | 'Valuable'` triggers mandatory photo; `'Low'` shows a suggestion only; the Ack button is `disabled` until the photo state is satisfied
- **Single SPA = sender and runner share the same browser** — `navigate('/rate')` after code entry takes the whole app there; the sender's tracking page is the same session
- **Vite build ≠ TypeScript check** — `pnpm build` uses esbuild (no type errors); run `tsc --noEmit` separately for strict checking

---

## 4. Validation steps

```bash
cd app
pnpm build          # must pass with 0 errors
pnpm dev            # http://localhost:5173
```

Manual happy path:

1. Register — name, hostel, gender → confirm email → OTP `123456` → Home
2. Post a job → Tracking page shows with 4-digit code card
3. Switch to runner → Feed → Accept → Active Delivery
4. For Fragile/Valuable: photo required before Ack; for Low: optional
5. Ack condition → In Transit phase
6. Enter the 4-digit code (from Tracking page) → navigates to `/rate`
7. Pay step: "Pay via UPI" → spinner → confirmed → Step 2
8. Rate step: pick stars → Submit → "Delivered & Closed!"
9. Home: no active banner, no payment pending banner; recent jobs show DELIVERED
10. `/sender/tracking`: timeline at step 4 "Delivered!"
11. `/rate` again: "All caught up!" — no re-entry

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| JOB-2404 pre-matched to `u1`, causing ghost Active Delivery on login | Changed `runner_id` to `u2` in `mockJobs` |
| Active Delivery showed completed job again after delivery | `activeJob` memo restricted to `MATCHED`/`IN_TRANSIT`; `setActiveJob(null)` on code entry |
| TrackingPage lost DELIVERED job on re-mount (no-job flash) | Job resolver refactored — sort fallback never filters by status; `PENDING_RATING` added to active filter |
| Sender had no path back to Tracking after delivery | Recent jobs list made tappable; `PENDING_RATING` routes to `/rate`, others to `/sender/tracking` |
| Job showed CLOSED without showing DELIVERED | Rating submit changed to `PENDING_RATING → DELIVERED` (not CLOSED); `DELIVERED` added to `PENDING_RATING` targets |
| RatingPage re-opened on CLOSED job (clicking recent job) | Added `!job` early-return guard — renders "All caught up!" instead of form |
| Trailing "Rate & Confirm Payment" button re-linked DELIVERED jobs to `/rate` | Removed that button; only `PENDING_RATING`-specific CTA remains |
| `AlertCircle` undefined in ActiveDeliveryPage | Added to lucide-react import |
| Gender option disappeared from login | Restored in `AuthPage`; wired `pendingGender` through `AppContext → VerifyPage → User` |
| PostRequestPage wizard regressed (job type, price floor, cancel all missing) | Restored full Phase 3 wizard; recreated `postingValidation.ts` |
| `Job` type used but not imported in ActiveDeliveryPage | **Known gap (M1)** — Vite build passes; fix: drop explicit annotation, rely on inference |
| `handleIssue` bypasses `assertTransition` | **Known gap (M3)** — fix before Phase 5 |
| `simulateProgress` demo uses `DELIVERED` path, breaks rating submit | **Known gap (M4)** — fix: advance through `PENDING_RATING` instead |

---

## Gaps going into Phase 5

- No-answer-at-dropoff protocol (20-min wait, `Sender Unreachable` state) — not built
- Real Razorpay integration — payment is a mock spinner
- Runner earnings not updated on `User` object after delivery
- `delivered_at` set at payment time, not handoff time (semantic drift)
- Jobs end in `DELIVERED` state — no auto-close to `CLOSED` after 2-hour dispute window
- `/sender/tracking` has no `RequireAuth` guard
- All state is in-memory; page refresh resets to mock data

---

*Add `notes/phase-5-summary.md` when Phase 5 is done.*
