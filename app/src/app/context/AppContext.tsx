import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Job, RunnerTrustRecord, TrustEvent, User } from '@/domain/types';
import type { SuspensionStatus, UserGender, UserRole } from '@/domain/enums';
import { createSampleJob, attachDevJobDebug, logJobTransition } from '@/domain/devJobDebug';
import { createPilotScenarioJobs } from '@/domain/demoScenarios';
import { bindMockJobStore, services } from '@/services';
import { supabase } from '@/lib/supabaseClient';

export type { Job, User } from '@/domain/types';
export type { JobStatus, UserRole, UserGender } from '@/domain/enums';

/**
 * Fields that may only exist locally until a photo signed-URL hydrate lands.
 * Payment / dispute / rating now come from the server (Phase 20).
 */
const LOCAL_ONLY_JOB_FIELDS: (keyof Job)[] = [
  'photo_url', 'dropoff_photo_url',
];

/**
 * Merge freshly fetched server jobs with the local copy.
 * Server status/fields win (Phase 14+ persists lifecycle). Local-only photo
 * URLs are re-applied when the server row has not hydrated them yet.
 * Do NOT keep a further-along local status — that made DEV simulate /
 * optimistic UI look PENDING_RATING while the DB was still MATCHED, so
 * file_dispute failed with a confusing “sign in” message.
 */
function mergeServerJobs(local: Job[], server: Job[]): Job[] {
  const localById = new Map(local.map((j) => [j.id, j]));
  const merged = server.map((s) => {
    const l = localById.get(s.id);
    if (!l) return s;
    const next: Job = { ...s };
    for (const f of LOCAL_ONLY_JOB_FIELDS) {
      if (next[f] === undefined && l[f] !== undefined) {
        (next as Record<keyof Job, unknown>)[f] = l[f];
      }
    }
    return next;
  });
  const serverIds = new Set(server.map((s) => s.id));
  for (const l of local) {
    if (!serverIds.has(l.id)) merged.push(l);
  }
  return merged;
}

/** Fields collected on Auth, applied onto `User` at Verify. */
export interface PendingSignup {
  email: string;
  name: string;
  hostel_block: string;
  gender: UserGender;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  activeJob: Job | null;
  setActiveJob: (job: Job | null) => void;
  /** @deprecated kept for backward compat — prefer `pendingSignup`. */
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
  pendingSignup: PendingSignup | null;
  setPendingSignup: (signup: PendingSignup | null) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
  /** False until mock boot or supabase session restore finishes. */
  authReady: boolean;
  trustEvents: TrustEvent[];
  appendTrustEvent: (event: TrustEvent) => void;
  runnerTrustRecords: Record<string, RunnerTrustRecord>;
  updateRunnerTrustRecord: (
    runnerId: string,
    updater: (prev: RunnerTrustRecord) => RunnerTrustRecord,
  ) => void;
  /**
   * Re-pull jobs + own suspension + trust from the backend (supabase mode; no-op on mock).
   * Pass `includeRunnerIds` to keep loading trust for runners no longer on a job
   * (e.g. after Find New Buddy re-pool).
   */
  refreshData: (opts?: { includeRunnerIds?: string[] }) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const isSupabaseAdapter = import.meta.env.VITE_DATA_ADAPTER === 'supabase';

function emptyTrustRecord(runnerId: string): RunnerTrustRecord {
  return { runner_id: runnerId, no_show_count: 0, suspension_status: 'active' };
}

function SessionRestoreGate() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-3"
      style={{ background: '#060A14', fontFamily: 'Inter, sans-serif' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}
      >
        <span className="text-white font-bold text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          RB
        </span>
      </div>
      <div className="w-5 h-5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
      <p className="text-sm" style={{ color: '#64748B' }}>
        Restoring session…
      </p>
    </div>
  );
}

