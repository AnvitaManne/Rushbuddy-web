# Phase 11 Summary — Supabase Project + Local Schema

## 1. Goal of the phase

Phase 11 = **schema foundation only**: local Supabase project files, v1 SQL migration, VIT org seed, and setup docs — without wiring the frontend to Supabase.

- Do **not** replace mock services.
- Do **not** add Supabase client usage in `app/`.
- Do **not** implement real Auth, payment providers, Storage, or RLS policies yet.

Sources: `notes/phase-9-summary.md`, `notes/phase-10-summary.md`, `docs/architecture/production-architecture.md`, `docs/architecture/data-access-layer.md`, `docs/database/schema-v1.md`, domain/service types.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `supabase/config.toml` | Local CLI project (`rushbuddy-web`); seed path `./seed.sql` |
| `supabase/.gitignore` | CLI defaults (branches/temp/local env) |
| `supabase/migrations/0001_initial_schema.sql` | All v1 enums, tables, indexes, cheap CHECKs |
| `supabase/seed.sql` | Seed org `vit-vellore` + sample hostel/landmark labels in `settings` |
| `docs/database/supabase-local-setup.md` | Env var names, `npx supabase` commands, acceptance |
| `notes/phase-11-summary.md` | This file |

### Not changed

- No `app/src/**` (mocks + `services` registry untouched)
- No RLS / Auth triggers / Storage buckets
- No separate `locations` table (not in schema-v1)

### Slice map (canonical)

| Slice | Deliverable | How it shipped |
|-------|-------------|----------------|
| **11.1** | Migration plan (docs/read-only) | Proposal before SQL |
| **11.2** | Enums + core tables (orgs, users, jobs) | Inside `0001_initial_schema.sql` |
| **11.3** | `job_events`, `trust_events` | Same migration |
| **11.4** | Payments / disputes / photos / FIR (+ ratings) | Same migration |
| **11.5** | Indexes + constraints | Same migration |
| **11.6** | Seed: VIT org + sample locations | `seed.sql` → org row + `settings` lists |
| **11.7** | Local setup docs | `supabase-local-setup.md` |
| **11.8** | Phase summary | This file |

---

## 3. Important concepts / architecture decisions

- **Single migration** for greenfield v1 (enums + tables + indexes); later slices can add RLS/Auth separately.
- **`job_event_type` is a Postgres ENUM** (locked initial set from schema-v1), not free `text`.
- **Circular `jobs` ↔ `photos` FKs:** create `jobs` without photo columns → create `photos` → `ALTER` add `pickup_photo_id` / `dropoff_photo_id`.
- **Stable seed UUID:** `01000000-0000-4000-8000-000000000001` for `vit-vellore`.
- **Sample locations:** no `locations` table; hostel blocks + campus landmarks seeded in `organizations.settings` (`hostel_blocks`, `common_landmarks`) from mock demo strings.
- **DB CHECKs in v1:** mixed gendered hostels, `posted_price >= price_floor`, scheduled window order, declared-value cap. **Mode-2 / travel_date presence** stay app-enforced.
- **Payment / rating / dispute / FIR / photos** are tables; god-`Job` payment fields remain mock-only until adapters land.
- **Service registry** still `createMockServices()`; env vars documented only for a future swap.

---

## 4. Validation steps

1. Confirm files under `supabase/` and `docs/database/supabase-local-setup.md` exist.
2. With Docker running, from repo root:
   - `npx supabase start` (or `npx supabase db reset`)
   - `npx supabase status` for URL/keys
3. Query seed: `organizations.slug = 'vit-vellore'`, domain `vitstudent.ac.in`, non-empty `settings.hostel_blocks` / `common_landmarks`.
4. Confirm no `app/src` imports of `@supabase/*` / client SDK.
5. Optional: `cd app && pnpm build` (no app code changes expected).

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| Global `supabase` CLI not on PATH | Document / use `npx supabase`; `supabase init` still produced `config.toml` |
| `supabase init` exit noise (PostHog shutdown timeout) | Project files were written; ignored telemetry exit |
| Circular photo FKs on `jobs` | Deferred photo FK columns until after `photos` table |
| Slice list asked for “sample locations” / no `locations` table in schema-v1 | Seed labels into `organizations.settings` instead of inventing a table |

---

*Next: RLS / Auth linkage / Supabase service adapters — keep MVP locked fields when touching Auth/Post. Keep mocks until a deliberate adapter swap.*
