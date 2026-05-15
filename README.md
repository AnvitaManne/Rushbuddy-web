# RushBuddy Web

Campus peer-delivery MVP (VIT Vellore beta). This repo holds the product spec, execution plan, and the Figma-derived React prototype.

## Repository layout

```
rushbuddy-web/
├── README.md                 # You are here
├── docs/
│   ├── product/              # Source-of-truth product docs
│   │   ├── core-flow-specs.md
│   │   └── working-notes-v1.md
│   ├── plans/                # Implementation roadmap
│   │   └── sjt-mvp-core-loop.md
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
pnpm install   # or npm install
pnpm dev       # or npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## What to read first

1. [docs/product/core-flow-specs.md](docs/product/core-flow-specs.md) — flows, handoff modes, no-show, payment rules
2. [docs/plans/sjt-mvp-core-loop.md](docs/plans/sjt-mvp-core-loop.md) — phased build plan
3. [docs/product/working-notes-v1.md](docs/product/working-notes-v1.md) — founder ops/trust context

## Git workflow

- `main` — stable
- `feature/<phase-name>` — one phase per branch (e.g. `feature/phase-1-data-model`)
- Commit docs and code in small, logical commits

## Next build phases

See [docs/plans/sjt-mvp-core-loop.md](docs/plans/sjt-mvp-core-loop.md). Recommended order: data model → auth → post request → runner delivery → payment → ops/trust.
