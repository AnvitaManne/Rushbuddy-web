# Phase 3 Summary — Post Request Flow

## 1. Goal of the phase

Phase 3 = Implement the MVP **Post Request** sender flow: job type, item details, carry-only rules, route classification, timing, Mode 2 intercity fields, hybrid pricing, declared-value cap, and post-submit guardrails — wiring domain helpers into `PostRequestPage` without redesigning runner delivery, payment, or rating.

Also included (review + bug fixes before Phase 4):
- Authenticated sender on post
- Auth guard on `/sender/post`
- One in-flight request per sender
- Sender cancel for OPEN jobs (before runner accepts)
- Fixes for “completed delivery still active” and “blocked from posting with no cancel path”

Source references:
- `docs/plans/sjt-mvp-core-loop.md`
- `docs/product/core-flow-specs.md`
- `notes/phase-1-summary.md`
- `notes/phase-2-summary.md`

Constraints remembered:
- V1 handoff modes only: `mode_1_direct_p2p` and `mode_2_landmark` (no proxy fields on `Job`).
- `purchase_type` hard lock: `carry_only`.
- `Job` shape stays snake_case.
- No full auth/delivery/payment redesign — only compile fixes and small sender-side bug fixes where posting/active-job logic required it.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `app/src/domain/postingValidation.ts` | Single source of truth for post-request validation, timing, Mode 2 fields, one-active-job checks, sender cancel eligibility. |
| `app/src/app/components/auth/RequireAuth.tsx` | Redirects unauthenticated users away from protected sender routes (e.g. `/sender/post`). |
| `notes/phase-3-summary.md` | This file — memory for future-you after Phase 3. |

### Changed

| File | What changed |
|------|--------------|
| `app/src/domain/types.ts` | Added optional `declared_value` on `Job` (required at posting in UI). |
| `app/src/domain/jobTransitions.ts` | Added `OPEN → CLOSED` for sender cancel before match. |
| `app/src/domain/runnerEligibility.ts` | `isJobPostingValid` delegates to `validateLocationTypes` (no duplicate conflict logic). |
| `app/src/domain/index.ts` | Barrel export for `postingValidation`. |
| `app/src/app/components/pages/PostRequestPage.tsx` | Full 4-step post wizard; domain validation on post; authenticated sender; active-job block + cancel buttons; review copy by job type; posted price “Use suggested” behavior. |
| `app/src/app/routes.tsx` | Wrapped post route with `RequireAuth`. |
| `app/src/app/components/pages/HomePage.tsx` | Shows OPEN sender jobs (“WAITING FOR RUNNER”) with link to tracking; uses logged-in `user.id`. |
| `app/src/app/components/pages/TrackingPage.tsx` | Cancel OPEN jobs via `OPEN → CLOSED`; uses authenticated sender id; clears `activeJob` on cancel. |
| `app/src/app/components/pages/ActiveDeliveryPage.tsx` | Only shows `MATCHED` / `IN_TRANSIT` runner jobs; clears context on delivery complete (bug fix). |

### Not touched (by design)

- Full runner accept/delivery redesign, handoff code entry, payment/rating flows, backend persistence.

### Slice map (what each slice did)

| Slice | Deliverable |
|-------|-------------|
| **3.1** | `postingValidation.ts`: `PostRequestDraft`, `validateDeclaredValue`, `validateLocationTypes`, `validatePostRequestDraft`; `declared_value` on `Job`. |
| **3.2** | Job type as first wizard step; `computePriceFloor` / `resolveHandoffMode` use selected type. |
| **3.3** | Carry-only ack + Food “ready” confirmation; `purchase_type: 'carry_only'`. |
| **3.4** | Pickup/drop location type selectors; gendered hostel conflict blocking via domain helpers. |
| **3.5** | Timing fields by job type; `expires_at` via `computeExpiresAt` (removed 24h placeholder). |
| **3.6** | Intercity Mode 2: `corridor_landmark`, `receiver_phone`. |
| **3.7** | Hybrid pricing: `price_floor` + editable `posted_price` with `validatePostedPrice`. |
| **3.8** | Declared value input; ₹2,000 cap via `DECLARED_VALUE_MAX_INR`. |
| **3.9** | Phase summary note (this file). |
| **Review** | `RequireAuth`, authenticated sender fields, one active job per sender, extended draft validation (timing, Mode 2, active job). |
| **Bug fixes** | Active delivery after complete; sender cancel for OPEN jobs; home/tracking/post cancel UX. |

