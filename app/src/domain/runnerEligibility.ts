import type { JobStatus, LocationType, UserGender } from './enums';
import { assertTransition } from './jobTransitions';
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
  const hasMens =
    pickup_location_type === 'mens_hostel' || drop_location_type === 'mens_hostel';
  const hasWomens =
    pickup_location_type === 'womens_hostel' || drop_location_type === 'womens_hostel';
  return !(hasMens && hasWomens);
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

const RUNNER_ACTIVE_DELIVERY_STATUSES: readonly JobStatus[] = ['MATCHED', 'IN_TRANSIT'];

/** Runner's in-progress delivery, if any. */
export function getRunnerActiveDeliveryJob(jobs: Job[], runnerId: string): Job | undefined {
  return jobs.find(
    j =>
      j.runner_id === runnerId &&
      RUNNER_ACTIVE_DELIVERY_STATUSES.includes(j.status),
  );
}

/**
 * Accept-time validation (feed visibility uses `canRunnerSeeJob` only).
 * Returns a user-facing error string, or `null` when the runner may accept.
 */
export function getRunnerAcceptJobError(
  runner: User | null,
  job: Job,
  allJobs?: Job[],
): string | null {
  if (!runner) {
    return 'Log in to accept jobs.';
  }
  if (allJobs) {
    const active = getRunnerActiveDeliveryJob(allJobs, runner.id);
    if (active) {
      return 'Finish your current delivery before accepting another job.';
    }
  }
  if (job.status !== 'OPEN') {
    return 'Job just taken. Check other listings.';
  }
  if (job.runner_id) {
    return 'Job just taken. Check other listings.';
  }
  if (!canRunnerSeeJob(runner, job)) {
    return 'You are not eligible for this job.';
  }
  const transition = assertTransition(job.status, 'MATCHED');
  if (!transition.ok) {
    return transition.error;
  }
  return null;
}

/**
 * Applies OPEN → MATCHED for a runner. Returns unchanged `jobs` and an error when accept fails.
 */
export function matchJobForRunner(
  jobs: Job[],
  jobId: string,
  runner: User,
): { jobs: Job[]; error: string | null } {
  const current = jobs.find(j => j.id === jobId);
  if (!current) {
    return { jobs, error: 'Job not found.' };
  }

  const error = getRunnerAcceptJobError(runner, current, jobs);
  if (error) {
    return { jobs, error };
  }

  const matched_at = new Date().toISOString();
  const next = jobs.map(j =>
    j.id === jobId
      ? {
          ...j,
          status: 'MATCHED' as const,
          runner_id: runner.id,
          runner_name: runner.name,
          runner_rating: runner.rating,
          matched_at,
          agreed_price: j.posted_price,
        }
      : j,
  );

  return { jobs: next, error: null };
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
