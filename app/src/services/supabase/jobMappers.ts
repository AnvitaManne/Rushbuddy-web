/**
 * DB row ↔ domain Job mappers (Phase 13 / Slice 13.3).
 *
 * Only columns that exist on public.jobs are mapped. Payment / dispute / photo
 * lifecycle fields live in separate tables (payments, disputes, photos) and stay
 * mock-backed until later phases, so they are left undefined after hydrate.
 *
 * Confirmation code (pilot): stored plaintext in `confirmation_code_hash` so the
 * sender can re-read the 4-digit code across refreshes. It is only ever selected
 * for the job's own sender and never returned in feed/list projections.
 * TODO(prod): hash at rest + deliver the raw code out-of-band.
 */

import type { Job } from '@/domain/types';
import type {
  HandoffMode,
  ItemType,
  JobStatus,
  JobType,
  LocationType,
  PurchaseType,
  RiskLevel,
  WeightTier,
} from '@/domain/enums';

/** Feed / list projection — never includes confirmation_code_hash. */
export const JOB_COLUMNS =
  'id, organization_id, status, sender_id, sender_name, sender_hostel, runner_id, runner_name, runner_rating, runner_hostel, job_type, handoff_mode, item_type, weight, risk, purchase_type, pickup_location, drop_location, pickup_location_type, drop_location_type, description, price_floor, posted_price, agreed_price, corridor_landmark, receiver_phone, scheduled_window_start, scheduled_window_end, travel_date, expires_at, condition_acknowledged, no_answer_at, ops_notified, no_answer_contact_attempts, sender_response_at, no_answer_resolution, dropoff_secure_location, dropoff_geotag, runner_payout_status, dispute_window_ends_at, declared_value, matched_at, pickup_confirmed_at, delivered_at, closed_at, pickup_photo_id, dropoff_photo_id, created_at, updated_at' as const;

/** Sender-only detail projection — adds the plaintext code column. */
export const JOB_COLUMNS_WITH_CODE = `${JOB_COLUMNS}, confirmation_code_hash` as const;

export interface DbJobRow {
  id: string;
  organization_id: string;
  status: JobStatus;
  sender_id: string;
  sender_name: string | null;
  sender_hostel: string | null;
  runner_id: string | null;
  runner_name: string | null;
  runner_rating: number | string | null;
  runner_hostel: string | null;
  job_type: JobType;
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
  price_floor: number | string;
  posted_price: number | string;
  agreed_price: number | string | null;
  confirmation_code_hash?: string | null;
  corridor_landmark: string | null;
  receiver_phone: string | null;
  scheduled_window_start: string | null;
  scheduled_window_end: string | null;
  travel_date: string | null;
  expires_at: string;
  condition_acknowledged: boolean;
  no_answer_at: string | null;
  ops_notified: boolean | null;
  no_answer_contact_attempts: number | null;
  sender_response_at: string | null;
  no_answer_resolution: 'secure_drop' | 'hold_for_ops' | null;
  dropoff_secure_location: string | null;
  dropoff_geotag: Job['dropoff_geotag'] | null;
  runner_payout_status: 'pending' | 'earned' | 'withheld' | 'paid' | null;
  dispute_window_ends_at: string | null;
  declared_value: number | string | null;
  matched_at: string | null;
  pickup_confirmed_at: string | null;
  delivered_at: string | null;
  closed_at: string | null;
  pickup_photo_id?: string | null;
  dropoff_photo_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  /** Joined from photos when selecting with embed. */
  pickup_photo?: { storage_path: string } | null;
  dropoff_photo?: { storage_path: string } | null;
}

