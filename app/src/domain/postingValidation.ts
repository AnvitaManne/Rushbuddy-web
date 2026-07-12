import type { JobType } from './enums';
import { DECLARED_VALUE_MAX_INR } from './constants';
import { validatePostedPrice } from './jobHelpers';
import { isJobPostingValid, type JobPostingDraft } from './runnerEligibility';
import type { ScheduledWindow } from './types';

/** True when a declared value is unset, or set and within `DECLARED_VALUE_MAX_INR`. */
export function validateDeclaredValue(declaredValue: number | undefined): boolean {
  if (declaredValue === undefined) return true;
  return declaredValue >= 0 && declaredValue <= DECLARED_VALUE_MAX_INR;
}

/** Minimum fields required to fully validate a Post Request draft before submit. */
export interface PostRequestDraft extends JobPostingDraft {
  job_type: JobType;
  item_type: string;
  price_floor: number;
  posted_price: number;
  declared_value?: number;
  scheduled_window?: ScheduledWindow;
  travel_date?: string;
  corridor_landmark?: string;
  receiver_phone?: string;
  food_ready_ack?: boolean;
}

/**
 * Validates a full Post Request draft, returning a list of human-readable errors
 * (empty when the draft is postable). Combines the locked posting rules:
 * gendered-hostel conflicts, price floor, declared value cap, conditional
 * job-type fields, and the Food "ready to carry" acknowledgement.
 */
export function validatePostRequestDraft(draft: PostRequestDraft): string[] {
  const errors: string[] = [];

  if (!isJobPostingValid(draft)) {
    errors.push('Pickup and drop cannot mix men\u2019s and women\u2019s hostel locations.');
  }
  if (!validatePostedPrice(draft.price_floor, draft.posted_price)) {
    errors.push(`Offer price must be at least \u20B9${draft.price_floor} (system floor).`);
  }
  if (!validateDeclaredValue(draft.declared_value)) {
    errors.push(`Declared value must be \u20B9${DECLARED_VALUE_MAX_INR} or less.`);
  }

  if (draft.job_type === 'campus_scheduled') {
    const { start, end } = draft.scheduled_window ?? {};
    if (!start || !end) {
      errors.push('Pick a start and end time for the scheduled window.');
    } else if (new Date(end).getTime() <= new Date(start).getTime()) {
      errors.push('Scheduled window end must be after the start.');
    }
  }

  if (draft.job_type === 'intercity') {
    if (!draft.travel_date) errors.push('Travel date is required for intercity jobs.');
    if (!draft.corridor_landmark?.trim()) errors.push('Corridor landmark is required for intercity jobs.');
    if (!draft.receiver_phone?.trim()) errors.push('Receiver phone is required for intercity jobs.');
  }

  if (draft.item_type === 'Food' && !draft.food_ready_ack) {
    errors.push('Confirm the food is already ordered and ready for carry-only pickup.');
  }

  return errors;
}

/*
 * --- Examples (no test runner) ---
 *
 * validateDeclaredValue(2000)   // true
 * validateDeclaredValue(2001)   // false
 * validatePostRequestDraft({ job_type: 'intercity', ..., corridor_landmark: '', receiver_phone: '' })
 *   // ['Corridor landmark is required...', 'Receiver phone is required...']
 */
