# Phase 1 Summary — Domain / Data Layer

## 1. Goal of the phase

Phase 1 = Build the **domain layer** for jobs and users: types, state machine, pure helpers, runner visibility rules, and wire it into `AppContext` — **no new UI screens**, no auth/post-request/delivery redesign.

Source of truth: `docs/product/core-flow-specs.md`, `docs/plans/sjt-mvp-core-loop.md`.

Constraints remembered:
- V1 handoff: `mode_1_direct_p2p` and `mode_2_landmark` only (no proxy fields on `Job`).
- 4-digit `confirmation_code` at job creation; runner enters at handoff.
- `gender` on `User` is internal (matching only): `male` | `female` | `prefer_not_to_say`.

---

## 2. Files / folders added or changed

### Added (`app/src/domain/`)

| File | Why it exists |
|------|----------------|
| `enums.ts` | Shared string unions: `JobStatus`, `JobType`, `HandoffMode`, `LocationType`, `UserGender`, etc. |
| `types.ts` | Canonical `User` and `Job` interfaces (snake_case). |
| `constants.ts` | `DECLARED_VALUE_MAX_INR` (2000) for future posting validation. |
| `jobTransitions.ts` | Allowed status transitions + `canTransition` / `assertTransition`. |
| `jobHelpers.ts` | Pure helpers: confirmation code, price floor, expiry, handoff mode, posted-price check. |
| `runnerEligibility.ts` | `canRunnerSeeJob`, `isJobPostingValid` (gendered hostel rules). |
| `devJobDebug.ts` | Dev-only: `logJobTransition`, `createSampleJob`, `window.__rushbuddyDev`. |
| `index.ts` | Barrel re-exports (not `devJobDebug` — import that directly when needed). |

### Changed

| File | What changed |
|------|----------------|
| `app/src/app/context/AppContext.tsx` | Re-exports domain `Job`/`User`; `mockJobs` via `createSampleJob()`; snake_case; `drop_location_type` instead of `isWomensHostel`; dev helpers in `import.meta.env.DEV`. |
| `app/README.md` | Short “Dev job helpers” section for `__rushbuddyDev`. |
| Page components | **TypeScript only**: camelCase → snake_case field access so app still compiles. |
| `RunnerFeedPage.tsx` | Filters OPEN jobs with `canRunnerSeeJob(user, job)`. |

### Slice map (what each slice did)

| Slice | Deliverable |
|-------|-------------|
| **1.1** | `types.ts` + `enums.ts` + `constants.ts` |
| **1.2** | `jobTransitions.ts` |
| **1.3** | `jobHelpers.ts` |
| **1.4** | `runnerEligibility.ts` |
| **1.5** | Wire domain into `AppContext` + fix TS in pages |
| **1.6** | `devJobDebug.ts` + README dev notes |

---

## 3. Important concepts / architecture decisions

- **Domain vs UI**: All business rules live under `app/src/domain/`. Pages/context consume types; rules are not duplicated in components yet (Phase 2 will enforce them).
- **Snake_case on domain models**: `sender_id`, `posted_price`, etc. UI was updated to match when wiring (Slice 1.5).
- **Pricing model**: `price_floor` (system min) + `posted_price` (sender offer) at OPEN; `agreed_price` set at MATCHED.
- **Handoff mode**: Derived from `job_type` via `resolveHandoffMode()` — campus → mode 1, intercity → mode 2.
- **State machine**: Explicit adjacency map in `ALLOWED_TRANSITIONS`; validate with `canTransition` / `assertTransition` (not yet called from UI on every status change).
- **Runner feed visibility**: `canRunnerSeeJob` — women’s/men’s hostel on **pickup OR drop**; `prefer_not_to_say` excluded from gendered jobs; suspended runners see nothing.
- **Invalid postings**: `isJobPostingValid` rejects mens + womens hostel on same job (not wired to Post Request UI yet).
- **Barrel export**: `import { Job, canTransition } from '@/domain'` (`@` → `app/src`).
- **Dev helpers**: `createSampleJob()` builds full `Job` objects; `window.__rushbuddyDev` only in dev.
- **No proxy fields** on `Job` (informal receiver = share confirmation code out of band).

---

## 4. Validation steps

```bash
cd app
pnpm install   # if needed
pnpm dev       # http://localhost:5173 (Vite default)
pnpm build     # production compile — must pass
```

Manual checks (from Slice 1.5):

1. Log in → **Runner feed**: female default user should **not** see JOB-2403 if you temporarily set `gender: 'male'` in `defaultUser`.
2. **Post request** → tracking loads without console errors.
3. **Home** / **Active delivery** (JOB-2404 MATCHED) still render routes and prices.

Dev console (after `pnpm dev`):

```js
__rushbuddyDev.logJobTransition('JOB-2401', 'OPEN', 'MATCHED')
__rushbuddyDev.addJob({ drop_location_type: 'womens_hostel' })
```

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| PowerShell rejected `&&` in terminal | Use `;` between commands on Windows. |
| Wiring domain meant **breaking all pages** that used camelCase (`priceMin`, `senderId`, …) | Slice 1.5: bulk rename to snake_case across pages; no layout changes. |
| `isWomensHostel` on mock jobs | Replaced with `drop_location_type: 'womens_hostel'` on JOB-2403. |
| Runner feed empty before login | `canRunnerSeeJob` needs `user`; feed shows 0 OPEN until OTP/verify sets user — expected until Phase 2 auth flow. |
| `buildMockJob` duplicated logic | Slice 1.6: single `createSampleJob()` in `devJobDebug.ts`; `mockJobs` and dev console share it. |
| Gender shown on Profile page | Left as-is in Phase 1 (compile-only page fixes); plan says hide in UI — **Phase 2 gap**. |
| Domain rules not enforced in UI | `assertTransition`, `validatePostedPrice`, `isJobPostingValid` exist but pages still set `status` directly — **Phase 2 gap**. |

---

## Gaps before Phase 2 (quick reminder)

- Enforce transitions + posting validation in UI flows.
- Post request: location types, job types, declared value cap, Mode 2 fields.
- Hide `gender` in UI; map registration labels to snake_case.
- Job expiry, handoff code entry, automated tests.

---

*Add `notes/phase-2-summary.md` when Phase 2 is done.*
