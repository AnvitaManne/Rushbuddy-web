import type { LocationType, UserGender } from './enums';
import { validateLocationTypes } from './postingValidation';
import type { Job, User } from './types';

/** Minimum fields required to validate a job before posting. */
export type JobPostingDraft = Pick<Job, 'pickup_location_type' | 'drop_location_type'>;

function isGenderedHostel(type: LocationType): boolean {
  return type === 'mens_hostel' || type === 'womens_hostel';
}

/**
 * Rejects postings where pickup and drop require different runner genders
 * (e.g. men's hostel pickup + women's hostel drop).
 */
export function isJobPostingValid(jobDraft: JobPostingDraft): boolean {
  const { pickup_location_type, drop_location_type } = jobDraft;
  return validateLocationTypes(pickup_location_type, drop_location_type);
}

/**
 * Required runner gender when either endpoint is a gendered hostel.
 * Returns `null` when no gender filter applies (general-only or same-gender hostels).
 */
function requiredRunnerGender(
  jobDraft: JobPostingDraft,
): UserGender | null | 'invalid' {
  if (!isJobPostingValid(jobDraft)) return 'invalid';

  const { pickup_location_type, drop_location_type } = jobDraft;
  const requiresFemale =
    pickup_location_type === 'womens_hostel' || drop_location_type === 'womens_hostel';
  const requiresMale =
    pickup_location_type === 'mens_hostel' || drop_location_type === 'mens_hostel';

  if (requiresFemale) return 'female';
  if (requiresMale) return 'male';
  return null;
}

/**
 * Whether a runner may see a job in the feed (accept eligibility is separate).
 *
 * - `suspension_status === 'suspended'` → never visible
 * - Conflicting mens/womens endpoints → never visible (invalid posting)
 * - `prefer_not_to_say` → hidden when either endpoint is a gendered hostel
 * - Women's hostel on pickup or drop → only `female` runners
 * - Men's hostel on pickup or drop → only `male` runners
 * - `general` on both ends → all active runners (subject to gender rules above)
 */
export function canRunnerSeeJob(runner: User, job: Job): boolean {
  if (runner.suspension_status === 'suspended') {
    return false;
  }

  const required = requiredRunnerGender(job);
  if (required === 'invalid') {
    return false;
  }

  const genderedJob =
    isGenderedHostel(job.pickup_location_type) || isGenderedHostel(job.drop_location_type);

  if (runner.gender === 'prefer_not_to_say') {
    return !genderedJob;
  }

  if (required === null) {
    return true;
  }

  return runner.gender === required;
}

/*
 * --- Examples (no test runner) ---
 *
 * isJobPostingValid({ pickup: general, drop: general })           // true
 * isJobPostingValid({ pickup: womens_hostel, drop: womens_hostel }) // true
 * isJobPostingValid({ pickup: mens_hostel, drop: womens_hostel })  // false
 *
 * canRunnerSeeJob(femaleRunner, womensHostelJob)   // true
 * canRunnerSeeJob(maleRunner, womensHostelJob)       // false
 * canRunnerSeeJob(maleRunner, generalJob)            // true
 * canRunnerSeeJob(preferNotSayRunner, generalJob)    // true
 * canRunnerSeeJob(preferNotSayRunner, mensHostelJob) // false
 * canRunnerSeeJob(suspendedRunner, anyJob)           // false
 */
