import { DECLARED_VALUE_MAX_INR } from './constants';
import type { JobType, LocationType } from './enums';
import type { Job, ScheduledWindow } from './types';
import { validatePostedPrice } from './jobHelpers';

/** Job statuses that block a sender from posting another in-flight request in V1. */
export const SENDER_ACTIVE_JOB_STATUSES = [
  'OPEN',
  'MATCHED',
  'IN_TRANSIT',
  'ISSUE_REPORTED',
] as const satisfies readonly Job['status'][];

/** Runner delivery is in progress for these statuses only. */
export const RUNNER_ACTIVE_DELIVERY_STATUSES = [
  'MATCHED',
  'IN_TRANSIT',
] as const satisfies readonly Job['status'][];

/** Fields validated by `validatePostRequestDraft`. */
export type PostRequestField =
  | 'pickup_location'
  | 'drop_location'
  | 'pickup_location_type'
  | 'drop_location_type'
  | 'declared_value'
  | 'posted_price'
  | 'price_floor'
  | 'scheduling'
  | 'corridor_landmark'
  | 'receiver_phone'
  | 'sender_active';

/** Minimum input required to validate a post-request form before job creation. */
export interface PostRequestDraft {
  job_type: JobType;
  pickup_location: string;
  drop_location: string;
  pickup_location_type: LocationType;
  drop_location_type: LocationType;
  price_floor: number;
  posted_price: number;
  declared_value?: number;
  scheduled_window_start?: string;
  scheduled_window_end?: string;
  travel_datetime?: string;
  corridor_landmark?: string;
  receiver_phone?: string;
  sender_id?: string;
  existing_jobs?: readonly Job[];
}

export interface PostRequestValidationResult {
  valid: boolean;
  errors: Partial<Record<PostRequestField, string>>;
}

