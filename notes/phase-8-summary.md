# Phase 8 Summary — QA + Pilot Hardening

## 1. Goal of the phase

Phase 8 = Make the mock app **pilot-testable**: scenario matrix, dogfooding runbook, pilot fixtures, restore broken MVP flows, friction copy, go/no-go checklist, README how-to.

**Not** new product scope. No backend, real payments, real KYC, GPS, or FIR filing.

Source of truth: `docs/plans/sjt-mvp-core-loop.md`, `docs/product/core-flow-specs.md`, Phases 1–7 behavior (many phase notes were missing on disk — see §5).

Hard pilot limits (always):
- No real money / KYC / LE filing
- In-memory state — **refresh resets**
- FIR = mock support package only

---

## 2. Files / folders added or changed

### Added (`docs/qa/`)

| File | Why it exists |
|------|----------------|
| `scenario-test-matrix.md` | P0 / P1 / P2 scenarios with Pass/Fail for pilot QA |
| `internal-dogfooding-runbook.md` | 19-job tabletop script, roles, exit criteria, triage labels |
| `pilot-readiness-checklist.md` | Final Green / Yellow / Red go/no-go sheet |

### Added / restored (`app/src/domain/`)

| File | Why it exists |
|------|----------------|
| `demoScenarios.ts` | `createPilotScenarioJobs()` — `PILOT-01`…`12` dogfood fixtures |
| `paymentPolicy.ts` | Allowed payment methods (Mode 1 cash OK; Mode 2 UPI/PhonePe only) |
| `failureHandling.ts` | No-answer / secure drop / hold-for-ops helpers |
| `closurePolicy.ts` | Close / dispute-window rules |
| `trustOps.ts` | Suspension, FIR mock package, no-show helpers |

*(Some of these were “ghost” / unwired before 8.5 — Phase 8 re-wired them into UI.)*

### Changed (high signal)

| File | What changed |
|------|----------------|
| `devJobDebug.ts` | `__rushbuddyDev.loadPilotScenarios()`, suspend / bypass helpers |
| `AppContext.tsx` | `pendingSignup`, trust store, `createPilotJobs` into DEV attach, `defaultUser` export |
| Auth / Verify / Post / Feed / Active / Tracking / Rating / Home / Profile | P0 restore + P1 copy; MVP locked fields kept |
| `README.md` + `app/README.md` | How to run QA, build, load pilot scenarios |
| `notes/phase-8-summary.md` | This file |

### Slice map (what each slice did)

| Slice | Deliverable |
|-------|-------------|
| **8.0** | Doc/spec drift audit (review only) — plan contradictions, missing phase notes |
| **8.1** | `docs/qa/scenario-test-matrix.md` |
| **8.2** | `docs/qa/internal-dogfooding-runbook.md` |
| **8.3** | `demoScenarios.ts` + `loadPilotScenarios()` |
| **8.4** | QA pass report — found Phases 2–7 UI largely unwired |
| **8.5** | **P0 restore** — gender, job types, handoff code → `PENDING_RATING`, no-answer, payment policy, re-pool, FIR mock, eligibility, hide gender on Profile |
| **8.6** | **P1 friction** — badges, OTP/handoff/rating/Find New Buddy/Post disabled reasons, DEV tip |
| **8.7** | `docs/qa/pilot-readiness-checklist.md` |
| **8.8** | Root + app README QA instructions |

### Post-8.5 / 8.6 bugfixes (same phase)

- Home Recent Jobs / active card: `openJob` + navigate by `jobId`
- `user` null vs `defaultUser` (`u1`) mismatch → empty feed / “no active”
- Same user as sender+runner: `openJob` respects **Home role toggle**
- Wrong handoff code: **3 attempts then lock**
- Tip saved on payment confirm
- Sender/Runner toggle **stays on Home** (does not force Post / Feed)
- **Home is role-aware (not label-only):** Sender mode shows sender jobs/stats/tracking; Runner mode shows runs/earnings/active delivery — never force-switch role when opening a job
- **Restored Slice 7.6 mock ops resolution** on Tracking for `DISPUTED` (was lost in 8.5 rewrite) — three outcomes + optional unsuspend; FIR package stays separate

---

## 3. Important concepts / architecture decisions

- **QA order:** scenario matrix → dogfooding runbook → readiness checklist (then Green/Yellow/Red).
- **Pilot fixtures ≠ full flows:** `loadPilotScenarios()` seeds mid-states for dogfood; happy path still Auth → Post → Accept → Code → Pay → Rate.
- **Avoid circular imports:** `demoScenarios` uses `createSampleJob`; AppContext passes `createPilotJobs` into `attachDevJobDebug` instead of importing AppContext from domain.
- **Single-user mock + Home `currentRole`:** one `u1` can be sender and runner. On Home:
  - Toggle **only** sets `currentRole` and **stays on `/home`** (Post / Feed are Quick Actions or nav).
  - Sender mode → filter `sender_id === uid`, sender snapshot stats, open → Tracking / Rate (not Active Delivery).
  - Runner mode → filter `runner_id === uid`, earnings / runner metrics, open → Active Delivery.
  - Do **not** call `setCurrentRole` inside `openJob` in a way that overrides the user’s toggle.
