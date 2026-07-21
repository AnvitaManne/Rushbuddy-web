# Phase 12 Summary — Supabase Auth + Organizations

## 1. Goal of the phase

Phase 12 = wire **Supabase Auth email OTP** + `public.users` / `organization_members`, while keeping **jobs / payments / trust** on mock adapters.

- Auth flow: AuthPage → `beginSignup` → VerifyPage → `completeSignup`
- Org gate: email domain → `organizations.email_domains` → seeded `vit-vellore`
- Hybrid registry: `VITE_DATA_ADAPTER=supabase` swaps auth/org only
- Preserve MVP locked Auth/Verify fields (gender, email confirm); do not touch Post Request

Sources: `docs/plans/phase-12-supabase-auth-orgs.md`, `notes/phase-10-summary.md`, `notes/phase-11-summary.md`, `docs/database/supabase-local-setup.md`.

---

## 2. Files / folders added or changed

### Added

| File | Why it exists |
|------|----------------|
| `docs/plans/phase-12-supabase-auth-orgs.md` | Slice map, auth flow, org resolution, acceptance |
| `supabase/migrations/0002_auth_profile_and_rls.sql` | Auth→profile trigger, org resolve RPC, membership RPC, minimal RLS |
| `app/src/lib/supabaseClient.ts` | Browser client; throws if env missing when adapter=supabase |
| `app/.env.example` | `VITE_SUPABASE_*` + `VITE_DATA_ADAPTER=mock` |
| `app/src/services/supabase/*` | Auth + org adapters, mappers, pure domain helpers |
| `notes/phase-12-summary.md` | This file |

### Changed

| File | Change |
|------|--------|
| `app/src/services/index.ts` | `createSupabaseServices()` hybrid; env-gated `services` export |
| `app/src/services/types.ts` | Optional `otp` on `AuthSignupInput` |
| `AuthPage.tsx` / `VerifyPage.tsx` | Wired through `services`; mock keeps OTP `123456` |
| `AppContext.tsx` | Session restore + “Restoring session…” gate; `authReady` |
| `AppShell.tsx` | Auth redirect; `signOut` via services |
| `docs/database/supabase-local-setup.md` | `db reset` applies `0001` + `0002` |
| `docs/architecture/data-access-layer.md` | Step D marked in progress |
| `app/README.md` | Copy `.env.example` → `.env.local` for supabase mode |
| `app/package.json` | `@supabase/supabase-js` |

### Slice map (canonical)

| Slice | Deliverable | How it shipped |
|-------|-------------|----------------|
| **12.1** | Phase plan | `docs/plans/phase-12-supabase-auth-orgs.md` |
| **12.2** | Auth trigger + RLS | `0002_auth_profile_and_rls.sql` |
| **12.3** | Client + env | `supabaseClient.ts`, `.env.example` |
| **12.4** | Auth/org adapters | `services/supabase/*` |
| **12.5** | Registry swap | `createSupabaseServices` + `VITE_DATA_ADAPTER` |
| **12.6** | Auth + Verify wire | Pages call `services`; mock OTP fallback |
| **12.7** | Session restore | AppContext + AppShell gate/sign-out |
| **12.8** | Phase summary | This file |

### Not done (deferred)

- Job/payment/trust Supabase adapters or RLS
- Migrating `mockJobs` off AppContext
- Full tenant RLS beyond users/orgs/members

---

## 3. Important concepts / architecture decisions

- **Hybrid registry:** auth + organizations on Supabase when `VITE_DATA_ADAPTER=supabase`; jobs/payments/trust stay mock.
- **Minimal Auth row:** trigger on `auth.users` insert creates `public.users` (`auth_user_id`, email, verified); app fills name/hostel/gender after OTP.
- **Membership via RPC:** no broad INSERT policy — `ensure_organization_membership` / `complete_user_profile` (SECURITY DEFINER).
- **Pre-auth org check:** RLS hides orgs from anon; `resolve_organization_id_from_email` + vit-vellore seed-id fallback for signup domain allowlist.
- **Gender:** matching-only; collected on Auth, persisted on verify; `USER_PUBLIC_COLUMNS` omits it.
- **Mock path:** default adapter unchanged; demo OTP `123456` kept when not supabase.

---

## 4. Validation steps

1. `npx supabase db reset` (Docker) — applies `0001` + `0002` + seed; confirm `vit-vellore` / `vitstudent.ac.in`.
2. Smoke SQL: `resolve_organization_id_from_email('x@vitstudent.ac.in')`; RLS on `users` / `organizations` / `organization_members` only.
3. Mock mode (default): Auth → OTP `123456` → home; gender + pendingSignup still work; Post Request unchanged.
4. Supabase mode: copy `.env.example` → `.env.local`, set keys from `npx supabase status`, `VITE_DATA_ADAPTER=supabase`; OTP via Inbucket; refresh restores session; sign-out clears it.
5. `cd app && pnpm build`.

---

## 5. Problems faced and fixes

| Problem | Fix |
|---------|-----|
| Trigger needs profile fields but OTP metadata lacks them | Nullable `name` / `hostel_block` / `gender` until app UPDATE |
| No INSERT policy on `organization_members` | Membership via SECURITY DEFINER RPCs |
| Pre-auth `getBySlug` blocked by RLS | Seed-id fallback for `vit-vellore` + domain resolve RPC |
| `setUser(null)` was coerced to `defaultUser` | Allow null so sign-out / restore work |
| Protected routes would flash login before restore | `authReady` gate (“Restoring session…”) before router |
| Local `db reset` failed without Docker | Document Docker prerequisite; retry when Desktop is running |

---

*Next: jobs/events adapters + tenant RLS; keep MVP locked fields on Auth/Post. Optional: retire demo OTP once supabase mode is the pilot default.*
