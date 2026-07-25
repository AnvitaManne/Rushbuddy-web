-- RushBuddy Phase 12 / Slice 12.2 — Auth profile trigger + minimal RLS
-- Creates public.users on auth.users insert; org resolve helper; membership RPC.
-- Profile fields (name, hostel_block, gender) filled by app after OTP verify.
-- No jobs / payments / trust RLS in this migration.

-- ---------------------------------------------------------------------------
-- Allow minimal profile rows from Auth trigger (app completes fields later)
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN hostel_block DROP NOT NULL,
  ALTER COLUMN gender DROP NOT NULL;

COMMENT ON COLUMN public.users.name IS
  'Set after OTP verify / profile completion; NULL until then.';
COMMENT ON COLUMN public.users.hostel_block IS
  'Set after OTP verify / profile completion; NULL until then.';
COMMENT ON COLUMN public.users.gender IS
  'Matching-only; set after OTP verify / profile completion; NULL until then.';

-- ---------------------------------------------------------------------------
-- Org resolution (email domain → organizations.email_domains)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_organization_id_from_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
  FROM public.organizations o
  WHERE o.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM unnest(o.email_domains) AS d(domain)
      WHERE lower(d.domain) = lower(split_part(trim(p_email), '@', 2))
        AND split_part(trim(p_email), '@', 2) <> ''
    )
  ORDER BY o.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_organization_id_from_email(text) IS
  'Returns active organization id whose email_domains contains the address domain (e.g. vit-vellore / vitstudent.ac.in).';

REVOKE ALL ON FUNCTION public.resolve_organization_id_from_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_organization_id_from_email(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auth → public.users (minimal row; verified on Auth identity create)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    auth_user_id,
    email,
    verified,
    verified_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    true,
    now()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'AFTER INSERT on auth.users: minimal public.users row (auth_user_id, email, verified). Profile fields updated by app.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Membership after profile completion (SECURITY DEFINER; no broad INSERT policy)
-- Respects organization_members_one_active_org_per_user partial unique index.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_organization_membership()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_org_id uuid;
  v_existing_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT *
  INTO v_user
  FROM public.users
  WHERE auth_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.users row missing for auth user';
  END IF;

  IF v_user.name IS NULL OR btrim(v_user.name) = ''
     OR v_user.hostel_block IS NULL OR btrim(v_user.hostel_block) = ''
     OR v_user.gender IS NULL THEN
    RAISE EXCEPTION 'profile incomplete: name, hostel_block, and gender are required';
  END IF;

  SELECT om.organization_id
  INTO v_existing_org_id
  FROM public.organization_members om
  WHERE om.user_id = v_user.id
    AND om.status = 'active'
  LIMIT 1;

  IF v_existing_org_id IS NOT NULL THEN
    RETURN v_existing_org_id;
  END IF;

  v_org_id := public.resolve_organization_id_from_email(v_user.email);
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'no active organization for email domain';
  END IF;

  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  VALUES (
    v_org_id,
    v_user.id,
    'member',
    'active'
  )
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET
    status = 'active',
    role = 'member',
    updated_at = now()
  RETURNING organization_id INTO v_org_id;

  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_organization_membership() IS
  'After profile fields are set: insert active organization_members (member) for email-resolved org. No-op if already active member.';

REVOKE ALL ON FUNCTION public.ensure_organization_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_organization_membership() TO authenticated;

-- Optional single-call path for app: update profile then ensure membership
CREATE OR REPLACE FUNCTION public.complete_user_profile(
  p_name text,
  p_hostel_block text,
  p_gender public.user_gender
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = ''
     OR p_hostel_block IS NULL OR btrim(p_hostel_block) = ''
     OR p_gender IS NULL THEN
    RAISE EXCEPTION 'name, hostel_block, and gender are required';
  END IF;

  UPDATE public.users
  SET
    name = btrim(p_name),
    hostel_block = btrim(p_hostel_block),
    gender = p_gender,
    updated_at = now()
  WHERE auth_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'public.users row missing for auth user';
  END IF;

  v_org_id := public.ensure_organization_membership();
  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION public.complete_user_profile(text, text, public.user_gender) IS
  'App RPC after OTP: set name/hostel_block/gender on own users row, then ensure organization_members.';

REVOKE ALL ON FUNCTION public.complete_user_profile(text, text, public.user_gender) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_user_profile(text, text, public.user_gender) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS (users, organizations, organization_members only)
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- users: own row only
CREATE POLICY users_select_own
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY users_update_own
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- organizations: members of that org
CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      INNER JOIN public.users u ON u.id = om.user_id
      WHERE om.organization_id = organizations.id
        AND om.status = 'active'
        AND u.auth_user_id = auth.uid()
    )
  );

-- organization_members: own membership rows
CREATE POLICY organization_members_select_own
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = organization_members.user_id
        AND u.auth_user_id = auth.uid()
    )
  );

-- No anon policies. Membership INSERT is via ensure_organization_membership /
-- complete_user_profile (SECURITY DEFINER). Jobs/payments/trust remain without RLS.
