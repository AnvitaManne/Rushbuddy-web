# RushBuddy Web App

Vite + React app (`app/`). Design reference: [Figma — Next.js Web App Design](https://www.figma.com/design/VmX2nXmj4plj2Br2pkqCqL/Next.js-Web-App-Design).

## Running locally

From this directory (`app/`):

```bash
pnpm install
pnpm dev
```

Compile check:

```bash
pnpm build
```

### Env (Supabase mode)

Default data adapter is **mock** — no env file required for day-to-day UI work.

For future Supabase auth/org adapters (`VITE_DATA_ADAPTER=supabase`):

1. Copy `.env.example` → `.env.local` (do not commit `.env.local`).
2. From the **repo root**, run `npx supabase status` and paste the API URL + `anon` key into `.env.local`.
3. Set `VITE_DATA_ADAPTER=supabase`.

See `src/lib/supabaseClient.ts` (`supabase` export). Missing URL/anon key throws a clear error only when adapter is `supabase`.

Pilot QA docs (repo root): [docs/qa/scenario-test-matrix.md](../docs/qa/scenario-test-matrix.md), [internal-dogfooding-runbook.md](../docs/qa/internal-dogfooding-runbook.md), [pilot-readiness-checklist.md](../docs/qa/pilot-readiness-checklist.md).

**Reminder:** no real money, no real KYC; mock mode still has no backend persistence (refresh resets state).

**Home mode:** Sender/Runner toggle on Command Centre stays on `/home` and filters the dashboard by role (Sender → your requests / Tracking; Runner → your runs / Active Delivery). Post and Feed are separate nav/quick actions.

## Dev job helpers (domain verification)

When `pnpm dev` is running, helpers attach to the browser console via `window.__rushbuddyDev` (see `src/domain/devJobDebug.ts`). Mock jobs in `AppContext` are built with `createSampleJob()`.

1. Open the app and DevTools → Console.
2. You should see: `[RushBuddy dev] … window.__rushbuddyDev ready`.
3. Examples:

```js
// Seed PILOT-01…12 jobs for dogfooding / scenario QA
__rushbuddyDev.loadPilotScenarios()

// Log whether a transition is valid (uses jobTransitions rules)
__rushbuddyDev.logJobTransition('JOB-2401', 'OPEN', 'MATCHED')

// Inject a new OPEN job into React state
__rushbuddyDev.addJob({ item_type: 'Food', drop_location_type: 'womens_hostel', posted_price: 55 })

// Drive a status change on an existing mock job
__rushbuddyDev.transitionJob('JOB-2401', 'MATCHED')

// Build a job object without adding to state
__rushbuddyDev.createSampleJob({ status: 'IN_TRANSIT', runner_id: 'u1' })
```

`logJobTransition` and `attachDevJobDebug` are no-ops in production builds (`import.meta.env.DEV`).
  