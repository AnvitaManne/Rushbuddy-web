import type { Job } from './types';
import { createSampleJob } from './devJobDebug';

/**
 * Stable IDs for dogfooding fixtures. Reloading removes prior `PILOT-*` jobs
 * so the set stays recognizable and does not duplicate.
 */
export const PILOT_SCENARIO_IDS = [
  'PILOT-01',
  'PILOT-02',
  'PILOT-03',
  'PILOT-04',
  'PILOT-05',
  'PILOT-06',
  'PILOT-07',
  'PILOT-08',
  'PILOT-09',
  'PILOT-10',
  'PILOT-11',
  'PILOT-12',
] as const;

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function daysFromNowDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds 12 reusable mock jobs for Phase 8 dogfooding / pilot tabletop.
 * Uses `createSampleJob` so floors, handoff mode, expiry, and codes stay consistent.
 */
export function createPilotScenarioJobs(): Job[] {
  const scheduledStart = hoursFromNow(2);
  const scheduledEnd = hoursFromNow(4);

  return [
    // 1. Campus immediate low-risk OPEN
    createSampleJob({
      id: 'PILOT-01',
      status: 'OPEN',
      job_type: 'campus_immediate',
      risk: 'Low',
      item_type: 'Document',
      weight: 'Light',
      sender_id: 'u-pilot-a',
      sender_name: 'Pilot Sender A',
      sender_hostel: 'MH-A Block',
      pickup_location: 'SJT Lobby',
      drop_location: 'MH-A Block, Room 101',
      description:
        '[PILOT-01] Campus immediate · Low risk · OPEN — accept from Runner Feed',
      confirmation_code: '1001',
      created_at: minutesAgo(5),
      eta: '10 min',
      distance: '0.7 km',
    }),

    // 2. Campus immediate fragile OPEN
    createSampleJob({
      id: 'PILOT-02',
      status: 'OPEN',
      job_type: 'campus_immediate',
      risk: 'Fragile',
      item_type: 'Object',
      weight: 'Medium',
      sender_id: 'u-pilot-b',
      sender_name: 'Pilot Sender B',
      sender_hostel: 'GH-B Block',
      pickup_location: 'TT Printer Shop',
      drop_location: 'GH-B Block, Room 210',
      pickup_location_type: 'general',
      drop_location_type: 'womens_hostel',
      description:
        '[PILOT-02] Campus immediate · Fragile · OPEN — photo required at Condition Ack',
      confirmation_code: '1002',
      created_at: minutesAgo(8),
      eta: '14 min',
      distance: '1.1 km',
    }),

    // 3. Scheduled job OPEN
    createSampleJob({
      id: 'PILOT-03',
      status: 'OPEN',
      job_type: 'campus_scheduled',
      risk: 'Low',
      item_type: 'Medicine',
      weight: 'Light',
      sender_id: 'u-pilot-a',
      sender_name: 'Pilot Sender A',
      sender_hostel: 'MH-A Block',
      pickup_location: 'VIT Pharmacy',
      drop_location: 'MH-C Block, Room 412',
      scheduled_window: { start: scheduledStart, end: scheduledEnd },
      description:
        '[PILOT-03] Campus scheduled · OPEN — window set; live until window end',
      confirmation_code: '1003',
      created_at: minutesAgo(3),
      eta: 'window',
      distance: '0.9 km',
    }),

    // 4. Intercity Mode 2 OPEN
    createSampleJob({
      id: 'PILOT-04',
      status: 'OPEN',
      job_type: 'intercity',
      risk: 'Low',
      item_type: 'Document',
      weight: 'Light',
      sender_id: 'u-pilot-c',
      sender_name: 'Pilot Sender C',
      sender_hostel: 'MH-D Block',
      pickup_location: 'VIT Main Gate',
      drop_location: 'Chennai Central — meet at landmark',
      travel_date: daysFromNowDate(3),
      corridor_landmark: 'Chennai Central — Platform 1 entrance',
      receiver_phone: '9000000004',
      description:
        '[PILOT-04] Intercity Mode 2 · OPEN — landmark + receiver_phone set',
      confirmation_code: '1004',
      created_at: minutesAgo(12),
      eta: 'travel day',
      distance: 'corridor',
    }),

    // 5. MATCHED pre-pickup no-show candidate
    createSampleJob({
      id: 'PILOT-05',
      status: 'MATCHED',
      job_type: 'campus_immediate',
      risk: 'Low',
      item_type: 'Food',
      weight: 'Medium',
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      runner_id: 'r-pilot-ghost',
      runner_name: 'Ghost Runner',
      runner_rating: 4.2,
      runner_hostel: 'MH-B Block',
      pickup_location: 'CALS Canteen',
      drop_location: 'MH-C Block, Room 412',
      condition_acknowledged: false,
      matched_at: minutesAgo(12),
      description:
        '[PILOT-05] MATCHED · no-show candidate — Find New Buddy after 10 min / DEV',
      confirmation_code: '1005',
      created_at: minutesAgo(20),
      eta: '5 min',
      distance: '0.6 km',
    }),

    // 6. IN_TRANSIT normal delivery candidate
    createSampleJob({
      id: 'PILOT-06',
      status: 'IN_TRANSIT',
      job_type: 'campus_immediate',
      risk: 'Low',
      item_type: 'Document',
      weight: 'Light',
      sender_id: 'u-pilot-b',
      sender_name: 'Pilot Sender B',
      sender_hostel: 'GH-A Block',
      runner_id: 'u1',
      runner_name: 'You',
      runner_rating: 4.8,
      runner_hostel: 'MH-C Block',
      pickup_location: 'MBA Hall Gate',
      drop_location: 'Tech Tower B-201',
      condition_acknowledged: true,
      matched_at: minutesAgo(25),
      pickup_confirmed_at: minutesAgo(15),
      photo_url: 'mock://pickup/PILOT-06.jpg',
      description:
        '[PILOT-06] IN_TRANSIT · normal — enter handoff code to complete',
      confirmation_code: '1006',
      created_at: minutesAgo(40),
      eta: '8 min',
      distance: '0.8 km',
    }),

    // 7. PENDING_RATING normal code-delivered job
    createSampleJob({
      id: 'PILOT-07',
      status: 'PENDING_RATING',
      job_type: 'campus_immediate',
      risk: 'Low',
      item_type: 'Medicine',
      weight: 'Light',
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      runner_id: 'r-pilot-1',
      runner_name: 'Pilot Runner 1',
      runner_rating: 4.7,
      runner_hostel: 'MH-A Block',
      pickup_location: 'Medical Centre',
      drop_location: 'MH-C Block, Room 412',
      condition_acknowledged: true,
      matched_at: minutesAgo(50),
      pickup_confirmed_at: minutesAgo(40),
      delivered_at: minutesAgo(10),
      description:
        '[PILOT-07] PENDING_RATING · code delivered — mock pay + rate (Mode 1 cash OK)',
      confirmation_code: '1007',
      created_at: minutesAgo(60),
      eta: 'done',
      distance: '0.5 km',
    }),

    // 8. Low-risk secure_drop PENDING_RATING
    createSampleJob({
      id: 'PILOT-08',
      status: 'PENDING_RATING',
      job_type: 'campus_immediate',
      risk: 'Low',
      item_type: 'Object',
      weight: 'Light',
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      runner_id: 'r-pilot-2',
      runner_name: 'Pilot Runner 2',
      runner_rating: 4.5,
      runner_hostel: 'MH-D Block',
      pickup_location: 'Admin Block',
      drop_location: 'MH-C Block gate',
      condition_acknowledged: true,
      matched_at: minutesAgo(70),
      pickup_confirmed_at: minutesAgo(55),
      no_answer_at: minutesAgo(35),
      ops_notified: true,
      dropoff_photo_url: 'mock://dropoff/PILOT-08/secure.jpg',
      delivered_at: minutesAgo(12),
      description:
        '[PILOT-08] PENDING_RATING · Low-risk secure_drop — ops notified, mock photo',
      confirmation_code: '1008',
      created_at: minutesAgo(90),
    }),

    // 9. Fragile hold_for_ops ISSUE_REPORTED
    createSampleJob({
      id: 'PILOT-09',
      status: 'ISSUE_REPORTED',
      job_type: 'campus_immediate',
      risk: 'Fragile',
      item_type: 'Object',
      weight: 'Medium',
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      runner_id: 'r-pilot-2',
      runner_name: 'Pilot Runner 2',
      runner_rating: 4.5,
      runner_hostel: 'MH-D Block',
      pickup_location: 'SJT Lab',
      drop_location: 'MH-C Block, Room 412',
      condition_acknowledged: true,
      matched_at: minutesAgo(80),
      pickup_confirmed_at: minutesAgo(65),
      photo_url: 'mock://pickup/PILOT-09.jpg',
      no_answer_at: minutesAgo(40),
      ops_notified: true,
      description:
        '[PILOT-09] ISSUE_REPORTED · Fragile hold_for_ops — no unattended drop',
      confirmation_code: '1009',
      created_at: minutesAgo(100),
    }),

    // 10. DISPUTED theft escalation candidate
    createSampleJob({
      id: 'PILOT-10',
      status: 'DISPUTED',
      job_type: 'campus_immediate',
      risk: 'Low',
      item_type: 'Document',
      weight: 'Light',
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      runner_id: 'r-pilot-theft',
      runner_name: 'Flagged Runner',
      runner_rating: 3.9,
      runner_hostel: 'MH-B Block',
      pickup_location: 'Library',
      drop_location: 'MH-C Block, Room 412',
      condition_acknowledged: true,
      matched_at: minutesAgo(120),
      pickup_confirmed_at: minutesAgo(100),
      delivered_at: minutesAgo(30),
      description:
        '[PILOT-10] DISPUTED · theft escalation candidate — mock FIR / suspension path',
      confirmation_code: '1010',
      created_at: minutesAgo(140),
    }),

    // 11. CLOSED completed job
    createSampleJob({
      id: 'PILOT-11',
      status: 'CLOSED',
      job_type: 'campus_immediate',
      risk: 'Low',
      item_type: 'Document',
      weight: 'Light',
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      runner_id: 'r-pilot-1',
      runner_name: 'Pilot Runner 1',
      runner_rating: 4.7,
      runner_hostel: 'MH-A Block',
      pickup_location: 'Food Court',
      drop_location: 'MH-C Block, Room 412',
      condition_acknowledged: true,
      matched_at: minutesAgo(200),
      pickup_confirmed_at: minutesAgo(180),
      delivered_at: minutesAgo(160),
      tip_amount: 10,
      rating: 5,
      description: '[PILOT-11] CLOSED · completed happy-path reference',
      confirmation_code: '1011',
      created_at: minutesAgo(220),
    }),

    // 12. Mode 2 UPI-only payment candidate
    createSampleJob({
      id: 'PILOT-12',
      status: 'PENDING_RATING',
      job_type: 'intercity',
      risk: 'Low',
      item_type: 'Object',
      weight: 'Medium',
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      runner_id: 'r-pilot-3',
      runner_name: 'Pilot Runner 3',
      runner_rating: 4.6,
      runner_hostel: 'Off-campus',
      pickup_location: 'VIT Main Gate',
      drop_location: 'Katpadi Junction — landmark handoff',
      travel_date: daysFromNowDate(1),
      corridor_landmark: 'Katpadi Junction — taxi stand board',
      receiver_phone: '9000000012',
      condition_acknowledged: true,
      matched_at: minutesAgo(90),
      pickup_confirmed_at: minutesAgo(70),
      delivered_at: minutesAgo(15),
      description:
        '[PILOT-12] PENDING_RATING · Mode 2 UPI-only — Cash must be hidden on /rate',
      confirmation_code: '1012',
      created_at: minutesAgo(110),
      eta: 'landmark',
      distance: 'corridor',
    }),
  ];
}
