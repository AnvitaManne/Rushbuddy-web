/**
 * Data access service interfaces (Phase 10).
 * Implementations live under `services/mock/` (later: `services/supabase/`).
 * No backend I/O here — contracts only.
 */

import type {
  Job,
  RunnerTrustRecord,
  TrustEvent,
  User,
  FIRExport,
} from '@/domain/types';
import type {
  PaymentMethod,
  PaymentStatus,
  SuspensionStatus,
  UserGender,
} from '@/domain/enums';
import type { DisputeResolutionOutcome } from '@/domain/trustOps';

// ---------------------------------------------------------------------------
// Supporting DTOs (colocated until domain types catch up — Phase 9 checklist)
// ---------------------------------------------------------------------------

/** Signup fields collected on Auth, applied at Verify. Gender is matching-only. */
export interface AuthSignupInput {
  email: string;
  name: string;
  hostel_block: string;
  gender: UserGender;
  /** Email OTP — required by Supabase `completeSignup`; unused by mock stub. */
  otp?: string;
}

/** Payment intent recorded at rating time (still embedded on `Job` in the mock). */
export interface JobPaymentRecord {
  job_id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  tip_amount: number;
  rating?: number;
  paid_at?: string;
}

/** Campus / community tenant (maps to schema `organizations`). */
export interface Organization {
  id: string;
  slug: string;
  display_name: string;
  email_domains: string[];
  status: 'active' | 'paused';
  settings?: Record<string, unknown>;
}

/** User ↔ org membership (maps to schema `organization_members`). */
export interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: 'member' | 'ops' | 'admin';
  status: 'active' | 'removed';
}

// ---------------------------------------------------------------------------
// Service interfaces
// ---------------------------------------------------------------------------

/** Session / identity. Real Auth is a later phase; mock will wrap current session. */
export interface AuthService {
  getCurrentUser(): Promise<User | null>;
  isAuthenticated(): Promise<boolean>;
  /** Persist pending signup fields prior to verify (no real OTP yet). */
  beginSignup(input: AuthSignupInput): Promise<void>;
  /** Apply verified signup onto the session user (mock: same as today’s Verify). */
  completeSignup(input: AuthSignupInput): Promise<User>;
  signOut(): Promise<void>;
}

/** No-answer resolution payloads for `JobService.reportNoAnswer`. */
export type ReportNoAnswerInput =
  | { kind: 'contact_attempt' }
  | { kind: 'secure_drop'; location?: string }
  | { kind: 'hold_for_ops' };

/** Job lifecycle persistence (today: `jobs` array in AppContext). */
export interface JobService {
  listJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | null>;
  createJob(job: Job): Promise<Job>;
  updateJob(id: string, patch: Partial<Job>): Promise<Job | null>;
  /** Atomic accept when a real backend exists; mock updates MATCHED fields. */
  acceptJob(jobId: string, runner: Pick<User, 'id' | 'name' | 'rating' | 'hostel_block'>): Promise<Job | null>;
  removeJob(id: string): Promise<boolean>;

  // --- Lifecycle (Phase 14): persisted transitions + server-side handoff verify ---
  /** MATCHED → IN_TRANSIT. `photo_url` persistence is deferred (Storage phase). */
  acknowledgePickup(jobId: string, options?: { photo_url?: string }): Promise<Job | null>;
  /** IN_TRANSIT → PENDING_RATING. Returns null when the code is wrong. */
  completeHandoff(jobId: string, confirmationCode: string): Promise<Job | null>;
  /** No-answer protocol: contact attempt / secure drop (Low) / hold for ops (Fragile/Valuable). */
  reportNoAnswer(jobId: string, input: ReportNoAnswerInput): Promise<Job | null>;
  /** Generic runner issue → ISSUE_REPORTED. */
  reportIssue(jobId: string): Promise<Job | null>;
  /** Sender closes a finished/held job → CLOSED. */
  closeJob(jobId: string): Promise<Job | null>;

  // --- Disputes (Phase 15): persisted so they sync across accounts ---
  /** Sender files a dispute → PENDING_RATING → DISPUTED (theft-like also suspends runner). */
  fileDispute(jobId: string, input: { dispute_type: string; description: string }): Promise<Job | null>;
  /** Sender/ops resolves a dispute → CLOSED with payout + optional unsuspend. */
  resolveDispute(
    jobId: string,
    input: { outcome: DisputeResolutionOutcome; unsuspend?: boolean },
  ): Promise<Job | null>;
}

/** Off-platform payment intent + tip/rating at close (today: fields on `Job`). */
export interface PaymentService {
  getPaymentForJob(jobId: string): Promise<JobPaymentRecord | null>;
  recordPayment(
    jobId: string,
    input: {
      method: PaymentMethod;
      tip_amount: number;
      rating?: number;
    },
  ): Promise<JobPaymentRecord | null>;
}

/** Trust/safety events and per-runner aggregates. */
export interface TrustService {
  appendEvent(event: TrustEvent): Promise<void>;
  getEventsForRunner(runnerId: string): Promise<TrustEvent[]>;
  getRunnerRecord(runnerId: string): Promise<RunnerTrustRecord>;
  updateRunnerRecord(
    runnerId: string,
    updater: (prev: RunnerTrustRecord) => RunnerTrustRecord,
  ): Promise<RunnerTrustRecord>;
  setSuspension(
    runnerId: string,
    status: SuspensionStatus,
    reason?: string,
  ): Promise<RunnerTrustRecord>;
}

/** Org tenancy + email-domain allowlist (VIT = one seeded org later). */
export interface OrganizationService {
  getById(id: string): Promise<Organization | null>;
  getBySlug(slug: string): Promise<Organization | null>;
  listOrganizations(): Promise<Organization[]>;
  getMembership(userId: string): Promise<OrganizationMember | null>;
  /** True when email’s domain is in the org’s `email_domains`. */
  isEmailAllowed(organizationId: string, email: string): Promise<boolean>;
}

/** Photo kinds that map to public.photo_kind (Phase 16). */
export type JobPhotoKind = 'pickup' | 'dropoff_secure' | 'other';

/** Job evidence photos (Supabase Storage + public.photos). */
export interface PhotoService {
  /** Upload a blob, register it on the job, return a display URL (signed or mock). */
  uploadJobPhoto(input: {
    jobId: string;
    kind: JobPhotoKind;
    blob: Blob;
    geotag?: Record<string, unknown>;
  }): Promise<{ photo_id: string; url: string; storage_path: string }>;
  /** Best-effort signed URL for a storage path (null when unavailable). */
  getSignedUrl(storagePath: string): Promise<string | null>;
}

/** Persisted FIR support packages (public.fir_exports). */
export interface FirService {
  generate(jobId: string): Promise<FIRExport | null>;
  getLatest(jobId: string): Promise<FIRExport | null>;
}

/** Composition root shape for `getServices()` (Slice 10.4). */
export interface AppServices {
  auth: AuthService;
  jobs: JobService;
  payments: PaymentService;
  trust: TrustService;
  organizations: OrganizationService;
  photos: PhotoService;
  fir: FirService;
}
