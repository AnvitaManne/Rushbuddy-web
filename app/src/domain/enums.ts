/** Job lifecycle states (see core-flow-specs). */
export type JobStatus =
  | 'OPEN'
  | 'MATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CLOSED'
  | 'DISPUTED'
  | 'ISSUE_REPORTED'
  | 'PENDING_RATING';

/** Internal only — used for gendered-hostel matching; never shown in UI. */
export type UserGender = 'male' | 'female' | 'prefer_not_to_say';

export type SuspensionStatus = 'active' | 'suspended';

export type UserRole = 'sender' | 'runner' | null;

export type JobType = 'campus_immediate' | 'campus_scheduled' | 'intercity';

/** Locked at posting; cannot change mid-job. */
export type HandoffMode = 'mode_1_direct_p2p' | 'mode_2_landmark';

export type LocationType = 'general' | 'mens_hostel' | 'womens_hostel';

/** V1 hard lock — all jobs are carry-only. */
export type PurchaseType = 'carry_only';

export type ItemType = 'Document' | 'Food' | 'Medicine' | 'Object';

export type WeightTier = 'Light' | 'Medium' | 'Heavy';

export type RiskLevel = 'Low' | 'Fragile' | 'Valuable';

/**
 * Payment methods the sender can use on the rating / payment screen.
 * `cash` is only surfaced for Mode 1 jobs when the job is in PENDING_RATING
 * (i.e. the runner has already entered the handoff code).
 */
export type PaymentMethod = 'upi' | 'phonepe' | 'cash';

/**
 * Lifecycle state of the sender-side payment for a job.
 * Distinct from JobStatus — a job can be CLOSED with payment_status 'paid' (normal)
 * or 'disputed' (ops review path).
 */
export type PaymentStatus = 'unpaid' | 'paid' | 'disputed';
