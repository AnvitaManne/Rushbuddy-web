# RushBuddy Web

Campus peer-delivery MVP (VIT Vellore beta). This repo holds the product spec, execution plan, and the Figma-derived React prototype.

## Repository layout

```
rushbuddy-web/
├── README.md                 # You are here
├── notes/                    # Phase summaries (add phase-N-summary.md after each phase)
│   ├── README.md             # Template for future phases
│   ├── phase-1-summary.md
│   └── phase-8-summary.md
├── docs/
│   ├── product/              # Source-of-truth product docs
│   │   ├── core-flow-specs.md
│   │   └── working-notes-v1.md
│   ├── plans/                # Implementation roadmap
│   │   └── sjt-mvp-core-loop.md
│   ├── qa/                   # Pilot QA + dogfooding
│   │   ├── scenario-test-matrix.md
│   │   ├── internal-dogfooding-runbook.md
│   │   └── pilot-readiness-checklist.md
│   └── design/               # Design references
│       └── figma-guidelines.md
└── app/                      # Vite + React prototype (from Figma export)
    ├── package.json
    ├── src/
    └── ...
```

## Quick start (prototype)

```bash
cd app
pnpm install
pnpm dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

Production compile check:

```bash
cd app
pnpm build
```

App-local notes (including console DEV helpers): [app/README.md](app/README.md).

## Pilot QA (Phase 8)

**Hard limits — do not treat as product bugs**

- No real money (mock Cash / UPI / PhonePe only)
- No real KYC (VIT email / mock OTP only; no Aadhaar uploads)
- No backend persistence (in-memory state; **refresh resets** the session)
- FIR support package is mock export/copy only — never file with police

### Suggested QA order

1. [docs/qa/scenario-test-matrix.md](docs/qa/scenario-test-matrix.md) — mark P0 / P1 Pass/Fail  
2. [docs/qa/internal-dogfooding-runbook.md](docs/qa/internal-dogfooding-runbook.md) — 19-job tabletop run  
3. [docs/qa/pilot-readiness-checklist.md](docs/qa/pilot-readiness-checklist.md) — Green / Yellow / Red go/no-go  

### Load pilot scenarios (DEV console)

With `pnpm dev` running, open the browser DevTools console and run:

```js
__rushbuddyDev.loadPilotScenarios()
```

That seeds `PILOT-01`…`12` jobs for dogfooding. More helpers: [app/README.md](app/README.md).

### Home Sender / Runner mode (mock)

Same logged-in user can act as both. On Command Centre (`/home`):

- **Sender / Runner toggle stays on Home** — it does not jump to Post Request or Job Feed (use Quick Actions or nav for those).
- **Sender mode** shows your sent requests + sender snapshot; opening a job goes to Tracking / Rate.
- **Runner mode** shows your runs + earnings metrics; opening a job goes to Active Delivery.

## What to read first

1. [docs/product/core-flow-specs.md](docs/product/core-flow-specs.md) — flows, handoff modes, no-show, payment rules
2. [docs/plans/sjt-mvp-core-loop.md](docs/plans/sjt-mvp-core-loop.md) — phased build plan
3. [docs/product/working-notes-v1.md](docs/product/working-notes-v1.md) — founder ops/trust context
4. [docs/qa/scenario-test-matrix.md](docs/qa/scenario-test-matrix.md) — when preparing a pilot QA pass

## Git workflow

- `main` — stable
- `feature/<phase-name>` — one phase per branch (e.g. `feature/phase-1-data-model`)
- Commit docs and code in small, logical commits

## Next build phases

See [docs/plans/sjt-mvp-core-loop.md](docs/plans/sjt-mvp-core-loop.md). Recommended order: data model → auth → post request → runner delivery → payment → ops/trust.
