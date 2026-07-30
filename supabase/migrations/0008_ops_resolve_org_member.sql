-- RushBuddy Phase 18 / Slice 18.2 — allow org members (pilot ops) to resolve disputes.
-- Previously only the job sender could call resolve_dispute. Founders sharing an org
-- need to resolve from /ops without impersonating the sender.

CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_job_id uuid,
  p_outcome public.dispute_resolution,
  p_unsuspend boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_org uuid;
  v_job public.jobs%ROWTYPE;
  v_payout public.runner_payout_status;
  v_allowed boolean;
BEGIN
  v_me := public.current_app_user_id();
  v_org := public.current_app_user_org_id();
  IF v_me IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'resolve_dispute: not authenticated';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'resolve_dispute: job % not found', p_job_id USING ERRCODE = '55000';
  END IF;

  -- Sender OR any active member of the job's organization (pilot ops).
  v_allowed := (
    v_job.sender_id = v_me
    OR (
      v_job.organization_id = v_org
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_job.organization_id
          AND om.user_id = v_me
          AND om.status = 'active'
      )
    )
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'resolve_dispute: not allowed for this job' USING ERRCODE = '42501';
  END IF;

  IF v_job.status NOT IN ('DISPUTED', 'PENDING_RATING') THEN
    RAISE EXCEPTION 'resolve_dispute: job % not resolvable (status %)', p_job_id, v_job.status
      USING ERRCODE = '55000';
  END IF;

  v_payout := CASE WHEN p_outcome = 'runner_at_fault' THEN 'withheld' ELSE 'earned' END;

  UPDATE public.jobs
  SET status = 'CLOSED', closed_at = now(), runner_payout_status = v_payout, updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  UPDATE public.disputes
  SET status = 'resolved', resolution_outcome = p_outcome, resolved_by = v_me,
      resolved_at = now(), updated_at = now()
  WHERE job_id = v_job.id AND status <> 'resolved';

  IF v_job.runner_id IS NOT NULL THEN
    INSERT INTO public.trust_events (organization_id, runner_id, job_id, type, description)
    VALUES (v_job.organization_id, v_job.runner_id, v_job.id, 'ops_note_added',
            format('Dispute on %s resolved as "%s" · payout=%s', v_job.id, p_outcome, v_payout));

    IF p_outcome = 'runner_at_fault' THEN
      UPDATE public.users
      SET suspension_status = 'suspended',
          suspension_reason = COALESCE(suspension_reason, 'Ops: runner at fault on dispute resolution'),
          suspended_at = COALESCE(suspended_at, now()),
          updated_at = now()
      WHERE id = v_job.runner_id AND suspension_status <> 'suspended';
    END IF;

    IF p_unsuspend THEN
      UPDATE public.users
      SET suspension_status = 'active', suspension_reason = NULL, suspended_at = NULL, updated_at = now()
      WHERE id = v_job.runner_id;
      INSERT INTO public.trust_events (organization_id, runner_id, job_id, type, description)
      VALUES (v_job.organization_id, v_job.runner_id, v_job.id, 'unsuspension',
              format('Ops unsuspended runner after resolving %s', v_job.id));
    END IF;
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'status_changed',
          jsonb_build_object('to', 'CLOSED', 'outcome', p_outcome, 'via', 'ops'));

  RETURN v_job.id;
END;
$$;

-- Also allow org members to close hold-for-ops / disputed jobs via close_job.
CREATE OR REPLACE FUNCTION public.close_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_org uuid;
  v_job public.jobs%ROWTYPE;
  v_allowed boolean;
BEGIN
  v_me := public.current_app_user_id();
  v_org := public.current_app_user_org_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'close_job: not authenticated'; END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'close_job: job % not found', p_job_id USING ERRCODE = '55000';
  END IF;

  v_allowed := (
    v_job.sender_id = v_me
    OR (
      v_org IS NOT NULL
      AND v_job.organization_id = v_org
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_job.organization_id
          AND om.user_id = v_me
          AND om.status = 'active'
      )
    )
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'close_job: not closable by this user' USING ERRCODE = '42501';
  END IF;

  IF v_job.status NOT IN ('PENDING_RATING', 'DELIVERED', 'ISSUE_REPORTED', 'DISPUTED') THEN
    RAISE EXCEPTION 'close_job: job % not in a closable status', p_job_id USING ERRCODE = '55000';
  END IF;

  UPDATE public.jobs
  SET status = 'CLOSED', closed_at = now(), updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'status_changed', jsonb_build_object('to', 'CLOSED', 'via', 'ops_or_sender'));

  RETURN v_job.id;
END;
$$;