function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function optNum(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Pilot: plaintext at rest so the sender can re-read the code. TODO(prod): hash. */
export function hashConfirmationCode(code: string): string {
  return code.trim();
}

/** Constant-time-ish equality for handoff verification (Phase 14). */
export function verifyConfirmationCode(entered: string, stored: string): boolean {
  return entered.trim() === stored.trim();
}

/**
 * Map a public.jobs row → domain Job.
 * `includeConfirmationCode` must only be true when the caller is the sender.
 */
export function mapJobRow(
  row: DbJobRow,
  opts: { includeConfirmationCode?: boolean } = {},
): Job {
  const job: Job = {
    id: row.id,
    status: row.status,
    sender_id: row.sender_id,
    sender_name: row.sender_name ?? '',
    sender_hostel: row.sender_hostel ?? '',
    job_type: row.job_type,
    handoff_mode: row.handoff_mode,
    item_type: row.item_type,
    weight: row.weight,
    risk: row.risk,
    purchase_type: row.purchase_type,
    pickup_location: row.pickup_location,
    drop_location: row.drop_location,
    pickup_location_type: row.pickup_location_type,
    drop_location_type: row.drop_location_type,
    description: row.description ?? '',
    price_floor: num(row.price_floor),
    posted_price: num(row.posted_price),
    confirmation_code: opts.includeConfirmationCode ? (row.confirmation_code_hash ?? '') : '',
    expires_at: row.expires_at,
    condition_acknowledged: !!row.condition_acknowledged,
    created_at: row.created_at,
  };

  if (row.runner_id) {
    job.runner_id = row.runner_id;
    if (row.runner_name) job.runner_name = row.runner_name;
    job.runner_rating = optNum(row.runner_rating);
    if (row.runner_hostel) job.runner_hostel = row.runner_hostel;
  }

  const agreed = optNum(row.agreed_price);
  if (agreed !== undefined) job.agreed_price = agreed;

  if (row.corridor_landmark) job.corridor_landmark = row.corridor_landmark;
  if (row.receiver_phone) job.receiver_phone = row.receiver_phone;
  if (row.scheduled_window_start && row.scheduled_window_end) {
    job.scheduled_window = {
      start: row.scheduled_window_start,
      end: row.scheduled_window_end,
    };
  }
  if (row.travel_date) job.travel_date = row.travel_date;

  if (row.no_answer_at) job.no_answer_at = row.no_answer_at;
  if (row.ops_notified != null) job.ops_notified = row.ops_notified;
  if (row.no_answer_contact_attempts != null)
    job.no_answer_contact_attempts = row.no_answer_contact_attempts;
  if (row.sender_response_at) job.sender_response_at = row.sender_response_at;
  if (row.no_answer_resolution) job.no_answer_resolution = row.no_answer_resolution;
  if (row.dropoff_secure_location) job.dropoff_secure_location = row.dropoff_secure_location;
  if (row.dropoff_geotag) job.dropoff_geotag = row.dropoff_geotag;
  if (row.runner_payout_status) job.runner_payout_status = row.runner_payout_status;
  if (row.dispute_window_ends_at) job.dispute_window_ends_at = row.dispute_window_ends_at;

  const declared = optNum(row.declared_value);
  if (declared !== undefined) job.declared_value = declared;

  if (row.matched_at) job.matched_at = row.matched_at;
  if (row.pickup_confirmed_at) job.pickup_confirmed_at = row.pickup_confirmed_at;
  if (row.delivered_at) job.delivered_at = row.delivered_at;
  if (row.closed_at) job.closed_at = row.closed_at;

  return job;
}

/** Domain Job → INSERT payload for public.jobs (sender create path). */
export function mapJobToInsert(
  job: Job,
  ctx: { organizationId: string; senderId: string },
): Record<string, unknown> {
  const insert: Record<string, unknown> = {
    organization_id: ctx.organizationId,
    status: job.status,
    sender_id: ctx.senderId,
    sender_name: job.sender_name,
    sender_hostel: job.sender_hostel,
    job_type: job.job_type,
    handoff_mode: job.handoff_mode,
    item_type: job.item_type,
    weight: job.weight,
    risk: job.risk,
    purchase_type: job.purchase_type,
    pickup_location: job.pickup_location,
    drop_location: job.drop_location,
    pickup_location_type: job.pickup_location_type,
    drop_location_type: job.drop_location_type,
    description: job.description ?? '',
    price_floor: job.price_floor,
    posted_price: job.posted_price,
    confirmation_code_hash: hashConfirmationCode(job.confirmation_code),
    expires_at: job.expires_at,
    condition_acknowledged: job.condition_acknowledged ?? false,
  };

  if (job.agreed_price !== undefined) insert.agreed_price = job.agreed_price;
  if (job.corridor_landmark) insert.corridor_landmark = job.corridor_landmark;
  if (job.receiver_phone) insert.receiver_phone = job.receiver_phone;
  if (job.scheduled_window) {
    insert.scheduled_window_start = job.scheduled_window.start;
    insert.scheduled_window_end = job.scheduled_window.end;
  }
  if (job.travel_date) insert.travel_date = job.travel_date;
  if (job.declared_value !== undefined) insert.declared_value = job.declared_value;

  return insert;
}

/** Domain Job patch → jobs UPDATE payload (only mapped columns are forwarded). */
export function mapJobPatchToDb(patch: Partial<Job>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  const passthrough: (keyof Job)[] = [
    'status',
    'runner_id',
    'runner_name',
    'runner_rating',
    'runner_hostel',
    'agreed_price',
    'posted_price',
    'price_floor',
    'description',
    'expires_at',
    'condition_acknowledged',
    'no_answer_at',
    'ops_notified',
    'no_answer_contact_attempts',
    'sender_response_at',
    'no_answer_resolution',
    'dropoff_secure_location',
    'dropoff_geotag',
    'runner_payout_status',
    'dispute_window_ends_at',
    'declared_value',
    'matched_at',
    'pickup_confirmed_at',
    'delivered_at',
    'closed_at',
  ];

  for (const key of passthrough) {
    if (patch[key] !== undefined) db[key] = patch[key];
  }

  if (patch.scheduled_window !== undefined) {
    db.scheduled_window_start = patch.scheduled_window?.start ?? null;
    db.scheduled_window_end = patch.scheduled_window?.end ?? null;
  }

  db.updated_at = new Date().toISOString();
  return db;
}
