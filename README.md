# RushBuddy web

Campus peer-delivery for VIT Vellore — send a package with a student runner nearby, track handoff with a confirmation code, and close the job with payment, ratings, and dispute/trust controls.

This repo is a full-stack MVP: React client + Supabase (Postgres, Auth, Storage, RLS) with a mock adapter for offline/demo work. Built through **Phase 22**.

---

## Features (current stage)

### Auth & campus gate
- VIT-only signup (`@vitstudent.ac.in`) with email OTP via Supabase Auth
- Registration captures name, hostel block, and gender (matching-only; never shown on profiles/cards)
- Organization membership for the seeded VIT Vellore campus

### Post a request (sender)
- Three job types: **Campus Immediate**, **Campus Scheduled**, **Intercity**
- Pickup/drop location types (`general` / men's / women's hostel) with gender-aware runner filtering
- Carry-only rules, Food “already ordered” ack, ₹2,000 declared-value cap
- Editable offer price with system floor; mode-locked handoff (campus → Mode 1, intercity → Mode 2)

### Runner loop
- Job feed with eligibility filters; race-safe accept (single winner in Postgres)
- Active delivery: condition acknowledge, mandatory photos for Fragile/Valuable, handoff code entry
- No-answer-at-door protocol → hold for ops when sender unreachable
- Cross-account status sync (sender tracking updates when the runner advances the job)

### Open-job lifecycle
- Campus Immediate TTL with live countdown, cancel, and one-shot +30 min extend
- Stale unmatched jobs auto-expire and leave the runner feed

### Payments, ratings & disputes
- Mock Cash / UPI / PhonePe settlement after successful handoff
- Optional rating; 2-hour dispute window
- Theft / not-delivered escalation with runner suspension hooks

### Trust & ops
- “Find New Buddy” no-show re-pool with strike count (auto-suspend at 2)
- Lightweight **Ops Queue** for disputed / issue-reported jobs
- Real camera/gallery photo capture uploaded to Supabase Storage
- **FIR support package** (readable panel + copy / download JSON / print) — campus-security handoff aid, **not** a legal FIR filing

### Architecture
- Domain layer: types, job state machine, pricing/expiry/eligibility helpers
- Service adapters: `VITE_DATA_ADAPTER=mock | supabase` (UI stays the same)
- Append-only `job_events` timeline; RLS-backed jobs, payments, disputes, photos, trust

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Frontend | React 18, Vite, React Router, Tailwind |
| Backend | Supabase (Postgres, Auth OTP, Storage, RPC + RLS) |
| Local / demo | In-memory mock adapter (no env required) |

---

## Quick start

```bash
cd app
pnpm install
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
cd app
pnpm build   # production compile check
```

### Supabase mode (optional)

1. Copy `app/.env.example` → `app/.env.local`
2. Set `VITE_DATA_ADAPTER=supabase` and paste project URL + anon key
3. From repo root, apply migrations with the Supabase CLI as needed

App-local notes (DEV console helpers, Home sender/runner toggle): [app/README.md](app/README.md).

---

## Honest limits (resume / demo)

- **No real money** — settlement UI is mock Cash / UPI / PhonePe
- **No real KYC / Aadhaar** — VIT email + OTP only
- **FIR package** is evidence export for campus security / founders — it does not file with police
- Mock adapter: refresh resets session; Supabase mode persists across accounts

Deferred (not in this version): live payment gateway, live GPS tracking, location-radius matching.

---

## Repo layout

```
Rushbuddy-web/
├── app/                 # Vite + React client
├── supabase/            # Migrations, seed, local project config
├── docs/
│   ├── product/         # Core flow specs + working notes
│   ├── plans/           # MVP core-loop plan
│   └── qa/              # Pilot scenario matrix & dogfooding
└── notes/               # Phase 1–22 summaries
```

---

## Docs worth reading

1. [docs/product/core-flow-specs.md](docs/product/core-flow-specs.md) — flows, handoff modes, no-show & payment rules  
2. [docs/plans/sjt-mvp-core-loop.md](docs/plans/sjt-mvp-core-loop.md) — locked MVP business rules  
3. [notes/](notes/) — what each build phase shipped  

---

## Status

**Phase 22 complete** — end-to-end campus delivery MVP with Supabase persistence, ops queue, photo evidence, and FIR support package. Built for a VIT Vellore beta / pilot, not a public consumer launch.
