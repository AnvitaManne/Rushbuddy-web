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
} from './supabaseOrganizationService';
