import type { Job, RunnerTrustRecord, TrustEvent, TrustEventType, FIRExport } from './types';

/** No-show strikes at (or above) this count trigger an automatic suspension. */
export const NO_SHOW_SUSPENSION_THRESHOLD = 2;

let trustEventSeq = 0;

/** Builds a new immutable trust/safety log entry. Does not mutate any state on its own. */
export function createTrustEvent(params: {
  runner_id: string;
  job_id?: string;
  type: TrustEventType;
  description: string;
}): TrustEvent {
  trustEventSeq += 1;
  return {
    id: `TE-${Date.now()}-${trustEventSeq}`,
    runner_id: params.runner_id,
    job_id: params.job_id,
    type: params.type,
    description: params.description,
    created_at: new Date().toISOString(),
  };
}

/**
 * Records a no-show strike against a runner's trust record.
 * Auto-suspends once `no_show_count` reaches `NO_SHOW_SUSPENSION_THRESHOLD`.
 */
export function applyNoShowStrike(record: RunnerTrustRecord): RunnerTrustRecord {
  const no_show_count = record.no_show_count + 1;
  const shouldSuspend =
    no_show_count >= NO_SHOW_SUSPENSION_THRESHOLD && record.suspension_status !== 'suspended';
  if (!shouldSuspend) {
    return { ...record, no_show_count };
  }
  return {
    ...record,
    no_show_count,
    suspension_status: 'suspended',
    suspended_at: new Date().toISOString(),
    suspension_reason: `Repeated no-shows (${no_show_count})`,
  };
}

/** Immediately suspends a runner (e.g. theft escalation from a "Not delivered" dispute). */
export function suspendRunner(record: RunnerTrustRecord, reason: string): RunnerTrustRecord {
  return {
    ...record,
    suspension_status: 'suspended',
    suspended_at: new Date().toISOString(),
    suspension_reason: reason,
  };
}

/** Lifts a suspension (ops resolution / dev tool). */
export function unsuspendRunner(record: RunnerTrustRecord): RunnerTrustRecord {
  return {
    ...record,
    suspension_status: 'active',
    suspended_at: undefined,
    suspension_reason: undefined,
  };
}

/** Builds a mock FIR (First Information Report) support package for a disputed job. */
export function buildFirExport(job: Job): FIRExport {
  return {
    job_id: job.id,
    generated_at: new Date().toISOString(),
    sender_name: job.sender_name,
    sender_hostel: job.sender_hostel,
    runner_id: job.runner_id ?? 'unknown',
    runner_name: job.runner_name ?? 'unknown',
    item_description: `${job.item_type} · ${job.weight} · ${job.risk} risk — ${job.description || 'No description provided'}`,
    declared_value: job.declared_value,
    pickup_location: job.pickup_location,
    drop_location: job.drop_location,
    dispute_type: job.dispute_type,
    dispute_description: job.dispute_description,
    confirmation_code: job.confirmation_code,
    timeline: {
      created_at: job.created_at,
      matched_at: job.matched_at,
      pickup_confirmed_at: job.pickup_confirmed_at,
      delivered_at: job.delivered_at,
      disputed_at: job.disputed_at,
    },
  };
}

/*
 * --- Examples (no test runner) ---
 *
 * applyNoShowStrike({ runner_id: 'r1', no_show_count: 1, suspension_status: 'active' })
 *   // { runner_id: 'r1', no_show_count: 2, suspension_status: 'suspended', ... }
 *
 * suspendRunner({ runner_id: 'r1', no_show_count: 0, suspension_status: 'active' }, 'Theft escalation')
 *   // { ..., suspension_status: 'suspended', suspension_reason: 'Theft escalation' }
 */
