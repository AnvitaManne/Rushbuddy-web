# Phase 19 — No-Show Strike Sync (Find New Buddy)

## Goal
Persist “Find New Buddy” so the runner’s no-show strike (and auto-suspend at 2) syncs across accounts — not only in the sender’s local React state.

## What changed
- Migration `0009_no_show_repool.sql` — `record_no_show_and_repool(job)`: sender-only; MATCHED + no pickup → OPEN; clear runner; `users.no_show_count++`; suspend at ≥2; `trust_events` (`no_show` / `suspension`) + `job_events` (`re_pooled` / `status_changed`). Also hardens `accept_job` to reject suspended runners server-side.
- `JobService.repoolNoShow` (Supabase + mock).
- Tracking **Find New Buddy** calls the service; refreshes trust for the former runner via `refreshData({ includeRunnerIds })`.
- Mock still applies strikes locally after a successful store update.

## How to test
1. Apply migration (`npx supabase migration up` from repo root) with Docker up.
2. As runner, accept a job (leave pickup unconfirmed).
3. As sender (DEV or wait 10 min), tap **Find New Buddy** → job returns to OPEN / feed.
4. As runner, soft-refresh: `no_show_count` increased; after **2** no-shows → feed shows suspended / accept blocked.
5. Second browser / account: same suspension after refresh.

## Out of scope
Payment gateway, FIR PDF, strict ops-only RBAC.
