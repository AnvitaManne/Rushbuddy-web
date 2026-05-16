# RushBuddy Web App

Vite + React app (`app/`). Design reference: [Figma — Next.js Web App Design](https://www.figma.com/design/VmX2nXmj4plj2Br2pkqCqL/Next.js-Web-App-Design).

## Running locally

```bash
pnpm install
pnpm dev
```

## Dev job helpers (domain verification)

When `pnpm dev` is running, helpers attach to the browser console via `window.__rushbuddyDev` (see `src/domain/devJobDebug.ts`). Mock jobs in `AppContext` are built with `createSampleJob()`.

1. Open the app and DevTools → Console.
2. You should see: `[RushBuddy dev] Helpers on window.__rushbuddyDev`.
3. Examples:

```js
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
  