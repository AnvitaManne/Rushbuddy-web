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
 *   declared_value: 500,
 * }) // { valid: true, errors: {} }
 */