export const mockJobs: Job[] = [
  createSampleJob({
    id: 'JOB-2401',
    sender_id: 'u2',
    sender_name: 'Priya Menon',
    sender_hostel: 'GH-C Block',
    item_type: 'Document',
    weight: 'Light',
    risk: 'Low',
    pickup_location: 'MBA Hall Gate',
    drop_location: 'Tech Tower A-304',
    description: 'Printed assignment, 20 pages. Please handle carefully.',
    posted_price: 30,
    status: 'OPEN',
    created_at: '2026-04-09T09:14:00Z',
    eta: '12 min',
    distance: '0.8 km',
    confirmation_code: '4821',
  }),
  createSampleJob({
    id: 'JOB-2402',
    sender_id: 'u3',
    sender_name: 'Arjun Sharma',
    sender_hostel: 'MH-A Block',
    item_type: 'Medicine',
    weight: 'Light',
    risk: 'Low',
    pickup_location: 'VIT Pharmacy, Main Gate',
    drop_location: 'MH-D Block, Room 512',
    description: 'Prescribed medication. Urgent — fever since morning.',
    posted_price: 40,
    status: 'OPEN',
    created_at: '2026-04-09T09:22:00Z',
    eta: '8 min',
    distance: '0.5 km',
    confirmation_code: '7193',
  }),
  createSampleJob({
    id: 'JOB-2403',
    sender_id: 'u4',
    sender_name: 'Kavitha R',
    sender_hostel: 'GH-A Block',
    item_type: 'Object',
    weight: 'Medium',
    risk: 'Fragile',
    pickup_location: 'SJT Ground Floor',
    drop_location: 'GH-B Block Room 208',
    description: 'Water bottle + charger left in lab. Handle with care.',
    posted_price: 65,
    status: 'OPEN',
    created_at: '2026-04-09T08:58:00Z',
    pickup_location_type: 'general',
    drop_location_type: 'womens_hostel',
    eta: '15 min',
    distance: '1.2 km',
    confirmation_code: '3056',
  }),
  createSampleJob({
    id: 'JOB-2404',
    sender_id: 'u5',
    sender_name: 'Rahul Nair',
    sender_hostel: 'MH-B Block',
    item_type: 'Food',
    weight: 'Medium',
    risk: 'Low',
    pickup_location: 'CALS Canteen',
    drop_location: 'MH-B Block, Room 317',
    description: 'Chicken biryani + lassi. Keep upright please!',
    posted_price: 50,
    status: 'MATCHED',
    agreed_price: 50,
    runner_id: 'u1',
    runner_name: 'You',
    runner_rating: 4.8,
    created_at: '2026-04-09T09:05:00Z',
    matched_at: '2026-04-09T09:08:00Z',
    eta: '5 min',
    distance: '0.6 km',
    confirmation_code: '8842',
  }),
  createSampleJob({
    id: 'JOB-2389',
    sender_id: 'u1',
    sender_name: 'You',
    sender_hostel: 'MH-C Block',
    item_type: 'Document',
    weight: 'Light',
    risk: 'Low',
    pickup_location: 'TT Hall Printer Shop',
    drop_location: 'MH-C Block, Room 412 (yours)',
    description: 'Mid-sem notes printout',
    posted_price: 30,
    status: 'DELIVERED',
    agreed_price: 30,
    runner_id: 'r1',
    runner_name: 'Deepak V',
    runner_rating: 4.9,
    created_at: '2026-04-08T14:30:00Z',
    delivered_at: '2026-04-08T14:52:00Z',
    tip_amount: 10,
    confirmation_code: '1290',
  }),
  createSampleJob({
    id: 'JOB-2376',
    sender_id: 'u6',
    sender_name: 'Sneha Kumar',
    sender_hostel: 'GH-A Block',
    item_type: 'Medicine',
    weight: 'Light',
    risk: 'Low',
    pickup_location: 'VIT Medical Centre',
    drop_location: 'GH-A Block, Room 104',
    description: 'Vitamin tablets from health centre',
    posted_price: 40,
    status: 'CLOSED',
    agreed_price: 40,
    runner_id: 'u1',
    runner_name: 'You',
    created_at: '2026-04-07T11:10:00Z',
    delivered_at: '2026-04-07T11:34:00Z',
    tip_amount: 20,
    rating: 5,
    confirmation_code: '5567',
  }),
  createSampleJob({
    id: 'JOB-2361',
    sender_id: 'u7',
    sender_name: 'Mohammed A',
    sender_hostel: 'MH-D Block',
    item_type: 'Object',
    weight: 'Light',
    risk: 'Low',
    pickup_location: 'Admin Block',
    drop_location: 'MH-D Block, Room 222',
    description: 'ID card from admin',
    posted_price: 45,
    status: 'CLOSED',
    agreed_price: 45,
    runner_id: 'u1',
    runner_name: 'You',
    created_at: '2026-04-06T16:00:00Z',
    delivered_at: '2026-04-06T16:20:00Z',
    tip_amount: 0,
    rating: 4,
    confirmation_code: '9034',
  }),
];

