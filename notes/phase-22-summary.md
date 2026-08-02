# Phase 22 — Solid FIR Support Package

## Goal
Launch-ready campus-security handoff package (readable + download + print). Still **not** a legal FIR.

## What changed
- Migration `0015_fir_package_solid.sql` — enriched payload (emails, hostel, events, photo paths), `fir_exported` event, org members can generate
- `FirPackagePanel` — parties, dispute, timeline, event log, evidence thumbs, Copy / Download JSON / Print
- Tracking + Ops wired; signed photo URLs on generate/getLatest
- Print CSS in `styles/index.css`

## Deferred (cofounder)
Blinkit-style payments, location radius, live runner GPS tracking.

## How to test
1. Soft-refresh; complete a job → file **Not delivered** dispute
2. Tracking → Generate support package → see readable panel; Download / Print
3. Ops Queue → same disputed job → Load / generate support package
