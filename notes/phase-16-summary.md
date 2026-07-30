# Phase 16 — Photos (Storage) + FIR Export Persistence

## Goal
Replace `mock://` photo strings and ephemeral FIR packages with Supabase Storage + `photos` / `fir_exports` rows so evidence and theft-support packages sync across accounts and survive reload.

## What changed

### Database — `supabase/migrations/0007_photos_storage_and_fir.sql`
- Private Storage bucket `job-photos` (5 MB, jpeg/png/webp) with org-scoped Storage RLS (path `{org_id}/{job_id}/{kind}/…`).
- RLS + `SELECT` grants on `photos` and `fir_exports`.
- RPCs:
  - `register_job_photo(job, kind, path, geotag?)` — runner inserts `photos`, sets `jobs.pickup_photo_id` / `dropoff_photo_id`.
  - `generate_fir_export(job)` — sender of a `DISPUTED` job writes a JSON support package into `fir_exports` (includes dispute + timeline + photo ids).

### Service layer
- `PhotoService` / `FirService` on `AppServices`.
- Supabase: upload → register RPC; signed URL hydrate on job list/get; FIR generate/getLatest.
- Mock: `mock://` URLs + in-memory FIR map (`buildFirExport`).

### Front-end
- `ActiveDeliveryPage`: simulated capture uploads a real JPEG blob, then condition-ack / secure-drop proceed; URLs stored on the job.
- `TrackingPage`: Generate FIR → `services.fir.generate`; loads latest persisted package when viewing a disputed job.
- `AppContext` merge keeps `photo_url` / `dropoff_photo_url` across polls until the server returns signed URLs.

## Out of scope (later)
Real device camera / file picker UX, FIR PDF, public filing, ops dashboard, payment gateway.

## Validation
- `pnpm build` clean.
- Apply with `npx supabase migration up` once local Supabase is running.
- Manual: Fragile pickup photo → refresh still shows a URL (not `mock://`); dispute → Generate FIR → reload shows same package.

## Note on Docker
If `supabase start` hangs with no containers, open **Docker Desktop** first, wait until it is healthy, then re-run `npx supabase start` from the repo root.
