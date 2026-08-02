/**
 * In-memory JobService mock (Phase 10 Slice 10.3).
 * Shares today’s `Job` shape; uses domain transition / failure / payment helpers.
 * Not wired to UI yet — pass a store (or use the built-in array) when composing later.
 */

import type { Job, User } from '@/domain/types';
import type { JobStatus } from '@/domain/enums';
import { assertTransition } from '@/domain/jobTransitions';
import { computeDisputeWindowEndsAt } from '@/domain/paymentPolicy';
import {
  canExtendOpenJob,
  CAMPUS_IMMEDIATE_TTL_MS,
  isOpenJobExpired,
} from '@/domain/jobHelpers';
import {
  canUseSecureDrop,
  createMockDropoffEvidence,
  markRunnerPayoutEarnedPatch,
  requiresOpsHold,
} from '@/domain/failureHandling';
import type { JobService, ReportNoAnswerInput } from '../types';

/** Mutable job list accessors — typically AppContext `jobs` / `setJobs` later. */
export interface MockJobStore {
  getJobs(): Job[];
  setJobs(jobs: Job[]): void;
}

/**
 * Handoff completion is one user action but two status hops:
 * IN_TRANSIT → DELIVERED → PENDING_RATING (same as ActiveDeliveryPage).
 */
function assertHandoffToPendingRating(status: JobStatus) {
  const toDelivered = assertTransition(status, 'DELIVERED');
  if (!toDelivered.ok) return toDelivered;
  return assertTransition('DELIVERED', 'PENDING_RATING');
}

function createInternalStore(initial: Job[] = []): MockJobStore {
  let jobs = [...initial];
  return {
    getJobs: () => jobs,
    setJobs: (next) => {
      jobs = next;
    },
  };
}

function patchJob(store: MockJobStore, id: string, patch: Partial<Job>): Job | null {
  const jobs = store.getJobs();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx < 0) return null;
  const updated = { ...jobs[idx], ...patch };
  const next = [...jobs];
  next[idx] = updated;
  store.setJobs(next);
  return updated;
}

export type { ReportNoAnswerInput } from '../types';

/** Lifecycle methods now live on the base JobService interface (Phase 14). */
export type MockJobService = JobService;

