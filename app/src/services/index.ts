/**
 * Service adapter registry (Phase 10).
 * Today: in-memory mocks. Later swap on env (e.g. DATA_ADAPTER === 'supabase').
 */

import type { Job, User } from '@/domain/types';
import { createMockJobService, type MockJobStore } from './mock/mockJobService';
import { createMockPaymentService } from './mock/mockPaymentService';
import { createMockTrustService } from './mock/mockTrustService';
import type {
  AppServices,
  AuthService,
  AuthSignupInput,
  Organization,
  OrganizationService,
} from './types';

export type { AppServices } from './types';
export type * from './types';

/** VIT seed org (schema-v1) — stub until a dedicated mock org module exists. */
const SEED_ORG: Organization = {
  id: 'org-vit-vellore',
  slug: 'vit-vellore',
  display_name: 'VIT Vellore',
  email_domains: ['vitstudent.ac.in'],
  status: 'active',
};

function createJobStore(initial: Job[] = []): MockJobStore {
  let jobs = [...initial];
  return {
    getJobs: () => jobs,
    setJobs: (next) => {
      jobs = next;
    },
  };
}

/** Active job backing store — defaults internal; AppContext binds React state. */
let activeJobStore: MockJobStore = createJobStore();

/**
 * Point job/payment mocks at AppContext `jobs` so accept/create updates the UI.
 * Call once from AppProvider (store may use a ref for `getJobs`).
 */
export function bindMockJobStore(store: MockJobStore): void {
  activeJobStore = store;
}

/** Store facade closed over by mock adapters; always delegates to `activeJobStore`. */
const jobStoreFacade: MockJobStore = {
  getJobs: () => activeJobStore.getJobs(),
  setJobs: (next) => activeJobStore.setJobs(next),
};

/** Placeholder auth — session still lives in AppContext until a later wire. */
function createStubAuthService(): AuthService {
  let pending: AuthSignupInput | null = null;
  let currentUser: User | null = null;

  return {
    async getCurrentUser() {
      return currentUser;
    },
    async isAuthenticated() {
      return currentUser !== null;
    },
    async beginSignup(input) {
      pending = input;
    },
    async completeSignup(input) {
      const source = input ?? pending;
      if (!source) {
        throw new Error('AuthService.completeSignup: no signup input');
      }
      currentUser = {
        id: `mock-${source.email}`,
        email: source.email,
        name: source.name,
        hostel_block: source.hostel_block,
        gender: source.gender,
        verified: true,
        current_role: null,
        rating: 0,
        total_deliveries: 0,
        total_earnings: 0,
        weekly_earnings: 0,
        acceptance_rate: 0,
        trust_score: 100,
        joined_at: new Date().toISOString(),
        no_show_count: 0,
        suspension_status: 'active',
        streak: 0,
        best_week_earnings: 0,
      };
      pending = null;
      return currentUser;
    },
    async signOut() {
      currentUser = null;
      pending = null;
    },
  };
}

/** Placeholder org service seeded with vit-vellore. */
function createStubOrganizationService(
  orgs: Organization[] = [SEED_ORG],
): OrganizationService {
  return {
    async getById(id) {
      return orgs.find((o) => o.id === id) ?? null;
    },
    async getBySlug(slug) {
      return orgs.find((o) => o.slug === slug) ?? null;
    },
    async listOrganizations() {
      return [...orgs];
    },
    async getMembership(_userId) {
      return null;
    },
    async isEmailAllowed(organizationId, email) {
      const org = orgs.find((o) => o.id === organizationId);
      if (!org) return false;
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) return false;
      return org.email_domains.map((d) => d.toLowerCase()).includes(domain);
    },
  };
}

/** Compose in-memory adapters. Jobs + payments share `jobStoreFacade`. */
export function createMockServices(): AppServices {
  return {
    auth: createStubAuthService(),
    jobs: createMockJobService(jobStoreFacade),
    payments: createMockPaymentService(jobStoreFacade),
    trust: createMockTrustService(),
    organizations: createStubOrganizationService(),
  };
}

// Later:
// export const services =
//   import.meta.env.VITE_DATA_ADAPTER === 'supabase'
//     ? createSupabaseServices()
//     : createMockServices();

export const services = createMockServices();
