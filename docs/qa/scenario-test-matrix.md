# RushBuddy MVP — Scenario Test Matrix (Phase 8)

Pilot QA checklist for the mock frontend. Source of truth: `docs/plans/sjt-mvp-core-loop.md` + phase summaries (Phases 1–7).

**How to use**

1. Run `pnpm dev` from `app/` (separate from this doc).
2. Execute each scenario; mark **Pass/Fail**.
3. Put friction, copy issues, or unexpected states in **Notes**.
4. Prefer DEV shortcuts only when the scenario says so (e.g. skip 20-min wait, expire dispute window).

**Known pilot limits (do not fail as product bugs)**

- No real OTP email, payments, GPS, camera, KYC, or law-enforcement filing.
- App state is in-memory; refresh resets session (see P2-04).
- FIR package is mock export/copy only.

**Pass/Fail legend:** leave blank until tested → `Pass` / `Fail`.

---

## P0 — Happy paths

### P0-01 — Auth registration + OTP

| Field | Value |
|-------|--------|
| **Scenario ID** | P0-01 |
| **Scenario name** | Auth registration + OTP verify |
| **Role(s)** | New user |
| **Priority** | P0 |
| **Preconditions** | Logged out / fresh session |
| **Steps** | 1. Open Auth. 2. Enter `@vitstudent.ac.in` email, full name, hostel block, gender (Male / Female / Prefer not to say). 3. Confirm email on typo-guard screen. 4. Enter OTP (mock). 5. Verify & enter. |
| **Expected result** | User lands on Home; session created; gender stored for matching only (not shown on profile/cards). |
| **Pass/Fail** | |
| **Notes** | |

---

### P0-02 — Campus Immediate Mode 1 → closed

| Field | Value |
|-------|--------|
| **Scenario ID** | P0-02 |
| **Scenario name** | Campus immediate Mode 1 happy path |
| **Role(s)** | Sender, Runner |
| **Priority** | P0 |
| **Preconditions** | Verified user; can switch sender/runner as needed |
| **Steps** | 1. Post **Campus Immediate** job (Mode 1). 2. As runner: accept → start delivery. 3. Condition Acknowledged (photo if Fragile/Valuable). 4. At drop: enter correct 4-digit confirmation code. 5. As sender: confirm payment (Cash or UPI/PhonePe allowed) → submit rating. |
| **Expected result** | Job reaches `PENDING_RATING` after code; after pay+rate → `CLOSED`; Home shows dimmed CLOSED. |
| **Pass/Fail** | |
| **Notes** | |

---

### P0-03 — Intercity Mode 2 → UPI-only payment

| Field | Value |
|-------|--------|
| **Scenario ID** | P0-03 |
| **Scenario name** | Intercity Mode 2 post + UPI/PhonePe only |
| **Role(s)** | Sender, Runner |
| **Priority** | P0 |
| **Preconditions** | Verified user |
| **Steps** | 1. Post **Intercity** with travel date, corridor landmark, receiver phone. 2. Runner accepts → condition ack → enters handoff code. 3. Sender opens `/rate` payment step. |
| **Expected result** | `handoff_mode` is `mode_2_landmark`. Payment step shows UPI and PhonePe only; **Cash hidden**. Confirm + rate → `CLOSED`. |
| **Pass/Fail** | |
| **Notes** | |

---

### P0-04 — Low-risk no-answer → secure drop → closure

| Field | Value |
|-------|--------|
| **Scenario ID** | P0-04 |
| **Scenario name** | Low-risk secure drop after no-answer |
| **Role(s)** | Runner, Sender |
| **Priority** | P0 |
| **Preconditions** | Active `IN_TRANSIT` job with risk **Low** |
| **Steps** | 1. Runner taps No Answer at Door. 2. Wait protocol (or DEV bypass). 3. Log 2 contact attempts. 4. Sender Unreachable → choose secure spot → mock photo → Confirm Secure Drop. 5. Sender pays + rates (or confirms payment path). |
| **Expected result** | Job → `PENDING_RATING`; `ops_notified: true`; mock dropoff evidence present; `runner_payout_status` earned; then → `CLOSED`. Full fee; no sender refund. |
| **Pass/Fail** | |
| **Notes** | Locked rule: Low risk allows secure unattended drop (plan No-Answer section / Phase 5). |

---

### P0-05 — Fragile no-answer → hold-for-ops → payment / ops review

