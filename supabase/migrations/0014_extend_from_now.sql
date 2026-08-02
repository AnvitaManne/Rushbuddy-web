-- Extend adds 30 minutes from now (clearer after DEV near-expiry), not from old expires_at.

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
  SET expires_at = now() + interval '30 minutes',
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
