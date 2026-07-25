-- RushBuddy Phase 13 / Slice 13.9 — table privilege grants
-- Migration-created tables have no anon/authenticated DML grants by default, so
-- even RLS-permitted reads fail with "permission denied for table ...".
-- RLS still governs WHICH rows are visible; these grants only unlock the verbs.

-- Signup (anon) resolves the org via SECURITY DEFINER RPC; a plain SELECT here is
-- RLS-filtered to nothing pre-membership, but the grant avoids a hard privilege error.
GRANT SELECT ON public.organizations TO anon, authenticated;

-- Authenticated app surface (all gated by the policies in 0002 / 0003).
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT ON public.job_events TO authenticated;

-- Note: users/organization_members/job_events writes happen through SECURITY DEFINER
-- functions/triggers (owner = postgres), so no INSERT grant is needed for those.