| Field | Value |
|-------|--------|
| **Scenario ID** | P0-05 |
| **Scenario name** | Fragile hold-for-ops (no unattended drop) |
| **Role(s)** | Runner, Sender |
| **Priority** | P0 |
| **Preconditions** | Active `IN_TRANSIT` job with risk **Fragile** or **Valuable** |
| **Steps** | 1. No Answer → wait + 2 contacts. 2. Sender Unreachable. 3. Confirm hold path (no green secure-drop card). 4. As sender: confirm payment to runner from Tracking (or rate path). |
| **Expected result** | No secure drop UI; hold-for-ops / `ISSUE_REPORTED` (or equivalent ops-hold state); ops notified; full runner payout path available; sender can confirm payment. |
| **Pass/Fail** | |
| **Notes** | Fragile/Valuable: unattended drop forbidden. |

---

### P0-06 — Dispute “Not delivered” → theft → suspension → FIR

| Field | Value |
|-------|--------|
| **Scenario ID** | P0-06 |
| **Scenario name** | Theft escalation + FIR support package |
| **Role(s)** | Sender (ops DEV optional) |
| **Priority** | P0 |
| **Preconditions** | Job delivered / at rating (`PENDING_RATING` or rate screen); runner assigned |
| **Steps** | 1. On rate/dispute: choose **Not delivered** (theft path). 2. Submit dispute. 3. Open Tracking: generate FIR support package → copy. 4. Check runner feed/profile trust (suspended). |
| **Expected result** | Job `DISPUTED`; theft escalation event; runner suspended / payout withheld; FIR package is mock JSON (placeholders OK); **not** a real filing. |
| **Pass/Fail** | |
| **Notes** | Mock-only: no LE upload, no real KYC. |

---

### P0-07 — Pre-pickup runner no-show → re-pool

| Field | Value |
|-------|--------|
| **Scenario ID** | P0-07 |
| **Scenario name** | Find New Buddy after pre-pickup no-show |
| **Role(s)** | Sender |
| **Priority** | P0 |
| **Preconditions** | Job `MATCHED`; runner has not condition-acked |
| **Steps** | 1. Wait 10 min from `matched_at` **or** use DEV elapsed shortcut. 2. Tap **Find New Buddy** / Runner Unresponsive. |
| **Expected result** | Job returns `OPEN`; runner cleared; previous runner `no_show_count` increments; trust event logged; job visible again for eligible runners. |
| **Pass/Fail** | |
| **Notes** | |

---

## P1 — Edge cases

### P1-01 — Invalid VIT email

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-01 |
| **Scenario name** | Non-VIT email blocked |
| **Role(s)** | New user |
| **Priority** | P1 |
| **Preconditions** | On Auth |
| **Steps** | Enter email not ending in `@vitstudent.ac.in`; try continue. |
| **Expected result** | Inline block; no OTP step. Copy clarifies VIT-only beta. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-02 — Missing gender

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-02 |
| **Scenario name** | Gender required at registration |
| **Role(s)** | New user |
| **Priority** | P1 |
| **Preconditions** | On Auth |
| **Steps** | Fill email, name, hostel; leave gender unset; try send/continue. |
| **Expected result** | Cannot proceed until Male / Female / Prefer not to say selected. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-03 — Wrong OTP / lock copy

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-03 |
| **Scenario name** | Wrong OTP feedback |
| **Role(s)** | New user mid-verify |
| **Priority** | P1 |
| **Preconditions** | Reached OTP screen |
| **Steps** | Enter incorrect OTP repeatedly (up to mock lock behavior). |
| **Expected result** | Clear incorrect-code / attempts remaining (or lock) copy; user not verified. |
| **Pass/Fail** | |
| **Notes** | Record exact copy if confusing. |

---

