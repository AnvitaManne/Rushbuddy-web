import type { PaymentMethod } from './enums';
import type { Job } from './types';

/** Fields needed to resolve payment policy for a job. */
export type PaymentPolicyJob = Pick<Job, 'handoff_mode'>;

const CAMPUS_METHODS: readonly PaymentMethod[] = ['upi', 'phonepe', 'cash'];
/** Mode 2 (landmark/intercity) hides cash — receiver is off-campus and unverified in person. */
const INTERCITY_METHODS: readonly PaymentMethod[] = ['upi', 'phonepe'];

/**
 * Payment methods a sender may pick at rating time.
 * Cash is hidden for Mode 2 (`mode_2_landmark`) jobs.
 */
export function getAllowedPaymentMethods(job: PaymentPolicyJob): readonly PaymentMethod[] {
  return job.handoff_mode === 'mode_2_landmark' ? INTERCITY_METHODS : CAMPUS_METHODS;
}

/** True unless the job is Mode 2 (landmark/intercity), where cash is disallowed. */
export function isCashAllowed(job: PaymentPolicyJob): boolean {
  return getAllowedPaymentMethods(job).includes('cash');
}

const DISPUTE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Computes `dispute_window_ends_at` as 2 hours after delivery. */
export function computeDisputeWindowEndsAt(deliveredAt: string): string {
  return new Date(new Date(deliveredAt).getTime() + DISPUTE_WINDOW_MS).toISOString();
}

/*
 * --- Examples (no test runner) ---
 *
 * getAllowedPaymentMethods({ handoff_mode: 'mode_1_direct_p2p' }) // ['upi','phonepe','cash']
 * getAllowedPaymentMethods({ handoff_mode: 'mode_2_landmark' })   // ['upi','phonepe']
 * isCashAllowed({ handoff_mode: 'mode_2_landmark' })              // false
 */
