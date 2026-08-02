# Phase 22 — Solid FIR Support Package

**Goal:** Launch-ready campus-security handoff package (readable + download + print). Still **not** a legal FIR filing or PDF pipeline.

**Deferred (cofounder):** Blinkit-style payments, location radius, live runner tracking.

---

## Scope

**In:**
- Enrich `generate_fir_export`: emails, runner hostel, job_events timeline, photo paths; event `fir_exported`
- Allow org members (ops) to generate as well as sender
- Domain + mapper + signed photo URLs on generate/getLatest
- Tracking: readable package panel, Download JSON, Print, disclaimer
- Mock parity; docs + build

**Out:** PDF upload to Storage, Aadhaar/KYC, payment gateway, maps.

---

## Acceptance

- [x] Disputed theft job → Generate → enriched package persists and reloads
- [x] Download `.json`; Print shows readable layout
- [x] Photos appear when present (thumbs or links)
- [x] `pnpm build` clean
