# Phase 21 — Campus Immediate OPEN TTL (expire + extend)

**Goal:** Enforce unmatched `campus_immediate` 30‑min expiry with sender extend/cancel near 25 min so stale OPEN jobs leave the feed.

**Sources:** Locked Post Request copy; `computeExpiresAt`; `expires_at` already stored but never enforced.

---

## Scope

**In:**
- Domain: `OPEN → CLOSED`; helpers for TTL remaining / extend window
- Migration: `open_extended` flag; `cancel_open_job`, `extend_open_job`, `expire_stale_open_jobs`; `accept_job` rejects past `expires_at`
- JobService + mock; Tracking countdown / Extend / Cancel; feed hides expired OPEN
- Docs + build

**Out:** Payment gateway, FIR PDF, Edge cron, scheduled/intercity-only UX polish, DEV simulate→lifecycle RPCs.

---

## Acceptance

- [x] Expired OPEN jobs close (or leave feed) and cannot be accepted
- [x] Sender can Cancel OPEN (persisted CLOSED)
- [x] Campus Immediate: Extend (+30 min, once) in the last 5 minutes
- [x] `pnpm build` clean
