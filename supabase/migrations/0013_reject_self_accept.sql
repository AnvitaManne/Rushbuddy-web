-- RushBuddy — reject self-accept (sender cannot accept their own job).

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
    AND sender_id <> v_me
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
