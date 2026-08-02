-- RushBuddy Phase 22 — solid FIR support package payload (emails, events, photos).
-- Org members may generate (ops handoff); event_type fir_exported.

CREATE OR REPLACE FUNCTION public.generate_fir_export(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_org uuid;
  v_job public.jobs%ROWTYPE;
  v_dispute public.disputes%ROWTYPE;
  v_payload jsonb;
  v_export_id uuid;
  v_code text;
  v_sender_email text;
  v_runner_email text;
  v_pickup_path text;
  v_dropoff_path text;
  v_events jsonb;
  v_allowed boolean;
BEGIN
  v_me := public.current_app_user_id();
  v_org := public.current_app_user_org_id();
  IF v_me IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'generate_fir_export: not authenticated';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id AND status = 'DISPUTED';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'generate_fir_export: job % not disputed', p_job_id
      USING ERRCODE = '55000';
  END IF;

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
    RAISE EXCEPTION 'generate_fir_export: not allowed for this job'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_dispute FROM public.disputes
  WHERE job_id = v_job.id
  ORDER BY opened_at DESC
  LIMIT 1;

  SELECT email INTO v_sender_email FROM public.users WHERE id = v_job.sender_id;
  IF v_job.runner_id IS NOT NULL THEN
    SELECT email INTO v_runner_email FROM public.users WHERE id = v_job.runner_id;
  END IF;

  IF v_job.pickup_photo_id IS NOT NULL THEN
    SELECT storage_path INTO v_pickup_path FROM public.photos WHERE id = v_job.pickup_photo_id;
  END IF;
  IF v_job.dropoff_photo_id IS NOT NULL THEN
    SELECT storage_path INTO v_dropoff_path FROM public.photos WHERE id = v_job.dropoff_photo_id;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'at', e.created_at,
      'type', e.event_type,
      'actor_user_id', e.actor_user_id,
      'payload', e.payload
    ) ORDER BY e.created_at
  ), '[]'::jsonb)
  INTO v_events
  FROM public.job_events e
  WHERE e.job_id = v_job.id;

  v_code := COALESCE(v_job.confirmation_code_hash, '');

  v_payload := jsonb_build_object(
    'job_id', v_job.id,
    'generated_at', now(),
    'disclaimer', 'RushBuddy campus support package for security / ops handoff. Not a legal First Information Report and not a police filing.',
    'sender_name', v_job.sender_name,
    'sender_hostel', v_job.sender_hostel,
    'sender_email', v_sender_email,
    'runner_id', COALESCE(v_job.runner_id::text, 'unknown'),
    'runner_name', COALESCE(v_job.runner_name, 'unknown'),
    'runner_hostel', v_job.runner_hostel,
    'runner_email', v_runner_email,
    'item_description', format('%s · %s · %s risk — %s', v_job.item_type, v_job.weight, v_job.risk, COALESCE(NULLIF(v_job.description, ''), 'No description')),
    'declared_value', v_job.declared_value,
    'pickup_location', v_job.pickup_location,
    'drop_location', v_job.drop_location,
    'receiver_phone', v_job.receiver_phone,
    'corridor_landmark', v_job.corridor_landmark,
    'dispute_type', v_dispute.dispute_type,
    'dispute_description', v_dispute.description,
    'confirmation_code', v_code,
    'timeline', jsonb_build_object(
      'created_at', v_job.created_at,
      'matched_at', v_job.matched_at,
      'pickup_confirmed_at', v_job.pickup_confirmed_at,
      'delivered_at', v_job.delivered_at,
      'disputed_at', v_dispute.opened_at
    ),
    'events', v_events,
    'pickup_photo_id', v_job.pickup_photo_id,
    'dropoff_photo_id', v_job.dropoff_photo_id,
    'pickup_photo_path', v_pickup_path,
    'dropoff_photo_path', v_dropoff_path
  );

  INSERT INTO public.fir_exports (
    organization_id, job_id, generated_by, generated_at, payload
  ) VALUES (
    v_job.organization_id, v_job.id, v_me, now(), v_payload
  )
  RETURNING id INTO v_export_id;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (
    v_job.organization_id, v_job.id, v_me, 'fir_exported',
    jsonb_build_object('fir_export_id', v_export_id)
  );

  RETURN v_export_id;
END;
$$;
