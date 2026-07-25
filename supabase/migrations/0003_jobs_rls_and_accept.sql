-- RushBuddy Phase 13 / Slice 13.2 — Jobs RLS + atomic accept + job_events
-- Adds: caller-id helpers, append_job_event, job-created event trigger,
-- accept_job (atomic OPEN→MATCHED), and RLS for jobs / job_events.
-- Payments / trust remain without RLS (still mock-backed in the app).

-- ---------------------------------------------------------------------------
-- Denormalized party display fields (pilot)
-- users RLS allows reading only your own row, so a runner's feed cannot JOIN
-- the sender's name (and we must never expose gender). Store display-only
-- name/hostel/rating on the job instead. TODO: normalize behind a gender-safe
-- view/RPC in a later phase.
-- ---------------------------------------------------------------------------

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_hostel text,
  ADD COLUMN IF NOT EXISTS runner_name text,
  ADD COLUMN IF NOT EXISTS runner_rating numeric(3, 2),
  ADD COLUMN IF NOT EXISTS runner_hostel text;

COMMENT ON COLUMN public.jobs.sender_name IS 'Denormalized display name (pilot); gender-safe, avoids cross-user reads under RLS.';

-- ---------------------------------------------------------------------------
-- Caller identity helpers (auth.uid() → public.users.id / active org)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_app_user_id() IS
  'Resolves the public.users.id for the current auth session (NULL if unauthenticated).';

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_app_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  INNER JOIN public.users u ON u.id = om.user_id
  WHERE u.auth_user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_app_user_org_id() IS
  'Active organization_id for the current auth session (one active org per user in v1).';

REVOKE ALL ON FUNCTION public.current_app_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_org_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- Append-only job_events writer (no direct client INSERT policy)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.append_job_event(
  p_job_id uuid,
  p_event_type public.job_event_type,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_id uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.jobs WHERE id = p_job_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'append_job_event: job % not found', p_job_id;
  END IF;

  INSERT INTO public.job_events (
    organization_id, job_id, actor_user_id, event_type, payload
  )
  VALUES (
    v_org,
    p_job_id,
    COALESCE(p_actor_user_id, public.current_app_user_id()),
    p_event_type,
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.append_job_event(uuid, public.job_event_type, jsonb, uuid) IS
  'Append-only job_events writer. organization_id derived from the job. SECURITY DEFINER: only path for client-visible event writes.';

REVOKE ALL ON FUNCTION public.append_job_event(uuid, public.job_event_type, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_job_event(uuid, public.job_event_type, jsonb, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Initial event on job create (status_changed → OPEN) via AFTER INSERT trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_job_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_events (
    organization_id, job_id, actor_user_id, event_type, payload
  )
  VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.sender_id,
    'status_changed',
    jsonb_build_object('to', NEW.status)
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_job_created() IS
  'AFTER INSERT on public.jobs: writes the initial status_changed job_event (e.g. → OPEN).';

DROP TRIGGER IF EXISTS on_job_created ON public.jobs;
CREATE TRIGGER on_job_created
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_job_created();

-- ---------------------------------------------------------------------------
-- Atomic accept: only one runner can win an OPEN job
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_name text;
  v_rating numeric(3, 2);
  v_hostel text;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'accept_job: not authenticated';
  END IF;

  SELECT name, rating, hostel_block
  INTO v_name, v_rating, v_hostel
  FROM public.users
  WHERE id = v_me;

  UPDATE public.jobs
  SET
    status = 'MATCHED',
    runner_id = v_me,
    runner_name = v_name,
    runner_rating = v_rating,
    runner_hostel = v_hostel,
    matched_at = now(),
    agreed_price = posted_price,
    updated_at = now()
  WHERE id = p_job_id
    AND status = 'OPEN'
    AND runner_id IS NULL
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    -- Already matched / cancelled / not visible — surface as a conflict.
    RAISE EXCEPTION 'accept_job: job % is no longer open', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (
    organization_id, job_id, actor_user_id, event_type, payload
  )
  VALUES (
    v_job.organization_id,
    v_job.id,
    v_me,
    'status_changed',
    jsonb_build_object('from', 'OPEN', 'to', 'MATCHED')
  );

  -- Return only the id (never the row): confirmation_code_hash must not reach the runner.
  RETURN v_job.id;
END;
$$;

COMMENT ON FUNCTION public.accept_job(uuid) IS
  'Atomic OPEN→MATCHED for the calling runner. Single conditional UPDATE prevents double-accept; appends a status_changed event. Returns job id only (never the code).';

REVOKE ALL ON FUNCTION public.accept_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_job(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: jobs + job_events (tenant-scoped)
-- ---------------------------------------------------------------------------

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

-- jobs: members read everything in their org
CREATE POLICY jobs_select_org_member
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_app_user_org_id());

-- jobs: sender inserts own job into own org
CREATE POLICY jobs_insert_own
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = public.current_app_user_id()
    AND organization_id = public.current_app_user_org_id()
  );

-- jobs: sender may update own jobs (cancel / re-pool); runner may update own accepted jobs.
-- Atomic accept still goes through accept_job (SECURITY DEFINER) which bypasses RLS.
CREATE POLICY jobs_update_sender
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (sender_id = public.current_app_user_id())
  WITH CHECK (sender_id = public.current_app_user_id());

CREATE POLICY jobs_update_runner
  ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (runner_id = public.current_app_user_id())
  WITH CHECK (runner_id = public.current_app_user_id());

-- job_events: members read events for jobs in their org. No client INSERT policy
-- (writes go through append_job_event / triggers / accept_job — all SECURITY DEFINER).
CREATE POLICY job_events_select_org_member
  ON public.job_events
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_app_user_org_id());
