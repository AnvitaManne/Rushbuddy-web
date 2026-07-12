# RushBuddy — Internal Dogfooding Runbook

Practical script for **10–20 simulated jobs** before any campus pilot rollout.  
Companion checklist: [`scenario-test-matrix.md`](./scenario-test-matrix.md).

---

## 0. Hard rules (read aloud before starting)

| Rule | Meaning |
|------|---------|
| Dummy packages only | Empty box, notebook, water bottle — nothing valuable or perishable you care about. |
| No real Aadhaar / phone sharing | Use fake numbers and placeholder IDs. Never photograph real KYC docs. |
| No real money | Do not send UPI to anyone. Tap **mock** UPI / PhonePe / Cash in-app only. |
| Mock payments only | “Paid” in the app means intent recorded — not a bank transfer. |
| No real FIR filing | FIR button builds a **mock support package**. Do not email police or colleges. |
| Refresh wipes state | Browser refresh resets the mock app. Finish a job before refreshing. |

If anyone is unsure: **stop and ask ops** — do not invent workarounds with real data or money.

---

## 1. Who participates

| Role | People | Job |
|------|--------|-----|
| **Senders** | 2–3 | Post jobs, track, pay (mock), rate, dispute if scripted. |
| **Runners** | 2–3 | Accept, pick up, enter handoff code, run no-answer paths. |
| **Ops observer** | 1 | Times events, fills log sheet, screenshots bugs, does **not** play sender/runner except DEV helpers. |

**Suggested labels (fake identities in-app)**

- Sender A / Sender B / Sender C  
- Runner 1 / Runner 2 / Runner 3  
- Ops = note-taker with laptop + phone for screenshots  

Use `@vitstudent.ac.in`-style **test** emails only. Prefer one browser profile / window per role if the mock app shares one logged-in user (ops notes which persona is “in character”).

---

## 2. Test duration

### Run A — Tabletop (required): 60–90 minutes

- Everyone in one room (or one call).  
- Phones/laptops on the mock app (`pnpm dev` already running — someone technical starts it).  
- Walk the **job mix** below; use DEV shortcuts for 10‑min / 20‑min waits when the UI offers them.  
- Goal: cover every P0 path once without walking campus.

### Run B — Optional campus walk (same day or later): ~45–60 minutes

- Same people; still **dummy packages** and **no real money**.  
- Physically move between a fake pickup and drop for 3–5 campus-immediate jobs only.  
- Skip long timers with DEV if needed; focus on confusion while moving.

---

## 3. Before you start (10 minutes)

1. Ops opens [`scenario-test-matrix.md`](./scenario-test-matrix.md) and a blank log (section 5).  
2. Confirm everyone heard the hard rules.  
3. Smoke-check: one person can open Home, Post Request, Runner Feed.  
   - On Home: **Sender** toggle stays on Command Centre and shows **sender** jobs/stats (not runner earnings).  
   - **Runner** toggle stays on Home and shows runs / earnings.  
   - Post / Feed are via Quick Actions or sidebar — not the mode toggle itself.  
4. Agree hand signals: “stuck”, “bug”, “skip to next job”.  
5. **Do not** refresh mid-job unless testing P2-04 on purpose.

---

## 4. Job mix (19 simulated jobs)

Work **in order**. Tick when done. Map to matrix IDs where helpful.

| # | Job type / path | Count | Who posts | Who runs | Matrix |
|---|-----------------|------:|-----------|----------|--------|
| 1–4 | Campus immediate (Mode 1 happy path) | 4 | Senders A/B | Runners 1/2 | P0-02 |
| 5–7 | Campus scheduled | 3 | Senders A/B | Runner 1/2 | — |
| 8–10 | Intercity / landmark (Mode 2) | 3 | Sender C | Runner 3 | P0-03, P1-11 |
| 11–13 | Low-risk no-answer → **secure drop** | 3 | Sender A/B | Runner 1/2 | P0-04 |
| 14–15 | Fragile/Valuable no-answer → **hold-for-ops** | 2 | Sender B | Runner 2 | P0-05 |
| 16–17 | Disputes (include one **Not delivered** / theft) | 2 | Sender A | (prior runner) | P0-06 |
| 18 | Pre-pickup runner **no-show** → Find New Buddy | 1 | Sender C | Runner 3 ghosts | P0-07 |
| 19 | **Suspended** runner cannot accept | 1 | any OPEN job | Suspended runner | P1-09 |

**Total: 19** (fits the 10–20 band). If short on time, finish all **P0-mapped** rows first (1–4, 8–10, 11–13, 14–15, 16–17, 18, 19).

### Mini-scripts (non-technical)

**Campus immediate (jobs 1–4)**  
Post Campus Immediate → runner accepts → Condition Acknowledged → runner enters the **4-digit code** from sender’s Tracking screen → sender mock-pays → rates → job Closed.

**Scheduled (jobs 5–7)**  
Same as campus, but choose Campus Scheduled and set a start/end window. Confirm the job posts and can be accepted.

