-- RushBuddy Phase 15 / Slice 15.2 — payments, ratings, disputes, trust.
-- Persists the closing + safety layer so it syncs across accounts. All writes go
-- through SECURITY DEFINER RPCs (owner = postgres) so they bypass RLS; clients only
-- get SELECT (org-scoped) on the underlying tables.

-- ---------------------------------------------------------------------------
-- RLS: org members can read; no direct writes (RPCs own inserts/updates)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_org_member ON public.payments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_app_user_org_id());

CREATE POLICY ratings_select_org_member ON public.ratings
  FOR SELECT TO authenticated
  USING (organization_id = public.current_app_user_org_id());

CREATE POLICY disputes_select_org_member ON public.disputes
  FOR SELECT TO authenticated
  USING (organization_id = public.current_app_user_org_id());

CREATE POLICY trust_events_select_org_member ON public.trust_events
  FOR SELECT TO authenticated
  USING (organization_id = public.current_app_user_org_id());

GRANT SELECT ON public.payments     TO authenticated;
GRANT SELECT ON public.ratings      TO authenticated;
GRANT SELECT ON public.disputes     TO authenticated;
GRANT SELECT ON public.trust_events TO authenticated;

-- ---------------------------------------------------------------------------
-- Sender: record payment (upsert one row per job)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_payment(
  p_job_id uuid,
  p_method public.payment_method,
  p_tip numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
  v_base numeric;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'record_payment: not authenticated'; END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id AND sender_id = v_me;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_payment: job % not owned by sender', p_job_id USING ERRCODE = '55000';
  END IF;
  IF v_job.runner_id IS NULL THEN
    RAISE EXCEPTION 'record_payment: job % has no runner', p_job_id USING ERRCODE = '55000';
  END IF;

  v_base := COALESCE(v_job.agreed_price, v_job.posted_price, 0);

  INSERT INTO public.payments (
    organization_id, job_id, payer_id, payee_id, base_amount, tip_amount,
    method, status, recorded_at
  ) VALUES (
    v_job.organization_id, v_job.id, v_me, v_job.runner_id, v_base, COALESCE(p_tip, 0),
    p_method, 'paid', now()
  )
  ON CONFLICT (job_id) DO UPDATE
    SET method = EXCLUDED.method,
        tip_amount = EXCLUDED.tip_amount,
        status = 'paid',
        recorded_at = now();

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'payment_recorded',
          jsonb_build_object('method', p_method, 'tip', COALESCE(p_tip, 0)));

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sender: submit rating (upsert one per job) + refresh runner aggregate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_rating(p_job_id uuid, p_stars integer)
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
  IF v_me IS NULL THEN RAISE EXCEPTION 'submit_rating: not authenticated'; END IF;
  IF p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'submit_rating: stars must be 1..5' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id AND sender_id = v_me;
  IF NOT FOUND OR v_job.runner_id IS NULL THEN
    RAISE EXCEPTION 'submit_rating: job % not ratable by sender', p_job_id USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.ratings (organization_id, job_id, rater_id, ratee_id, stars)
  VALUES (v_job.organization_id, v_job.id, v_me, v_job.runner_id, p_stars)
  ON CONFLICT (job_id) DO UPDATE SET stars = EXCLUDED.stars;

  UPDATE public.users
  SET rating = COALESCE((SELECT round(avg(stars)::numeric, 2) FROM public.ratings WHERE ratee_id = v_job.runner_id), 0),
      updated_at = now()
  WHERE id = v_job.runner_id;

  RETURN v_job.id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Theft-like classifier (mirrors domain isTheftLikeDispute)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_theft_like_dispute(p_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(p_type)) = 'not delivered'
      OR lower(p_type) LIKE '%theft%'
      OR lower(p_type) LIKE '%stolen%'
      OR lower(p_type) LIKE '%misappropriat%';
$$;

-- ---------------------------------------------------------------------------
-- Sender: file dispute (PENDING_RATING → DISPUTED); theft-like → suspend runner
-- ---------------------------------------------------------------------------
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
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'file_dispute: not authenticated'; END IF;

  UPDATE public.jobs
  SET status = 'DISPUTED', updated_at = now()
  WHERE id = p_job_id AND sender_id = v_me AND status = 'PENDING_RATING'
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'file_dispute: job % not disputable by sender', p_job_id USING ERRCODE = '55000';
  END IF;

  -- One open case file per job (partial unique index disputes_one_open_per_job).
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

-- ---------------------------------------------------------------------------
-- Sender/ops: resolve dispute (DISPUTED → CLOSED) + payout + optional unsuspend
-- ---------------------------------------------------------------------------
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
  v_job public.jobs%ROWTYPE;
  v_payout public.runner_payout_status;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'resolve_dispute: not authenticated'; END IF;

  v_payout := CASE WHEN p_outcome = 'runner_at_fault' THEN 'withheld' ELSE 'earned' END;

  UPDATE public.jobs
  SET status = 'CLOSED', closed_at = now(), runner_payout_status = v_payout, updated_at = now()
  WHERE id = p_job_id AND sender_id = v_me AND status IN ('DISPUTED', 'PENDING_RATING')
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resolve_dispute: job % not resolvable by sender', p_job_id USING ERRCODE = '55000';
  END IF;

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
          jsonb_build_object('to', 'CLOSED', 'outcome', p_outcome));

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
    'record_payment(uuid, public.payment_method, numeric)',
    'submit_rating(uuid, integer)',
    'file_dispute(uuid, text, text)',
    'resolve_dispute(uuid, public.dispute_resolution, boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated;', fn);
  END LOOP;
END;
$$;
