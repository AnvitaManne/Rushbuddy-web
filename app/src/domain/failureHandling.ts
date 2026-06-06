/**
 * failureHandling.ts — Pure helpers for the no-answer-at-dropoff protocol.
 *
 * Policy (from sjt-mvp-core-loop.md, locked):
 *  - Runner taps "No Answer at Door" → 20-minute wait + 2 contact attempts.
 *  - If sender responds within window: delivery continues (normal path).
 *  - If no response after 20 min + 2 attempts → runner taps "Sender Unreachable":
 *      Low risk     → secure unattended drop (photo + geotag + ops notification).
 *      Fragile/Valuable → runner holds item; awaits ops instruction only.
 *  - Runner payout: full agreed fee regardless of path.
 *  - Sender refund: none.
 *
 * No real GPS, real camera, backend, or Razorpay in this file.
 */

import type { Job } from './types';
import type { DropoffGeotag, NoAnswerResolution, RunnerPayoutStatus } from './types';

// ── Policy constants ──────────────────────────────────────────────────────────

export const NO_ANSWER_WAIT_MINUTES = 20;
export const REQUIRED_CONTACT_ATTEMPTS = 2;

// ── Dev bypass ────────────────────────────────────────────────────────────────

/**
 * Mutable container for dev-only flags.
 * Using an object (not a bare `let`) so that other modules can mutate
 * `.bypassNoAnswerWait` without hitting the ES-module read-only binding restriction.
 *
 * Toggle from the browser console via:
 *   __rushbuddyDev.bypassNoAnswerWait(true)
 *
 * Never set this in production-bound code.
 */
export const _devFlags = {
  bypassNoAnswerWait: false,
};

// ── Risk-branch guards ────────────────────────────────────────────────────────

/**
 * Returns `true` when the job's risk level allows an unattended secure drop.
 * Only `Low` risk qualifies — Fragile and Valuable must never be left unattended.
 */
export function canUseSecureDrop(job: Pick<Job, 'risk'>): boolean {
  return job.risk === 'Low';
}

/**
 * Returns `true` when the job must be held by the runner pending ops instruction.
 * Applies to `Fragile` and `Valuable` risk levels.
 */
export function requiresOpsHold(job: Pick<Job, 'risk'>): boolean {
  return job.risk === 'Fragile' || job.risk === 'Valuable';
}

// ── Wait-window check ─────────────────────────────────────────────────────────

/**
 * Returns `true` when the runner is permitted to tap "Sender Unreachable".
 *
 * All three conditions must hold:
 *  1. `no_answer_at` is set (runner already tapped "No Answer at Door").
 *  2. `no_answer_contact_attempts` has reached REQUIRED_CONTACT_ATTEMPTS (2).
 *  3. At least NO_ANSWER_WAIT_MINUTES (20) have elapsed since `no_answer_at`
 *     — OR `__devBypassNoAnswerWait` is enabled for manual testing.
 *
 * @param job  Job fields needed for the check (subset of Job).
 * @param now  Current time (defaults to `new Date()`). Pass an explicit value in tests.
 */
export function canMarkSenderUnreachable(
  job: Pick<Job, 'no_answer_at' | 'no_answer_contact_attempts'>,
  now: Date = new Date(),
): boolean {
  if (!job.no_answer_at) return false;
  if ((job.no_answer_contact_attempts ?? 0) < REQUIRED_CONTACT_ATTEMPTS) return false;
  if (_devFlags.bypassNoAnswerWait) return true;
  const elapsedMs = now.getTime() - new Date(job.no_answer_at).getTime();
  return elapsedMs >= NO_ANSWER_WAIT_MINUTES * 60 * 1000;
}

// ── Mock evidence builder ─────────────────────────────────────────────────────

/**
 * Builds mock dropoff evidence for a Low-risk secure drop.
 * In production this would be a real camera capture + GPS fix.
 *
 * Returns fields that should be merged into the Job patch:
 *   `dropoff_photo_url`, `dropoff_geotag`, `dropoff_secure_location`.
 *
 * @param job            Job (only `id` is needed for the mock URL).
 * @param secureLocation Text describing the chosen secure spot
 *                       (e.g. "MH-B Gate Security Desk").
 */
export interface MockDropoffEvidence {
  dropoff_photo_url: string;
  dropoff_geotag: DropoffGeotag;
  dropoff_secure_location: string;
}

export function createMockDropoffEvidence(
  job: Pick<Job, 'id'>,
  secureLocation: string,
): MockDropoffEvidence {
  return {
    dropoff_photo_url: `mock://dropoff/${job.id}/${Date.now()}.jpg`,
    dropoff_geotag: {
      lat: 12.9698,
      lng: 79.1583,
      label: secureLocation,
    },
    dropoff_secure_location: secureLocation,
  };
}

// ── Payout patch ──────────────────────────────────────────────────────────────

/**
 * Returns the Job patch that marks the runner's payout as earned.
 * Applied on both the happy-path (DELIVERED → CLOSED) and the no-answer
 * paths (secure drop or ops-hold), since policy is full agreed fee always.
 *
 * Merge this into the job update with the spread operator:
 *   setJobs(prev => prev.map(j => j.id === job.id ? { ...j, ...markRunnerPayoutEarnedPatch() } : j));
 */
export function markRunnerPayoutEarnedPatch(): { runner_payout_status: RunnerPayoutStatus } {
  return { runner_payout_status: 'earned' };
}

/**
 * Returns the job-status label shown to the runner for a given no_answer_resolution.
 * UI can call this rather than branching on the enum directly.
 */
export function noAnswerResolutionLabel(resolution: NoAnswerResolution): string {
  return resolution === 'secure_drop'
    ? 'Secure Drop — Photo logged'
    : 'Holding Item — Awaiting Ops';
}
