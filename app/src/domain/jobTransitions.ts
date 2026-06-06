import type { JobStatus } from './enums';

/**
 * Allowed job status transitions per core-flow-specs.md.
 *
 * Happy path: OPEN → MATCHED → IN_TRANSIT → PENDING_RATING → CLOSED
 *             (DELIVERED retained for demo-simulate path and dispute resolution)
 * Branches: DISPUTED (post-delivery), ISSUE_REPORTED (active delivery), MATCHED → OPEN (no-show re-pool)
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  OPEN: ['MATCHED', 'CLOSED'],
  MATCHED: ['IN_TRANSIT', 'OPEN', 'ISSUE_REPORTED'],
  IN_TRANSIT: ['DELIVERED', 'PENDING_RATING', 'ISSUE_REPORTED'],
  DELIVERED: ['PENDING_RATING', 'CLOSED', 'DISPUTED'],
  PENDING_RATING: ['DELIVERED', 'CLOSED', 'DISPUTED'],
  DISPUTED: ['CLOSED'],
  ISSUE_REPORTED: ['OPEN', 'IN_TRANSIT', 'CLOSED'],
  CLOSED: [],
} as const;

export type TransitionResult =
  | { ok: true; from: JobStatus; to: JobStatus }
  | { ok: false; from: JobStatus; to: JobStatus; error: string };

/** Returns target statuses valid from `current`. */
export function getAllowedTransitions(current: JobStatus): readonly JobStatus[] {
  return ALLOWED_TRANSITIONS[current];
}

/** Whether `current` → `next` is allowed by the V1 state machine. */
export function canTransition(current: JobStatus, next: JobStatus): boolean {
  if (current === next) return false;
  return ALLOWED_TRANSITIONS[current].includes(next);
}

function transitionError(from: JobStatus, to: JobStatus): string {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (allowed.length === 0) {
    return `Cannot transition job from ${from} to ${to}: ${from} is a terminal status.`;
  }
  return `Cannot transition job from ${from} to ${to}. Allowed targets: ${allowed.join(', ')}.`;
}

/**
 * Validates a status change. Returns `{ ok: true }` or `{ ok: false, error }`.
 * Callers that need a hard failure may throw on `!result.ok`.
 */
export function assertTransition(
  current: JobStatus,
  next: JobStatus,
): TransitionResult {
  if (canTransition(current, next)) {
    return { ok: true, from: current, to: next };
  }
  return { ok: false, from: current, to: next, error: transitionError(current, next) };
}

/*
 * --- Examples (no test runner) ---
 *
 * canTransition('OPEN', 'MATCHED')              // true  — runner accept (Flow 3)
 * canTransition('MATCHED', 'IN_TRANSIT')        // true  — pickup confirmed (Flow 4)
 * canTransition('MATCHED', 'OPEN')            // true  — runner no-show re-pool (Flow 3)
 * canTransition('IN_TRANSIT', 'DELIVERED')    // true  — delivery / handoff complete (Flow 4)
 * canTransition('DELIVERED', 'PENDING_RATING')  // true  — awaiting sender rating (Flow 5)
 * canTransition('DELIVERED', 'CLOSED')          // true  — 2h dispute window elapsed (Flow 4)
 * canTransition('DELIVERED', 'DISPUTED')        // true  — sender reports issue (Flow 5)
 * canTransition('PENDING_RATING', 'CLOSED')     // true  — rated or 24h auto-close (Flow 5)
 * canTransition('DISPUTED', 'CLOSED')           // true  — ops resolution (Flow 5)
 * canTransition('MATCHED', 'ISSUE_REPORTED')    // true  — report at pickup (Flow 4)
 * canTransition('IN_TRANSIT', 'ISSUE_REPORTED') // true  — report mid-delivery (Flow 4)
 * canTransition('ISSUE_REPORTED', 'OPEN')       // true  — re-pool after ops/sender resolution
 * canTransition('ISSUE_REPORTED', 'CLOSED')     // true  — cancelled or finalized
 *
 * canTransition('OPEN', 'DELIVERED')            // false — must match and pick up first
 * canTransition('MATCHED', 'DELIVERED')         // false — must enter IN_TRANSIT first
 * canTransition('OPEN', 'DISPUTED')             // false — disputes are post-delivery only
 * canTransition('CLOSED', 'OPEN')               // false — CLOSED is terminal
 * canTransition('OPEN', 'OPEN')                 // false — no self-transitions
 *
 * assertTransition('OPEN', 'MATCHED')           // { ok: true, from: 'OPEN', to: 'MATCHED' }
 * assertTransition('OPEN', 'CLOSED')            // { ok: false, error: '...Allowed targets: MATCHED.' }
 */
