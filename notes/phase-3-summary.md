# Phase 3 Summary — Post Request Flow

## 1. Goal of the phase

Phase 3 = Implement the MVP **Post Request** sender flow: collect job type, item details, carry-only rules, route classification, timing, Mode 2 intercity fields, hybrid pricing, and declared-value cap — wiring domain helpers into `PostRequestPage` without redesigning auth, runner delivery, payment, or active delivery.

Source references:
- `docs/plans/sjt-mvp-core-loop.md`
- `docs/product/core-flow-specs.md`
- `notes/phase-1-summary.md`
- `notes/phase-2-summary.md`

Constraints remembered:
- V1 handoff modes only: `mode_1_direct_p2p` and `mode_2_landmark` (no proxy fields on `Job`).
- `purchase_type` hard lock: `carry_only`.
- `Job` shape stays snake_case.
- Figma styling treated as temporary; no visual redesign pass.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `app/src/domain/postingValidation.ts` | Reusable post-request validation: declared value, location-type conflict, `validatePostRequestDraft`. |
| `notes/phase-3-summary.md` | Captures Phase 3 implementation decisions, validations, and remaining gaps. |

### Changed

| File | What changed |
|------|--------------|
| `app/src/domain/types.ts` | Added optional `declared_value` on `Job`; documented as required at posting. |
| `app/src/domain/postingValidation.ts` | Slice 3.1 base; later slices added `LOCATION_TYPE_CONFLICT_MESSAGE`, `getLocationTypeConflictError`, `getDeclaredValueError`, required declared-value checks. |
| `app/src/domain/runnerEligibility.ts` | `isJobPostingValid` delegates to `validateLocationTypes` (same behavior, single source of truth). |
| `app/src/domain/index.ts` | Barrel export for `postingValidation`. |
| `app/src/app/components/pages/PostRequestPage.tsx` | Full post-request wizard: 4 steps (Job Type → Item Details → Locations → Review); domain-enforced posting rules. |

### Not touched (by design)

- Auth pages (`AuthPage`, `VerifyPage`), `RunnerFeedPage` accept logic, `ActiveDeliveryPage`, `TrackingPage`, payment/rating flows, handoff code entry, no-answer flow.

---

## 3. Slice map (what each slice did)

| Slice | Deliverable |
|------|-------------|
| **3.1** | Domain posting validation: `PostRequestDraft`, `validateDeclaredValue`, `validateLocationTypes`, `validatePostRequestDraft`; `declared_value` on `Job`; barrel export. |
| **3.2** | Job type as first wizard step (`campus_immediate` / `campus_scheduled` / `intercity`); `computePriceFloor` and `resolveHandoffMode` use selected type. |
| **3.3** | Carry-only disclaimer + acknowledgement; Food “already ordered and ready” confirmation; `purchase_type: 'carry_only'` on create. |
| **3.4** | Pickup/drop location type selectors (`general` / `mens_hostel` / `womens_hostel`); conflict blocking via domain helpers; stored on created `Job`. |
| **3.5** | Timing fields by job type; `expires_at` via `computeExpiresAt` (immediate +30 min, scheduled = window end, intercity = 2h before travel datetime). |
| **3.6** | Intercity Mode 2 fields: `corridor_landmark`, `receiver_phone` (required for intercity); `handoff_mode: mode_2_landmark`. |
| **3.7** | Hybrid floor pricing: show `price_floor`, editable `posted_price` (default suggested upper bound), `validatePostedPrice` enforcement. |
| **3.8** | Declared value input; positive-only; hard block above `DECLARED_VALUE_MAX_INR` (₹2,000); stored on `Job`. |
| **3.9** | This phase summary note. |

---

## 4. Product decisions implemented in Phase 3

- **Job type chosen first** and drives pricing, handoff mode, timing UI, and expiry rules.
- **Handoff mode locked at post** via `resolveHandoffMode(job_type)`:
  - Campus immediate / scheduled → `mode_1_direct_p2p`
  - Intercity → `mode_2_landmark`
- **Carry-and-deliver only**: mandatory acknowledgement; Food requires “Yes, it's ready”.
- **Location typing** on both endpoints; rejects men's + women's hostel on the same job at post time.
- **Gendered visibility** unchanged at accept time — posted jobs with gendered endpoints filter via existing `canRunnerSeeJob` on the feed.
- **Timing**:
  - Campus immediate: no picker; expires 30 minutes after `created_at`.
  - Campus scheduled: `scheduled_window.start/end`; expires at window end; end must be after start.
  - Intercity: travel datetime required; `travel_date` stored as `YYYY-MM-DD`; expiry 2 hours before travel time (full datetime passed to helper).
