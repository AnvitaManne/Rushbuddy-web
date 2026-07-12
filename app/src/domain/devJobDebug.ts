import type { JobStatus, SuspensionStatus } from './enums';
import type { Job } from './types';
import { assertTransition } from './jobTransitions';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
} from './jobHelpers';
import { _devFlags } from './failureHandling';

/** Fields you may override when synthesizing mock / test jobs. */
export type SampleJobOverrides = Partial<
  Omit<Job, 'price_floor' | 'handoff_mode' | 'expires_at' | 'confirmation_code' | 'purchase_type'>
> & {
  scheduled_window?: Job['scheduled_window'];
  travel_date?: Job['travel_date'];
};

const MATCHED_PLUS: JobStatus[] = [
  'MATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'PENDING_RATING',
  'CLOSED',
  'DISPUTED',
  'ISSUE_REPORTED',
];

/**
 * Logs a job status change and whether it is allowed by the domain state machine.
 * No-op in production builds.
 */
export function logJobTransition(
  jobId: string,
  from: JobStatus | '(new)',
  to: JobStatus,
): void {
  if (!import.meta.env.DEV) return;

  const label = `[RushBuddy job ${jobId}]`;
  if (from === '(new)') {
    console.info(`${label} created → ${to}`);
    return;
  }

  const result = assertTransition(from, to);
  if (result.ok) {
    console.info(`${label} ${from} → ${to} ✓`);
  } else {
    console.warn(`${label} ${from} → ${to} ✗`, result.error);
  }
}

/**
 * Builds a fully populated domain `Job` for mocks and browser-console experiments.
 * Computes `price_floor`, `handoff_mode`, `expires_at`, and `confirmation_code` when omitted.
 */
export function createSampleJob(overrides: SampleJobOverrides = {}): Job {
  const job_type = overrides.job_type ?? 'campus_immediate';
  const created_at = overrides.created_at ?? new Date().toISOString();
  const item_type = overrides.item_type ?? 'Document';
  const weight = overrides.weight ?? 'Light';
  const risk = overrides.risk ?? 'Low';
  const status = overrides.status ?? 'OPEN';

  const price_floor =
    overrides.price_floor ??
    computePriceFloor(item_type, weight, risk, job_type);
  const posted_price = overrides.posted_price ?? Math.round(price_floor * 1.15);

  const scheduled_window = overrides.scheduled_window;
  const travel_date = overrides.travel_date;

  const agreed_price =
    overrides.agreed_price ??
    (MATCHED_PLUS.includes(status) ? posted_price : undefined);

  return {
    id: overrides.id ?? `JOB-DEV-${Math.floor(1000 + Math.random() * 9000)}`,
    status,
    sender_id: overrides.sender_id ?? 'u-dev',
    sender_name: overrides.sender_name ?? 'Dev Sender',
    sender_hostel: overrides.sender_hostel ?? 'MH-C Block',
    runner_id: overrides.runner_id,
    runner_name: overrides.runner_name,
    runner_rating: overrides.runner_rating,
    runner_hostel: overrides.runner_hostel,
    job_type,
    handoff_mode: resolveHandoffMode(job_type),
    item_type,
    weight,
    risk,
    purchase_type: 'carry_only',
    pickup_location: overrides.pickup_location ?? 'MBA Hall Gate',
    drop_location: overrides.drop_location ?? 'Tech Tower A-304',
    pickup_location_type: overrides.pickup_location_type ?? 'general',
    drop_location_type: overrides.drop_location_type ?? 'general',
    description: overrides.description ?? 'Dev sample job',
    price_floor,
    posted_price,
    agreed_price,
    confirmation_code: overrides.confirmation_code ?? generateConfirmationCode(),
    expires_at:
      overrides.expires_at ??
      computeExpiresAt(job_type, created_at, scheduled_window, travel_date),
    condition_acknowledged: overrides.condition_acknowledged ?? false,
    corridor_landmark: overrides.corridor_landmark,
    receiver_phone: overrides.receiver_phone,
    scheduled_window,
    travel_date,
    photo_url: overrides.photo_url,
    dropoff_photo_url: overrides.dropoff_photo_url,
    no_answer_at: overrides.no_answer_at,
    ops_notified: overrides.ops_notified,
    no_answer_contact_attempts: overrides.no_answer_contact_attempts,
    sender_response_at: overrides.sender_response_at,
    no_answer_resolution: overrides.no_answer_resolution,
    dropoff_secure_location: overrides.dropoff_secure_location,
    dropoff_geotag: overrides.dropoff_geotag,
    runner_payout_status: overrides.runner_payout_status,
    payment_method: overrides.payment_method,
    payment_status: overrides.payment_status,
    paid_at: overrides.paid_at,
    dispute_window_ends_at: overrides.dispute_window_ends_at,
    closed_at: overrides.closed_at,
    dispute_type: overrides.dispute_type,
    dispute_description: overrides.dispute_description,
    disputed_at: overrides.disputed_at,
    declared_value: overrides.declared_value,
    created_at,
    matched_at: overrides.matched_at,
    pickup_confirmed_at: overrides.pickup_confirmed_at,
    delivered_at: overrides.delivered_at,
    eta: overrides.eta ?? '~10 min',
    distance: overrides.distance ?? '0.8 km',
    tip_amount: overrides.tip_amount,
    rating: overrides.rating,
  };
}

