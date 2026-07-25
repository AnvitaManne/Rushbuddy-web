# RushBuddy — Pilot Readiness Checklist (Phase 8.7)

Final **go / no-go** sheet before any campus pilot. Fill this in a short decision meeting after dogfooding.

**Companions**

- [`scenario-test-matrix.md`](./scenario-test-matrix.md) — Pass/Fail for P0 / P1 / P2
- [`internal-dogfooding-runbook.md`](./internal-dogfooding-runbook.md) — 19-job run + exit criteria
- Product rules: `docs/plans/sjt-mvp-core-loop.md`, `docs/product/working-notes-v1.md`

**How to use**

1. Complete dogfooding Run A (and optional Run B) per the runbook.
2. Update the scenario matrix Pass/Fail columns.
3. Walk **this** checklist top to bottom; mark each row `Done` / `Open` / `N/A`.
4. Record **Launch decision** (section 6) and list required fixes if not Green.

**Meeting roles:** Product owner · Ops lead · Tech lead · (optional) legal reviewer

**Date:** _______________ **Facilitator:** _______________

---

## 1. Product readiness

| # | Check | Evidence | Status |
|---|--------|----------|--------|
| 1.1 | **All P0 scenarios pass** (P0-01 … P0-07 in scenario matrix) | Matrix Pass marks + dogfood log | ☐ Done / ☐ Open |
| 1.2 | **P1 known issues documented** — every Fail or deferred P1 has a short title, repro, triage label (`P1 before pilot` or `P2 later`) | Bug list from dogfood §6 | ☐ Done / ☐ Open |
| 1.3 | **≥ 80% of P1 Pass** *or* open P1s have an agreed fix owner + target before pilot | Matrix rollup + bug list | ☐ Done / ☐ Open |
| 1.4 | **No dead-end states** in the mock app — every stuck job has a UI exit, DEV helper path, or filed **P0 blocker** | Dogfood “impossible recovery” log | ☐ Done / ☐ Open |
| 1.5 | Core loop still intact: Auth gender → Verify; 3 job types; location types; editable offer ≥ floor; handoff code → `PENDING_RATING`; Mode 2 cash hidden | Spot-check or P0/P1 matrix | ☐ Done / ☐ Open |
| 1.6 | Dummy packages only in any campus walk; no valuable / perishable dogfood items | Ops attestation | ☐ Done / ☐ Open |

**Product gate:** 1.1 and 1.4 must be Done. Open **P0 blockers** → automatic Red (section 6).

---

## 2. Ops readiness

| # | Check | Owner / note | Status |
|---|--------|--------------|--------|
| 2.1 | **Who watches disputes** named for pilot window (name + backup + contact channel) | Owner: _______________ Backup: _______________ | ☐ Done / ☐ Open |
| 2.2 | **Response SLA** agreed and written for pilot (recommended from product notes: review disputes within **~4 hours** during active pilot hours; theft / `DISPUTED` same day) | SLA: _______________ Hours: _______________ | ☐ Done / ☐ Open |
| 2.3 | Ops knows **FIR support is mock only** — generate/copy package for process practice; **do not** email police, college security, or file a real FIR from the app | Briefing done | ☐ Done / ☐ Open |
| 2.4 | **No real compensation promised** — V1 peer platform is not an insurer; no cash reimbursement for theft/damage from RushBuddy; communicate verbally + in any pilot briefing | Briefing done | ☐ Done / ☐ Open |
| 2.5 | Ops has a place to log disputes / hold-for-ops (spreadsheet or chat thread is fine for pilot) | Link/path: _______________ | ☐ Done / ☐ Open |
| 2.6 | Escalation path for fragile/valuable **hold-for-ops** (who tells runner where to take the item) | Owner: _______________ | ☐ Done / ☐ Open |

**Ops gate:** 2.1–2.4 must be Done before any real student cohort is invited.

---

## 3. Legal / policy readiness

Mark **Ready** only if a draft exists and has been reviewed; **Pending** if still to write; **Blocked** if pilot cannot start without it.

| # | Check | Draft status | Status |
|---|--------|--------------|--------|
| 3.1 | **T&C draft** (or pilot addendum) — independent providers, peer risk, carry-only food, mock/pilot limitations if still mock-only | ☐ Ready / ☐ Pending / ☐ Blocked | ☐ Done / ☐ Open |
| 3.2 | **Liability language** — platform facilitates matching; parties own package risk; no guarantee of outcome | ☐ Ready / ☐ Pending / ☐ Blocked | ☐ Done / ☐ Open |
| 3.3 | **Declared value cap** — hard product + policy alignment at **₹2,000**; above-cap jobs blocked in app (P1-05) | Cap confirmed ₹2,000 | ☐ Done / ☐ Open |
| 3.4 | **Peer platform disclaimer** — not courier company, not insurer, no V1 cash compensation for theft | In T&C or pilot briefing sheet | ☐ Done / ☐ Open |
| 3.5 | Piloters told: use test data only if still on mock stack; no real Aadhaar photos / real UPI | Briefing | ☐ Done / ☐ Open |

**Legal gate for a *real* campus cohort:** 3.1–3.4 at least **Pending with named owner and date**, not forgotten. If T&C is Blocked with no interim pilot waiver, do not go Green.

---

## 4. Trust / safety readiness

