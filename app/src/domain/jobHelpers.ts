import type { HandoffMode, ItemType, JobType, RiskLevel, WeightTier } from './enums';
import type { ScheduledWindow } from './types';

/** Item-type base fee (INR), aligned with PostRequestPage mock pricing. */
const BASE_PRICES: Record<ItemType, number> = {
  Document: 25,
  Food: 30,
  Medicine: 35,
  Object: 40,
};

const WEIGHT_MULT: Record<WeightTier, number> = {
  Light: 1,
  Medium: 1.5,
  Heavy: 2.5,
};

const RISK_MULT: Record<RiskLevel, number> = {
  Low: 1,
  Fragile: 1.3,
  Valuable: 1.8,
};

/**
 * Flat corridor surcharge (INR) added to the campus floor for intercity jobs.
 * Tune when corridor pricing is finalized in ops.
 */
const INTERCITY_CORRIDOR_SURCHARGE_INR = 75;

const CAMPUS_IMMEDIATE_TTL_MS = 30 * 60 * 1000;
const INTERCITY_EXPIRY_LEAD_MS = 2 * 60 * 60 * 1000;

/** Uniform random int in [min, max] (inclusive). */
function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const maxUint = 0xffffffff;
    const limit = maxUint - (maxUint % range);
    const buf = new Uint32Array(1);
    let value = maxUint;
    while (value >= limit) {
      crypto.getRandomValues(buf);
      value = buf[0]!;
    }
    return min + (value % range);
  }
  return min + Math.floor(Math.random() * range);
}

/**
 * Returns a 4-digit confirmation code string (0000–9999).
 * Leading zeros are preserved (e.g. `"0042"`).
 */
export function generateConfirmationCode(): string {
  return String(randomInt(0, 9999)).padStart(4, '0');
}

/**
 * System price floor (INR).
 *
 * Formula (campus): `round(base[item] × weight_mult[weight] × risk_mult[risk])`
 * Formula (intercity): campus floor + `INTERCITY_CORRIDOR_SURCHARGE_INR`
 *
 * Mirrors PostRequestPage: `BASE_PRICES × WEIGHT_MULT × RISK_MULT`, rounded.
 */
export function computePriceFloor(
  itemType: ItemType,
  weight: WeightTier,
  risk: RiskLevel,
  jobType?: JobType,
): number {
  const campusFloor = Math.round(
    BASE_PRICES[itemType] * WEIGHT_MULT[weight] * RISK_MULT[risk],
  );
  if (jobType === 'intercity') {
    return campusFloor + INTERCITY_CORRIDOR_SURCHARGE_INR;
  }
  return campusFloor;
}

/** True when the sender's posted offer meets or exceeds the system floor. */
export function validatePostedPrice(floor: number, posted: number): boolean {
  return posted >= floor;
}

function parseIsoDate(iso: string, label: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}: "${iso}" is not a valid ISO date/time.`);
  }
  return date;
}

/**
 * Interprets `YYYY-MM-DD` as UTC midnight on that calendar day.
 * Assumption (documented): intercity travel has no separate time field in V1;
 * expiry is computed from 00:00:00.000Z on `travel_date` minus 2 hours.
 */
function parseTravelDate(travelDate: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) {
    return new Date(`${travelDate}T00:00:00.000Z`);
  }
  return parseIsoDate(travelDate, 'travel_date');
}

/**
 * Computes `expires_at` as an ISO 8601 UTC string.
 *
 * - `campus_immediate`: `createdAt` + 30 minutes
 * - `campus_scheduled`: `scheduled_window.end` (must be provided)
 * - `intercity`: 2 hours before `travel_date` (UTC midnight if date-only)
 */
export function computeExpiresAt(
  jobType: JobType,
  createdAt: string,
  scheduledWindow?: ScheduledWindow,
  travelDate?: string,
): string {
  switch (jobType) {
    case 'campus_immediate': {
      const created = parseIsoDate(createdAt, 'createdAt');
      return new Date(created.getTime() + CAMPUS_IMMEDIATE_TTL_MS).toISOString();
    }
    case 'campus_scheduled': {
      if (!scheduledWindow?.end) {
        throw new Error(
          'campus_scheduled jobs require scheduled_window.end to compute expires_at.',
        );
      }
      return parseIsoDate(scheduledWindow.end, 'scheduled_window.end').toISOString();
    }
    case 'intercity': {
      if (!travelDate) {
        throw new Error('intercity jobs require travel_date to compute expires_at.');
      }
      const travel = parseTravelDate(travelDate);
      return new Date(travel.getTime() - INTERCITY_EXPIRY_LEAD_MS).toISOString();
    }
    default: {
      const _exhaustive: never = jobType;
      return _exhaustive;
    }
  }
}

/** Maps job type to immutable handoff mode (V1). */
export function resolveHandoffMode(jobType: JobType): HandoffMode {
  switch (jobType) {
    case 'campus_immediate':
    case 'campus_scheduled':
      return 'mode_1_direct_p2p';
    case 'intercity':
      return 'mode_2_landmark';
    default: {
      const _exhaustive: never = jobType;
      return _exhaustive;
    }
  }
}

/*
 * --- Examples (no test runner) ---
 *
 * generateConfirmationCode()  // e.g. "3847", "0042"
 *
 * computePriceFloor('Document', 'Light', 'Low')                    // 25
 * computePriceFloor('Object', 'Medium', 'Fragile')                 // 78  (40×1.5×1.3)
 * computePriceFloor('Medicine', 'Light', 'Low', 'intercity')       // 110 (35 + 75)
 *
 * validatePostedPrice(25, 30)   // true
 * validatePostedPrice(25, 20)   // false
 *
 * computeExpiresAt('campus_immediate', '2026-05-16T10:00:00.000Z')
 *   // '2026-05-16T10:30:00.000Z'
 *
 * computeExpiresAt('campus_scheduled', '2026-05-16T08:00:00.000Z', {
 *   start: '2026-05-16T14:00:00.000Z',
 *   end: '2026-05-16T16:00:00.000Z',
 * })
 *   // '2026-05-16T16:00:00.000Z'
 *
 * computeExpiresAt('intercity', '2026-05-10T00:00:00.000Z', undefined, '2026-05-20')
 *   // '2026-05-19T22:00:00.000Z'  (00:00 UTC on travel date minus 2h)
 *
 * resolveHandoffMode('campus_immediate')  // 'mode_1_direct_p2p'
 * resolveHandoffMode('intercity')         // 'mode_2_landmark'
 */