export type DevJobDebugHandlers = {
  setJobs: (update: Job[] | ((prev: Job[]) => Job[])) => void;
  setActiveJob?: (job: Job | null) => void;
  /** Provided by AppProvider to avoid a circular import with demoScenarios. */
  createPilotJobs?: () => Job[];
  /** Provided by AppProvider to suspend/unsuspend a runner's trust record + User.suspension_status. */
  setRunnerSuspension?: (
    runnerId: string,
    status: SuspensionStatus,
    reason?: string,
  ) => void;
};

export type RushBuddyDevGlobal = {
  createSampleJob: typeof createSampleJob;
  logJobTransition: typeof logJobTransition;
  /** Prepends a sample job to context state. */
  addJob: (overrides?: SampleJobOverrides) => Job;
  /** Updates status with transition logging. */
  transitionJob: (jobId: string, to: JobStatus) => void;
  /**
   * Loads Phase 8 dogfooding fixtures (`PILOT-01`…`PILOT-12`).
   * Removes any prior `PILOT-*` jobs, then prepends the fresh set.
   */
  loadPilotScenarios: () => Job[];
  /** Toggles the no-answer wait-gate bypass (P0-04/P0-05 testing). */
  bypassNoAnswerWait: (enabled: boolean) => void;
  /** Suspends a runner (mock ops action / P0-06 testing). */
  suspendRunner: (runnerId: string, reason?: string) => void;
  /** Lifts a runner suspension. */
  unsuspendRunner: (runnerId: string) => void;
};

declare global {
  interface Window {
    __rushbuddyDev?: RushBuddyDevGlobal;
  }
}

/**
 * Attaches helpers to `window.__rushbuddyDev` in development.
 * Returns a cleanup function (call on unmount).
 */
export function attachDevJobDebug(handlers: DevJobDebugHandlers): () => void {
  if (!import.meta.env.DEV) {
    return () => {};
  }

  const api: RushBuddyDevGlobal = {
    createSampleJob,
    logJobTransition,
    addJob(overrides) {
      const job = createSampleJob(overrides);
      logJobTransition(job.id, '(new)', job.status);
      handlers.setJobs(prev => [job, ...prev]);
      handlers.setActiveJob?.(job);
      return job;
    },
    transitionJob(jobId, to) {
      handlers.setJobs(prev =>
        prev.map(j => {
          if (j.id !== jobId) return j;
          logJobTransition(jobId, j.status, to);
          return { ...j, status: to };
        }),
      );
    },
    loadPilotScenarios() {
      const pilots = handlers.createPilotJobs?.() ?? [];
      if (pilots.length === 0) {
        console.warn(
          '[RushBuddy dev] loadPilotScenarios() — no jobs (createPilotJobs not provided)',
        );
        return pilots;
      }
      handlers.setJobs(prev => {
        const withoutPriorPilots = prev.filter(j => !j.id.startsWith('PILOT-'));
        return [...pilots, ...withoutPriorPilots];
      });
      pilots.forEach(j => logJobTransition(j.id, '(new)', j.status));
      console.info(
        `[RushBuddy dev] loadPilotScenarios() — loaded ${pilots.length} pilot jobs:`,
        pilots.map(j => `${j.id} (${j.status})`),
      );
      return pilots;
    },
    bypassNoAnswerWait(enabled) {
      _devFlags.bypassNoAnswerWait = enabled;
      console.info(`[RushBuddy dev] bypassNoAnswerWait(${enabled})`);
    },
    suspendRunner(runnerId, reason = 'Manual dev suspension') {
      handlers.setRunnerSuspension?.(runnerId, 'suspended', reason);
      console.info(`[RushBuddy dev] suspendRunner(${runnerId}) — ${reason}`);
    },
    unsuspendRunner(runnerId) {
      handlers.setRunnerSuspension?.(runnerId, 'active');
      console.info(`[RushBuddy dev] unsuspendRunner(${runnerId})`);
    },
  };

  window.__rushbuddyDev = api;
  console.info(
    '[RushBuddy dev] Helpers on window.__rushbuddyDev — addJob(), transitionJob(), loadPilotScenarios(), bypassNoAnswerWait(), suspendRunner(), unsuspendRunner(), logJobTransition(), createSampleJob()',
  );

  return () => {
    delete window.__rushbuddyDev;
  };
}
