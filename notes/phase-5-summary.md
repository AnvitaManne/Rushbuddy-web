# Phase 5 Summary — No-Answer / Failure Handling

## 1. Goal of the phase

Phase 5 = Implement the full **no-answer-at-dropoff protocol** for the runner, surface the outcome to the sender, and make runner payout explicit — **no real GPS, camera, backend, Razorpay, FIR export, or ops dashboard**.

Source of truth: `docs/plans/sjt-mvp-core-loop.md`, `docs/product/core-flow-specs.md`.

Protocol locked for this phase:

- Runner taps **"No Answer at Door"** at the dropoff → starts a 20-minute wait + 2 contact attempts.
- If sender responds within the window → delivery continues normally.
- If no response after 20 min + 2 attempts → runner taps **"Sender Unreachable"**:
  - **Low risk** → secure unattended drop (location selector + mock geotagged photo + ops notified). Job → `PENDING_RATING`.
  - **Fragile / Valuable** → runner holds item; awaits ops instruction only. Job → `ISSUE_REPORTED`.
- **Runner payout**: full agreed fee regardless of path.
- **Sender refund**: none.
- Dev bypass: `window.__rushbuddyDev.bypassNoAnswerWait(true)` skips the 20-min wall-clock check for testing.

---

## 2. Files added or changed

### Added (`app/src/domain/`)

| File | Why it exists |
|------|----------------|
| `failureHandling.ts` | Policy constants (`NO_ANSWER_WAIT_MINUTES`, `REQUIRED_CONTACT_ATTEMPTS`), risk-branch guards (`canUseSecureDrop`, `requiresOpsHold`), wait-window check (`canMarkSenderUnreachable`), mock evidence builder (`createMockDropoffEvidence`), payout patch (`markRunnerPayoutEarnedPatch`), mutable dev-flag object (`_devFlags`). |

### Added (`notes/`)

| File | Why it exists |
|------|----------------|
| `phase-5-summary.md` | This file. |

### Changed

| File | What changed |
|------|----------------|
| `app/src/domain/types.ts` | Added `NoAnswerResolution`, `RunnerPayoutStatus`, `DropoffGeotag` types; 7 new optional fields on `Job`: `no_answer_at`, `no_answer_contact_attempts`, `sender_response_at`, `sender_unreachable_at`, `no_answer_resolution`, `dropoff_photo_url`, `dropoff_geotag`, `dropoff_secure_location`, `ops_notified`, `runner_payout_status`. |
| `app/src/domain/index.ts` | Barrel-exported `failureHandling.ts`. |
| `app/src/domain/devJobDebug.ts` | Extended `window.__rushbuddyDev` with failure-handling helpers: `bypassNoAnswerWait`, `canUseSecureDrop`, `requiresOpsHold`, `canMarkSenderUnreachable`, `createMockDropoffEvidence`, `markRunnerPayoutEarnedPatch`. |
| `app/src/app/components/pages/ActiveDeliveryPage.tsx` | Full no-answer runner UI: "No Answer at Door" trigger, 20-min wait + 2 contact attempts tracker, dev bypass button, "Sender Responded" path, "Sender Unreachable" gate, Low-risk 3-step secure drop (location picker + mock photo + confirm), Fragile/Valuable hold-for-ops (warning copy + confirm button). Delivered phase screen shows resolution-specific copy. Earnings Preview shows "Payout confirmed" badge. All status changes use `assertTransition`. |
| `app/src/app/components/pages/TrackingPage.tsx` | Failure evidence card (no-answer timestamps, drop location/photo/geotag for secure drop, hold notice for ops-hold); `ISSUE_REPORTED` mapped to timeline step 2; stale `simStep` bypassed for failure-state jobs; job resolved via `location.state.jobId`; "Confirm Payment to Runner" amber button for failure-path jobs; simulate button hidden when resolution is set. |
| `app/src/app/components/pages/HomePage.tsx` | `handleJobClick` passes `state: { jobId }` to all tracking/rate navigations; `SECURE DROP` / `HOLD FOR OPS` resolution badges on recent job rows; `ISSUE_REPORTED` click routes sender to `/sender/tracking`, runner is a no-op. |
| `app/src/app/components/pages/RatingPage.tsx` | Job lookup uses `location.state.jobId` as top priority; fallback order fixed to PENDING_RATING → DELIVERED (prevents pre-seeded mock DELIVERED job from being closed instead of the real one). |
| `app/src/app/components/pages/RunnerFeedPage.tsx` | `user ?? defaultUser` fallback so `canRunnerSeeJob` runs even before auth; newly posted OPEN jobs now appear in the feed. |
| `app/src/app/components/pages/PostRequestPage.tsx` | Custom price input added to Step 2 (offer must be ≥ system floor; pre-filled with floor; green hint when above floor); `posted_price` uses sender's offer, not hardcoded `priceMax`. |
| `app/src/app/components/pages/AuthPage.tsx` | Restored gender radio-button group (Male / Female / Prefer not to say) that was missing from the registration form. |