**Intercity (jobs 8–10)**  
Choose Intercity; fill travel date, landmark, receiver phone (fake). Complete delivery with code. On payment: confirm **Cash is hidden**; use mock UPI or PhonePe only.

**Low-risk secure drop (jobs 11–13)**  
Risk = Low. After pickup, runner taps No Answer → (DEV skip wait if available) → 2 contact attempts → Sender Unreachable → secure spot + mock photo → Confirm. Sender mock-pays / closes path.

**Fragile hold (jobs 14–15)**  
Risk = Fragile or Valuable. Same no-answer start; **do not** leave package. Hold-for-ops path only. Sender can still confirm payment to runner.

**Disputes (jobs 16–17)**  
After a delivery reaches rating: one mild dispute (e.g. damaged); one **Not delivered** theft path → check suspension + mock FIR generate/copy on Tracking. Then use **Mock Ops Resolution** (three outcomes) to close `DISPUTED` → `CLOSED`. Ops screenshots FIR + resolve panel.

**No-show (job 18)**  
Match a runner; **do not** Condition Ack. Sender opens Tracking → DEV “10 min elapsed” if shown → **Find New Buddy**. Job should go back to Finding Buddy; note no-show count if visible.

**Suspended runner (job 19)**  
After theft suspension (or ops uses DEV suspend if available): that runner opens Job Feed → should see restricted / cannot accept.

---

## 5. Data to record

Ops keeps one row per job (copy into a spreadsheet or notes app).

| Field | Example |
|-------|---------|
| Job # | 12 |
| Type | Low-risk secure drop |
| Sender / Runner | A / 1 |
| Time to post | 1:40 (mm:ss from open Post → Post Request) |
| Time to match | 0:45 (post → accept) |
| Time to pickup | 2:10 (accept → Condition Ack) |
| Outcome | Closed / Disputed / Re-pooled / Stuck |
| Confusion points | “Didn’t know where the code was” |
| Failed validations | Tried price below floor — blocked ✓ |
| Trust concerns | “FIR looked too real — scary” |
| Screenshot? | Yes — link/filename |
| Triage label | P1 before pilot |

Also log **session-level**:

- Anyone almost used real UPI or real phone? (process fail)  
- Refresh accidents and lost jobs  
- Any **impossible recovery** (job stuck with no button path)

---

## 6. Bug triage labels

When logging an issue, pick **one**:

| Label | Use when |
|-------|----------|
| **P0 blocker** | Cannot complete a P0 path; data loss mid-flow; wrong payment rules (e.g. Cash on Mode 2); unsafe recovery. |
| **P1 before pilot** | Edge validation wrong/missing; suspension/re-pool broken; confusing but recoverable. |
| **P2 later** | Minor logic/copy that does not block pilot. |
| **UI polish later** | Spacing, wording tone, non-blocking layout — no behavior change required for pilot. |

Write: short title → steps to reproduce → expected vs actual → screenshot → label.

---

## 7. Exit criteria (go / no-go)

**Go for campus pilot prep** only if all are true:

1. **All P0 scenarios** in the matrix pass (or P0-01..P0-07 covered by this run and marked Pass).  
2. **No impossible recovery states** left open (every stuck job has a known exit or a P0 bug filed).  
3. **≥ 80% of P1** scenarios Pass **or** have a **known fix** already filed as P1 before pilot.  
4. Hard rules held: **no real money**, **no real sensitive KYC/phone/Aadhaar**, dummy packages only.  
5. Ops has screenshots for every P0/P1 fail.

**No-go:** any open **P0 blocker**, or Mode 2 cash visible, or theft/FIR path crashes, or re-pool leaves the job unusable.

---

## 8. Suggested 90-minute agenda

| Time | Block |
|------|--------|
| 0:00–0:10 | Rules, roles, open log, smoke check |
| 0:10–0:25 | Jobs 1–4 campus immediate |
| 0:25–0:35 | Jobs 5–7 scheduled |
| 0:35–0:50 | Jobs 8–10 intercity + cash check |
| 0:50–1:05 | Jobs 11–13 secure drop |
| 1:05–1:15 | Jobs 14–15 hold-for-ops |
| 1:15–1:25 | Jobs 16–17 disputes + FIR |
| 1:25–1:35 | Jobs 18–19 no-show + suspension |
| 1:35–1:45 | Score exit criteria; assign triage labels |

If you finish early: sample 3–4 **P1** matrix rows (wrong OTP, price below floor, mens+womens hostel, wrong code).

---

## 9. After the run

1. Ops updates Pass/Fail on [`scenario-test-matrix.md`](./scenario-test-matrix.md).  
2. Paste bug list into the team chat with triage labels.  
3. Decide go / no-go using section 7.  
4. Optional Run B only if Run A was **go** or only polish leftovers remain.

---

## Validation (Slice 8.2)

1. Open `docs/qa/internal-dogfooding-runbook.md`.  
2. Confirm a non-technical person can follow roles, job mix, and mini-scripts.  
3. Confirm explicit **no real money / no real sensitive data** rules.  
4. No app build required for this slice.

---

*Phase 8 dogfooding only — do not expand product scope during the run. File friction; fix in later slices.*
