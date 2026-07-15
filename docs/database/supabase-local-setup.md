# Supabase local setup (Phase 11)

**Status:** Schema + seed only. App still uses in-memory mock services. No Supabase client in `app/` yet.

**Sources:** [`schema-v1.md`](./schema-v1.md), [`../architecture/production-architecture.md`](../architecture/production-architecture.md), [`../architecture/data-access-layer.md`](../architecture/data-access-layer.md)

---

## 1. What this phase adds

| Path | Purpose |
|------|---------|
| `supabase/config.toml` | Local CLI project (`project_id = rushbuddy-web`) |
| `supabase/migrations/0001_initial_schema.sql` | Enums, v1 tables, indexes, cheap CHECKs |
| `supabase/seed.sql` | Organization `vit-vellore` |

**Out of scope here:** RLS policies, Auth wiring, Storage buckets, payment providers, replacing mock services, `createClient` in app code.

---

## 2. Prerequisites

1. [Docker Desktop](https://docs.docker.com/get-docker/) running
2. Supabase CLI (via `npx` is fine; no global install required):

```bash
npx supabase --version
```

Run CLI commands from the **repo root** (`rushbuddy-web/`), not `app/`.

---

## 3. Start local stack

```bash
# From repo root
npx supabase start
```

First start pulls images, applies migrations, then runs `seed.sql` (`[db.seed]` in `config.toml`).

Useful follow-ups:

```bash
npx supabase status          # URLs + anon/service keys
npx supabase db reset        # wipe → migrate → seed again
npx supabase stop            # stop containers
```

After reset/start, confirm the seed org + sample locations:

```sql
SELECT id, slug, display_name, email_domains, status,
       settings->'hostel_blocks' AS hostel_blocks,
       settings->'common_landmarks' AS common_landmarks
FROM public.organizations
WHERE slug = 'vit-vellore';
```

Stable seed id (documented; do not change lightly):

```text
01000000-0000-4000-8000-000000000001
```

Sample locations are **not** a `locations` table (schema-v1 has none). They ship in `organizations.settings` as `hostel_blocks` + `common_landmarks` (labels + `location_type`), drawn from mock demo strings. Job rows still store free-text `pickup_location` / `drop_location`.

---

## 4. Environment variables (document only — not wired in app)

Copy values from `npx supabase status` when you later add a client. Suggested names for a future Vite app env file (e.g. `app/.env.local`):

| Variable | Source (local) | Notes |
|----------|----------------|-------|
| `VITE_SUPABASE_URL` | API URL (default `http://127.0.0.1:54321`) | Public |
| `VITE_SUPABASE_ANON_KEY` | `anon` / `publishable` key from status | Public; RLS will constrain |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key from status | **Server only**; never ship to the browser |
| `VITE_DATA_ADAPTER` | `mock` (today) \| future `supabase` | Matches comment in `app/src/services/index.ts` |

Do **not** commit real keys. Local defaults from `supabase start` are fine for developers; cloud project keys stay in private env / CI secrets.

Example shape (placeholders):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<paste-from-supabase-status>
VITE_DATA_ADAPTER=mock
```

Until a later phase swaps the service registry, keep `VITE_DATA_ADAPTER=mock` (or omit it). The UI must continue to run on mocks.

---

## 5. Schema notes vs application enforcement

Encoded in `0001_initial_schema.sql`:

- Mixed men's + women's hostel endpoints rejected (`jobs_no_mixed_gendered_hostels`)
- `posted_price >= price_floor`
- Scheduled window end > start when both set
- `declared_value` ≤ 2000 when set
- One active org membership per user (partial unique index)
- One payment / rating row per job; at most one non-resolved dispute per job

**Still app-layer (not DB CHECKs in v1):** Mode 2 required fields (`corridor_landmark`, `receiver_phone`), intercity `travel_date`, campus_scheduled window presence, domain transition rules.

**Deferred migrations:** RLS, `auth.users` link / triggers, Storage, updated_at triggers.

---

## 6. Default local ports

| Service | Port |
|---------|------|
| API | `54321` |
| DB | `54322` |
| Studio | `54323` |
| Inbucket (email) | `54324` |

Exact URLs/keys: always prefer `npx supabase status`.

---

## 7. Acceptance checklist

- [ ] `supabase/` exists with `config.toml`, `migrations/0001_initial_schema.sql`, `seed.sql`
- [ ] `npx supabase start` (or `db reset`) applies migration without error
- [ ] `organizations` contains `vit-vellore` / `vitstudent.ac.in`
- [ ] Seed `settings` includes `hostel_blocks` and `common_landmarks`
- [ ] No Supabase client imports under `app/src`
- [ ] Mock services still power the UI (`services` registry unchanged)

---

## 8. Related docs

| Doc | Role |
|-----|------|
| [`schema-v1.md`](./schema-v1.md) | Column plan this migration implements |
| [`../architecture/data-access-layer.md`](../architecture/data-access-layer.md) | Future `services/supabase/*` seam |
| [`notes/phase-11-summary.md`](../../notes/phase-11-summary.md) | What shipped in Phase 11 |
