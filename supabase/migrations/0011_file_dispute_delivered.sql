-- RushBuddy — allow dispute from DELIVERED as well as PENDING_RATING,
-- and return a clearer conflict when the job is not disputable.

CREATE OR REPLACE FUNCTION public.file_dispute(
  p_job_id uuid,
  p_type text,
  p_description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
  v_theft boolean;
  v_from text;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'file_dispute: not authenticated'; END IF;

  -- Align with domain: PENDING_RATING or DELIVERED (post-handoff) may dispute.
  UPDATE public.jobs
  SET status = 'DISPUTED', updated_at = now()
  WHERE id = p_job_id
    AND sender_id = v_me
    AND status IN ('PENDING_RATING', 'DELIVERED')
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    SELECT status::text INTO v_from FROM public.jobs WHERE id = p_job_id AND sender_id = v_me;
    RAISE EXCEPTION 'file_dispute: job % not disputable (status=%)', p_job_id, COALESCE(v_from, 'missing-or-not-sender')
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.disputes WHERE job_id = v_job.id AND status <> 'resolved') THEN
    INSERT INTO public.disputes (
      organization_id, job_id, opened_by, dispute_type, description, status, opened_at
    ) VALUES (
      v_job.organization_id, v_job.id, v_me, COALESCE(NULLIF(btrim(p_type), ''), 'Not specified'),
      COALESCE(p_description, ''), 'open', now()
    );
  END IF;

  v_theft := public.is_theft_like_dispute(p_type);

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'dispute_filed',
          jsonb_build_object('type', p_type, 'theft', v_theft));

  IF v_theft AND v_job.runner_id IS NOT NULL THEN
    INSERT INTO public.trust_events (organization_id, runner_id, job_id, type, description)
    VALUES
      (v_job.organization_id, v_job.runner_id, v_job.id, 'theft_escalation',
       format('Theft-like dispute "%s" on %s — escalated for investigation.', p_type, v_job.id)),
      (v_job.organization_id, v_job.runner_id, v_job.id, 'suspension',
       format('Runner suspended pending theft investigation on %s.', v_job.id));

    UPDATE public.users
    SET suspension_status = 'suspended',
        suspension_reason = format('Theft escalation: "%s" dispute', p_type),
        suspended_at = now(),
        updated_at = now()
    WHERE id = v_job.runner_id;
  END IF;

  RETURN v_job.id;
END;
$$;
