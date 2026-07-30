# Phase 18 — Lightweight Ops Dashboard

**Goal:** Give founders/ops a single queue for `DISPUTED` and `ISSUE_REPORTED` jobs so resolution isn’t buried only on the sender Tracking page. Co-founder can monitor + resolve from `/ops`.

**Sources:** `notes/phase-15-summary.md` (ops dashboard deferred), Tracking mock-ops panel.

---

## Scope

**In:**
- Authenticated route `/ops` with queue of org jobs in `DISPUTED` / `ISSUE_REPORTED`
- Resolve dispute (reuse `resolveDispute` outcomes + optional unsuspend)
- Close / acknowledge hold-for-ops jobs via existing `closeJob` where allowed
- Expand `resolve_dispute` RPC so any **active org member** of the job’s org can resolve (not only the sender) — pilot ops = founders on the same org
- Sidebar nav entry

**Out:** full admin auth roles UI, FIR PDF, payment gateway, analytics charts, email/push to ops.

---

## Slice map

| Slice | Deliverable |
|-------|-------------|
| 18.1 | This plan |
| 18.2 | Migration `0008_ops_resolve_org_member.sql` |
| 18.3 | `OpsPage` + route + nav |
| 18.4 | Summary + build |

## Acceptance

- [ ] `/ops` lists disputed + held jobs after refresh
- [ ] Resolve outcome closes job for runner + sender via existing poll
- [ ] Org member (not only sender) can call `resolve_dispute`
- [ ] `pnpm build` clean; MVP-locked fields intact