- **MVP locked fields** (`.cursor/rules/mvp-locked-fields.mdc`): gender on Auth→Verify; 3 job types + locked copy; location types; editable offer ≥ floor — never delete in “small” refactors.
- **Payment:** Mode 1 allows Cash; Mode 2 hides Cash (`getAllowedPaymentMethods`).
- **No-answer:** Low → secure drop path; Fragile/Valuable → hold-for-ops (no unattended drop).
- **Handoff:** runner enters 4-digit `confirmation_code` → `PENDING_RATING` (not a fake “Job Done” skip).
- **Doc drift still exists:** plan frontmatter / `core-flow-specs` Flow 4 may disagree with Phase 5 Low secure drop — trust **locked MVP + this summary** for pilot QA.
- **Phase notes must live on disk** in `notes/` — missing 2–7 notes caused pain in 8.0/8.4.

---

## 4. Validation steps

```bash
cd app
pnpm install   # if needed
pnpm dev       # http://localhost:5173
pnpm build     # must pass
```

Pilot QA path:

1. Open `docs/qa/scenario-test-matrix.md` — walk P0 (then P1).
2. Follow `docs/qa/internal-dogfooding-runbook.md` (19 jobs).
3. Fill `docs/qa/pilot-readiness-checklist.md` → Green / Yellow / Red.

DEV console (after `pnpm dev`):

```js
__rushbuddyDev.loadPilotScenarios()
// optional: bypassNoAnswerWait(true), suspendRunner('u1'), unsuspendRunner('u1')
```

Smoke:

1. Auth → gender → Verify → Home.
2. **Sender** toggle: stay on Home; see **My requests** / sender snapshot (not runner earnings); job tap → Tracking/Rate.
3. **Runner** toggle: stay on Home; see earnings / runner metrics; job tap → Active Delivery.
4. Quick Action → Post (all 3 job types) or Browse Jobs — do not expect the mode toggle itself to leave Home.
5. Refresh once on purpose — confirm state wipe is expected.

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| Phase notes 2–7 missing / ghost on disk | Recovered behavior from chats for audit; **write summaries after every phase** (`notes/README.md`) |
| Plan says “no unattended drop” vs Phase 5 Low secure drop | Pilot QA follows Low = secure drop, Fragile/Valuable = hold; treat plan Active Delivery sentence as stale |
| Slice 8.4: Phases 2–7 UI unwired (no gender, hardcoded `campus_immediate`, no handoff code, cash always, etc.) | Slice **8.5** P0 restore of locked MVP flows + domain wiring |
| Domain files existed but pages ignored them | Wire `paymentPolicy` / `failureHandling` / `trustOps` / posting validation into pages |
| Home job click / “Simulate → pay” not opening Rating | `openJob` + look up by `jobId`; don’t require `user?.id` only |
| Feed empty / no active job after login | Use `user ?? defaultUser` / `uid = user?.id ?? defaultUser.id` |
| Sender mode opened runner Active Delivery | Same `u1` both roles — branch on `currentRole` |
| Unlimited wrong handoff codes | Cap at 3 attempts, then lock; reset when `job.id` changes |
| Sender/Runner toggle always navigated to Post/Feed | Toggle only `setCurrentRole`; stay on Home |
| Sender mode still **looked/acted like runner** (earnings, runner jobs, openJob forced runner) | Filter jobs + stats by `currentRole`; Sender → Tracking/Rate; Runner → Active; never override toggle in `openJob` |
| DISPUTED Tracking only showed FIR — **no ops resolution mocks** (lost in 8.5 rewrite of Slice 7.6) | Restored Mock Ops Resolution panel: runner at fault / sender error / unclear → `CLOSED` + payout + optional unsuspend |
| Circular import risk for pilot loader | AppContext injects `createPilotJobs` into DEV API |

---

## Gaps still open after Phase 8

- Fix remaining **doc drift** in `sjt-mvp-core-loop.md` / `core-flow-specs.md` (Mode 3 frontmatter, Flow 4, unattended-drop wording).
- Rewrite missing `notes/phase-2`…`phase-7` summaries if you need them before a big rewrite.
- Real backend, payments, KYC, timers, multi-user — **out of Phase 8**.
- Fill matrix Pass/Fail + readiness checklist in a real dogfood meeting before inviting campus users.

---

*Next: add `notes/phase-9-summary.md` when Phase 9 starts/ends. Template: `notes/README.md`.*