- **Mode 2 intercity posting**: `corridor_landmark` + `receiver_phone` required; no proxy UI/fields.
- **Hybrid pricing**: system `price_floor` + sender-entered `posted_price` ≥ floor; runner later accepts `posted_price` as `agreed_price` (accept flow not in this phase).
- **Declared value cap**: required positive amount; blocked above ₹2,000 using `DECLARED_VALUE_MAX_INR` constant.
- **Confirmation code** still generated at job creation via `generateConfirmationCode()` (handoff entry remains a later phase).
- **Sender identity on post** still mocked as `sender_id: 'u1'` — authenticated user wiring deferred.

---

## 5. Validation steps

Build check run across slices:

```bash
cd app
pnpm build
```

Manual checks (Post Request flow):

1. **3.1** — `pnpm build` passes; `@/domain` exports posting validation helpers; mock jobs compile without `declared_value`.
2. **3.2** — First step is Job Type; each type reaches item details; posted job stores `job_type` + derived `handoff_mode`.
3. **3.3** — Cannot proceed without carry-only ack; Food blocked without ready confirmation; non-food proceeds with carry-only ack only.
4. **3.4** — `general → general` posts; `womens_hostel → general` stores types; `mens_hostel → womens_hostel` blocked inline; women's hostel job visible to matching runners via `canRunnerSeeJob`.
5. **3.5** — Immediate `expires_at` ≈ +30 min; invalid scheduled window blocked; valid scheduled stores `scheduled_window` and `expires_at = end`; intercity requires datetime; valid intercity stores `travel_date` and pre-travel expiry.
6. **3.6** — Intercity shows landmark + phone; missing values blocked; posted job has `mode_2_landmark`, `corridor_landmark`, `receiver_phone`.
7. **3.7** — Floor displayed; posted price below floor blocked; at/above floor allowed; `posted_price` on job matches entered value.
8. **3.8** — Blank / zero / negative declared value blocked; ₹2,500 blocked with cap message; ₹2,000 allowed; `declared_value` stored on job.
9. **End-to-end** — Complete post navigates to sender tracking without console errors.

Dev console spot-check after post:

```js
// Inspect latest job in context or via __rushbuddyDev
const j = /* latest posted Job */;
j.job_type, j.handoff_mode, j.price_floor, j.posted_price, j.declared_value, j.expires_at
```

---

## 6. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| Domain validation existed but Post Request UI ignored it (Phase 1 gap). | Slice 3.1 added `postingValidation.ts`; later slices wired helpers into `PostRequestPage` and `handlePost`. |
| `computeExpiresAt` throws for scheduled/intercity without timing fields. | Slice 3.5 added timing UI; removed interim 24h expiry placeholder. |
| Duplicate gendered-hostel conflict logic risk in UI vs domain. | Slice 3.4 uses `validateLocationTypes` / `getLocationTypeConflictError`; `isJobPostingValid` delegates to same helper. |
| `posted_price` was hardcoded to display range max (`priceMax`). | Slice 3.7 added editable offer field with `validatePostedPrice` gate. |
| Cap constant lived in domain but had no posting UI. | Slice 3.8 required `declared_value` with `getDeclaredValueError` and `DECLARED_VALUE_MAX_INR` in copy. |
| Intercity Mode 2 fields missing despite `resolveHandoffMode` mapping. | Slice 3.6 collected and stored `corridor_landmark` / `receiver_phone`. |
| PowerShell `&&` chaining (Windows). | Use `;` between commands (carried from Phase 1). |

---

## 7. Gaps before Phase 4 (checklist)

- **Authenticated sender on post**: replace hardcoded `sender_id: 'u1'` / mock sender fields with logged-in `user` from `AppContext`.
- **Runner accept flow**: set `agreed_price = posted_price` at MATCHED; accept-time eligibility checks beyond feed visibility.
- **One active job per sender** warning/block from core-flow spec (not implemented in Post Request).
- **Job expiry UX**: 25-minute sender notification with extend/cancel for campus immediate; auto-expire unmatched jobs in UI/state.
- **Status transitions in UI**: call `assertTransition` / `canTransition` when pages mutate `job.status` (Tracking, Runner feed accept, Active delivery).
- **Tracking page**: surface new job fields (timing, declared value, handoff mode, confirmation code holder copy) as needed.
- **Handoff code entry** at delivery (runner session) — not modeled in posting phase.
- **Payment / rating** flows unchanged; cash visibility rules tied to Mode 1 + code entry still pending.
- **Mock jobs**: optional `declared_value` on legacy samples; consider adding representative intercity / scheduled mocks for dev.
- **Automated tests** for post-request validation and wizard gates.
- **Backend persistence** for jobs, auth session, OTP — still in-memory demo.
- **ops_notified** default/false at creation; ops logging not wired.

---

*Phase 4 should pick up runner match/accept, delivery, and/or sender tracking enforcement per the MVP plan.*
