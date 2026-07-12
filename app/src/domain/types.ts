import type {
  HandoffMode,
  ItemType,
  JobStatus,
  JobType,
  LocationType,
  PurchaseType,
  RiskLevel,
  SuspensionStatus,
  UserGender,
  UserRole,
  WeightTier,
} from './enums';

export type {
  HandoffMode,
  ItemType,
  JobStatus,
  JobType,
  LocationType,
  PurchaseType,
  RiskLevel,
  SuspensionStatus,
  UserGender,
  UserRole,
  WeightTier,
} from './enums';

export { DECLARED_VALUE_MAX_INR } from './constants';

/** ISO 8601 timestamp window for campus_scheduled jobs. */
export interface ScheduledWindow {
  start: string;
  end: string;
}

/**
 * Authenticated RushBuddy user.
 * `gender` is matching-only and must not be surfaced in UI.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  hostel_block: string;
  verified: boolean;
  current_role: UserRole;

  /** Aggregate runner rating (1–5). */
  rating: number;
  total_deliveries: number;
  total_earnings: number;
  weekly_earnings: number;
  acceptance_rate: number;
  trust_score: number;
  joined_at: string;

  gender: UserGender;
  no_show_count: number;
  suspension_status: SuspensionStatus;

  streak: number;
  best_week_earnings: number;
}

/**
 * Delivery job — canonical domain shape (snake_case).
 *
 * Pricing lifecycle:
 * - At **OPEN**: `price_floor` (system minimum) and `posted_price` (sender offer, ≥ floor) are set.
 * - At **MATCHED**: `agreed_price` is set to `posted_price` and fixed for the rest of the job.
 * - Before match, `agreed_price` must be undefined.
 *
 * `handoff_mode` is chosen at posting and is immutable thereafter.
 * `corridor_landmark` and `receiver_phone` apply only when `handoff_mode` is `mode_2_landmark`.
 */
export interface Job {
  id: string;
  status: JobStatus;

  sender_id: string;
  sender_name: string;
  sender_hostel: string;
  runner_id?: string;
  runner_name?: string;
  runner_rating?: number;
  runner_hostel?: string;

  job_type: JobType;
  /** Immutable after the job is posted. */
  handoff_mode: HandoffMode;
  item_type: ItemType;
  weight: WeightTier;
  risk: RiskLevel;
  purchase_type: PurchaseType;

  pickup_location: string;
  drop_location: string;
  pickup_location_type: LocationType;
  drop_location_type: LocationType;
  description: string;

  /**
   * System-computed minimum from item × weight × risk (and corridor for intercity).
   * Set at creation; immutable.
   */
  price_floor: number;
  /**
   * Sender's posted offer (≥ `price_floor`). Set at OPEN.
   */
  posted_price: number;
  /**
   * Fixed payout amount. Set at MATCHED when a runner accepts; undefined while OPEN.
   */
  agreed_price?: number;

  /** Four-digit code generated at job creation; runner enters at handoff. */
  confirmation_code: string;

  /** Mode 2 (landmark) only. */
  corridor_landmark?: string;
  /** Mode 2 (landmark) only. */
  receiver_phone?: string;

  scheduled_window?: ScheduledWindow;
  /** ISO date (YYYY-MM-DD) for intercity jobs. */
  travel_date?: string;
  expires_at: string;

  condition_acknowledged: boolean;
  photo_url?: string;
  dropoff_photo_url?: string;
  no_answer_at?: string;
  ops_notified?: boolean;

  created_at: string;
  matched_at?: string;
  pickup_confirmed_at?: string;
  delivered_at?: string;

  /** Display-only hints used by mock UI until routing/ETA services exist. */
  eta?: string;
  distance?: string;

  tip_amount?: number;
  rating?: number;

  /** Runner payout lifecycle for ops/trust (mock — no real wallet). */
  runner_payout_status?: 'pending' | 'earned' | 'withheld' | 'paid';
}

/** Ops/trust event categories for no-shows, disputes, and FIR-ready logs. */
export type TrustEventType =
  | 'runner_no_show_pre_pickup'
  | 'runner_unresponsive_after_pickup'
  | 'sender_no_answer_dropoff'
  | 'secure_drop_completed'
  | 'hold_for_ops'
  | 'dispute_filed'
  | 'theft_escalation'
  | 'account_suspended'
  | 'ops_note_added';

export type TrustSeverity = 'info' | 'warning' | 'critical';

/**
 * Append-only trust/ops log entry.
 * Used for account actions and FIR export assembly — not a legal filing.
 */
export interface TrustEvent {
  id: string;
  type: TrustEventType;
  job_id?: string;
  actor_user_id?: string;
  target_user_id?: string;
  created_at: string;
  severity: TrustSeverity;
  message: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Runner-facing trust aggregate (mirrors User trust fields + ops extras).
 * Kept separate so ops can evolve without widening every User consumer.
 */
export interface RunnerTrustRecord {
  runner_id: string;
  no_show_count: number;
  suspension_status: SuspensionStatus;
  trust_score: number;
  last_incident_at?: string;
  suspension_reason?: string;
}

/** Mock-only party identity for FIR support packages. Never real Aadhaar. */
export interface FirPartyIdentity {
  user_id: string;
  display_name: string;
  email: string;
  hostel_block: string;
  /** V1 mock KYC — college email only; not government ID. */
  identity_source: 'mock_vit_email_only';
  /** Placeholder ref; always clearly mock. */
  mock_aadhaar_ref: string;
}

export interface FirTimelineEntry {
  at: string;
  label: string;
  source: 'job' | 'trust_event';
  status?: JobStatus;
  event_type?: TrustEventType;
}

export interface FirEvidence {
  pickup_photo_url: string | null;
  dropoff_photo_url: string | null;
  ops_notified: boolean;
  no_answer_at: string | null;
  trust_events: TrustEvent[];
  /** Mock GPS breadcrumbs for FIR support; not live tracking. */
  mock_gps_log: Array<{
    at: string;
    label: string;
    lat: number | null;
    lng: number | null;
  }>;
}

/**
 * FIR support package export.
 * Mock / supporting document only — not a legal filing with law enforcement.
 */
export interface FIRExport {
  job_id: string;
  runner_identity: FirPartyIdentity;
  sender_identity: FirPartyIdentity;
  job_timeline: FirTimelineEntry[];
  last_known_status: JobStatus;
  evidence: FirEvidence;
  generated_at: string;
  disclaimer: 'mock/supporting-document-not-legal-filing';
}