---

## 3. Slice map

| Slice | Deliverable |
|-------|-------------|
| **5.0** | Clean up Phase 4 gaps: `assertTransition` in `handleIssue`; `navigate('/home')` after flagging; `TrackingPage.simulateProgress` fixed to go through `DELIVERED → PENDING_RATING` before navigating to `/rate`. |
| **5.1** | No-answer domain fields on `Job` + `failureHandling.ts` + barrel export + `devJobDebug` extensions. |
| **5.2** | "No Answer at Door" trigger + 20-min wait + 2 contact attempts tracker in `ActiveDeliveryPage`. |
| **5.3** | Sender-responded path: "Sender Responded — Continue Delivery" collapses the panel and resumes normal in-transit delivery. |
| **5.4** | "Sender Unreachable" gate: requires both contact attempts logged AND 20-min elapsed (or dev bypass); risk-branch placeholder cards revealed. |
| **5.5** | Low-risk secure unattended drop: 3-step UI (location selector with 4 presets + custom text, mock photo capture, confirm); writes `secure_drop` evidence fields; job → `PENDING_RATING`; `handleSecureDrop` uses double `assertTransition`. |
| **5.6** | Fragile/Valuable hold-for-ops: warning copy ("Do not leave this package unattended"); "Holding Item — Notify Ops" button; writes `hold_for_ops` fields; job → `ISSUE_REPORTED`; `handleOpsHold` uses `assertTransition`. |
| **5.7** | Sender-facing surfacing: failure evidence card in `TrackingPage`; `HOLD FOR OPS` / `SECURE DROP` badges in `HomePage` recent job rows; `ISSUE_REPORTED` timeline step and status copy. |
| **5.8** | Explicit payout copy: resolution-aware delivered phase screen (✅ / 📋 headings); "Payout confirmed ✓" sub-label on payout badge; green "Full agreed fee earned" banner in Earnings Preview. |
| **5.9** | `notes/phase-5-summary.md` (this file). |

---

## 4. Product decisions implemented

| Decision | Implementation |
|----------|----------------|
| 20-minute wait before Sender Unreachable | `canMarkSenderUnreachable` checks `elapsedMs >= 20 * 60 * 1000`; dev bypass via `_devFlags.bypassNoAnswerWait` or inline `waitBypassed` state. |
| 2 contact attempts required | `REQUIRED_CONTACT_ATTEMPTS = 2`; counter capped; "Sender Unreachable" disabled until both logged. |
| Low risk → secure unattended drop only | `canUseSecureDrop(job)` → `job.risk === 'Low'`. Mock evidence: `createMockDropoffEvidence` returns fixed lat/lng + location label as geotag. |
| Fragile/Valuable → hold for ops, never unattended | `requiresOpsHold(job)` → `risk === 'Fragile' \|\| 'Valuable'`. Shown as amber "Hold Item" card; no location/photo steps. |
| Full runner payout regardless of outcome | `markRunnerPayoutEarnedPatch()` returns `{ runner_payout_status: 'earned' }`; applied in both `handleSecureDrop` and `handleOpsHold`. |
| No sender refund | Copy shown in TrackingPage evidence card and failure-path payment note. No refund logic implemented (none required in MVP). |
| No real GPS or camera | `dropoff_geotag` is a fixed mock coordinate (12.9698, 79.1583); `dropoff_photo_url` is a mock URL string. |
| Sender pays runner even on failure paths | TrackingPage "Confirm Payment to Runner" button for `ISSUE_REPORTED` jobs; routes to `/rate` with `state: { jobId }`. |
| `assertTransition` on all status changes | `handleIssue` (IN_TRANSIT → ISSUE_REPORTED), `handleSecureDrop` (IN_TRANSIT → DELIVERED, DELIVERED → PENDING_RATING), `handleOpsHold` (IN_TRANSIT → ISSUE_REPORTED). |

---

## 5. Validation steps

```bash
cd app
pnpm build    # must pass with exit 0
pnpm dev      # http://localhost:5173
```

### Low-risk secure drop (end-to-end)

1. `window.__rushbuddyDev.createSampleJob({ risk: 'Low' })` in console.
2. Accept job → Condition Acknowledged → In Transit.
3. Tap **No Answer at Door** → contact tracker appears (0/2).
4. Log 2 contact attempts → counter fills.
5. Tap **Dev: Simulate 20 min elapsed** → "Sender Unreachable" button activates.
6. Tap **Sender Unreachable** → green Secure Drop card appears.
7. Select a location tile (e.g. "Shop Counter").
8. Tap **Capture drop photo (mock)** → "Photo captured ✓".
9. Tap **Confirm Secure Drop** → spinner → "✅ Secure Drop Complete" screen → navigates `/home`.
10. Verify job: `status: 'PENDING_RATING'`, `no_answer_resolution: 'secure_drop'`, `ops_notified: true`, `runner_payout_status: 'earned'`, `dropoff_photo_url`, `dropoff_geotag`, `dropoff_secure_location`.
11. Home: recent job row shows `PENDING_RATING · SECURE DROP` badge; click → `/rate` → confirm payment → job `CLOSED`.
12. Sender tracking: evidence card shows drop location, photo ✓, geotag, ops notified, runner payout earned, sender refund none.

