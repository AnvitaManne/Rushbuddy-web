# Phase 9 Summary — Production Architecture + Backend Foundation

## 1. Goal of the phase

Phase 9 = **Docs only**: define launch-ready architecture and Postgres schema so RushBuddy can leave the in-memory mock without rewriting UI yet.

- Do **not** replace `AppContext`.
- Do **not** implement Supabase calls or migrations.
- Generalize from VIT-only to an **organization/community** model (VIT = one seeded org).
- Plan tables for users, orgs, jobs, job_events, payments, trust, disputes, FIR exports, photos.
- Catalog frontend type changes for a later code slice.

Sources: `notes/phase-8-summary.md`, `docs/plans/sjt-mvp-core-loop.md`, `docs/product/core-flow-specs.md`, `app/src/domain/types.ts`.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `docs/architecture/production-architecture.md` | Mock vs target, org model, boundaries, AppContext migration path, privacy |
| `docs/database/schema-v1.md` | Table/column plan, enums, indexes, RLS notes, types.ts mapping, VIT seed |
| `docs/plans/phase-9-backend-foundation.md` | Phase scope, slices, out-of-scope, frontend type checklist |
| `notes/phase-9-summary.md` | This file |

### Not changed

- No `app/src/**` code
- No Supabase client, Auth, or SQL migrations

### Slice map

| Slice | Deliverable |
|-------|-------------|
| **9.0** | Read-only audit |
| **9.1** | Architecture doc |
| **9.2** | Schema v1 |
| **9.3** | Phase plan + type checklist |
| **9.4** | Phase summary |

---

## 3. Important concepts / architecture decisions

- **Organization = community/campus**; email allowlist lives on the org (`email_domains`), not as a permanent product constant.
- **Seed:** `vit-vellore` → `vitstudent.ac.in`.
- **V1 membership:** one active org per user via `organization_members`.
- **Jobs:** current-state row + append-only **`job_events`** (FIR/ops timeline reconstructible).
- **Extracted from god-Job:** `payments`, `ratings`, `disputes`, `photos`, `fir_exports`, `trust_events`.
- **Domain helpers stay client-side**; persistence/enforcement moves server-side later.
- **AppContext stays** until repository adapters exist (Phase 10+).
- Spec drift: trust **MVP locks + Phase 8** over stale Flow 4 “Job Done”.

---

## 4. Validation steps

1. Open the three docs under `docs/architecture/`, `docs/database/`, `docs/plans/phase-9-backend-foundation.md`.
2. Confirm schema lists: organizations, users, organization_members, jobs, job_events, payments, ratings, trust_events, disputes, fir_exports, photos.
3. Confirm architecture says no AppContext replacement / no Supabase in this phase.
4. Optional: `cd app && pnpm build` (no code changes expected).

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| No prior architecture/database docs | Created greenfield folders + three planning docs |
| VIT hardcoded in Auth as product identity | Documented org seed + domain allowlist migration for later |
| Payments/disputes/FIR/photos on Job or ephemeral | Planned child tables + events |
| phases 2–7 notes still missing | Out of Phase 9 scope; Phase 8 note already flagged this |

---

*Next implementation work is outside Phase 9: migrations, repos, Supabase. Keep MVP locked fields when touching Auth/Post.*
