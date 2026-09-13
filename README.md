# RushBuddy
# RushBuddy web

Peer-to-peer package delivery for campus networks. Senders post carry-only jobs; nearby student runners accept, deliver, and close out with a confirmation-code handoff — backed by payments, ratings, disputes, and ops tooling.

Full-stack MVP: React client + Supabase (Postgres, Auth, Storage, RLS), plus a mock data adapter for local development.

---

## Product

### Auth & access
- Institution-gated signup (email domain allowlist) with OTP auth
- Profile fields for hostel and matching preferences (preferences stay internal — never shown on public cards)
- Multi-tenant org membership per campus

### Posting
- Job types: immediate, scheduled window, and intercity corridor
- Location typing (general / gendered hostel) with eligibility filtering for runners
- Carry-only policy, declared-value caps, and editable offer price above a computed floor
- Handoff mode locked at post time (direct P2P vs landmark)

### Delivery loop
- Runner feed with eligibility rules; race-safe accept (single winner via Postgres RPC)
- Condition acknowledge, risk-tiered photo evidence, and 4-digit handoff code completion
- No-answer-at-dropoff protocol with hold-for-ops escalation
- Live cross-account sync between sender tracking and runner progress

### Lifecycle & expiry
- Open-job TTL with countdown, cancel, and one-shot extend for immediate jobs
- Auto-expiry so stale unmatched jobs leave the feed

### Payments, trust & ops
- Settlement flow after successful handoff (Cash / UPI / PhonePe UI; gateway integration deferred)
- Ratings, dispute window, theft / not-delivered escalation, and suspension hooks
- No-show re-pool (“Find New Buddy”) with strike counting
- Ops queue for disputed and issue-reported jobs
- Camera/gallery capture uploaded to object storage
- Exportable incident support package (copy / JSON / print) for campus security handoff — not a legal filing

---

## Engineering highlights

- Domain-first core: typed job model, explicit state machine, pure helpers for pricing, expiry, and runner eligibility
- Adapter boundary (`mock` | `supabase`) so the UI stays stable while persistence swaps
- Append-only job event timeline; RLS on jobs, payments, disputes, photos, and trust data
- Server-side handoff verification and lifecycle RPCs for multi-account consistency

---

## Stack

| Layer | Tech |
|--------|------|
| Client | React 18, Vite, React Router, Tailwind |
| Backend | Supabase — Postgres, Auth (OTP), Storage, RPC + RLS |
| Local | In-memory mock adapter (no env required) |

---

## Quick start

```bash
cd app
pnpm install
pnpm dev
```

Usually serves at `http://localhost:5173`.

```bash
cd app && pnpm build
```

### Supabase mode

1. Copy `app/.env.example` → `app/.env.local`
2. Set `VITE_DATA_ADAPTER=supabase` with project URL + anon key
3. Apply migrations from the repo root via the Supabase CLI

More app notes: [app/README.md](app/README.md).

---

## Current scope

- Settlement is simulated in-app; no live payment processor yet
- Identity is email OTP + domain gate; no government-ID KYC
- GPS tracking and radius-based matching are not in this build
- Mock adapter resets on refresh; Supabase mode persists across sessions and accounts

---

## Layout

```
├── app/          # Vite + React client
├── supabase/     # Migrations, seed, project config
├── docs/         # Product specs, plans, QA
└── notes/        # Build summaries
```

---

## Docs

- [docs/product/core-flow-specs.md](docs/product/core-flow-specs.md) — flows, handoff modes, failure & payment rules  
- [docs/plans/sjt-mvp-core-loop.md](docs/plans/sjt-mvp-core-loop.md) — locked MVP operating rules  
- [notes/](notes/) — what shipped in each build increment  
