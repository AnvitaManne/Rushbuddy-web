import type { JobStatus, JobType, LocationType } from './enums';
import { DECLARED_VALUE_MAX_INR } from './constants';
import { validatePostedPrice } from './jobHelpers';
import { isJobPostingValid } from './runnerEligibility';
import type { ItemType, Job, RiskLevel, WeightTier } from './types';
import type { ScheduledWindow } from './types';

/** Sender jobs that block posting a new request (pre-completion in-flight). */
export const SENDER_ACTIVE_JOB_STATUSES: readonly JobStatus[] = [
  'OPEN',
  'MATCHED',
  'IN_TRANSIT',
  'ISSUE_REPORTED',
];

export type PostRequestDraft = {
  job_type: JobType;
  item_type: ItemType;
  weight: WeightTier;
  risk: RiskLevel;
  pickup_location: string;
  drop_location: string;
  pickup_location_type: LocationType;
  drop_location_type: LocationType;
  price_floor: number;
  posted_price: number;
  declared_value: number;
  carry_only_ack: boolean;
  food_ready_ack: boolean;
  scheduled_window?: ScheduledWindow;
  travel_date?: string;
  corridor_landmark?: string;
  receiver_phone?: string;
};

export function getSenderActiveJob(jobs: Job[], senderId: string): Job | undefined {
  return jobs.find(
    j => j.sender_id === senderId && SENDER_ACTIVE_JOB_STATUSES.includes(j.status),
  );
}

export function getSenderActiveJobError(jobs: Job[], senderId: string): string | null {
  const active = getSenderActiveJob(jobs, senderId);
  if (!active) return null;
  return `You already have an active request (${active.id}). Cancel it before posting a new one.`;
}

export function canSenderCancelJob(job: Job, senderId: string): boolean {
  return job.sender_id === senderId && job.status === 'OPEN';
}

export function getLocationTypeConflictError(
  pickup: LocationType,
  drop: LocationType,
): string | null {
  if (!isJobPostingValid({ pickup_location_type: pickup, drop_location_type: drop })) {
    return "Cannot combine men's and women's hostel on the same job.";
  }
  return null;
}

export function getDeclaredValueError(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return 'Declared value is required.';
  }
  if (value > DECLARED_VALUE_MAX_INR) {
    return `Declared value cannot exceed ₹${DECLARED_VALUE_MAX_INR.toLocaleString('en-IN')}.`;
  }
  return null;
}

export function parseDatetimeLocalToIso(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function buildScheduledWindowFromLocal(
  startLocal: string,
  endLocal: string,
): ScheduledWindow | null {
  const start = parseDatetimeLocalToIso(startLocal);
  const end = parseDatetimeLocalToIso(endLocal);
  if (!start || !end) return null;
  if (new Date(end).getTime() <= new Date(start).getTime()) return null;
  return { start, end };
}

export function toTravelDateFromLocal(travelLocal: string): string | null {
  const iso = parseDatetimeLocalToIso(travelLocal);
  if (!iso) return null;
  return iso.slice(0, 10);
}

export function validatePostRequestTiming(
  jobType: JobType,
  scheduledWindow?: ScheduledWindow,
  travelDate?: string,
): string | null {
  const now = Date.now();
  switch (jobType) {
    case 'campus_immediate':
      return null;
    case 'campus_scheduled': {
      if (!scheduledWindow?.start || !scheduledWindow?.end) {
        return 'Pick a scheduled window start and end.';
      }
      if (new Date(scheduledWindow.end).getTime() <= now) {
        return 'Scheduled window end must be in the future.';
      }
      return null;
    }
    case 'intercity': {
      if (!travelDate) return 'Pick a travel date and time.';
      const travelMs = new Date(`${travelDate}T00:00:00.000Z`).getTime();
      if (Number.isNaN(travelMs)) return 'Invalid travel date.';
      return null;
    }
    default:
      return null;
  }
}

export function validatePostRequestMode2(draft: PostRequestDraft): string | null {
  if (draft.job_type !== 'intercity') return null;
  if (!draft.corridor_landmark?.trim()) {
    return 'Corridor landmark is required for intercity jobs.';
  }
  if (!draft.receiver_phone?.trim()) {
    return 'Receiver phone is required for intercity jobs.';
  }
  return null;
}

export function validatePostRequestDraft(draft: PostRequestDraft): string | null {
  if (!draft.carry_only_ack) {
    return 'You must confirm carry-only delivery.';
  }
  if (draft.item_type === 'Food' && !draft.food_ready_ack) {
    return 'Confirm food is already ordered and ready for pickup.';
  }
  const locationErr = getLocationTypeConflictError(
    draft.pickup_location_type,
    draft.drop_location_type,
  );
  if (locationErr) return locationErr;
  if (!draft.pickup_location.trim()) return 'Pickup location is required.';
  if (!draft.drop_location.trim()) return 'Drop location is required.';
  if (!validatePostedPrice(draft.price_floor, draft.posted_price)) {
    return `Posted price must be at least ₹${draft.price_floor} (system floor).`;
  }
  const declaredErr = getDeclaredValueError(draft.declared_value);
  if (declaredErr) return declaredErr;
  const timingErr = validatePostRequestTiming(
    draft.job_type,
    draft.scheduled_window,
    draft.travel_date,
  );
  if (timingErr) return timingErr;
  return validatePostRequestMode2(draft);
}