export function createMockJobService(
  storeOrJobs: MockJobStore | Job[] = [],
): MockJobService {
  const store: MockJobStore = Array.isArray(storeOrJobs)
    ? createInternalStore(storeOrJobs)
    : storeOrJobs;

  return {
    async listJobs() {
      const now = new Date();
      for (const job of store.getJobs()) {
        if (!isOpenJobExpired(job, now)) continue;
        if (!assertTransition(job.status, 'CLOSED').ok) continue;
        patchJob(store, job.id, {
          status: 'CLOSED',
          closed_at: now.toISOString(),
        });
      }
      return store.getJobs();
    },

    async getJob(id) {
      return store.getJobs().find((j) => j.id === id) ?? null;
    },

    async createJob(job) {
      store.setJobs([job, ...store.getJobs()]);
      return job;
    },

    async updateJob(id, patch) {
      return patchJob(store, id, patch);
    },

    async acceptJob(jobId, runner: Pick<User, 'id' | 'name' | 'rating' | 'hostel_block'>) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      if (job.sender_id === runner.id) return null;
      if (isOpenJobExpired(job)) return null;
      const result = assertTransition(job.status, 'MATCHED');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'MATCHED',
        runner_id: runner.id,
        runner_name: runner.name,
        runner_rating: runner.rating,
        runner_hostel: runner.hostel_block,
        matched_at: new Date().toISOString(),
        agreed_price: job.posted_price,
      });
    },

    async removeJob(id) {
      const before = store.getJobs();
      const next = before.filter((j) => j.id !== id);
      if (next.length === before.length) return false;
      store.setJobs(next);
      return true;
    },

    async acknowledgePickup(jobId, options) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      const result = assertTransition(job.status, 'IN_TRANSIT');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'IN_TRANSIT',
        pickup_confirmed_at: new Date().toISOString(),
        condition_acknowledged: true,
        photo_url: options?.photo_url ?? job.photo_url,
      });
    },

    async completeHandoff(jobId, confirmationCode) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      if (confirmationCode.trim() !== job.confirmation_code) return null;
      const result = assertHandoffToPendingRating(job.status);
      if (!result.ok) return null;
      const delivered_at = new Date().toISOString();
      return patchJob(store, jobId, {
        status: 'PENDING_RATING',
        delivered_at,
        dispute_window_ends_at: computeDisputeWindowEndsAt(delivered_at),
        ...markRunnerPayoutEarnedPatch(),
      });
    },

    async reportNoAnswer(jobId, input) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;

      if (input.kind === 'contact_attempt') {
        return patchJob(store, jobId, {
          no_answer_contact_attempts: (job.no_answer_contact_attempts ?? 0) + 1,
          no_answer_at: job.no_answer_at ?? new Date().toISOString(),
        });
      }

      if (input.kind === 'secure_drop') {
        if (!canUseSecureDrop(job)) return null;
        const result = assertHandoffToPendingRating(job.status);
        if (!result.ok) return null;
        const delivered_at = new Date().toISOString();
        const evidence = createMockDropoffEvidence(job.id);
        return patchJob(store, jobId, {
          status: 'PENDING_RATING',
          delivered_at,
          dispute_window_ends_at: computeDisputeWindowEndsAt(delivered_at),
          no_answer_resolution: 'secure_drop',
          dropoff_secure_location:
            input.location || 'Left at door / reception, per policy',
          ...evidence,
          ...markRunnerPayoutEarnedPatch(),
        });
      }

      // hold_for_ops — Fragile/Valuable only (Low-risk uses secure_drop).
      if (!requiresOpsHold(job)) return null;
      const result = assertTransition(job.status, 'ISSUE_REPORTED');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'ISSUE_REPORTED',
        ops_notified: true,
        no_answer_resolution: 'hold_for_ops',
        ...markRunnerPayoutEarnedPatch(),
      });
    },

    async reportIssue(jobId) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      const result = assertTransition(job.status, 'ISSUE_REPORTED');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'ISSUE_REPORTED',
        ops_notified: true,
      });
    },

    async fileDispute(jobId, input) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      const result = assertTransition(job.status, 'DISPUTED');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'DISPUTED',
        dispute_type: input.dispute_type || 'Not specified',
        dispute_description: input.description,
        disputed_at: new Date().toISOString(),
      });
    },

    async resolveDispute(jobId, input) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      const result = assertTransition(job.status, 'CLOSED');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        runner_payout_status: input.outcome === 'runner_at_fault' ? 'withheld' : 'earned',
      });
    },

    async closeJob(jobId) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      const result = assertTransition(job.status, 'CLOSED');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
      });
    },

    async repoolNoShow(jobId) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job || !job.runner_id || job.pickup_confirmed_at) return null;
      const result = assertTransition(job.status, 'OPEN');
      if (!result.ok) return null;
      return patchJob(store, jobId, {
        status: 'OPEN',
        runner_id: undefined,
        runner_name: undefined,
        runner_rating: undefined,
        runner_hostel: undefined,
        matched_at: undefined,
        agreed_price: undefined,
      });
    },

    async cancelOpenJob(jobId) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      const result = assertTransition(job.status, 'CLOSED');
      if (!result.ok || job.status !== 'OPEN') return null;
      return patchJob(store, jobId, {
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
      });
    },

    async extendOpenJob(jobId) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job || !canExtendOpenJob(job)) return null;
      return patchJob(store, jobId, {
        expires_at: new Date(Date.now() + CAMPUS_IMMEDIATE_TTL_MS).toISOString(),
        open_extended: true,
      });
    },

    async expireStaleOpenJobs() {
      const now = new Date();
      let n = 0;
      for (const job of store.getJobs()) {
        if (!isOpenJobExpired(job, now)) continue;
        const result = assertTransition(job.status, 'CLOSED');
        if (!result.ok) continue;
        patchJob(store, job.id, {
          status: 'CLOSED',
          closed_at: now.toISOString(),
        });
        n += 1;
      }
      return n;
    },
  };
}
