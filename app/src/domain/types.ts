import type {
  HandoffMode,
  ItemType,
  JobStatus,
  JobType,
  LocationType,
  PaymentMethod,
  PaymentStatus,
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
  PaymentMethod,
  PaymentStatus,
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

  /** Number of contact attempts logged by the runner when the sender is unreachable at drop-off. */
  no_answer_contact_attempts?: number;
  /** Set when the sender responds after a no-answer attempt (clears the unreachable path). */
  sender_response_at?: string;
  /** How an unreachable-sender delivery was resolved. `Low` risk → secure_drop; Fragile/Valuable → hold_for_ops. */
  no_answer_resolution?: 'secure_drop' | 'hold_for_ops';
  /** Free-text description of where the item was left for a secure drop. */
  dropoff_secure_location?: string;
  /** Mock geotag captured with drop-off evidence. */
  dropoff_geotag?: { lat: number; lng: number; accuracy_m: number; captured_at: string };

  /** Runner payout lifecycle, independent of sender payment status. */
  runner_payout_status?: 'pending' | 'earned' | 'withheld' | 'paid';

  /** Off-platform payment intent, recorded at rating time. Cash is hidden for Mode 2 (intercity) jobs. */
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  paid_at?: string;

  /** ISO timestamp after which the job may auto-close without a filed dispute. */
  dispute_window_ends_at?: string;
  closed_at?: string;

  dispute_type?: string;
  dispute_description?: string;
  disputed_at?: string;

  /** Sender-declared item value (INR), capped at `DECLARED_VALUE_MAX_INR`. */
  declared_value?: number;

  created_at: string;
  matched_at?: string;
  pickup_confirmed_at?: string;
  delivered_at?: string;

  /** Display-only hints used by mock UI until routing/ETA services exist. */
  eta?: string;
  distance?: string;

  tip_amount?: number;
  rating?: number;
}

/** Category of trust/safety event logged against a runner. */
export type TrustEventType =
  | 'no_show'
  | 'theft_escalation'
  | 'dispute_filed'
  | 'suspension'
  | 'unsuspension';

/** Immutable trust/safety log entry, attributable to a runner and (optionally) a job. */
export interface TrustEvent {
  id: string;
  runner_id: string;
  job_id?: string;
  type: TrustEventType;
  description: string;
  created_at: string;
}

/** Aggregate per-runner trust/safety state, separate from the display `User.trust_score`. */
export interface RunnerTrustRecord {
  runner_id: string;
  no_show_count: number;
  suspension_status: SuspensionStatus;
  suspended_at?: string;
  suspension_reason?: string;
}

/** Mock First Information Report export bundle for a disputed job, generated for ops/police handoff. */
export interface FIRExport {
  job_id: string;
  generated_at: string;
  sender_name: string;
  sender_hostel: string;
  runner_id: string;
  runner_name: string;
  item_description: string;
  declared_value?: number;
  pickup_location: string;
  drop_location: string;
  dispute_type?: string;
  dispute_description?: string;
  confirmation_code: string;
  timeline: {
    created_at: string;
    matched_at?: string;
    pickup_confirmed_at?: string;
    delivered_at?: string;
    disputed_at?: string;
  };
}
