import { DECLARED_VALUE_MAX_INR } from './constants';
import type { LocationType } from './enums';
import { validatePostedPrice } from './jobHelpers';

/** Fields validated by `validatePostRequestDraft`. */
export type PostRequestField =
  | 'pickup_location'
  | 'drop_location'
  | 'pickup_location_type'
  | 'drop_location_type'
  | 'declared_value'
  | 'posted_price'
  | 'price_floor';

/** Minimum input required to validate a post-request form before job creation. */
export interface PostRequestDraft {
  pickup_location: string;
  drop_location: string;
  pickup_location_type: LocationType;
  drop_location_type: LocationType;
  price_floor: number;
  posted_price: number;
  declared_value?: number;
}

export interface PostRequestValidationResult {
  valid: boolean;
  errors: Partial<Record<PostRequestField, string>>;
}

/**
 * True when declared value is a positive amount within the V1 cap (≤ ₹2,000).
 */
export function validateDeclaredValue(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= DECLARED_VALUE_MAX_INR;
}

/**
 * Rejects postings where pickup and drop require different runner genders
 * (men's hostel on one end and women's hostel on the other).
 */
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

/**
 * Aggregates post-request field checks for the Post Request UI.
 * Does not mutate the draft; returns per-field errors when invalid.
 */
export function validatePostRequestDraft(
  draft: PostRequestDraft,
): PostRequestValidationResult {
  const errors: Partial<Record<PostRequestField, string>> = {};

  if (!draft.pickup_location.trim()) {
    errors.pickup_location = 'Pickup location is required';
  }

  if (!draft.drop_location.trim()) {
    errors.drop_location = 'Drop location is required';
  }

  if (
    !validateLocationTypes(draft.pickup_location_type, draft.drop_location_type)
  ) {
    errors.pickup_location_type =
      "Pickup and drop cannot mix men's and women's hostel on the same job.";
    errors.drop_location_type =
      "Pickup and drop cannot mix men's and women's hostel on the same job.";
  }

  if (draft.declared_value !== undefined && !validateDeclaredValue(draft.declared_value)) {
    errors.declared_value = `Declared value must be between ₹1 and ₹${DECLARED_VALUE_MAX_INR.toLocaleString('en-IN')}.`;
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

/*
 * --- Examples (no test runner) ---
 *
 * validateDeclaredValue(500)    // true
 * validateDeclaredValue(2000)   // true
 * validateDeclaredValue(2001)   // false
 * validateDeclaredValue(0)      // false
 *
 * validateLocationTypes('general', 'general')           // true
 * validateLocationTypes('womens_hostel', 'womens_hostel') // true
 * validateLocationTypes('mens_hostel', 'womens_hostel') // false
 *
 * validatePostRequestDraft({
 *   pickup_location: 'MBA Gate',
 *   drop_location: 'MH-B Room 214',
 *   pickup_location_type: 'general',
 *   drop_location_type: 'general',
 *   price_floor: 25,
 *   posted_price: 30,
 * }) // { valid: true, errors: {} }
 */
