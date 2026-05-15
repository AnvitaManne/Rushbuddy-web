import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'sender' | 'runner' | null;
export type JobStatus = 'OPEN' | 'MATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'CLOSED' | 'DISPUTED' | 'ISSUE_REPORTED' | 'PENDING_RATING';

export interface Job {
  id: string;
  senderId: string;
  senderName: string;
  senderHostel: string;
  itemType: 'Document' | 'Food' | 'Medicine' | 'Object';
  weight: 'Light' | 'Medium' | 'Heavy';
  risk: 'Low' | 'Fragile' | 'Valuable';
  pickupLocation: string;
  dropLocation: string;
  description: string;
  priceMin: number;
  priceMax: number;
  agreedPrice?: number;
  status: JobStatus;
  runnerId?: string;
  runnerName?: string;
  runnerRating?: number;
  runnerHostel?: string;
  createdAt: string;
  matchedAt?: string;
  pickupConfirmedAt?: string;
  deliveredAt?: string;
  eta?: string;
  distance?: string;
  isWomensHostel?: boolean;
  tipAmount?: number;
  rating?: number;
  noShowCount?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  hostelBlock: string;
  verified: boolean;
  currentRole: UserRole;
  rating: number;
  totalDeliveries: number;
  totalEarnings: number;
  weeklyEarnings: number;
  acceptanceRate: number;
  trustScore: number;
  joinedAt: string;
  gender: 'male' | 'female';
  streak: number;
  bestWeekEarnings: number;
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
  pendingEmail: string;
  setPendingEmail: (email: string) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const mockJobs: Job[] = [
  {
    id: 'JOB-2401',
    senderId: 'u2',
    senderName: 'Priya Menon',
    senderHostel: 'GH-C Block',
    itemType: 'Document',
    weight: 'Light',
    risk: 'Low',
    pickupLocation: 'MBA Hall Gate',
    dropLocation: 'Tech Tower A-304',
    description: 'Printed assignment, 20 pages. Please handle carefully.',
    priceMin: 25,
    priceMax: 35,
    agreedPrice: 30,
    status: 'OPEN',
    createdAt: '2026-04-09T09:14:00Z',
    eta: '12 min',
    distance: '0.8 km',
  },
  {
    id: 'JOB-2402',
    senderId: 'u3',
    senderName: 'Arjun Sharma',
    senderHostel: 'MH-A Block',
    itemType: 'Medicine',
    weight: 'Light',
    risk: 'Low',
    pickupLocation: 'VIT Pharmacy, Main Gate',
    dropLocation: 'MH-D Block, Room 512',
    description: 'Prescribed medication. Urgent — fever since morning.',
    priceMin: 35,
    priceMax: 45,
    agreedPrice: 40,
    status: 'OPEN',
    createdAt: '2026-04-09T09:22:00Z',
    eta: '8 min',
    distance: '0.5 km',
  },
  {
    id: 'JOB-2403',
    senderId: 'u4',
    senderName: 'Kavitha R',
    senderHostel: 'GH-A Block',
    itemType: 'Object',
    weight: 'Medium',
    risk: 'Fragile',
    pickupLocation: 'SJT Ground Floor',
    dropLocation: 'GH-B Block Room 208',
    description: 'Water bottle + charger left in lab. Handle with care.',
    priceMin: 58,
    priceMax: 78,
    agreedPrice: 65,
    status: 'OPEN',
    createdAt: '2026-04-09T08:58:00Z',
    eta: '15 min',
    distance: '1.2 km',
    isWomensHostel: true,
  },
  {
    id: 'JOB-2404',
    senderId: 'u5',
    senderName: 'Rahul Nair',
    senderHostel: 'MH-B Block',
    itemType: 'Food',
    weight: 'Medium',
    risk: 'Low',
    pickupLocation: 'CALS Canteen',
    dropLocation: 'MH-B Block, Room 317',
    description: 'Chicken biryani + lassi. Keep upright please!',
    priceMin: 45,
    priceMax: 55,
    agreedPrice: 50,
    status: 'MATCHED',
    runnerId: 'u1',
    runnerName: 'You',
    runnerRating: 4.8,
    createdAt: '2026-04-09T09:05:00Z',
    matchedAt: '2026-04-09T09:08:00Z',
    eta: '5 min',
    distance: '0.6 km',
  },
  {
    id: 'JOB-2389',
    senderId: 'u1',
    senderName: 'You',
    senderHostel: 'MH-C Block',
    itemType: 'Document',
    weight: 'Light',
    risk: 'Low',
    pickupLocation: 'TT Hall Printer Shop',
    dropLocation: 'MH-C Block, Room 412 (yours)',
    description: 'Mid-sem notes printout',
    priceMin: 25,
    priceMax: 35,
    agreedPrice: 30,
    status: 'DELIVERED',
    runnerId: 'r1',
    runnerName: 'Deepak V',
    runnerRating: 4.9,
    createdAt: '2026-04-08T14:30:00Z',
    deliveredAt: '2026-04-08T14:52:00Z',
    rating: 5,
    tipAmount: 10,
  },
  {
    id: 'JOB-2376',
    senderId: 'u6',
    senderName: 'Sneha Kumar',
    senderHostel: 'GH-A Block',
    itemType: 'Medicine',
    weight: 'Light',
    risk: 'Low',
    pickupLocation: 'VIT Medical Centre',
    dropLocation: 'GH-A Block, Room 104',
    description: 'Vitamin tablets from health centre',
    priceMin: 35,
    priceMax: 45,
    agreedPrice: 40,
    status: 'CLOSED',
    runnerId: 'u1',
    runnerName: 'You',
    createdAt: '2026-04-07T11:10:00Z',
    deliveredAt: '2026-04-07T11:34:00Z',
    tipAmount: 20,
    rating: 5,
  },
  {
    id: 'JOB-2361',
    senderId: 'u7',
    senderName: 'Mohammed A',
    senderHostel: 'MH-D Block',
    itemType: 'Object',
    weight: 'Light',
    risk: 'Low',
    pickupLocation: 'Admin Block',
    dropLocation: 'MH-D Block, Room 222',
    description: 'ID card from admin',
    priceMin: 40,
    priceMax: 50,
    agreedPrice: 45,
    status: 'CLOSED',
    runnerId: 'u1',
    runnerName: 'You',
    createdAt: '2026-04-06T16:00:00Z',
    deliveredAt: '2026-04-06T16:20:00Z',
    tipAmount: 0,
    rating: 4,
  },
];

const defaultUser: User = {
  id: 'u1',
  email: 'aditi.k@vitstudent.ac.in',
  name: 'Aditi Krishnan',
  hostelBlock: 'MH-C Block',
  verified: true,
  currentRole: null,
  rating: 4.8,
  totalDeliveries: 23,
  totalEarnings: 1840,
  weeklyEarnings: 320,
  acceptanceRate: 91,
  trustScore: 94,
  joinedAt: '2026-03-01T00:00:00Z',
  gender: 'female',
  streak: 4,
  bestWeekEarnings: 450,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(null);
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
