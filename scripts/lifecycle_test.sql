-- Phase 14 lifecycle smoke test (local only; safe to delete).
-- Seeds a sender + runner + OPEN job, then walks the persisted lifecycle:
-- accept -> acknowledge_pickup -> verify_handoff (wrong then right) -> close_job.
-- Cleans up its own rows at the end.

\set ON_ERROR_STOP off
\set org '01000000-0000-4000-8000-000000000001'
\set job 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
\set sender 'a1111111-1111-4111-8111-111111111111'
\set runner 'b2222222-2222-4222-8222-222222222222'
\set sender_sub 'c1111111-1111-4111-8111-111111111111'
\set runner_sub 'd2222222-2222-4222-8222-222222222222'

BEGIN;
INSERT INTO public.users (id, auth_user_id, email, name, hostel_block, gender, verified, verified_at, rating)
VALUES
  (:'sender', :'sender_sub', 'lc-sender@vitstudent.ac.in', 'LC Sender', 'MH-A', 'male', true, now(), 4.5),
  (:'runner', :'runner_sub', 'lc-runner@vitstudent.ac.in', 'LC Runner', 'MH-B', 'male', true, now(), 4.8);

INSERT INTO public.organization_members (organization_id, user_id, role, status)
VALUES (:'org', :'sender', 'member', 'active'), (:'org', :'runner', 'member', 'active');

INSERT INTO public.jobs (
  id, organization_id, status, sender_id, sender_name, sender_hostel,
  job_type, handoff_mode, item_type, weight, risk, purchase_type,
  pickup_location, drop_location, pickup_location_type, drop_location_type,
  description, price_floor, posted_price, confirmation_code_hash, expires_at
) VALUES (
  :'job', :'org', 'OPEN', :'sender', 'LC Sender', 'MH-A',
  'campus_immediate', 'mode_1_direct_p2p', 'Document', 'Light', 'Low', 'carry_only',
  'SJT Gate', 'MH-B 214', 'general', 'mens_hostel',
  'lifecycle test', 30, 35, '7391', now() + interval '30 minutes'
);
COMMIT;

-- Runner accepts
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'runner_sub'), true);
SELECT 'accept ->' AS step, public.accept_job(:'job') IS NOT NULL AS ok;
COMMIT;

-- Runner acknowledges pickup (MATCHED -> IN_TRANSIT)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'runner_sub'), true);
SELECT 'pickup ->' AS step, public.acknowledge_pickup(:'job') IS NOT NULL AS ok;
COMMIT;

-- Runner tries WRONG code (should raise 22023)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'runner_sub'), true);
SELECT 'wrong code ->' AS step, public.verify_handoff(:'job', '0000') AS should_not_appear;
ROLLBACK;

-- Runner enters RIGHT code (IN_TRANSIT -> PENDING_RATING)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'runner_sub'), true);
SELECT 'right code ->' AS step, public.verify_handoff(:'job', '7391') IS NOT NULL AS ok;
COMMIT;

-- Sender closes (PENDING_RATING -> CLOSED)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'sender_sub'), true);
SELECT 'close ->' AS step, public.close_job(:'job') IS NOT NULL AS ok;
COMMIT;

-- Final state + event trail
SELECT 'final' AS step, status, runner_id IS NOT NULL AS has_runner,
       delivered_at IS NOT NULL AS delivered, closed_at IS NOT NULL AS closed,
       runner_payout_status
  FROM public.jobs WHERE id = :'job';
SELECT 'events' AS step, event_type FROM public.job_events WHERE job_id = :'job' ORDER BY created_at;

-- Cleanup
DELETE FROM public.job_events WHERE job_id = :'job';
DELETE FROM public.jobs WHERE id = :'job';
DELETE FROM public.organization_members WHERE user_id IN (:'sender', :'runner');
DELETE FROM public.users WHERE id IN (:'sender', :'runner');
