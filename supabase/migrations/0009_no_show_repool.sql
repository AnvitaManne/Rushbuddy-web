-- RushBuddy Phase 19 — Find New Buddy / no-show re-pool with strike + auto-suspend.
-- Also hardens accept_job so suspended runners cannot accept even if UI is bypassed.

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

CREATE OR REPLACE FUNCTION public.record_no_show_and_repool(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
  v_runner uuid;
  v_count integer;
  v_suspended boolean := false;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'record_no_show_and_repool: not authenticated'; END IF;

  SELECT * INTO v_job FROM public.jobs
  WHERE id = p_job_id AND sender_id = v_me AND status = 'MATCHED'
    AND pickup_confirmed_at IS NULL AND runner_id IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_no_show_and_repool: job % not eligible (need MATCHED, no pickup, has runner)', p_job_id
      USING ERRCODE = '55000';
  END IF;

  v_runner := v_job.runner_id;

  UPDATE public.jobs
  SET status = 'OPEN',
      runner_id = NULL,
      runner_name = NULL,
      runner_rating = NULL,
      runner_hostel = NULL,
      matched_at = NULL,
      agreed_price = NULL,
      updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  UPDATE public.users
  SET no_show_count = no_show_count + 1,
      updated_at = now()
  WHERE id = v_runner
  RETURNING no_show_count INTO v_count;

  INSERT INTO public.trust_events (organization_id, runner_id, job_id, type, description)
  VALUES (
    v_job.organization_id, v_runner, v_job.id, 'no_show',
    format('Re-pooled %s to Find New Buddy — no pickup confirmation (strike %s).', v_job.id, v_count)
  );

  IF v_count >= 2 THEN
    UPDATE public.users
    SET suspension_status = 'suspended',
        suspension_reason = format('Repeated no-shows (%s)', v_count),
        suspended_at = COALESCE(suspended_at, now()),
        updated_at = now()
    WHERE id = v_runner AND suspension_status <> 'suspended';

    IF FOUND THEN
      v_suspended := true;
      INSERT INTO public.trust_events (organization_id, runner_id, job_id, type, description)
      VALUES (
        v_job.organization_id, v_runner, v_job.id, 'suspension',
        format('Auto-suspended after %s no-shows (job %s).', v_count, v_job.id)
      );
    END IF;
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (
    v_job.organization_id, v_job.id, v_me, 're_pooled',
    jsonb_build_object(
      'from', 'MATCHED',
      'to', 'OPEN',
      'runner_id', v_runner,
      'no_show_count', v_count,
      'suspended', v_suspended
    )
  );

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (
    v_job.organization_id, v_job.id, v_me, 'status_changed',
    jsonb_build_object('from', 'MATCHED', 'to', 'OPEN', 'reason', 'no_show_repool')
  );

  RETURN v_job.id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_no_show_and_repool(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_no_show_and_repool(uuid) TO authenticated;