### P1-04 — Food not ready blocked

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-04 |
| **Scenario name** | Food requires ready acknowledgement |
| **Role(s)** | Sender |
| **Priority** | P1 |
| **Preconditions** | Post Request; item type Food |
| **Steps** | Select Food; leave “already ordered and ready” unchecked; try post. |
| **Expected result** | Post blocked until carry-only / ready ack checked. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-05 — Declared value > ₹2,000 blocked

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-05 |
| **Scenario name** | Declared-value hard cap |
| **Role(s)** | Sender |
| **Priority** | P1 |
| **Preconditions** | Post Request |
| **Steps** | Enter declared value above ₹2,000; try post. |
| **Expected result** | Hard block; job not created. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-06 — Mens + womens hostel conflict blocked

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-06 |
| **Scenario name** | Mixed gendered hostel endpoints rejected |
| **Role(s)** | Sender |
| **Priority** | P1 |
| **Preconditions** | Post Request |
| **Steps** | Set pickup `mens_hostel` and drop `womens_hostel` (or reverse); try post. |
| **Expected result** | Validation error; job not created. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-07 — Posted price below floor blocked

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-07 |
| **Scenario name** | Offer price ≥ floor |
| **Role(s)** | Sender |
| **Priority** | P1 |
| **Preconditions** | Post Request; floor visible |
| **Steps** | Set editable `posted_price` below floor; try post. |
| **Expected result** | Blocked; cannot submit below floor. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-08 — Mode 2 missing landmark / phone blocked

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-08 |
| **Scenario name** | Intercity required fields |
| **Role(s)** | Sender |
| **Priority** | P1 |
| **Preconditions** | Job type Intercity |
| **Steps** | Omit `corridor_landmark` and/or `receiver_phone`; try post. |
| **Expected result** | Blocked until both present (plus travel date as required by UI). |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-09 — Suspended runner cannot accept

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-09 |
| **Scenario name** | Suspension blocks accept |
| **Role(s)** | Runner |
| **Priority** | P1 |
| **Preconditions** | Runner suspended (theft path or `__rushbuddyDev.suspendRunner`) |
| **Steps** | Open Runner Feed; attempt accept on an OPEN job. |
| **Expected result** | Accept blocked / suspended UI; job not `MATCHED` for this runner. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-10 — Wrong handoff code does not complete

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-10 |
| **Scenario name** | Incorrect confirmation code |
| **Role(s)** | Runner |
| **Priority** | P1 |
| **Preconditions** | `IN_TRANSIT` job; sender code known from Tracking |
| **Steps** | Enter wrong 4-digit code; submit. |
| **Expected result** | Delivery does not complete; status stays `IN_TRANSIT` (not `PENDING_RATING` / not closed). |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-11 — Cash hidden for Mode 2

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-11 |
| **Scenario name** | Mode 2 cash visibility |
| **Role(s)** | Sender |
| **Priority** | P1 |
| **Preconditions** | Intercity job at payment step (`PENDING_RATING`) |
| **Steps** | Open payment method picker on `/rate`. |
| **Expected result** | Only UPI / PhonePe; Cash not shown. |
| **Pass/Fail** | |
| **Notes** | Pair with P0-03. |

---

### P1-12 — Close job before dispute window ends blocked

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-12 |
| **Scenario name** | Manual close gated by dispute window |
| **Role(s)** | Sender |
| **Priority** | P1 |
| **Preconditions** | Job paid; dispute window still open (`paid_at` recent) |
| **Steps** | Open Tracking; look for Close Job. |
| **Expected result** | Close not available (or blocked) until window elapsed; DEV expire may unlock for later close test. |
| **Pass/Fail** | |
| **Notes** | |

---

### P1-13 — DISPUTED job cannot auto-close

| Field | Value |
|-------|--------|
| **Scenario ID** | P1-13 |
| **Scenario name** | DISPUTED stays open for ops |
| **Role(s)** | Sender / DEV ops |
| **Priority** | P1 |
| **Preconditions** | Job in `DISPUTED` |
| **Steps** | Wait / check Tracking and Home; use **Mock Ops Resolution** on Tracking to close, or leave open. Confirm no auto-close without ops resolve. |
| **Expected result** | Job remains `DISPUTED` until mock ops picks an outcome → `CLOSED`; no auto-close. FIR package is separate from resolution. |
| **Pass/Fail** | |
| **Notes** | |

---

## P2 — Polish checks

### P2-01 — Copy clarity

| Field | Value |
|-------|--------|
| **Scenario ID** | P2-01 |
| **Scenario name** | Critical copy readable |
| **Role(s)** | Any |
| **Priority** | P2 |
| **Preconditions** | Spot-check Auth, Post, Active Delivery, Rate, Tracking, FIR |
| **Steps** | Read primary CTAs and error/empty states; note jargon or contradictions. |
| **Expected result** | User can tell what to do next without domain jargon; locked job-type blurbs match plan if shown. |
| **Pass/Fail** | |
| **Notes** | |

