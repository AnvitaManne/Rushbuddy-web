/**
 * closurePolicy.ts — Pure helpers for dispute-window and auto-close logic.
 *
 * Rules (locked in sjt-mvp-core-loop.md and core-flow-specs.md):
 *  - After the sender confirms payment (payment_status === 'paid'), a 2-hour
 *    dispute window opens (dispute_window_ends_at = paid_at + 2h).
 *  - If no dispute is filed before the window elapses, the job is eligible for
 *    auto-close: DELIVERED → CLOSED or PENDING_RATING → CLOSED.
 *  - DISPUTED jobs are never auto-closed by this layer; ops resolves them via
 *    the DISPUTED → CLOSED transition.
 *  - ISSUE_REPORTED (hold-for-ops) jobs are not auto-closed; they wait on ops.
 *  - CLOSED is terminal — no further transitions apply.
 *
 * All helpers are pure functions of job state and a `now` parameter so they are
 * deterministic, side-effect-free, and trivially unit-testable without mocks.
 * No timers, background workers, or network calls here.
 */

import type { Job } from './types';
import type { JobStatus } from './enums';
import { assertTransition } from './jobTransitions';

// ── Internal constants ─────────────────────────────────────────────────────────

/**
 * The only statuses from which the client-side auto-close is permitted.
 * DISPUTED and ISSUE_REPORTED are intentionally excluded (ops governs those).
 */
const AUTO_CLOSEABLE_STATUSES: readonly JobStatus[] = ['DELIVERED', 'PENDING_RATING'];

// ── Exported helpers ───────────────────────────────────────────────────────────

/**
 * Returns `true` if the job's dispute window is currently open.
 *
 * The window is open when:
 *  - `dispute_window_ends_at` is present (payment was confirmed, clock started), AND
 *  - `now` is strictly before that timestamp.
 *
 * A missing `dispute_window_ends_at` is treated as "window never started" → closed,
 * so callers don't need to guard against undefined.
 *
 * @param job  Job fields needed to evaluate the window.
 * @param now  Point-in-time reference (defaults to the current instant).
 */
export function isDisputeWindowOpen(
  job: Pick<Job, 'dispute_window_ends_at'>,
  now: Date = new Date(),
): boolean {
  if (!job.dispute_window_ends_at) return false;
  return now < new Date(job.dispute_window_ends_at);
}

/**
 * Returns `true` iff the job is eligible for client-side automatic closure.
 *
 * All four conditions must hold simultaneously:
 *  1. Status is DELIVERED or PENDING_RATING (still in an auto-closeable state).
 *  2. `payment_status === 'paid'` — sender explicitly confirmed payment.
 *  3. `dispute_window_ends_at` is set — the 2-hour dispute clock started.
 *  4. The window has fully elapsed (`now >= dispute_window_ends_at`).
 *
 * Deliberately excludes DISPUTED (ops resolves) and ISSUE_REPORTED (hold-for-ops).
 *
 * @param job  Job fields needed for the eligibility check.
 * @param now  Point-in-time reference (defaults to the current instant).
 */
export function canAutoCloseJob(
  job: Pick<Job, 'status' | 'payment_status' | 'dispute_window_ends_at'>,
  now: Date = new Date(),
): boolean {
  if (!AUTO_CLOSEABLE_STATUSES.includes(job.status as JobStatus)) return false;
  if (job.payment_status !== 'paid') return false;
  if (!job.dispute_window_ends_at) return false;
  return now >= new Date(job.dispute_window_ends_at);
}

/**
 * Builds the minimal state patch required to auto-close a job.
 *
 * Returns `null` when:
 *  - `canAutoCloseJob` returns false for the given `job` and `now`, OR
 *  - The state machine rejects the transition (defensive; DELIVERED and
 *    PENDING_RATING both allow → CLOSED, so this branch should not trigger
 *    in normal usage).
 *
 * Usage:
 * ```ts
 * const patch = buildCloseJobPatch(job);
 * if (patch) setJobs(prev => prev.map(j => j.id === job.id ? { ...j, ...patch } : j));
 * ```
 *
 * @param job  Job fields needed to evaluate and build the patch.
 * @param now  Point-in-time reference (defaults to the current instant).
 */
export function buildCloseJobPatch(
  job: Pick<Job, 'status' | 'payment_status' | 'dispute_window_ends_at'>,
  now: Date = new Date(),
): { status: 'CLOSED'; closed_at: string } | null {
  if (!canAutoCloseJob(job, now)) return null;
  const transition = assertTransition(job.status as JobStatus, 'CLOSED');
  if (!transition.ok) return null;
  return { status: 'CLOSED', closed_at: now.toISOString() };
}

/**
 * Returns a short user-facing string describing the job's closure state.
 *
 * Intended for status banners, tracking cards, and job-detail views.
 * Keeping the copy here ensures it never diverges between screens.
 *
 * @param job  Job fields needed to determine the applicable copy.
 * @param now  Point-in-time reference (defaults to the current instant).
 */
export function getClosureCopy(
  job: Pick<Job, 'status' | 'payment_status' | 'dispute_window_ends_at'>,
  now: Date = new Date(),
): string {
  switch (job.status as JobStatus) {
    case 'CLOSED':
      return 'Delivery complete. Payment confirmed and job closed.';

    case 'DISPUTED':
      return 'Under ops review. Our team will respond within 4 hours.';

    case 'ISSUE_REPORTED':
      return 'Hold for ops. Runner is awaiting instruction from the team.';

    case 'DELIVERED':
    case 'PENDING_RATING': {
      if (job.payment_status !== 'paid' || !job.dispute_window_ends_at) {
        return 'Awaiting payment confirmation.';
      }
      if (isDisputeWindowOpen(job, now)) {
        const endsAt = new Date(job.dispute_window_ends_at);
        const diffMs = endsAt.getTime() - now.getTime();
        const diffMins = Math.ceil(diffMs / 60_000);
        const diffHrs = Math.floor(diffMins / 60);
        const remMins = diffMins % 60;
        const timeStr = diffHrs > 0 ? `${diffHrs}h ${remMins}m` : `${remMins}m`;
        return `Payment confirmed. Dispute window closes in ${timeStr}.`;
      }
      return 'Dispute window closed. Job will auto-close shortly.';
    }

    default:
      return 'Job is in progress.';
  }
}
