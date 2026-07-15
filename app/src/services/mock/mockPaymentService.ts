/**
 * In-memory PaymentService mock (Phase 10).
 * Payment intent still lives on `Job` fields (mock era); uses paymentPolicy for method allowlist.
 * Not wired to UI yet — inject the same job store as MockJobService when composing.
 */

import type { Job } from '@/domain/types';
import { getAllowedPaymentMethods } from '@/domain/paymentPolicy';
import type { JobPaymentRecord, PaymentService } from '../types';
import type { MockJobStore } from './mockJobService';

function createInternalJobStore(initial: Job[] = []): MockJobStore {
  let jobs = [...initial];
  return {
    getJobs: () => jobs,
    setJobs: (next) => {
      jobs = next;
    },
  };
}

function toPaymentRecord(job: Job): JobPaymentRecord | null {
  if (!job.payment_method && !job.payment_status) return null;
  if (!job.payment_method || !job.payment_status) return null;
  return {
    job_id: job.id,
    method: job.payment_method,
    status: job.payment_status,
    tip_amount: job.tip_amount ?? 0,
    rating: job.rating,
    paid_at: job.paid_at,
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

export function createMockPaymentService(
  storeOrJobs: MockJobStore | Job[] = [],
): PaymentService {
  const store: MockJobStore = Array.isArray(storeOrJobs)
    ? createInternalJobStore(storeOrJobs)
    : storeOrJobs;

  return {
    async getPaymentForJob(jobId) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      return toPaymentRecord(job);
    },

    async recordPayment(jobId, input) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;

      const allowed = getAllowedPaymentMethods(job);
      if (!allowed.includes(input.method)) return null;

      const paid_at = new Date().toISOString();
      const updated = patchJob(store, jobId, {
        payment_method: input.method,
        payment_status: 'paid',
        paid_at,
        tip_amount: input.tip_amount,
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
      });
      if (!updated) return null;
      return toPaymentRecord(updated);
    },
  };
}