/** Converts `<input type="datetime-local">` value to ISO 8601 UTC. */
export function parseDatetimeLocalToIso(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseDatetimeInput(input: string): Date | null {
  if (!input.trim()) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True when declared value is a positive amount within the V1 cap (≤ ₹2,000).
 */
export function validateDeclaredValue(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= DECLARED_VALUE_MAX_INR;
}

/** UI-friendly declared-value validation; pass `null` when input is blank or unparsable. */
export function getDeclaredValueError(value: number | null): string | undefined {
  if (value === null) {
    return 'Declared value is required.';
  }
  if (!Number.isFinite(value)) {
    return 'Enter a valid declared value.';
  }
  if (value <= 0) {
    return 'Declared value must be greater than zero.';
  }
  if (value > DECLARED_VALUE_MAX_INR) {
    return `Declared value cannot exceed ₹${DECLARED_VALUE_MAX_INR.toLocaleString('en-IN')} in V1.`;
  }
  return undefined;
}

/**
 * Rejects postings where pickup and drop require different runner genders
 * (men's hostel on one end and women's hostel on the other).
 */
export const LOCATION_TYPE_CONFLICT_MESSAGE =
  "Pickup and drop cannot mix men's and women's hostel on the same job.";

export function validateLocationTypes(
  pickup_location_type: LocationType,
  drop_location_type: LocationType,
): boolean {
  const hasMens =
    pickup_location_type === 'mens_hostel' || drop_location_type === 'mens_hostel';
  const hasWomens =
    pickup_location_type === 'womens_hostel' || drop_location_type === 'womens_hostel';
  return !(hasMens && hasWomens);
}

/** Returns the conflict message when location types cannot be matched to one runner. */
export function getLocationTypeConflictError(
  pickup_location_type: LocationType,
  drop_location_type: LocationType,
): string | undefined {
  return validateLocationTypes(pickup_location_type, drop_location_type)
    ? undefined
    : LOCATION_TYPE_CONFLICT_MESSAGE;
}

/** Returns the sender's in-flight job, if any. */
export function getSenderActiveJob(
  jobs: readonly Job[],
  senderId: string,
): Job | undefined {
  return jobs.find(
    j =>
      j.sender_id === senderId &&
      (SENDER_ACTIVE_JOB_STATUSES as readonly string[]).includes(j.status),
  );
}

export function getSenderActiveJobError(
  jobs: readonly Job[],
  senderId: string,
): string | undefined {
  const active = getSenderActiveJob(jobs, senderId);
  if (!active) return undefined;
  return `You already have an active request (${active.id}). Cancel it before posting a new one.`;
}

/** Validates job-type timing fields from datetime-local inputs. */
export function validatePostRequestTiming(
  jobType: JobType,
  scheduledWindowStart: string,
  scheduledWindowEnd: string,
  travelDatetime: string,
  now: Date = new Date(),
): string | undefined {
  if (jobType === 'campus_immediate') return undefined;

  if (jobType === 'campus_scheduled') {
    if (!scheduledWindowStart.trim() || !scheduledWindowEnd.trim()) {
      return 'Window start and end are required.';
    }
    const start = parseDatetimeInput(scheduledWindowStart);
    const end = parseDatetimeInput(scheduledWindowEnd);
    if (!start || !end) {
      return 'Enter valid window start and end times.';
    }
    if (end.getTime() <= start.getTime()) {
      return 'Window end must be after window start.';
    }
    if (end.getTime() <= now.getTime()) {
      return 'Window end must be in the future.';
    }
    return undefined;
  }

  if (!travelDatetime.trim()) {
    return 'Travel date and time are required.';
  }
  const travel = parseDatetimeInput(travelDatetime);
  if (!travel) {
    return 'Enter a valid travel date and time.';
  }
  if (travel.getTime() <= now.getTime()) {
    return 'Travel time must be in the future.';
  }
  return undefined;
}

/** Validates Mode 2 intercity handoff fields. */
export function validatePostRequestMode2(
  jobType: JobType,
  corridorLandmark: string,
  receiverPhone: string,
): Partial<Pick<PostRequestValidationResult['errors'], 'corridor_landmark' | 'receiver_phone'>> {
  if (jobType !== 'intercity') return {};

  const errors: Partial<Record<'corridor_landmark' | 'receiver_phone', string>> = {};
  if (!corridorLandmark.trim()) {
    errors.corridor_landmark = 'Corridor landmark is required.';
  }
  if (!receiverPhone.trim()) {
    errors.receiver_phone = 'Receiver phone is required.';
  }
  return errors;
}

/** Builds a domain `ScheduledWindow` from datetime-local strings. */
export function buildScheduledWindowFromLocal(
  start: string,
  end: string,
): ScheduledWindow {
  return {
    start: parseDatetimeLocalToIso(start)!,
    end: parseDatetimeLocalToIso(end)!,
  };
}

/** YYYY-MM-DD for `Job.travel_date` from a datetime-local value. */
export function toTravelDateFromLocal(local: string): string {
  return parseDatetimeLocalToIso(local)!.slice(0, 10);
}

/**
 * Aggregates post-request field checks for the Post Request UI.
 * Does not mutate the draft; returns per-field errors when invalid.
 */
export function validatePostRequestDraft(
  draft: PostRequestDraft,
): PostRequestValidationResult {
  const errors: Partial<Record<PostRequestField, string>> = {};

  if (draft.sender_id && draft.existing_jobs) {
    const activeJobError = getSenderActiveJobError(draft.existing_jobs, draft.sender_id);
    if (activeJobError) {
      errors.sender_active = activeJobError;
    }
  }

  const timingError = validatePostRequestTiming(
    draft.job_type,
    draft.scheduled_window_start ?? '',
    draft.scheduled_window_end ?? '',
    draft.travel_datetime ?? '',
  );
  if (timingError) {
    errors.scheduling = timingError;
  }

  const mode2Errors = validatePostRequestMode2(
    draft.job_type,
    draft.corridor_landmark ?? '',
    draft.receiver_phone ?? '',
  );
  if (mode2Errors.corridor_landmark) {
    errors.corridor_landmark = mode2Errors.corridor_landmark;
  }
  if (mode2Errors.receiver_phone) {
    errors.receiver_phone = mode2Errors.receiver_phone;
  }

  if (!draft.pickup_location.trim()) {
    errors.pickup_location = 'Pickup location is required';
  }

  if (!draft.drop_location.trim()) {
    errors.drop_location = 'Drop location is required';
  }

  if (
    !validateLocationTypes(draft.pickup_location_type, draft.drop_location_type)
  ) {
    errors.pickup_location_type = LOCATION_TYPE_CONFLICT_MESSAGE;
    errors.drop_location_type = LOCATION_TYPE_CONFLICT_MESSAGE;
  }

  const declaredValueError = getDeclaredValueError(
    draft.declared_value ?? null,
  );
  if (declaredValueError) {
    errors.declared_value = declaredValueError;
  }

  if (!Number.isFinite(draft.price_floor) || draft.price_floor < 0) {
    errors.price_floor = 'Price floor is invalid.';
  }

  if (
    Number.isFinite(draft.price_floor) &&
    !validatePostedPrice(draft.price_floor, draft.posted_price)
  ) {
    errors.posted_price = `Posted price must be at or above the system floor (₹${draft.price_floor}).`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
