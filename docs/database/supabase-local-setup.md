# Supabase local setup

**Status:** Schema + seed + Auth profile trigger / minimal RLS (Phase 11–12). App still uses in-memory mock services until later Phase 12 slices wire a client.

**Sources:** [`schema-v1.md`](./schema-v1.md), [`../architecture/production-architecture.md`](../architecture/production-architecture.md), [`../architecture/data-access-layer.md`](../architecture/data-access-layer.md), [`../plans/phase-12-supabase-auth-orgs.md`](../plans/phase-12-supabase-auth-orgs.md)

---

## 1. What ships under `supabase/`

| Path | Purpose |
|------|---------|
| `supabase/config.toml` | Local CLI project (`project_id = rushbuddy-web`) |
| `supabase/migrations/0001_initial_schema.sql` | Enums, v1 tables, indexes, cheap CHECKs |
| `supabase/migrations/0002_auth_profile_and_rls.sql` | Auth → `public.users` trigger, org resolve helper, membership RPC, RLS on users/orgs/members |
| `supabase/seed.sql` | Organization `vit-vellore` |

**Still out of scope in DB:** job/payment/trust RLS, Storage buckets, payment providers. **App:** no `createClient` under `app/src` yet (Slice 12.2 is SQL/docs only).

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

First start pulls images, applies **all** migrations in order (`0001`, then `0002`), then runs `seed.sql` (`[db.seed]` in `config.toml`).

Useful follow-ups:

```bash
npx supabase status          # URLs + anon/service keys
npx supabase db reset        # wipe → migrate 0001 + 0002 → seed again
npx supabase stop            # stop containers
```

### `db reset` and migration `0002`

After pulling Phase 12 SQL, run a full reset so Auth trigger + RLS are applied on a clean database:

```bash
# From repo root — required once 0002_auth_profile_and_rls.sql is present
npx supabase db reset
```

This reapplies `0001_initial_schema.sql`, then `0002_auth_profile_and_rls.sql`, then `seed.sql`.  
If you only `supabase start` on an **already-initialized** local DB that never saw `0002`, reset (or an explicit migrate) is needed; reset is the simplest local path.

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

Optional smoke checks after `0002`:

```sql
-- Helpers exist
SELECT proname FROM pg_proc
WHERE proname IN (
  'handle_new_auth_user',
  'resolve_organization_id_from_email',
  'ensure_organization_membership',
  'complete_user_profile'
);

-- Domain resolve → vit-vellore seed
SELECT public.resolve_organization_id_from_email('anyone@vitstudent.ac.in');

-- RLS enabled (jobs etc. should still be false until a later phase)
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('users', 'organizations', 'organization_members', 'jobs');
```

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

Local Auth emails land in Inbucket (see ports below).

---

## 5. Schema notes vs application enforcement

Encoded in `0001_initial_schema.sql`:

- Mixed men's + women's hostel endpoints rejected (`jobs_no_mixed_gendered_hostels`)
- `posted_price >= price_floor`
- Scheduled window end > start when both set
- `declared_value` ≤ 2000 when set
- One active org membership per user (partial unique index)
- One payment / rating row per job; at most one non-resolved dispute per job

Encoded in `0002_auth_profile_and_rls.sql`:

- Trigger `on_auth_user_created`: on `auth.users` insert → minimal `public.users` (`auth_user_id`, `email`, `verified = true`, `verified_at = now()`)
- `name` / `hostel_block` / `gender` nullable until app profile completion (UPDATE own row or `complete_user_profile`)
- `resolve_organization_id_from_email(email)` → active org by `email_domains` (seed: `vitstudent.ac.in` → `vit-vellore`)
- `ensure_organization_membership()` / `complete_user_profile(...)` → `organization_members` (`role = member`, `status = active`)
- RLS on `users`, `organizations`, `organization_members` only (own profile; member SELECT org; SELECT own membership). No anon table access. No job/payment/trust RLS yet.

**Still app-layer (not DB CHECKs in v1):** Mode 2 required fields (`corridor_landmark`, `receiver_phone`), intercity `travel_date`, campus_scheduled window presence, domain transition rules.

**Deferred migrations:** Storage, updated_at triggers, tenant RLS for jobs/payments/trust/etc.

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

- [ ] `supabase/` exists with `config.toml`, `migrations/0001_*.sql`, `migrations/0002_auth_profile_and_rls.sql`, `seed.sql`
- [ ] `npx supabase db reset` applies `0001` + `0002` + seed without error
- [ ] `organizations` contains `vit-vellore` / `vitstudent.ac.in`
- [ ] Seed `settings` includes `hostel_blocks` and `common_landmarks`
- [ ] `resolve_organization_id_from_email('x@vitstudent.ac.in')` returns the vit-vellore id
- [ ] RLS enabled on `users`, `organizations`, `organization_members`; not required on `jobs` yet
- [ ] No Supabase client imports under `app/src`
- [ ] Mock services still power the UI (`services` registry unchanged)

---

## 8. Related docs

| Doc | Role |
|-----|------|
| [`schema-v1.md`](./schema-v1.md) | Column plan `0001` implements |
| [`../plans/phase-12-supabase-auth-orgs.md`](../plans/phase-12-supabase-auth-orgs.md) | Auth + orgs phase plan |
| [`../architecture/data-access-layer.md`](../architecture/data-access-layer.md) | Future `services/supabase/*` seam |
| [`notes/phase-11-summary.md`](../../notes/phase-11-summary.md) | What shipped in Phase 11 |