| # | Check | Evidence | Status |
|---|--------|----------|--------|
| 4.1 | **KYC mock vs real gap clear** — V1 pilot auth is VIT email / mock OTP only; College ID + Aadhaar + phone verification is **not** live; everyone briefed so they do not assume full KYC | Briefing + P2-03 | ☐ Done / ☐ Open |
| 4.2 | **No-show / suspension rules** understood: pre-pickup Find New Buddy; theft/`Not delivered` → suspend + withhold payout path; suspended runner cannot accept (P0-07, P0-06, P1-09) | Dogfood jobs 18–19 Pass | ☐ Done / ☐ Open |
| 4.3 | **Gender privacy** — gender collected for matching only; not shown on profile / runner cards / public UI (P0-01, P2 gender privacy) | Spot-check Profile + cards | ☐ Done / ☐ Open |
| 4.4 | Hostel gender matching / reject mixed men’s + women’s endpoints still enforced (P1-06) | Matrix or spot-check | ☐ Done / ☐ Open |
| 4.5 | Fragile/Valuable: **no unattended drop**; Low-risk secure drop only after no-answer protocol | P0-04 / P0-05 Pass | ☐ Done / ☐ Open |

**Trust gate:** 4.1 and 4.3 must be Done (honesty + privacy). 4.2 Failures that leave unsafe runners active → Red.

---

## 5. Technical readiness

| # | Check | Evidence | Status |
|---|--------|----------|--------|
| 5.1 | **App runs locally** — `pnpm dev` from `app/` opens Home / Post / Feed without crash | Tech smoke | ☐ Done / ☐ Open |
| 5.2 | **Known no-backend limitation** documented for piloters — no real email OTP, GPS, camera pipeline, or server persistence | Pilot briefing | ☐ Done / ☐ Open |
| 5.3 | **State resets on refresh** — everyone warned; finish jobs before refresh; refresh-wipe is not a product bug (P2-04) | Briefing | ☐ Done / ☐ Open |
| 5.4 | **No real payment** — Cash / UPI / PhonePe taps are mock intent only; no bank transfer in pilot protocol | Hard rules + briefing | ☐ Done / ☐ Open |
| 5.5 | DEV helpers (if used) limited to ops / dogfood — not advertised as user features | Ops note | ☐ Done / ☐ Open |
| 5.6 | Single-user mock caveat understood (same account can act sender + runner) — Home **Sender/Runner toggle stays on `/home`**, filters jobs/stats by mode (Sender → Tracking/Rate; Runner → Active Delivery); do not treat as multi-account production | Briefing + Home smoke | ☐ Done / ☐ Open |

**Tech gate:** 5.1–5.4 must be Done. If the pilot expects real persistence or real pay, this checklist stays **Red** until backend/payments exist (out of Phase 8 scope).

---

## 6. Launch decision

### Scorecard (fill after sections 1–5)

| Area | Result | Notes |
|------|--------|-------|
| Product | ☐ Pass / ☐ Gaps | |
| Ops | ☐ Pass / ☐ Gaps | |
| Legal / policy | ☐ Pass / ☐ Gaps | |
| Trust / safety | ☐ Pass / ☐ Gaps | |
| Technical | ☐ Pass / ☐ Gaps | |

### Decision

Choose **one**:

| Light | Meaning | When to use |
|-------|---------|-------------|
| **Green** | Ready for limited campus pilot prep / invite cohort under agreed rules | All gates in §§1–5 met; **zero** open P0 blockers; legal T&C Ready or explicit interim waiver signed off |
| **Yellow** | Soft launch only (tiny internal cohort / founders only) or delay public invite | No P0 blockers; open P1s have owners; legal Pending but not Blocked; briefing + ops coverage solid |
| **Red** | Do not invite campus users | Any open **P0 blocker**; Mode 2 cash visible; theft/FIR crash; re-pool dead-end; ops/legal/trust honesty gaps; or expectation of real pay/backend |

**Decision today:** ☐ Green ☐ Yellow ☐ Red

**Decided by:** _______________ **Date:** _______________

### Required fixes before Green

List only items that **block** Green. Leave empty if already Green.

| # | Fix | Owner | Target date | Done? |
|---|-----|-------|-------------|-------|
| 1 | | | | ☐ |
| 2 | | | | ☐ |
| 3 | | | | ☐ |
| 4 | | | | ☐ |
| 5 | | | | ☐ |

### Explicit non-goals for this pilot (do not block Green if still mock)

- Real payments / payouts  
- Real KYC (Aadhaar / College ID upload)  
- Real FIR filing or LE integration  
- Production backend / durable jobs across refresh  
- GPS tracking / live camera evidence pipeline  

---

## Sign-off

| Role | Name | Initials | Agree with decision? |
|------|------|----------|----------------------|
| Product | | | ☐ Yes / ☐ No |
| Ops | | | ☐ Yes / ☐ No |
| Tech | | | ☐ Yes / ☐ No |
| Legal (if present) | | | ☐ Yes / ☐ No |

---

## Validation (Slice 8.7)

1. Open `docs/qa/pilot-readiness-checklist.md`.
2. Confirm a pilot decision meeting can fill it without reading the whole codebase.
3. No app build required for this slice.

---

*Phase 8.7 only — checklist for readiness; does not expand product scope.*