---

### P2-02 — Gender not shown publicly

| Field | Value |
|-------|--------|
| **Scenario ID** | P2-02 |
| **Scenario name** | Gender privacy |
| **Role(s)** | Sender, Runner |
| **Priority** | P2 |
| **Preconditions** | Registered user with gender set |
| **Steps** | Check Profile, runner cards, Tracking, ratings, Home badges. |
| **Expected result** | Gender never displayed; only used for hostel matching. |
| **Pass/Fail** | |
| **Notes** | |

---

### P2-03 — No KYC / Aadhaar shown publicly

| Field | Value |
|-------|--------|
| **Scenario ID** | P2-03 |
| **Scenario name** | KYC/Aadhaar privacy |
| **Role(s)** | Any |
| **Priority** | P2 |
| **Preconditions** | Profile + FIR preview open |
| **Steps** | Scan Profile and FIR mock package UI for real Aadhaar/college ID values. |
| **Expected result** | No real KYC collection UI; FIR shows placeholders / mock labels only. |
| **Pass/Fail** | |
| **Notes** | |

---

### P2-04 — Refresh resets state (known)

| Field | Value |
|-------|--------|
| **Scenario ID** | P2-04 |
| **Scenario name** | Refresh clears in-memory state |
| **Role(s)** | Any |
| **Priority** | P2 |
| **Preconditions** | Mid-flow job or session |
| **Steps** | Browser refresh. |
| **Expected result** | State resets (known mock limitation). Fail only if UI crashes or lies that data persisted. |
| **Pass/Fail** | |
| **Notes** | Document warning for piloters. |

---

### P2-05 — Mobile layout sanity

| Field | Value |
|-------|--------|
| **Scenario ID** | P2-05 |
| **Scenario name** | Mobile viewport sanity |
| **Role(s)** | Any |
| **Priority** | P2 |
| **Preconditions** | Narrow viewport (~375px) or phone |
| **Steps** | Walk Auth → Post → Feed → Active → Rate → Tracking; check overflow, clipped CTAs, unusable inputs. |
| **Expected result** | Primary actions reachable; no broken horizontal scroll on core screens. |
| **Pass/Fail** | |
| **Notes** | Polish only; no redesign in Phase 8 unless flow-blocking. |

---

## Summary tracker

| ID | Name | Priority | Pass/Fail | Tester | Date |
|----|------|----------|-----------|--------|------|
| P0-01 | Auth registration + OTP | P0 | | | |
| P0-02 | Campus Mode 1 happy path | P0 | | | |
| P0-03 | Intercity Mode 2 UPI-only | P0 | | | |
| P0-04 | Low-risk secure drop | P0 | | | |
| P0-05 | Fragile hold-for-ops | P0 | | | |
| P0-06 | Theft + FIR package | P0 | | | |
| P0-07 | Pre-pickup re-pool | P0 | | | |
| P1-01 | Invalid VIT email | P1 | | | |
| P1-02 | Missing gender | P1 | | | |
| P1-03 | Wrong OTP / lock | P1 | | | |
| P1-04 | Food not ready | P1 | | | |
| P1-05 | Value > ₹2,000 | P1 | | | |
| P1-06 | Hostel gender conflict | P1 | | | |
| P1-07 | Price below floor | P1 | | | |
| P1-08 | Mode 2 missing fields | P1 | | | |
| P1-09 | Suspended cannot accept | P1 | | | |
| P1-10 | Wrong handoff code | P1 | | | |
| P1-11 | Cash hidden Mode 2 | P1 | | | |
| P1-12 | Close before window | P1 | | | |
| P1-13 | DISPUTED no auto-close | P1 | | | |
| P2-01 | Copy clarity | P2 | | | |
| P2-02 | Gender not public | P2 | | | |
| P2-03 | No KYC public | P2 | | | |
| P2-04 | Refresh resets | P2 | | | |
| P2-05 | Mobile layout | P2 | | | |

---

## Validation (Slice 8.1)

1. Open `docs/qa/scenario-test-matrix.md`.
2. Confirm **P0 / P1 / P2** sections exist.
3. Confirm each scenario has **Steps** and **Expected result**.
4. No app build required for this slice.

---

*Add findings from dogfooding in Pass/Fail + Notes. File friction bugs in later Phase 8 slices — do not expand product scope here.*
