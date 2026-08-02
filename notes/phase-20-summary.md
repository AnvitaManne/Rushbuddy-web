# Phase 20 — Hydrate Payments & Disputes onto Job

## Goal
After list/get/poll, attach payment + dispute (+ rating) from child tables onto `Job` so Ops/Tracking/Rating stay correct across soft-refresh and accounts.

## What changed
- `supabaseJobService.withRelatedFields` — batch-select `payments`, `ratings`, `disputes` for listed job ids; prefer open dispute, else newest.
- Wired into `listJobs` and `fetchJob` (covers get + lifecycle RPC re-fetch).
- `LOCAL_ONLY_JOB_FIELDS` narrowed to photo URL fallback only (payment/dispute no longer mock-only).

## How to test
1. Soft-refresh; as sender, complete a job → record payment + rate → soft-refresh Rating/Tracking: still shows paid.
2. File a dispute with a typed reason → open Ops Queue from another org account: dispute type visible (not blank).
3. Soft-refresh sender Tracking on that disputed job: type + description still present.

## Out of scope
Payment gateway, FIR PDF, strict ops-only RBAC.
