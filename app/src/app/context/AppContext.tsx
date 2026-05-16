import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Job, User } from '@/domain/types';
import type { UserRole } from '@/domain/enums';
import { createSampleJob, attachDevJobDebug, logJobTransition } from '@/domain/devJobDebug';

export type { Job, User } from '@/domain/types';
export type { JobStatus, UserRole, UserGender } from '@/domain/enums';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  activeJob: Job | null;
  setActiveJob: (job: Job | null) => void;
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

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
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    console.debug(`[RushBuddy dev] ${mockJobs.length} mock jobs loaded`);
    mockJobs.forEach(j => logJobTransition(j.id, '(new)', j.status));

    return attachDevJobDebug({ setJobs, setActiveJob });
  }, []);

  const handleSetUser = (u: User | null) => {
    setUser(u || defaultUser);
  };

  return (
    <AppContext.Provider value={{
      user,
      setUser: handleSetUser,
      currentRole,
      setCurrentRole,
      jobs,
      setJobs,
      activeJob,
      setActiveJob,
      pendingEmail,
      setPendingEmail,
      isAuthenticated,
      setIsAuthenticated,
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
