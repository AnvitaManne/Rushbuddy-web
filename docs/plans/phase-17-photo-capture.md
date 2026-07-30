# Phase 17 — Real Photo Capture + Preview

**Goal:** Replace the invisible “simulated” JPEG with a real camera / gallery pick and an on-screen thumbnail, so runners see the evidence before Condition Acknowledged / secure drop.

**Sources:** `notes/phase-16-summary.md`, Phase 16 testing feedback (tick with no visible photo).

---

## Scope

**In:**
- File input with `accept="image/*"` + `capture="environment"` (phone camera when available)
- Optional gallery pick (same input without forcing capture on desktop)
- Thumbnail preview after select / after successful upload
- Reuse existing `PhotoService.uploadJobPhoto` (Storage + `register_job_photo`)
- Wire pickup (Fragile/Valuable gate) and secure-drop evidence

**Out:** multi-photo albums, image compression pipeline, FIR PDF, ops dashboard, payment gateway.

---

## UX

1. Runner taps **Take / choose photo**
2. OS camera or file picker opens
3. Thumbnail appears under the control
4. On successful upload → green “Photo captured” + keep thumbnail (prefer signed/`photo_url` when returned)
5. Fragile/Valuable: Condition Acknowledged stays locked until upload succeeds
6. Secure drop: upload dropoff photo before calling `reportNoAnswer(secure_drop)`

Fallback: if the picker is unavailable / upload fails on Low-risk, keep soft-fail behavior from Phase 16. Fragile/Valuable stays hard-gated.

---

## Slice map

| Slice | Deliverable |
|-------|-------------|
| 17.1 | This plan |
| 17.2 | `PhotoCapture` control + helpers |
| 17.3 | Wire `ActiveDeliveryPage` |
| 17.4 | Summary + `pnpm build` |

## Acceptance

- [ ] Fragile path: must pick a real image; thumbnail visible; upload creates `photos` row
- [ ] Secure drop: dropoff photo uploaded + preview optional on runner screen
- [ ] No more reliance on `createSimulatedPhotoBlob` for the happy path
- [ ] Mock mode still works (upload returns `mock://`)
- [ ] `pnpm build` clean; MVP-locked Post Request fields intact
