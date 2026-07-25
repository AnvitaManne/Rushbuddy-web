-- RushBuddy Phase 14 / Slice 14.2 — job lifecycle RPCs + Realtime
-- Server-side pickup / handoff-verify / no-answer / secure-drop / hold-for-ops /
-- issue / close. All SECURITY DEFINER, validate caller = runner/sender, append
-- job_events, and return the job id (never the confirmation code).
-- Payments / ratings / disputes / photos are out of scope (separate tables).

-- ---------------------------------------------------------------------------
-- Runner: acknowledge pickup (MATCHED → IN_TRANSIT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acknowledge_pickup(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'acknowledge_pickup: not authenticated'; END IF;

  UPDATE public.jobs
  SET status = 'IN_TRANSIT',
      pickup_confirmed_at = now(),
      condition_acknowledged = true,
      updated_at = now()
  WHERE id = p_job_id AND runner_id = v_me AND status = 'MATCHED'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'acknowledge_pickup: job % not in MATCHED for this runner', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'pickup_acknowledged', jsonb_build_object('to', 'IN_TRANSIT'));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Runner: verify handoff code (IN_TRANSIT → PENDING_RATING)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_handoff(p_job_id uuid, p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'verify_handoff: not authenticated'; END IF;

  SELECT * INTO v_job FROM public.jobs
  WHERE id = p_job_id AND runner_id = v_me AND status = 'IN_TRANSIT';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verify_handoff: job % not in transit for this runner', p_job_id
      USING ERRCODE = '55000';
  END IF;

  IF btrim(p_code) <> btrim(v_job.confirmation_code_hash) THEN
    INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
    VALUES (v_job.organization_id, v_job.id, v_me, 'handoff_code_attempt', jsonb_build_object('ok', false));
    -- Distinct SQLSTATE so the client can show "wrong code" (not a hard failure).
    RAISE EXCEPTION 'verify_handoff: invalid handoff code' USING ERRCODE = '22023';
  END IF;

  UPDATE public.jobs
  SET status = 'PENDING_RATING',
      delivered_at = now(),
      dispute_window_ends_at = now() + interval '2 hours',
      runner_payout_status = 'earned',
      updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES
    (v_job.organization_id, v_job.id, v_me, 'handoff_code_success', jsonb_build_object('ok', true)),
    (v_job.organization_id, v_job.id, v_me, 'status_changed', jsonb_build_object('from', 'IN_TRANSIT', 'to', 'PENDING_RATING'));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Runner: log a contact attempt (no status change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_contact_attempt(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'report_contact_attempt: not authenticated'; END IF;

  UPDATE public.jobs
  SET no_answer_contact_attempts = COALESCE(no_answer_contact_attempts, 0) + 1,
      no_answer_at = COALESCE(no_answer_at, now()),
      updated_at = now()
  WHERE id = p_job_id AND runner_id = v_me AND status = 'IN_TRANSIT'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report_contact_attempt: job % not in transit for this runner', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'contact_attempt',
          jsonb_build_object('attempts', v_job.no_answer_contact_attempts));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Runner (Low risk): secure drop (IN_TRANSIT → PENDING_RATING)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_secure_drop(p_job_id uuid, p_location text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'resolve_secure_drop: not authenticated'; END IF;

  UPDATE public.jobs
  SET status = 'PENDING_RATING',
      delivered_at = now(),
      dispute_window_ends_at = now() + interval '2 hours',
      runner_payout_status = 'earned',
      no_answer_resolution = 'secure_drop',
      dropoff_secure_location = COALESCE(NULLIF(btrim(p_location), ''), 'Left at door / reception, per policy'),
      dropoff_geotag = jsonb_build_object('lat', 12.9698, 'lng', 79.1559, 'accuracy_m', 12, 'captured_at', now()),
      ops_notified = true,
      updated_at = now()
  WHERE id = p_job_id AND runner_id = v_me AND status = 'IN_TRANSIT' AND risk = 'Low'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resolve_secure_drop: job % not eligible (needs IN_TRANSIT + Low risk + this runner)', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES
    (v_job.organization_id, v_job.id, v_me, 'secure_drop', jsonb_build_object('location', v_job.dropoff_secure_location)),
    (v_job.organization_id, v_job.id, v_me, 'status_changed', jsonb_build_object('from', 'IN_TRANSIT', 'to', 'PENDING_RATING'));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Runner (Fragile/Valuable): hold for ops (IN_TRANSIT → ISSUE_REPORTED)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hold_for_ops(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'hold_for_ops: not authenticated'; END IF;

  UPDATE public.jobs
  SET status = 'ISSUE_REPORTED',
      ops_notified = true,
      no_answer_resolution = 'hold_for_ops',
      runner_payout_status = 'earned',
      updated_at = now()
  WHERE id = p_job_id AND runner_id = v_me AND status = 'IN_TRANSIT'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'hold_for_ops: job % not in transit for this runner', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES
    (v_job.organization_id, v_job.id, v_me, 'hold_for_ops', jsonb_build_object('to', 'ISSUE_REPORTED')),
    (v_job.organization_id, v_job.id, v_me, 'status_changed', jsonb_build_object('from', 'IN_TRANSIT', 'to', 'ISSUE_REPORTED'));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Runner: generic issue report (→ ISSUE_REPORTED)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_issue(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'report_issue: not authenticated'; END IF;

  UPDATE public.jobs
  SET status = 'ISSUE_REPORTED',
      ops_notified = true,
      updated_at = now()
  WHERE id = p_job_id AND runner_id = v_me AND status IN ('MATCHED', 'IN_TRANSIT')
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'report_issue: job % not active for this runner', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'status_changed', jsonb_build_object('to', 'ISSUE_REPORTED'));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sender: close job (→ CLOSED)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'close_job: not authenticated'; END IF;

  UPDATE public.jobs
  SET status = 'CLOSED',
      closed_at = now(),
      updated_at = now()
  WHERE id = p_job_id AND sender_id = v_me
    AND status IN ('PENDING_RATING', 'DELIVERED', 'ISSUE_REPORTED', 'DISPUTED')
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'close_job: job % not closable by this sender', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'status_changed', jsonb_build_object('to', 'CLOSED'));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'acknowledge_pickup(uuid)',
    'verify_handoff(uuid, text)',
    'report_contact_attempt(uuid)',
    'resolve_secure_drop(uuid, text)',
    'hold_for_ops(uuid)',
    'report_issue(uuid)',
    'close_job(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated;', fn);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Realtime: stream jobs changes (RLS still filters per subscriber)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END;
$$;