---

## 3. Important concepts / architecture decisions

- **Domain-first posting rules**: All post validation lives in `postingValidation.ts`. UI calls helpers; business rules are not duplicated in components.
- **Job type drives everything**: Pricing floor, handoff mode, timing UI, expiry, and review copy all branch from `job_type` chosen in step 1.
- **Handoff mode locked at post**: `resolveHandoffMode(job_type)` — campus → `mode_1_direct_p2p`, intercity → `mode_2_landmark`.
- **Hybrid pricing**: System `price_floor` + sender `posted_price` (≥ floor). Runner accept will set `agreed_price = posted_price` (Phase 4).
- **One in-flight sender request**: `SENDER_ACTIVE_JOB_STATUSES` = `OPEN`, `MATCHED`, `IN_TRANSIT`, `ISSUE_REPORTED`. Does **not** include `DELIVERED` / `PENDING_RATING` (delivery leg done → sender can post again).
- **Sender cancel (OPEN only)**: `canSenderCancelJob` + `OPEN → CLOSED`. Once a runner accepts (`MATCHED+`), cancel from post/tracking is not offered in V1 UI.
- **Runner active delivery statuses**: `RUNNER_ACTIVE_DELIVERY_STATUSES` = `MATCHED`, `IN_TRANSIT` only — completed `DELIVERED` jobs must not show on Active Delivery.
- **Authenticated post**: `handlePost` uses `user.id`, `user.name`, `user.hostel_block`; `/sender/post` requires login via `RequireAuth`.
- **Posted price UX**: `postedPriceTouched` flag — floor changes do not blindly overwrite user input; “Use suggested” resets to suggested value.
- **Gendered visibility unchanged at post**: Posted jobs with gendered endpoints still filter on runner feed via existing `canRunnerSeeJob`.
- **Confirmation code**: Still generated at creation via `generateConfirmationCode()`; runner entry at handoff is Phase 4+.

Key exports in `postingValidation.ts`:
- `validatePostRequestDraft`, `validatePostRequestTiming`, `validatePostRequestMode2`
- `getSenderActiveJob`, `getSenderActiveJobError`, `canSenderCancelJob`
- `SENDER_ACTIVE_JOB_STATUSES`, `RUNNER_ACTIVE_DELIVERY_STATUSES`
- `buildScheduledWindowFromLocal`, `toTravelDateFromLocal`, `parseDatetimeLocalToIso`

---

## 4. Validation steps

```bash
cd app
pnpm install   # if needed
pnpm dev       # http://localhost:5173
pnpm build     # must pass
```

Manual checks — Post Request wizard:

1. **Job type (3.2)** — First step is Job Type; each type reaches item details; job stores `job_type` + derived `handoff_mode`.
2. **Carry-only (3.3)** — Cannot proceed without carry-only ack; Food blocked without “ready” confirmation.
3. **Locations (3.4)** — `mens_hostel → womens_hostel` blocked; valid combos store `pickup_location_type` / `drop_location_type`.
4. **Timing (3.5)** — Immediate expires ≈ +30 min; scheduled window end must be future; intercity requires travel datetime + `travel_date`.
5. **Mode 2 (3.6)** — Intercity requires `corridor_landmark` + `receiver_phone`.
6. **Pricing (3.7)** — Posted price below floor blocked; at/above floor allowed.
7. **Declared value (3.8)** — Blank/zero/negative blocked; above ₹2,000 blocked; ₹2,000 allowed.