### Fragile/Valuable hold-for-ops (end-to-end)

1. `window.__rushbuddyDev.createSampleJob({ risk: 'Fragile' })`.
2. Accept → Condition Ack → In Transit → No Answer → 2 attempts → Simulate 20 min → Sender Unreachable.
3. Amber "Hold Item" card shows (green secure drop card must NOT appear).
4. Confirm "Holding Item — Notify Ops" → spinner → "📋 Item Held — Ops Notified" screen → `/home`.
5. Verify: `status: 'ISSUE_REPORTED'`, `no_answer_resolution: 'hold_for_ops'`, `ops_notified: true`, `runner_payout_status: 'earned'`.
6. Home: `ISSUE_REPORTED · HOLD FOR OPS` badge; click (as sender) → tracking page → "Runner Holding Item / Sender unreachable · Ops has been notified".
7. Tracking: "Confirm Payment to Runner →" amber button appears → `/rate` → confirm → job `CLOSED`.

### Normal delivery (regression)

8. Happy-path job → Condition Ack → In Transit → Confirm Delivery → "🎉 Delivered!" → `/home`. Earnings Preview shows no payout banner. ✓
9. No-answer panel does NOT appear unless runner taps "No Answer at Door". ✓
10. Switching from no-answer back (Sender Responded) resumes normal delivery without stale state. ✓

---

## 6. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| `handleIssue` set status but didn't navigate, so UI felt broken | Added `navigate('/home')` after the transition in Slice 5.0. |
| `export let __devBypassNoAnswerWait` caused ES module read-only binding error when set from console | Changed to `export const _devFlags = { bypassNoAnswerWait: false }` — mutating an object property bypasses the binding restriction. |
| "Log Contact Attempt" was pre-filled at 2/2 on repeat tests | `handleNoAnswer` now always hard-resets `no_answer_contact_attempts: 0`, regardless of previous value. |
| After "Condition Acknowledged", UI immediately jumped to "Sender Unreachable" state | `handleConditionAck` now explicitly clears all no-answer fields (`no_answer_at`, `sender_unreachable_at`, `no_answer_resolution`, etc.) and resets `_devFlags.bypassNoAnswerWait`. |
| `bypassNoAnswerWait` persisted from console across test runs | `handleNoAnswer` and `handleConditionAck` both reset `_devFlags.bypassNoAnswerWait = false`. |
| TrackingPage showed happy-path "Rate & Confirm Payment" for ISSUE_REPORTED jobs (stale `simStep = 3`) | Added `isFailureState` check — failure-path jobs always use real `stepIndex`, ignoring `simStep`. |
| Clicking a job in HomePage always opened the wrong job in TrackingPage (stale `ctxActiveJob`) | `handleJobClick` now passes `state: { jobId }` via router; TrackingPage reads `location.state.jobId` as top priority; fallback improved to prefer ISSUE_REPORTED over DELIVERED. |
| RatingPage closed the pre-seeded mock DELIVERED job (JOB-2389) instead of the user's PENDING_RATING job | Fixed lookup order: `navJobId` → PENDING_RATING → DELIVERED. TrackingPage simulate and "Rate" button now also pass `state: { jobId }`. |
| Newly posted OPEN jobs not appearing in runner feed | `user && canRunnerSeeJob` short-circuits to false when `user` is null (pre-auth). Fixed with `user ?? defaultUser` fallback. |
| Hold-for-ops path had no payment button for sender | Added "Confirm Payment to Runner →" amber button in TrackingPage when `job.no_answer_resolution` is set and job isn't CLOSED. |
| Gender radio group disappeared from registration form | Restored in AuthPage — state, validation, and UI. |

---

## 7. Gaps before Phase 6

- **Real wait timer**: The 20-minute countdown is dev-bypassed only; production would need a persistent server-side timestamp.
- **Real GPS geotag**: `dropoff_geotag` is always `{ lat: 12.9698, lng: 79.1583 }` — no device location API used.
- **Real camera capture**: `dropoff_photo_url` is a mock string — no `<input type="file">` or `getUserMedia`.
- **Ops dashboard**: `ops_notified: true` is a flag only; no real ops notification channel exists.
- **Sender refund policy**: Copy says "none" but no payment reversal logic is implemented (fine for MVP).
- **Automated tests**: No test runner; all validation is manual via `pnpm dev` and `window.__rushbuddyDev`.
- **Re-pool after ops-hold**: ISSUE_REPORTED → OPEN transition is in the state machine but no UI to trigger it.
- **Runner hold instructions**: After hold-for-ops, ops has no screen to send return/alternative delivery instructions.
- **FIR export**: Not implemented and explicitly out of scope for Phase 5.

---

*Add `notes/phase-6-summary.md` when Phase 6 is done.*
