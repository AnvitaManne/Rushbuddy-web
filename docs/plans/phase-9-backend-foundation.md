# Phase 9 — Backend Foundation

**Goal:** Prepare RushBuddy to move from an in-memory mock to a launch-ready architecture — **docs and schema plan first**, without replacing `AppContext` or implementing Supabase calls in this phase.

**Sources of truth:**

- [`notes/phase-8-summary.md`](../../notes/phase-8-summary.md)
- [`docs/plans/sjt-mvp-core-loop.md`](./sjt-mvp-core-loop.md)
- [`docs/product/core-flow-specs.md`](../product/core-flow-specs.md)
- [`app/src/domain/types.ts`](../../app/src/domain/types.ts)

**Primary deliverables (this phase):**

1. [`docs/architecture/production-architecture.md`](../architecture/production-architecture.md)
2. [`docs/database/schema-v1.md`](../database/schema-v1.md)
3. This plan
4. [`notes/phase-9-summary.md`](../../notes/phase-9-summary.md) at phase end

---

## Out of scope (Phase 9)

- Replacing or refactoring `AppContext` persistence
- Supabase project setup, SDK, Auth, RLS policies in code
- SQL migrations applied to a live database
- Real payments, KYC, GPS, or FIR filing
- Changing Auth / Post Request MVP locked UI (gender, job types, location types, editable offer) — if a later slice touches those pages, preserve [`.cursor/rules/mvp-locked-fields.mdc`](../../.cursor/rules/mvp-locked-fields.mdc)
- Editing `app/src/domain/types.ts` (catalog changes only, applied in a later phase)

---

## Slice map

| Slice | Deliverable | Status |
|-------|-------------|--------|
| **9.0** | Read-only audit (mock vs target; VIT hardcoding; what lives on `Job`) | Done (pre-docs) |
| **9.1** | `docs/architecture/production-architecture.md` | Done in Phase 9 docs |
| **9.2** | `docs/database/schema-v1.md` | Done in Phase 9 docs |
| **9.3** | This phase plan + frontend type checklist | Done in Phase 9 docs |
| **9.4** | `notes/phase-9-summary.md` | End of phase |
| **9.5+** | *(Later phases)* migrations, repos, Supabase, AppContext adapter | Not Phase 9 |

Later implementation phases (do not execute under Phase 9 docs-only):

| Future slice | Intent |
|--------------|--------|
| Migrations | Create Postgres enums/tables from schema-v1; seed `vit-vellore` |
| Repository interfaces | Mirror domain ops; in-memory adapter keeps mock working |
| Auth + orgs | Supabase Auth; membership; domain allowlist from org |
| Jobs + events | Atomic accept; append `job_events` |
| Evidence | Photos storage; payments; disputes; FIR persistence |
| Cutover | Session replaces `defaultUser`; then retire in-memory array |

---

## Architecture decisions (locked for docs)

| Decision | Choice |
|----------|--------|
| Tenancy | `organizations` = campus/community; VIT Vellore is one seeded org |
| Email gate | `organizations.email_domains`, not a product-wide `@vitstudent.ac.in` constant forever |
| Membership | One active org per user in V1 (`organization_members`) |
| Job truth | Current-state `jobs` + append-only `job_events` |
| Extractions tables | `payments`, `ratings`, `disputes`, `trust_events`, `fir_exports`, `photos` |
| Backend target | Postgres shaped for later Supabase |
| Client today | Keep `AppContext` until repositories exist |

---

## Frontend types that must change later

Do **not** apply these edits in Phase 9. Track for the first domain types migration after schema is approved.

### Add

| Type | Purpose |
|------|---------|
| `Organization` | `id`, `slug`, `display_name`, `email_domains`, `status`, `settings?` |
| `OrganizationMember` | `organization_id`, `user_id`, `role`, `status` |
| `JobEvent` | `job_id`, `organization_id`, `actor_user_id?`, `event_type`, `payload`, `created_at` |
| `Payment` | Extracted from `Job.payment_*` / tip |
| `Rating` | Stars for a closed/pending-rating job |
| `Dispute` | Extracted from `Job.dispute_*` |
| `Photo` | Replaces `mock://` URL fields |
| `FIRExport` (persist) | Keep builder; also represent stored `fir_exports` row |

### Change

| Type | Change |
|------|--------|
| `User` | Stop implying VIT-only email; add membership / org linkage; keep `gender` matching-only |
| `Job` | Add required `organization_id`; optional `pickup_photo_id` / `dropoff_photo_id`; peel payment/dispute fields over time; prefer joins for display names |
| Auth UI | Validate email against active org domains |
| `canRunnerSeeJob` / posting | Require same `organization_id`; gender/location rules unchanged |

### Leave as session / client

- `current_role` (`sender` \| `runner`)
- `eta` / `distance` display hints until routing exists

---

## Acceptance criteria (Phase 9 docs)

- [x] Production architecture doc describes mock → target, org model, boundaries, AppContext migration path, gender privacy
- [x] Schema v1 documents all required tables: users, organizations (+ members), jobs, job_events, payments, trust_events, disputes, fir_exports, photos
- [x] VIT is documented as seed organization `vit-vellore`, not the product identity
- [x] Frontend type change checklist exists for a later code slice
- [x] No AppContext replacement; no Supabase calls shipped
- [x] Phase summary written under `notes/`

---

## Validation (docs phase)

1. Open the three docs; confirm links resolve within `docs/`.
2. Confirm schema lists every table in the Phase 9 goal list.
3. Confirm architecture states AppContext stays until a later phase.
4. `pnpm build` in `app/` still green (no code changes expected).

---

## Risks / notes

- Spec drift remains between `core-flow-specs` Flow 4 and locked handoff/no-answer behavior — schema and events follow **MVP plan + Phase 8**, not stale Flow 4.
- Introducing `organization_id` everywhere is a breaking domain change; plan an adapter period (default org id in mock) before requiring it in UI.
- Confirmation codes must move to hashed storage at implementation time; mock may keep plaintext for pilot.
