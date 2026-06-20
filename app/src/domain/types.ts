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
 * How the no-answer-at-dropoff path was resolved.
 * - `secure_drop`: Low-risk only — item left at a secure nearby spot with photo evidence.
 * - `hold_for_ops`: Fragile/Valuable — runner holds item and awaits ops instruction.
 */
export type NoAnswerResolution = 'secure_drop' | 'hold_for_ops';

/** Runner payout lifecycle for failure/no-answer paths. */
export type RunnerPayoutStatus = 'pending' | 'earned' | 'withheld';

/** Mock geotagged location attached to an unattended secure drop. */
export interface DropoffGeotag {
  lat: number;
  lng: number;
  /** Human-readable label for the secure spot (e.g. "MH-B Gate Security Desk"). */
  label: string;
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

  // ── No-answer / failure-handling fields (Phase 5) ──────────────────────────

  /** ISO timestamp when runner first tapped "No Answer at Door". */
  no_answer_at?: string;
  /** Number of contact attempts made during the 20-minute wait (max = REQUIRED_CONTACT_ATTEMPTS). */
  no_answer_contact_attempts?: number;
  /** ISO timestamp when the sender responded during the wait window (clears no-answer path). */
  sender_response_at?: string;
  /** ISO timestamp when runner tapped "Sender Unreachable" after exhausting wait + attempts. */
  sender_unreachable_at?: string;
  /** Which branch the no-answer path resolved to. Set when runner taps "Sender Unreachable". */
  no_answer_resolution?: NoAnswerResolution;

  /** URL of mock geotagged photo for a secure-drop (Low risk path only). */
  dropoff_photo_url?: string;
  /** Mock geotag attached to the dropoff photo (Low risk path only). */
  dropoff_geotag?: DropoffGeotag;
  /** Text description of the secure spot chosen by the runner (Low risk path only). */
  dropoff_secure_location?: string;

  /** Whether ops has been notified of the no-answer event. */
  ops_notified?: boolean;
  /**
   * Runner payout lifecycle for failure paths.
   * - `pending`: default while job is active / under review.
   * - `earned`: full agreed fee confirmed (normal delivery or no-answer).
   * - `withheld`: ops review pending (ghosting / dispute).
   */
  runner_payout_status?: RunnerPayoutStatus;

  created_at: string;
  matched_at?: string;
  pickup_confirmed_at?: string;
  delivered_at?: string;

  /** Display-only hints used by mock UI until routing/ETA services exist. */
  eta?: string;
  distance?: string;

  tip_amount?: number;
  rating?: number;

  // ── Payment / closure fields (Phase 6) ────────────────────────────────────

  /**
   * Method the sender selected on the payment screen.
   * Recorded at confirmation; unverified for cash.
   */
  payment_method?: PaymentMethod;
  /**
   * Sender-side payment lifecycle.
   * - `unpaid`: default while job is active / awaiting rating.
   * - `paid`: sender confirmed payment (moves job to CLOSED).
   * - `disputed`: sender filed a dispute (moves job to DISPUTED → CLOSED via ops).
   */
  payment_status?: PaymentStatus;
  /** ISO timestamp when the sender tapped "Confirm Payment". */
  paid_at?: string;
  /**
   * ISO timestamp marking the end of the 2-hour dispute window.
   * Computed from `paid_at` by `computeDisputeWindowEndsAt`.
   * After this point the job auto-closes and the runner is paid in full.
   */
  dispute_window_ends_at?: string;
  /** ISO timestamp when the job transitioned to CLOSED. */
  closed_at?: string;
}
