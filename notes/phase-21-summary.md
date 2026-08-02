# Phase 21 — Campus Immediate OPEN TTL

## Goal
Enforce unmatched OPEN expiry (`expires_at`) with sender cancel + one-shot Campus Immediate extend so stale jobs leave the runner feed.

## What changed
- Domain: `OPEN → CLOSED`; `msUntilExpiry` / `isOpenJobExpired` / `canExtendOpenJob`
- Migration `0012_open_job_ttl.sql` — `open_extended`; `cancel_open_job`, `extend_open_job`, `expire_stale_open_jobs`; `accept_job` rejects past `expires_at`
- JobService methods (Supabase + mock); `listJobs` expires stale first
- Tracking: live countdown, **Extend +30 min** (last 5 min, once), persisted **Cancel**, DEV near-expiry
- Runner feed hides expired OPEN

## How to test
1. Soft-refresh; post Campus Immediate → Tracking shows countdown.
2. **DEV: near expiry** → Extend appears → Extend adds 30 min / `open_extended`.
3. Cancel OPEN → CLOSED; job gone from runner feed.
4. Let a job expire (or set past `expires_at`) → soft-refresh / list → CLOSED; accept fails.

## Out of scope
Payment gateway, FIR PDF, Edge cron, scheduled/intercity-only polish.
