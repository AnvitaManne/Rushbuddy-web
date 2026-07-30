# Phase 17 — Real Photo Capture + Preview

## Goal
Replace invisible simulated JPEGs with a real camera / gallery pick and an on-screen thumbnail.

## What changed
- New `PhotoCapture` control (`app/src/app/components/PhotoCapture.tsx`): hidden `input[type=file]` with `accept="image/*"` + `capture="environment"`, thumbnail preview, upload progress label.
- `ActiveDeliveryPage`: Fragile/Valuable pickup and secure-drop paths use `PhotoCapture` + existing `PhotoService.uploadJobPhoto`. Secure drop requires a dropoff photo before complete.
- Happy path no longer calls `createSimulatedPhotoBlob` (helper file left for optional/dev use).

## How to test
1. Soft-refresh the app.
2. As runner on a Fragile/Valuable job: tap **Take / choose photo** → camera or gallery opens → thumbnail appears → uploads → Condition Acknowledged unlocks.
3. Secure drop path: take dropoff photo first; confirm button stays disabled until photo is captured.

## Out of scope
Multi-photo albums, compression pipeline, FIR PDF, ops dashboard.
