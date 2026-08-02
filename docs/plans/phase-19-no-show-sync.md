# Phase 19 — No-Show Strike Sync (Find New Buddy)

**Goal:** Persist “Find New Buddy” re-pool so the runner gets a real no-show strike (and auto-suspend at threshold 2) across accounts — not only in the sender’s local React state.

**Sources:** `domain/trustOps.ts` (`applyNoShowStrike`, `NO_SHOW_SUSPENSION_THRESHOLD = 2`), Tracking `handleFindNewBuddy`, Phase 15 deferred list.

---

## Scope

**In:**
- RPC `record_no_show_and_repool(job)` — sender only; MATCHED + no pickup → OPEN; clear runner; increment `users.no_show_count`; suspend at ≥2; `trust_events` + `job_events` (`no_show` / `suspension` / `re_pooled`)
- Harden `accept_job` to reject suspended runners
- `JobService.repoolNoShow(jobId)`
- Wire Tracking Find New Buddy; refresh trust after success
- Mock parity

**Out:** ops dashboard no-show tooling, payment gateway, FIR PDF.

---

## Acceptance

- [x] Find New Buddy persists: job OPEN again, runner cleared in DB
- [x] Runner’s `no_show_count` increments; at 2 → `suspended` and feed blocks accept
- [x] Trust events visible after refresh for org members (`includeRunnerIds`)
- [x] `pnpm build` clean