const defaultUser: User = {
  id: 'u1',
  email: 'aditi.k@vitstudent.ac.in',
  name: 'Aditi Krishnan',
  hostel_block: 'MH-C Block',
  verified: true,
  current_role: null,
  rating: 4.8,
  total_deliveries: 23,
  total_earnings: 1840,
  weekly_earnings: 320,
  acceptance_rate: 91,
  trust_score: 94,
  joined_at: '2026-03-01T00:00:00Z',
  gender: 'female',
  no_show_count: 0,
  suspension_status: 'active',
  streak: 4,
  best_week_earnings: 450,
};

/**
 * Example runner for eligibility testing (prefer_not_to_say cannot see gendered hostel jobs).
 *
 * const mockUserPreferNotToSay: User = {
 *   ...defaultUser,
 *   id: 'u-pns',
 *   email: 'runner.pns@vitstudent.ac.in',
 *   name: 'Sam Runner',
 *   gender: 'prefer_not_to_say',
 * };
 */

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(null);
  // Supabase mode hydrates real jobs after login; mock mode seeds demo jobs.
  const [jobs, setJobs] = useState<Job[]>(isSupabaseAdapter ? [] : mockJobs);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(!isSupabaseAdapter);
  const [trustEvents, setTrustEvents] = useState<TrustEvent[]>([]);
  const [runnerTrustRecords, setRunnerTrustRecords] = useState<Record<string, RunnerTrustRecord>>({
    u1: emptyTrustRecord('u1'),
  });

  // Keep mock JobService / PaymentService pointed at live React job state.
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  useEffect(() => {
    bindMockJobStore({
      getJobs: () => jobsRef.current,
      setJobs: (next) => setJobs(next),
    });
  }, []);

  // Slice 12.7 — restore Supabase session; mock boots immediately (authReady already true).
  useEffect(() => {
    if (!isSupabaseAdapter || !supabase) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const current = await services.auth.getCurrentUser();
        if (cancelled) return;
        if (current) {
          setUser(current);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.warn('[RushBuddy] session restore failed', err);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAuthenticated(false);
        setPendingSignup(null);
        setPendingEmail('');
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Slice 13.6 / 14.4 / 15.4 — pull jobs (+ own suspension + trust) from the backend
  // and keep them fresh across accounts via focus + light polling. We refetch through
  // `listJobs` (privacy-safe: other users' confirmation codes are never returned)
  // instead of a Realtime subscription, which would broadcast full rows (codes).
  const refreshData = useCallback(async (opts?: { includeRunnerIds?: string[] }) => {
    if (!isSupabaseAdapter || !user?.id) return;
    try {
      const list = await services.jobs.listJobs();
      setJobs((prev) => mergeServerJobs(prev, list));

      // Refresh the signed-in user's suspension so the runner feed gate stays current.
      try {
        const me = await services.auth.getCurrentUser();
        if (me) {
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  suspension_status: me.suspension_status,
                  no_show_count: me.no_show_count,
                  trust_score: me.trust_score,
                  rating: me.rating,
                }
              : prev,
          );
        }
      } catch (err) {
        console.warn('[RushBuddy] user refresh failed', err);
      }

      // Load trust for runners still on jobs, plus any explicitly requested ids
      // (e.g. former runner after Find New Buddy).
      const runnerIds = Array.from(
        new Set([
          ...list.map((j) => j.runner_id).filter((id): id is string => !!id),
          ...(opts?.includeRunnerIds ?? []),
        ]),
      );
      if (runnerIds.length) {
        const eventLists = await Promise.all(
          runnerIds.map((id) => services.trust.getEventsForRunner(id).catch(() => [])),
        );
        setTrustEvents(eventLists.flat());
        const records = await Promise.all(
          runnerIds.map((id) =>
            services.trust.getRunnerRecord(id).catch(() => emptyTrustRecord(id)),
          ),
        );
        setRunnerTrustRecords((prev) => {
          const next = { ...prev };
          records.forEach((rec) => {
            next[rec.runner_id] = rec;
          });
          return next;
        });
      }
    } catch (err) {
      console.warn('[RushBuddy] job refresh failed', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isSupabaseAdapter) return;
    if (!user?.id) {
      setJobs([]);
      return;
    }

    void refreshData();

    const onFocus = () => void refreshData();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshData();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => void refreshData(), 20_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [user?.id, refreshData]);

  const appendTrustEvent = (event: TrustEvent) => {
    setTrustEvents(prev => [event, ...prev]);
  };

  const updateRunnerTrustRecord = (
    runnerId: string,
    updater: (prev: RunnerTrustRecord) => RunnerTrustRecord,
  ) => {
    setRunnerTrustRecords(prev => {
      const current = prev[runnerId] ?? emptyTrustRecord(runnerId);
      const next = updater(current);
      setUser(prevUser =>
        prevUser && prevUser.id === runnerId
          ? { ...prevUser, suspension_status: next.suspension_status }
          : prevUser,
      );
      return { ...prev, [runnerId]: next };
    });
  };

  const setRunnerSuspension = (
    runnerId: string,
    status: SuspensionStatus,
    reason?: string,
  ) => {
    updateRunnerTrustRecord(runnerId, prev => ({
      ...prev,
      suspension_status: status,
      suspended_at: status === 'suspended' ? new Date().toISOString() : undefined,
      suspension_reason: status === 'suspended' ? reason : undefined,
    }));
    // Persist lifts in supabase so the next poll / accept_job sees active.
    if (isSupabaseAdapter && status === 'active') {
      void services.trust.setSuspension(runnerId, 'active').then(() => {
        setUser(prevUser =>
          prevUser && prevUser.id === runnerId
            ? {
                ...prevUser,
                suspension_status: 'active',
                no_show_count: 0,
              }
            : prevUser,
        );
      }).catch((err) => {
        console.warn('[RushBuddy] persist unsuspend failed', err);
      });
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    console.debug(`[RushBuddy dev] ${mockJobs.length} mock jobs loaded`);
    mockJobs.forEach(j => logJobTransition(j.id, '(new)', j.status));

    return attachDevJobDebug({
      setJobs,
      setActiveJob,
      createPilotJobs: createPilotScenarioJobs,
      setRunnerSuspension,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authReady) {
    return <SessionRestoreGate />;
  }

  return (
    <AppContext.Provider value={{
      user,
      setUser,
      currentRole,
      setCurrentRole,
      jobs,
      setJobs,
      activeJob,
      setActiveJob,
      pendingEmail,
      setPendingEmail,
      pendingSignup,
      setPendingSignup,
      isAuthenticated,
      setIsAuthenticated,
      authReady,
      trustEvents,
      appendTrustEvent,
      runnerTrustRecords,
      updateRunnerTrustRecord,
      refreshData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { defaultUser };