Manual checks — Guardrails and bugs fixed:

8. **Auth** — Logged out → `/sender/post` redirects to auth; logged in → wizard loads.
9. **One active job** — With OPEN/MATCHED/IN_TRANSIT sender job, post blocked with clear message.
10. **Cancel OPEN job** — From Post Request banner, Tracking page, or after cancel → can post again.
11. **Home banner** — OPEN job shows “WAITING FOR RUNNER” → tap opens tracking.
12. **Active delivery complete** — Confirm delivery → Active Delivery shows “No active delivery”; sender can post new request.
13. **End-to-end post** — Successful post navigates to `/sender/tracking` without console errors.

Dev console spot-check after post:

```js
const j = /* latest posted Job from context or __rushbuddyDev */;
j.job_type, j.handoff_mode, j.price_floor, j.posted_price, j.declared_value, j.expires_at, j.sender_id
```

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| Post Request UI ignored domain validation (Phase 1 gap). | Added `postingValidation.ts`; wired into wizard gates and `handlePost` via `validatePostRequestDraft`. |
| `computeExpiresAt` threw without timing fields for scheduled/intercity. | Slice 3.5 added timing UI; removed interim 24h expiry placeholder. |
| Duplicate gendered-hostel logic risk in UI vs domain. | `validateLocationTypes` + `getLocationTypeConflictError`; `isJobPostingValid` delegates to same helper. |
| `posted_price` was tied to display max, not sender offer. | Slice 3.7: editable field + `validatePostedPrice`; review fix added `postedPriceTouched` + “Use suggested”. |
| Declared value cap existed in constants but not in UI. | Slice 3.8: required field + `getDeclaredValueError` + ₹2,000 cap copy. |
| Intercity Mode 2 fields missing. | Slice 3.6: `corridor_landmark`, `receiver_phone` on post. |
| Post still used hardcoded `sender_id: 'u1'`. | Review fix: `handlePost` uses authenticated `user` from context. |
| Anyone could open `/sender/post` without login. | Review fix: `RequireAuth` wrapper on route. |
| No one-active-job enforcement. | Review fix: `getSenderActiveJob` / `getSenderActiveJobError` in domain + banner on Post Request. |
| Completed delivery still showed on Active Delivery. | Removed fallback that matched any non-`CLOSED` job; only `MATCHED` / `IN_TRANSIT`; clear `activeJob` on `DELIVERED`. |
| `DELIVERED` still counted as sender “active” → blocked from posting. | Narrowed `SENDER_ACTIVE_JOB_STATUSES` to pre-completion in-flight statuses. |
| User blocked from new post with OPEN job but no cancel UI. | Added `OPEN → CLOSED`; cancel on Post Request + Tracking; home banner for OPEN jobs; copy says cancel before reposting. |
| Tracking/Home still hardcoded `'u1'` in places. | Updated to `user?.id ?? 'u1'` for sender/runner lookups. |
| PowerShell rejected `&&` in terminal. | Use `;` between commands on Windows (same as Phase 1). |

---

## Gaps before Phase 4 (quick reminder)

- **Runner accept flow**: set `agreed_price = posted_price` at MATCHED; accept-time eligibility + race handling.
- **Status transitions everywhere**: call `assertTransition` when UI mutates `job.status` (feed accept, tracking simulate, active delivery).
- **Job expiry UX**: 25-minute sender notification; extend/cancel; auto-expire unmatched OPEN jobs.
- **Handoff code entry** at delivery (runner session).
- **Tracking page**: surface timing, declared value, handoff mode, confirmation code copy for sender.
- **Hardcoded `'u1'` cleanup** in remaining pages (`RunnerFeedPage`, `RatingPage`, `ProfilePage`, etc.).
- **Automated tests** for posting validation and wizard gates.
- **Backend persistence** — still in-memory demo.

---

*Add `notes/phase-4-summary.md` when Phase 4 is done.*
