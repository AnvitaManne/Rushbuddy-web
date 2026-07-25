import type { Job } from './types';

/**
 * Mutable dev-only flags for exercising wait-gated flows without a real timer.
 * Never read in production logic paths other than the wait-gate check below.
 */
export const _devFlags = {
  bypassNoAnswerWait: false,
};

/** Runner must log this many failed contact attempts before marking the sender unreachable. */
const NO_ANSWER_REQUIRED_ATTEMPTS = 2;
/** Minimum wait after the first no-answer attempt before "Sender Unreachable" is enabled. */
const NO_ANSWER_WAIT_MS = 5 * 60 * 1000;

/** Low-risk items may be left at a secure drop location without the sender present. */
export function canUseSecureDrop(job: Pick<Job, 'risk'>): boolean {
  return job.risk === 'Low';
}

/** Fragile/Valuable items are never left unattended — they must be held for ops pickup. */
export function requiresOpsHold(job: Pick<Job, 'risk'>): boolean {
  return job.risk === 'Fragile' || job.risk === 'Valuable';
}

/**
 * True once a runner may mark the sender unreachable: enough logged attempts, and either
 * the wait window has elapsed since the first attempt, or the dev bypass flag is set.
 */
export function canMarkSenderUnreachable(
  job: Pick<Job, 'no_answer_contact_attempts' | 'no_answer_at' | 'sender_response_at'>,
): boolean {
  if (job.sender_response_at) return false;
  const attempts = job.no_answer_contact_attempts ?? 0;
  if (attempts < NO_ANSWER_REQUIRED_ATTEMPTS) return false;
  if (_devFlags.bypassNoAnswerWait) return true;
  if (!job.no_answer_at) return false;
  return Date.now() - new Date(job.no_answer_at).getTime() >= NO_ANSWER_WAIT_MS;
}

/** Builds mock drop-off evidence (photo + geotag) for a secure drop. */
export function createMockDropoffEvidence(jobId: string): {
  dropoff_photo_url: string;
  dropoff_geotag: { lat: number; lng: number; accuracy_m: number; captured_at: string };
} {
  return {
    dropoff_photo_url: `mock://dropoff/${jobId}/secure.jpg`,
    dropoff_geotag: {
      lat: 12.9692,
      lng: 79.1559,
      accuracy_m: 8,
      captured_at: new Date().toISOString(),
    },
  };
}

/** Patch marking the runner's payout as earned (paid out regardless of sender payment status). */
export function markRunnerPayoutEarnedPatch(): Pick<Job, 'runner_payout_status'> {
  return { runner_payout_status: 'earned' };
}

/*
 * --- Examples (no test runner) ---
 *
 * canUseSecureDrop({ risk: 'Low' })       // true
 * canUseSecureDrop({ risk: 'Fragile' })   // false
 * requiresOpsHold({ risk: 'Valuable' })   // true
 * canMarkSenderUnreachable({ no_answer_contact_attempts: 1, no_answer_at: '...' }) // false (needs 2 attempts)
 */
