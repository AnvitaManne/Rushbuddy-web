/**
 * Supabase auth + org adapters (Phase 12 / Slice 12.4).
 * Jobs / payments / trust stay on mocks until a later phase.
 */

export { emailDomainAllowed, extractEmailDomain } from './orgDomain';
export {
  isProfileComplete,
  mapOrganizationMemberRow,
  mapOrganizationRow,
  mapUserRow,
  ORGANIZATION_COLUMNS,
  ORGANIZATION_MEMBER_COLUMNS,
  USER_OWN_COLUMNS,
  USER_PUBLIC_COLUMNS,
} from './mappers';
export { createSupabaseAuthService } from './supabaseAuthService';
export {
  createSupabaseOrganizationService,
  resolveOrganizationIdFromEmail,
  VIT_VELLORE_SEED_ORG_ID,
} from './supabaseOrganizationService';
export { createSupabaseJobService } from './supabaseJobService';
export { createSupabasePaymentService } from './supabasePaymentService';
export { createSupabaseTrustService } from './supabaseTrustService';
export {
  hashConfirmationCode,
  verifyConfirmationCode,
  mapJobRow,
  mapJobToInsert,
  mapJobPatchToDb,
  JOB_COLUMNS,
  JOB_COLUMNS_WITH_CODE,
} from './jobMappers';
