-- RushBuddy — ops/dev unsuspend so pilot accounts can clear leftover suspensions.
-- Org members may lift suspension (and optionally reset no-show strikes) for a runner
-- in their organization.

CREATE OR REPLACE FUNCTION public.ops_unsuspend_runner(
  p_runner_id uuid,
  p_reset_strikes boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_org uuid;
  v_runner public.users%ROWTYPE;
BEGIN
  v_me := public.current_app_user_id();
  v_org := public.current_app_user_org_id();
  IF v_me IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'ops_unsuspend_runner: not authenticated';
  END IF;

  SELECT * INTO v_runner FROM public.users WHERE id = p_runner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ops_unsuspend_runner: runner % not found', p_runner_id
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org
      AND om.user_id = v_me
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ops_unsuspend_runner: not an active org member'
      USING ERRCODE = '42501';
  END IF;

  -- Runner must share the caller's org (same pilot tenant).
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org
      AND om.user_id = p_runner_id
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'ops_unsuspend_runner: runner not in your org'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.users
  SET suspension_status = 'active',
      suspension_reason = NULL,
      suspended_at = NULL,
      no_show_count = CASE WHEN p_reset_strikes THEN 0 ELSE no_show_count END,
      updated_at = now()
  WHERE id = p_runner_id;

  INSERT INTO public.trust_events (organization_id, runner_id, job_id, type, description)
  VALUES (
    v_org,
    p_runner_id,
    NULL,
    'unsuspension',
    CASE
      WHEN p_reset_strikes THEN 'Ops cleared suspension and reset no-show strikes.'
      ELSE 'Ops cleared suspension.'
    END
  );

  RETURN p_runner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ops_unsuspend_runner(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ops_unsuspend_runner(uuid, boolean) TO authenticated;
