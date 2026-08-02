-- RushBuddy Phase 21 — OPEN job TTL: cancel, extend (campus_immediate once), expire stale.
-- Also reject accept_job when expires_at has passed.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS open_extended boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs.open_extended IS
  'Campus Immediate: sender used the one-shot +30 min extend near expiry.';

-- ---------------------------------------------------------------------------
-- accept_job: refuse expired OPEN jobs
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
  v_suspension public.suspension_status;
  v_job public.jobs%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'accept_job: not authenticated';
  END IF;

  SELECT name, rating, hostel_block, suspension_status
  INTO v_name, v_rating, v_hostel, v_suspension
  FROM public.users
  WHERE id = v_me;

  IF v_suspension = 'suspended' THEN
    RAISE EXCEPTION 'accept_job: runner is suspended'
      USING ERRCODE = '55000';
  END IF;

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
    AND expires_at > now()
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
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

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sender cancel OPEN → CLOSED
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_open_job(p_job_id uuid)
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
  IF v_me IS NULL THEN RAISE EXCEPTION 'cancel_open_job: not authenticated'; END IF;

  UPDATE public.jobs
  SET status = 'CLOSED', closed_at = now(), updated_at = now()
  WHERE id = p_job_id AND sender_id = v_me AND status = 'OPEN'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cancel_open_job: job % not open for sender', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (
    v_job.organization_id, v_job.id, v_me, 'status_changed',
    jsonb_build_object('from', 'OPEN', 'to', 'CLOSED', 'reason', 'sender_cancel')
  );

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sender extend campus_immediate once (+30 min) in the last 5 minutes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extend_open_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
  v_left interval;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'extend_open_job: not authenticated'; END IF;

  SELECT * INTO v_job FROM public.jobs
  WHERE id = p_job_id AND sender_id = v_me AND status = 'OPEN'
    AND job_type = 'campus_immediate'
    AND open_extended = false
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'extend_open_job: job % not extendable', p_job_id
      USING ERRCODE = '55000';
  END IF;

  v_left := v_job.expires_at - now();
  IF v_left > interval '5 minutes' THEN
    RAISE EXCEPTION 'extend_open_job: too early (%>5 min left)', p_job_id
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.jobs
  SET expires_at = expires_at + interval '30 minutes',
      open_extended = true,
      updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (
    v_job.organization_id, v_job.id, v_me, 'status_changed',
    jsonb_build_object(
      'event', 'extended',
      'expires_at', v_job.expires_at,
      'open_extended', true
    )
  );

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Close all expired OPEN jobs in the caller's org (idempotent cleanup)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_open_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_count integer := 0;
  r record;
BEGIN
  v_org := public.current_app_user_org_id();
  IF v_org IS NULL THEN RETURN 0; END IF;

  FOR r IN
    SELECT id, organization_id FROM public.jobs
    WHERE organization_id = v_org AND status = 'OPEN' AND expires_at <= now()
  LOOP
    UPDATE public.jobs
    SET status = 'CLOSED', closed_at = now(), updated_at = now()
    WHERE id = r.id AND status = 'OPEN';

    IF FOUND THEN
      v_count := v_count + 1;
      INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
      VALUES (
        r.organization_id, r.id, public.current_app_user_id(), 'status_changed',
        jsonb_build_object('from', 'OPEN', 'to', 'CLOSED', 'reason', 'expired')
      );
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_open_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extend_open_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_open_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_open_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_open_job(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_open_jobs() TO authenticated;
