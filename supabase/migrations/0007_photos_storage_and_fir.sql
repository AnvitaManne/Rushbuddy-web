-- RushBuddy Phase 16 / Slice 16.2 — job photos (Storage) + FIR export persistence.
-- Private bucket job-photos; register_job_photo links photos onto jobs; generate_fir_export
-- stores the support package so it survives reload and syncs across accounts.

-- ---------------------------------------------------------------------------
-- Storage bucket (private)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {organization_id}/{job_id}/{kind}/{filename}
-- Allow authenticated users to upload/read objects whose first path segment is their org id.
CREATE POLICY job_photos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = public.current_app_user_org_id()::text
  );

CREATE POLICY job_photos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = public.current_app_user_org_id()::text
  );

CREATE POLICY job_photos_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = public.current_app_user_org_id()::text
  );

CREATE POLICY job_photos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = public.current_app_user_org_id()::text
  );

-- ---------------------------------------------------------------------------
-- RLS on photos / fir_exports (org-member read; writes via RPCs)
-- ---------------------------------------------------------------------------
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fir_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY photos_select_org_member ON public.photos
  FOR SELECT TO authenticated
  USING (organization_id = public.current_app_user_org_id());

CREATE POLICY fir_exports_select_org_member ON public.fir_exports
  FOR SELECT TO authenticated
  USING (organization_id = public.current_app_user_org_id());

GRANT SELECT ON public.photos TO authenticated;
GRANT SELECT ON public.fir_exports TO authenticated;

-- ---------------------------------------------------------------------------
-- Runner: register a photo already uploaded to Storage
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_job_photo(
  p_job_id uuid,
  p_kind public.photo_kind,
  p_storage_path text,
  p_geotag jsonb DEFAULT NULL
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
  v_photo_id uuid;
BEGIN
  v_me := public.current_app_user_id();
  v_org := public.current_app_user_org_id();
  IF v_me IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'register_job_photo: not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'register_job_photo: storage_path required' USING ERRCODE = '22023';
  END IF;

  -- Path must start with this org id (defense in depth vs Storage policy).
  IF split_part(p_storage_path, '/', 1) <> v_org::text THEN
    RAISE EXCEPTION 'register_job_photo: path org mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_job FROM public.jobs
  WHERE id = p_job_id AND organization_id = v_org AND runner_id = v_me
    AND status IN ('MATCHED', 'IN_TRANSIT');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'register_job_photo: job % not active for this runner', p_job_id
      USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.photos (
    organization_id, job_id, kind, storage_path, captured_by, captured_at, geotag
  ) VALUES (
    v_org, v_job.id, p_kind, btrim(p_storage_path), v_me, now(), p_geotag
  )
  RETURNING id INTO v_photo_id;

  IF p_kind = 'pickup' THEN
    UPDATE public.jobs SET pickup_photo_id = v_photo_id, updated_at = now() WHERE id = v_job.id;
  ELSIF p_kind = 'dropoff_secure' THEN
    UPDATE public.jobs SET dropoff_photo_id = v_photo_id, updated_at = now() WHERE id = v_job.id;
  END IF;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_org, v_job.id, v_me, 'status_changed',
          jsonb_build_object('photo', p_kind, 'photo_id', v_photo_id));

  RETURN v_photo_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Sender: generate + persist an FIR support package for a disputed job
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_fir_export(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_job public.jobs%ROWTYPE;
  v_dispute public.disputes%ROWTYPE;
  v_payload jsonb;
  v_export_id uuid;
  v_code text;
BEGIN
  v_me := public.current_app_user_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'generate_fir_export: not authenticated'; END IF;

  SELECT * INTO v_job FROM public.jobs
  WHERE id = p_job_id AND sender_id = v_me AND status = 'DISPUTED';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'generate_fir_export: job % not disputed by this sender', p_job_id
      USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_dispute FROM public.disputes
  WHERE job_id = v_job.id
  ORDER BY opened_at DESC
  LIMIT 1;

  -- Pilot stores plaintext in confirmation_code_hash; never include in public UI elsewhere.
  v_code := COALESCE(v_job.confirmation_code_hash, '');

  v_payload := jsonb_build_object(
    'job_id', v_job.id,
    'generated_at', now(),
    'sender_name', v_job.sender_name,
    'sender_hostel', v_job.sender_hostel,
    'runner_id', v_job.runner_id,
    'runner_name', v_job.runner_name,
    'item_description', format('%s · %s · %s risk — %s', v_job.item_type, v_job.weight, v_job.risk, COALESCE(NULLIF(v_job.description, ''), 'No description')),
    'declared_value', v_job.declared_value,
    'pickup_location', v_job.pickup_location,
    'drop_location', v_job.drop_location,
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
    'pickup_photo_id', v_job.pickup_photo_id,
    'dropoff_photo_id', v_job.dropoff_photo_id
  );

  INSERT INTO public.fir_exports (
    organization_id, job_id, generated_by, generated_at, payload
  ) VALUES (
    v_job.organization_id, v_job.id, v_me, now(), v_payload
  )
  RETURNING id INTO v_export_id;

  INSERT INTO public.job_events (organization_id, job_id, actor_user_id, event_type, payload)
  VALUES (v_job.organization_id, v_job.id, v_me, 'status_changed',
          jsonb_build_object('fir_export_id', v_export_id));

  RETURN v_export_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'register_job_photo(uuid, public.photo_kind, text, jsonb)',
    'generate_fir_export(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated;', fn);
  END LOOP;
END;
$$;
