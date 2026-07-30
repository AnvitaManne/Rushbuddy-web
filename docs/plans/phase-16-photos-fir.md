# Phase 16 — Photos (Storage) + FIR Export Persistence

**Goal:** Replace `mock://` photo strings and ephemeral FIR packages with real Supabase Storage + `photos` / `fir_exports` rows so evidence and theft-support packages sync across accounts and survive reload.

**Sources:** `notes/phase-15-summary.md`, `docs/architecture/production-architecture.md` (step F), `supabase/migrations/0001_initial_schema.sql` (`photos`, `fir_exports`, `photo_kind`).

---

## Problem recap

- Pickup / secure-drop photos are simulated (`mock://pickup/...`) and never leave the browser.
- FIR support package is built in-memory via `buildFirExport` and lost on refresh; runner/sender other account never sees a stored package.
- Schema already has `photos`, `jobs.pickup_photo_id` / `dropoff_photo_id`, and `fir_exports` — unused.

---

## Scope

**In:**
- Private Storage bucket `job-photos`
- Register pickup + secure-drop photos (client uploads a small JPEG; V1 keeps “simulated capture” UX but persists a real file)
- Link photos onto the job (`pickup_photo_id` / `dropoff_photo_id`)
- Signed URL hydration into `Job.photo_url` / `dropoff_photo_url` for UI
- Persist FIR export payload on generate; load latest for a job on Tracking

**Out:** real device camera / file picker redesign, PDF generation, public FIR filing, ops dashboard, payment gateway.

---

## Storage

| Item | Value |
|------|-------|
| Bucket | `job-photos` (private, not public) |
| Path | `{organization_id}/{job_id}/{kind}/{uuid}.jpg` |
| Kinds | `pickup` \| `dropoff_secure` (enum `photo_kind`; `other` reserved) |
| Access | authenticated upload/read only under own org path (Storage policies + app path helper) |

## RPCs (migration 0007, SECURITY DEFINER)

| RPC | Actor | Effect |
|-----|-------|--------|
| `register_job_photo(job, kind, storage_path, geotag?)` | runner on that job | insert `photos`; set `jobs.pickup_photo_id` or `dropoff_photo_id`; return photo id |
| `generate_fir_export(job)` | sender of a DISPUTED job | assemble JSON payload (job + dispute + timeline stubs); insert `fir_exports`; return export id |
| `get_latest_fir_export(job)` | org member on job | return latest `fir_exports` row for job (or null) |

RLS: org-member `SELECT` on `photos` and `fir_exports`; writes via RPCs only. `GRANT SELECT` to `authenticated`.

## Service layer

- New `PhotoService`: `uploadJobPhoto({ jobId, kind, blob })` → storage upload + `register_job_photo`; `getSignedUrl(path)`.
- Extend trust/FIR surface: `persistFirExport(jobId)` / `getLatestFirExport(jobId)` (on TrustService or a thin FirService — prefer methods on TrustService to avoid new registry churn, **or** add `fir` to AppServices). **Decision:** add `fir: FirService` with `generate` + `getLatest`.
- Job list/get: after map, if photo FKs present, resolve signed URLs into `photo_url` / `dropoff_photo_url` (best-effort).

## Front-end

- `ActiveDeliveryPage`: on simulated capture / before ack & secure drop, upload blob then proceed; store returned URLs on job.
- `TrackingPage`: Generate FIR → call `fir.generate`; show persisted payload; reload latest on mount when disputed.

## Slice map

| Slice | Deliverable |
|-------|-------------|
| 16.1 | This plan |
| 16.2 | `0007_photos_storage_and_fir.sql` |
| 16.3 | PhotoService + FirService (supabase + mock) |
| 16.4 | Wire ActiveDelivery photos |
| 16.5 | Wire Tracking FIR persist |
| 16.6 | Summary + smoke test |

## Acceptance

- [ ] Migration applies via `migration up`
- [ ] Fragile pickup photo persists; sender/runner refresh still sees a signed URL (not `mock://`)
- [ ] Secure-drop photo persists on Low-risk path
- [ ] FIR generate writes `fir_exports`; reload shows same package
- [ ] Mock mode still uses `mock://` / in-memory FIR
- [ ] `pnpm build` clean; MVP-locked Post Request fields intact
