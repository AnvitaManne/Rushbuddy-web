import type {
  FIRExport,
  FirPartyIdentity,
  FirTimelineEntry,
  Job,
  RunnerTrustRecord,
  TrustEvent,
  TrustEventType,
  TrustSeverity,
  User,
} from './types';

/**
 * Second no-show (repeat offense) triggers suspension eligibility.
 * First offense is a warning / strike only.
 */
export const NO_SHOW_SUSPENSION_THRESHOLD = 2;

/** Trust score deducted per no-show strike (clamped at 0). */
const NO_SHOW_TRUST_PENALTY = 5;

export type CreateTrustEventInput = {
  type: TrustEventType;
  message: string;
  job_id?: string;
  actor_user_id?: string;
  target_user_id?: string;
  metadata?: Record<string, string | number | boolean | null>;
  /** Override auto severity from `getTrustSeverityForEvent`. */
  severity?: TrustSeverity;
  created_at?: string;
  id?: string;
};

function newTrustEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `te_${crypto.randomUUID()}`;
  }
  return `te_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

/** Maps event type → default severity for ops triage. */
export function getTrustSeverityForEvent(type: TrustEventType): TrustSeverity {
  switch (type) {
    case 'secure_drop_completed':
    case 'ops_note_added':
      return 'info';
    case 'runner_no_show_pre_pickup':
    case 'sender_no_answer_dropoff':
    case 'hold_for_ops':
    case 'dispute_filed':
      return 'warning';
    case 'runner_unresponsive_after_pickup':
    case 'theft_escalation':
    case 'account_suspended':
      return 'critical';
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Builds a TrustEvent with id, timestamp, and severity filled in. */
export function createTrustEvent(input: CreateTrustEventInput): TrustEvent {
  return {
    id: input.id ?? newTrustEventId(),
    type: input.type,
    job_id: input.job_id,
    actor_user_id: input.actor_user_id,
    target_user_id: input.target_user_id,
    created_at: input.created_at ?? new Date().toISOString(),
    severity: input.severity ?? getTrustSeverityForEvent(input.type),
    message: input.message,
    metadata: input.metadata,
  };
}

/** Increments no-show count, stamps incident time, applies trust penalty. */
export function applyNoShowStrike(record: RunnerTrustRecord): RunnerTrustRecord {
  const nextCount = record.no_show_count + 1;
  return {
    ...record,
    no_show_count: nextCount,
    trust_score: Math.max(0, record.trust_score - NO_SHOW_TRUST_PENALTY),
    last_incident_at: new Date().toISOString(),
  };
}

/** True when no-show count reaches the repeat-offense threshold. */
export function shouldSuspendForNoShows(record: RunnerTrustRecord): boolean {
  return record.no_show_count >= NO_SHOW_SUSPENSION_THRESHOLD;
}

/** Marks the runner suspended with a reason (does not change no_show_count). */
export function suspendRunner(
  record: RunnerTrustRecord,
  reason: string,
): RunnerTrustRecord {
  return {
    ...record,
    suspension_status: 'suspended',
    suspension_reason: reason,
    last_incident_at: new Date().toISOString(),
  };
}

/**
 * Theft-like dispute types that trigger escalation + suspension.
 * Matches RatingPage labels (e.g. "Not delivered").
 */
export function isTheftLikeDispute(disputeType: string): boolean {
  const normalized = disputeType.trim().toLowerCase();
  return (
    normalized === 'not delivered' ||
    normalized.includes('theft') ||
    normalized.includes('misappropriat') ||
    normalized.includes('stolen')
  );
}

/** Clears suspension (dev / ops mock). Keeps no_show_count and trust_score. */
export function unsuspendRunner(record: RunnerTrustRecord): RunnerTrustRecord {
  return {
    ...record,
    suspension_status: 'active',
    suspension_reason: undefined,
  };
}

/** Mock ops dispute resolution outcomes (TrackingPage DEV panel). */
export type DisputeResolutionOutcome =
  | 'runner_at_fault'
  | 'sender_error'
  | 'unclear';

/** Trust score penalty when ops finds runner at fault (mock). */
export const DISPUTE_RUNNER_FAULT_TRUST_PENALTY = 10;

/** Maps resolution → runner payout status for mock ops close. */
export function payoutStatusForDisputeResolution(
  outcome: DisputeResolutionOutcome,
): 'withheld' | 'earned' {
  return outcome === 'runner_at_fault' ? 'withheld' : 'earned';
}

/** Applies runner-at-fault trust penalty on the trust record. */
export function applyDisputeRunnerFaultPenalty(
  record: RunnerTrustRecord,
): RunnerTrustRecord {
  return {
    ...record,
    trust_score: Math.max(0, record.trust_score - DISPUTE_RUNNER_FAULT_TRUST_PENALTY),
    last_incident_at: new Date().toISOString(),
  };
}

function buildMockPartyIdentity(user: User): FirPartyIdentity {
  const mockPhone = `+91-MOCK-${user.id.slice(-4).padStart(4, '0')}`;
  return {
    user_id: user.id,
    name: user.name,
    display_name: user.name,
    email: user.email,
    hostel_block: user.hostel_block,
    phone: mockPhone,
    college_id: `MOCK-COLLEGE-ID-${user.id}`,
    aadhaar_linked_phone: `MOCK-AADHAAR-PHONE-${user.id}`,
    identity_source: 'mock_vit_email_only',
    mock_aadhaar_ref: `MOCK-AADHAAR-REDACTED-${user.id}`,
  };
}

function buildJobTimeline(job: Job, events: TrustEvent[]): FirTimelineEntry[] {
  const fromJob: FirTimelineEntry[] = [];

  fromJob.push({
    at: job.created_at,
    label: 'Job created',
    source: 'job',
    status: 'OPEN',
  });

  if (job.matched_at) {
    fromJob.push({
      at: job.matched_at,
      label: 'Runner matched',
      source: 'job',
      status: 'MATCHED',
    });
  }
  if (job.pickup_confirmed_at) {
    fromJob.push({
      at: job.pickup_confirmed_at,
      label: 'Pickup confirmed',
      source: 'job',
      status: 'IN_TRANSIT',
    });
  }
  if (job.no_answer_at) {
    fromJob.push({
      at: job.no_answer_at,
      label: 'No answer at dropoff',
      source: 'job',
    });
  }
  if (job.delivered_at) {
    fromJob.push({
      at: job.delivered_at,
      label: 'Delivery confirmed',
      source: 'job',
      status: 'DELIVERED',
    });
  }

  const disputeEvent = events.find(
    (e) => e.job_id === job.id && (e.type === 'dispute_filed' || e.type === 'theft_escalation'),
  );
  if (disputeEvent || job.status === 'DISPUTED') {
    fromJob.push({
      at: disputeEvent?.created_at ?? job.delivered_at ?? job.created_at,
      label: 'Dispute / escalation recorded',
      source: disputeEvent ? 'trust_event' : 'job',
      status: 'DISPUTED',
      event_type: disputeEvent?.type,
    });
  }

  if (job.status === 'CLOSED') {
    fromJob.push({
      at: job.closed_at ?? job.delivered_at ?? job.created_at,
      label: 'Job closed',
      source: 'job',
      status: 'CLOSED',
    });
  }

  const fromEvents: FirTimelineEntry[] = events
    .filter((e) => !e.job_id || e.job_id === job.id)
    .map((e) => ({
      at: e.created_at,
      label: e.message,
      source: 'trust_event' as const,
      event_type: e.type,
    }));

  return [...fromJob, ...fromEvents].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

/**
 * Assembles a mock FIR support package from job + parties + trust events.
 * Disclaimer is always mock / not a legal filing.
 */
export function buildFirExport(
  job: Job,
  runner: User,
  sender: User,
  events: TrustEvent[],
): FIRExport {
  const jobEvents = events.filter((e) => !e.job_id || e.job_id === job.id);
  const disputeFiled = jobEvents.find((e) => e.type === 'dispute_filed');
  const disputeType =
    (disputeFiled?.metadata?.dispute_type as string | undefined) ?? null;
  const disputeDescription =
    (disputeFiled?.metadata?.dispute_description as string | undefined) ?? null;

  const dropoff_geotag =
    job.dropoff_photo_url || job.no_answer_at || disputeFiled
      ? {
          lat: null as number | null,
          lng: null as number | null,
          label: 'Mock dropoff geotag (not live GPS)',
          captured_at: job.no_answer_at ?? job.delivered_at ?? disputeFiled?.created_at ?? null,
        }
      : null;

  return {
    job_id: job.id,
    runner_identity: buildMockPartyIdentity(runner),
    sender_identity: buildMockPartyIdentity(sender),
    job_timeline: buildJobTimeline(job, jobEvents),
    last_known_status: job.status,
    evidence: {
      photo_url: job.photo_url ?? null,
      dropoff_photo_url: job.dropoff_photo_url ?? null,
      dropoff_geotag,
      condition_note: job.condition_acknowledged
        ? 'Condition acknowledged at pickup (no free-text note stored in V1 mock)'
        : null,
      dispute_type: disputeType,
      dispute_description: disputeDescription,
      ops_notified: job.ops_notified ?? false,
      no_answer_at: job.no_answer_at ?? null,
      trust_events: jobEvents,
      mock_gps_log: [
        {
          at: job.pickup_confirmed_at ?? job.matched_at ?? job.created_at,
          label: 'Mock last-known location (pickup corridor)',
          lat: null,
          lng: null,
        },
      ],
    },
    generated_at: new Date().toISOString(),
    disclaimer: 'mock/supporting-document-not-legal-filing',
    package_label: 'RushBuddy mock FIR support package (not a legal filing)',
  };
}
