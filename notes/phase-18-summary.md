# Phase 18 — Lightweight Ops Dashboard

## Goal
Single queue for `DISPUTED` + `ISSUE_REPORTED` so founders can monitor/resolve without digging through sender Tracking.

## What changed
- Migration `0008_ops_resolve_org_member.sql` — `resolve_dispute` and `close_job` allow any **active org member** of the job’s org (not only the sender).
- New `OpsPage` at `/ops` — list queue, resolve dispute outcomes (+ optional unsuspend), close hold-for-ops.
- Sidebar **Ops Queue** nav entry; route wired in `routes.tsx`.

## How to test
1. Soft-refresh; open **Ops Queue** in the sidebar (`/ops`).
2. File a theft-like dispute as sender → it appears in the ops queue.
3. From another org account (or same), resolve with an outcome → both sides show `CLOSED` after refresh.
4. Hold-for-ops job → **Close hold-for-ops job**.

## Out of scope
Strict ops-only RBAC UI, FIR PDF, payment gateway, analytics.
