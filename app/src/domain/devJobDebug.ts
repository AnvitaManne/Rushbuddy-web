import type { JobStatus } from './enums';
import type { Job, RunnerTrustRecord, TrustEvent } from './types';
import { assertTransition } from './jobTransitions';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
} from './jobHelpers';
import type { CreateTrustEventInput } from './trustOps';
import { createTrustEvent, suspendRunner as applySuspendRunner, unsuspendRunner as applyUnsuspendRunner } from './trustOps';

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
  /** Current trust event log (read via ref in AppContext). */
  getTrustEvents?: () => TrustEvent[];
  getRunnerTrustRecords?: () => Record<string, RunnerTrustRecord>;
  appendTrustEvent?: (input: CreateTrustEventInput | TrustEvent) => TrustEvent;
  updateRunnerTrustRecord?: (
    runnerId: string,
    updater: (prev: RunnerTrustRecord) => RunnerTrustRecord,
  ) => void;
};

export type RushBuddyDevGlobal = {
  createSampleJob: typeof createSampleJob;
  logJobTransition: typeof logJobTransition;
  /** Prepends a sample job to context state. */
  addJob: (overrides?: SampleJobOverrides) => Job;
  /** Updates status with transition logging. */
  transitionJob: (jobId: string, to: JobStatus) => void;
  /** In-memory trust event log. */
  trustEvents: () => TrustEvent[];
  /** In-memory runner trust records by runner id. */
  runnerTrustRecords: () => Record<string, RunnerTrustRecord>;
  /** Append a trust event (creates record lazily for target_user_id). */
  addTrustEvent: (input: CreateTrustEventInput | TrustEvent) => TrustEvent;
  /** Suspend a runner record and log account_suspended. */
  suspendRunner: (runnerId: string, reason: string) => RunnerTrustRecord | undefined;
  /** Clear suspension on a runner trust record (mock ops). */
  unsuspendRunner: (runnerId: string) => RunnerTrustRecord | undefined;
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
    trustEvents() {
      return handlers.getTrustEvents?.() ?? [];
    },
    runnerTrustRecords() {
      return handlers.getRunnerTrustRecords?.() ?? {};
    },
    addTrustEvent(input) {
      if (!handlers.appendTrustEvent) {
        const event = 'id' in input && 'severity' in input && 'created_at' in input
          ? (input as TrustEvent)
          : createTrustEvent(input as CreateTrustEventInput);
        console.warn('[RushBuddy dev] appendTrustEvent not wired; returning local event only');
        return event;
      }
      return handlers.appendTrustEvent(input);
    },
    suspendRunner(runnerId, reason) {
      if (!handlers.updateRunnerTrustRecord) {
        console.warn('[RushBuddy dev] updateRunnerTrustRecord not wired');
        return undefined;
      }
      let next: RunnerTrustRecord | undefined;
      handlers.updateRunnerTrustRecord(runnerId, (prev) => {
        next = applySuspendRunner(prev, reason);
        return next;
      });
      handlers.appendTrustEvent?.(
        createTrustEvent({
          type: 'account_suspended',
          target_user_id: runnerId,
          message: reason,
          metadata: { mock: true },
        }),
      );
      console.info(`[RushBuddy trust] suspended ${runnerId}: ${reason}`);
      return next;
    },
    unsuspendRunner(runnerId) {
      if (!handlers.updateRunnerTrustRecord) {
        console.warn('[RushBuddy dev] updateRunnerTrustRecord not wired');
        return undefined;
      }
      let next: RunnerTrustRecord | undefined;
      handlers.updateRunnerTrustRecord(runnerId, (prev) => {
        next = applyUnsuspendRunner(prev);
        return next;
      });
      console.info(`[RushBuddy trust] unsuspended ${runnerId}`);
      return next;
    },
  };

  window.__rushbuddyDev = api;
  console.info(
    '[RushBuddy dev] Helpers on window.__rushbuddyDev — addJob(), transitionJob(), trustEvents(), runnerTrustRecords(), addTrustEvent(), suspendRunner(), unsuspendRunner()',
  );

  return () => {
    delete window.__rushbuddyDev;
  };
}
