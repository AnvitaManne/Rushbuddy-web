-- Phase 13 accept-race smoke test (local only; safe to delete).
-- Seeds a sender + two runners, one OPEN job, then races accept_job.

\set ON_ERROR_STOP off

BEGIN;

-- Seed org id from supabase/seed.sql
\set org '01000000-0000-4000-8000-000000000001'

-- App users (auth_user_id doubles as the JWT sub we set below)
INSERT INTO public.users (id, auth_user_id, email, name, hostel_block, gender, verified, verified_at, rating)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'sender@vitstudent.ac.in', 'Sender S',  'MH-A', 'male',   true, now(), 4.5),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'runnerb@vitstudent.ac.in','Runner B',  'MH-B', 'male',   true, now(), 4.7),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '33333333-3333-4333-8333-333333333333', 'runnerc@vitstudent.ac.in','Runner C',  'MH-C', 'female', true, now(), 4.9);

INSERT INTO public.organization_members (organization_id, user_id, role, status)
VALUES
  (:'org', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'member', 'active'),
  (:'org', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member', 'active'),
  (:'org', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'member', 'active');

INSERT INTO public.jobs (
  id, organization_id, status, sender_id, sender_name, sender_hostel,
  job_type, handoff_mode, item_type, weight, risk, purchase_type,
  pickup_location, drop_location, pickup_location_type, drop_location_type,
  description, price_floor, posted_price, confirmation_code_hash, expires_at
) VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd', :'org', 'OPEN',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sender S', 'MH-A',
  'campus_immediate', 'mode_1_direct_p2p', 'Document', 'Light', 'Low', 'carry_only',
  'SJT Gate', 'MH-B 214', 'general', 'mens_hostel',
  'race test', 30, 35, '4821', now() + interval '30 minutes'
);

COMMIT;

-- Runner B accepts (should WIN)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
SELECT 'B accept ->' AS step, public.accept_job('dddddddd-dddd-4ddd-8ddd-dddddddddddd') AS won_job_id;
COMMIT;

-- Runner C accepts same job (should FAIL: already matched)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
SELECT 'C accept ->' AS step, public.accept_job('dddddddd-dddd-4ddd-8ddd-dddddddddddd') AS won_job_id;
COMMIT;

-- Final state: MATCHED to B, with a status_changed event for create + accept
SELECT 'final job' AS step, status, runner_id, runner_name, agreed_price FROM public.jobs
  WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
SELECT 'events' AS step, event_type, payload FROM public.job_events
  WHERE job_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' ORDER BY created_at;
