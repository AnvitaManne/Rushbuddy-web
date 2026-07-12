import type { Job } from './types';

/** True while a filed dispute could still be raised against this job. */
export function isDisputeWindowOpen(job: Pick<Job, 'dispute_window_ends_at'>): boolean {
  if (!job.dispute_window_ends_at) return false;
  return Date.now() < new Date(job.dispute_window_ends_at).getTime();
}

/**
 * Minimal auto-close gate: a job sitting in `PENDING_RATING` may auto-close once its
 * dispute window has elapsed without the sender rating or disputing it.
 */
export function canAutoCloseJob(job: Pick<Job, 'status' | 'dispute_window_ends_at'>): boolean {
  if (job.status !== 'PENDING_RATING') return false;
  return !isDisputeWindowOpen(job);
}

/*
 * --- Examples (no test runner) ---
 *
 * isDisputeWindowOpen({ dispute_window_ends_at: futureIso })  // true
 * isDisputeWindowOpen({ dispute_window_ends_at: pastIso })    // false
 * canAutoCloseJob({ status: 'PENDING_RATING', dispute_window_ends_at: pastIso }) // true
 * canAutoCloseJob({ status: 'DISPUTED', dispute_window_ends_at: pastIso })       // false
 */
