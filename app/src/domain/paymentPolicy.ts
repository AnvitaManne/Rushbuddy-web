/**
 * paymentPolicy.ts — Pure helpers for payment method visibility and payment state.
 *
 * Rules (locked in sjt-mvp-core-loop.md and core-flow-specs.md):
 *  - Mode 1 (Direct P2P): cash + UPI + PhonePe are available once the job reaches
 *    PENDING_RATING, which signals that the runner has successfully entered the
 *    handoff code received verbally from the person at the drop.
 *  - Mode 2 (Landmark): UPI and PhonePe only. Cash is unenforceable at a landmark
 *    because there is no physical person-to-person confirmation.
 *  - Failure paths (ISSUE_REPORTED via no-answer): runner is owed the full agreed fee;
 *    only UPI/PhonePe are accepted (cash requires the PENDING_RATING code-entry signal).
 *  - Jobs not yet in a payable state return an empty method list.
 *
 * No real payment processing, Razorpay, UPI verification, or wallet ledger here.
 */

import type { Job } from './types';
import type { JobStatus, PaymentMethod } from './enums';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Dispute window duration in hours (locked: 2h post-payment). */
export const DISPUTE_WINDOW_HOURS = 2;

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Statuses in which the payment screen is actionable.
 *
 * - `PENDING_RATING`: normal path — runner entered handoff code, job awaiting sender action.
 * - `DELIVERED`:      transitional — some flows arrive here before PENDING_RATING.
 * - `ISSUE_REPORTED`: failure path — no-answer hold-for-ops; runner still owed full payout.
 */
const PAYABLE_STATUSES: readonly JobStatus[] = [
  'PENDING_RATING',
  'DELIVERED',
  'ISSUE_REPORTED',
];

function isPayableState(job: Pick<Job, 'status'>): boolean {
  return PAYABLE_STATUSES.includes(job.status as JobStatus);
}

// ── Exported helpers ───────────────────────────────────────────────────────────

/**
 * Returns the payment methods the sender may use for this job.
 *
 * @returns An ordered array of allowed methods, or `[]` if payment is not yet actionable.
 *
 * Visibility rules:
 * - `[]`                        — job not in a payable state.
 * - `['upi', 'phonepe']`        — Mode 2 (Landmark) in any payable state.
 * - `['upi', 'phonepe']`        — Mode 1, payable, but NOT yet PENDING_RATING
 *                                 (e.g. DELIVERED / ISSUE_REPORTED: no confirmed code entry).
 * - `['upi', 'phonepe', 'cash']` — Mode 1, PENDING_RATING (runner entered handoff code).
 */
export function getAllowedPaymentMethods(
  job: Pick<Job, 'handoff_mode' | 'status'>,
): PaymentMethod[] {
  if (!isPayableState(job)) return [];

  // Mode 2 — landmark handoff: UPI only, cash unenforceable.
  if (job.handoff_mode === 'mode_2_landmark') {
    return ['upi', 'phonepe'];
  }

  // Mode 1 — Direct P2P.
  // Cash requires PENDING_RATING as proof that the runner entered the handoff code
  // received verbally from the person physically present at the drop.
  const base: PaymentMethod[] = ['upi', 'phonepe'];
  if (job.status === 'PENDING_RATING') base.push('cash');
  return base;
}

/**
 * Returns `true` iff cash is a valid payment method for this job.
 *
 * Conditions (both must hold):
 *  1. `handoff_mode` is `mode_1_direct_p2p`.
 *  2. Job status is `PENDING_RATING` — the signal that the runner has already entered
 *     the 4-digit handoff code from the person at the drop.
 */
export function isCashAllowed(job: Pick<Job, 'handoff_mode' | 'status'>): boolean {
  return (
    job.handoff_mode === 'mode_1_direct_p2p' &&
    job.status === 'PENDING_RATING'
  );
}

/**
 * Computes the end of the 2-hour dispute window.
 *
 * @param paidAt  ISO timestamp of payment confirmation ("Confirm Payment & Rate" tap).
 * @returns       ISO timestamp exactly `DISPUTE_WINDOW_HOURS` hours later.
 *
 * After this timestamp with no dispute filed, the job auto-closes and the runner
 * is paid in full. No exceptions (per core-flow-specs.md).
 */
export function computeDisputeWindowEndsAt(paidAt: string): string {
  const ms = new Date(paidAt).getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

/**
 * Returns short UI-ready copy explaining the active payment method restriction.
 * Keeps the policy rationale in domain so it cannot diverge between screens.
 *
 * @param job  Job fields needed to determine the applicable rule.
 * @returns    A single sentence suitable for a sub-label or tooltip.
 */
export function getPaymentPolicyCopy(
  job: Pick<Job, 'handoff_mode' | 'status'>,
): string {
  if (job.handoff_mode === 'mode_2_landmark') {
    return 'UPI only — cash is not accepted for landmark handoffs.';
  }
  if (!isPayableState(job)) {
    return 'Payment will be available once the delivery is confirmed.';
  }
  if (job.status !== 'PENDING_RATING') {
    // Mode 1 but not yet PENDING_RATING (e.g. DELIVERED / ISSUE_REPORTED path)
    return 'Cash requires handoff code entry. Pay via UPI or PhonePe.';
  }
  // Mode 1, PENDING_RATING — cash is available.
  return 'Cash payments are recorded as intent but not verified. UPI escrow is coming in v2.';
}
