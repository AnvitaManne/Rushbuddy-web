-- Phase 15 payments/ratings/disputes/trust smoke test (local only; self-cleaning).
-- Walks: accept -> pickup -> handoff -> record_payment -> submit_rating ->
-- file_dispute (theft -> runner suspended) -> resolve_dispute (runner_at_fault + unsuspend).

\set ON_ERROR_STOP off
\set org '01000000-0000-4000-8000-000000000001'
\set job 'f5000000-0000-4000-8000-000000000015'
\set sender 'f5aa0000-0000-4000-8000-0000000000a1'
\set runner 'f5bb0000-0000-4000-8000-0000000000b2'
\set sender_sub 'f5cc0000-0000-4000-8000-0000000000c1'
\set runner_sub 'f5dd0000-0000-4000-8000-0000000000d2'

BEGIN;
INSERT INTO public.users (id, auth_user_id, email, name, hostel_block, gender, verified, verified_at, rating)
VALUES
  (:'sender', :'sender_sub', 'p15-sender@vitstudent.ac.in', 'P15 Sender', 'MH-A', 'male', true, now(), 4.5),
  (:'runner', :'runner_sub', 'p15-runner@vitstudent.ac.in', 'P15 Runner', 'MH-B', 'male', true, now(), 4.8);
INSERT INTO public.organization_members (organization_id, user_id, role, status)
VALUES (:'org', :'sender', 'member', 'active'), (:'org', :'runner', 'member', 'active');
INSERT INTO public.jobs (
  id, organization_id, status, sender_id, sender_name, sender_hostel,
  job_type, handoff_mode, item_type, weight, risk, purchase_type,
  pickup_location, drop_location, pickup_location_type, drop_location_type,
  description, price_floor, posted_price, agreed_price, confirmation_code_hash, expires_at
) VALUES (
  :'job', :'org', 'OPEN', :'sender', 'P15 Sender', 'MH-A',
  'campus_immediate', 'mode_1_direct_p2p', 'Object', 'Light', 'Low', 'carry_only',
  'SJT Gate', 'MH-B 214', 'general', 'mens_hostel',
  'phase15 test', 30, 45, 45, '5566', now() + interval '30 minutes'
);
COMMIT;

-- Runner: accept + pickup + handoff
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'runner_sub'), true);
SELECT 'accept'  AS step, public.accept_job(:'job') IS NOT NULL AS ok;
SELECT 'pickup'  AS step, public.acknowledge_pickup(:'job') IS NOT NULL AS ok;
SELECT 'handoff' AS step, public.verify_handoff(:'job', '5566') IS NOT NULL AS ok;
COMMIT;

-- Sender: payment + rating
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'sender_sub'), true);
SELECT 'payment' AS step, public.record_payment(:'job', 'cash', 10) IS NOT NULL AS ok;
SELECT 'rating'  AS step, public.submit_rating(:'job', 5) IS NOT NULL AS ok;
SELECT 'dispute' AS step, public.file_dispute(:'job', 'Not delivered', 'never arrived') IS NOT NULL AS ok;
COMMIT;

-- Runner suspended by theft-like dispute?
SELECT 'runner suspended?' AS step, suspension_status FROM public.users WHERE id = :'runner';

-- Sender: resolve (runner at fault + unsuspend)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', :'sender_sub'), true);
SELECT 'resolve' AS step, public.resolve_dispute(:'job', 'runner_at_fault', true) IS NOT NULL AS ok;
COMMIT;

-- Final assertions
SELECT 'job'     AS step, status, runner_payout_status FROM public.jobs WHERE id = :'job';
SELECT 'payment' AS step, method, status, tip_amount FROM public.payments WHERE job_id = :'job';
SELECT 'rating'  AS step, stars FROM public.ratings WHERE job_id = :'job';
SELECT 'dispute' AS step, status, resolution_outcome FROM public.disputes WHERE job_id = :'job';
SELECT 'runner'  AS step, rating, suspension_status FROM public.users WHERE id = :'runner';
SELECT 'trust'   AS step, type FROM public.trust_events WHERE job_id = :'job' ORDER BY created_at;

-- Cleanup
DELETE FROM public.trust_events WHERE job_id = :'job';
DELETE FROM public.ratings WHERE job_id = :'job';
DELETE FROM public.payments WHERE job_id = :'job';
DELETE FROM public.disputes WHERE job_id = :'job';
DELETE FROM public.job_events WHERE job_id = :'job';
DELETE FROM public.jobs WHERE id = :'job';
DELETE FROM public.organization_members WHERE user_id IN (:'sender', :'runner');
DELETE FROM public.users WHERE id IN (:'sender', :'runner');
