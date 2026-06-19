# Phase 5 Summary — No-Answer / Failure Handling

## 1. Goal of the phase

Phase 5 = Handle the case where the runner reaches the drop-off but the sender doesn't answer.

- 20-minute wait + 2 contact attempts before declaring sender unreachable.
- **Low risk** → runner leaves item at a secure spot (mock photo + geotag + ops notified). Job → PENDING_RATING.
- **Fragile / Valuable** → runner holds item, ops notified. Job → ISSUE_REPORTED.
- Runner always gets the full agreed fee. Sender gets no refund.
- No real GPS, camera, or backend — all mocked.

---

## 2. Files / folders added or changed

**Added:**
- `app/src/domain/failureHandling.ts` — policy constants, risk guards, wait-window check, mock evidence builder, payout patch, dev flags
- `notes/phase-5-summary.md` — this file

**Changed:**
- `app/src/domain/types.ts` — new types (`NoAnswerResolution`, `RunnerPayoutStatus`, `DropoffGeotag`) + 10 new optional fields on `Job`
- `app/src/domain/index.ts` — barrel-exported `failureHandling`
- `app/src/domain/devJobDebug.ts` — exposed failure helpers on `window.__rushbuddyDev`
- `app/src/app/components/pages/ActiveDeliveryPage.tsx` — entire no-answer runner UI (wait timer, contact attempts, sender responded, sender unreachable, secure drop flow, hold-for-ops flow, payout copy)
- `app/src/app/components/pages/TrackingPage.tsx` — failure evidence card, ISSUE_REPORTED state, payment button for failure paths, job lookup fix
- `app/src/app/components/pages/HomePage.tsx` — resolution badges on job rows, correct click navigation
- `app/src/app/components/pages/RatingPage.tsx` — job lookup priority fix (PENDING_RATING before DELIVERED)
- `app/src/app/components/pages/RunnerFeedPage.tsx` — `user ?? defaultUser` so feed works before auth
- `app/src/app/components/pages/PostRequestPage.tsx` — custom price input (offer must be ≥ system floor)
- `app/src/app/components/pages/AuthPage.tsx` — restored missing gender radio group

---

## 3. Important concepts learned

- **`assertTransition`** — use it for every status change in UI handlers, not just in the domain layer. If it fails, log and bail.
- **Mutable export object for dev flags** — `export const _devFlags = { bypassNoAnswerWait: false }` instead of `export let`, because ES module bindings are read-only but object properties aren't.
- **Router state for job targeting** — `navigate('/rate', { state: { jobId } })` + `useLocation()` to read it. Prevents the wrong job being picked up when multiple sender jobs exist.
- **`isFailureState` to ignore stale `simStep`** — local component state can lag behind the real job status. For failure paths, always derive display step from the actual job status.
- **`user ?? defaultUser` fallback** — if auth hasn't completed, `user` in context is null. The runner feed filter `user && canRunnerSeeJob(user, j)` silently hides all jobs. Fallback to `defaultUser` keeps things working in dev.
- **Reset all related state on fresh start** — `handleConditionAck` and `handleNoAnswer` must clear every no-answer field (on both the job and local UI state) or stale data bleeds into the next test run.

---

## 4. Validation steps

```bash
cd app
pnpm build    # must exit 0
pnpm dev      # http://localhost:5173
```

**Low-risk secure drop:**
1. `window.__rushbuddyDev.createSampleJob({ risk: 'Low' })` in console
2. Accept → Condition Ack → In Transit
3. Tap "No Answer at Door" → log 2 contact attempts
4. "Dev: Simulate 20 min elapsed" → "Sender Unreachable" unlocks
5. Tap Sender Unreachable → pick a secure spot → capture mock photo → Confirm Secure Drop
6. See "✅ Secure Drop Complete" screen → lands on `/home`
7. Job should be `PENDING_RATING`, `ops_notified: true`, `runner_payout_status: 'earned'`
8. Click job → `/rate` → confirm payment → job closes

**Fragile/Valuable hold-for-ops:**
1. Same flow with `risk: 'Fragile'`
2. Amber "Hold Item" card shows (no green secure drop card)
3. Tap "Holding Item — Notify Ops" → "📋 Item Held — Ops Notified" → `/home`
4. Job `ISSUE_REPORTED`, `hold_for_ops`, payout earned
5. As sender: tracking page shows evidence card + "Confirm Payment to Runner" button → `/rate` → closes

**Regression:**
- Normal handoff-code delivery still works and shows "🎉 Delivered!" ✓
- Runner feed shows newly posted OPEN jobs ✓
- Rating page closes the right job (not the mock seed JOB-2389) ✓

---

## 5. Problems faced

| Problem | Fix |
|---------|-----|
| "Flag to Ops" button did nothing visibly | Added `navigate('/home')` after the status change |
| `export let __devBypassNoAnswerWait` threw read-only error from console | Changed to `export const _devFlags = { bypassNoAnswerWait: false }` |
| Contact attempt counter pre-filled at 2/2 on repeat tests | `handleNoAnswer` always hard-resets `no_answer_contact_attempts: 0` |
| After Condition Ack, UI jumped straight to Sender Unreachable | `handleConditionAck` now clears all no-answer fields + resets dev flags |
| Dev bypass persisted across test sessions | `handleNoAnswer` and `handleConditionAck` both reset `_devFlags.bypassNoAnswerWait = false` |
| TrackingPage showed "Rate & Confirm Payment" for ISSUE_REPORTED jobs | `isFailureState` check forces real `stepIndex`, ignores stale `simStep` |
| Clicking a job in HomePage opened the wrong job in TrackingPage | `handleJobClick` passes `state: { jobId }` via router; TrackingPage reads it as top priority |
| RatingPage closed the mock seed job instead of the real one | Lookup order fixed: `navJobId` → PENDING_RATING → DELIVERED |
| Newly posted jobs missing from runner feed | `user ?? defaultUser` fallback — `user` is null before auth |
| Hold-for-ops path had no payment button for sender | Added "Confirm Payment to Runner" amber button in TrackingPage |
| Gender field missing from registration form | Restored radio group in AuthPage |
