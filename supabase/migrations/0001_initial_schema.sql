-- RushBuddy schema v1 (Phase 11)
-- Source of truth: docs/database/schema-v1.md
-- No RLS policies, Auth triggers, or Storage buckets in this migration.

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------

CREATE TYPE public.job_status AS ENUM (
  'OPEN',
  'MATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'CLOSED',
  'DISPUTED',
  'ISSUE_REPORTED',
  'PENDING_RATING'
);

CREATE TYPE public.user_gender AS ENUM (
  'male',
  'female',
  'prefer_not_to_say'
);

CREATE TYPE public.suspension_status AS ENUM (
  'active',
  'suspended'
);

CREATE TYPE public.job_type AS ENUM (
  'campus_immediate',
  'campus_scheduled',
  'intercity'
);

CREATE TYPE public.handoff_mode AS ENUM (
  'mode_1_direct_p2p',
  'mode_2_landmark'
);

CREATE TYPE public.location_type AS ENUM (
  'general',
  'mens_hostel',
  'womens_hostel'
);

CREATE TYPE public.purchase_type AS ENUM (
  'carry_only'
);

CREATE TYPE public.item_type AS ENUM (
  'Document',
  'Food',
  'Medicine',
  'Object'
);

CREATE TYPE public.weight_tier AS ENUM (
  'Light',
  'Medium',
  'Heavy'
);

CREATE TYPE public.risk_level AS ENUM (
  'Low',
  'Fragile',
  'Valuable'
);

CREATE TYPE public.payment_method AS ENUM (
  'upi',
  'phonepe',
  'cash'
);

CREATE TYPE public.payment_status AS ENUM (
  'unpaid',
  'paid',
  'disputed'
);

CREATE TYPE public.runner_payout_status AS ENUM (
  'pending',
  'earned',
  'withheld',
  'paid'
);

CREATE TYPE public.org_status AS ENUM (
  'active',
  'paused'
);

CREATE TYPE public.member_role AS ENUM (
  'member',
  'ops',
  'admin'
);

CREATE TYPE public.member_status AS ENUM (
  'active',
  'removed'
);

CREATE TYPE public.dispute_status AS ENUM (
  'open',
  'under_review',
  'resolved'
);

CREATE TYPE public.dispute_resolution AS ENUM (
  'runner_at_fault',
  'sender_error',
  'unclear'
);

CREATE TYPE public.photo_kind AS ENUM (
  'pickup',
  'dropoff_secure',
  'other'
);

CREATE TYPE public.no_answer_resolution AS ENUM (
  'secure_drop',
  'hold_for_ops'
);

CREATE TYPE public.trust_event_type AS ENUM (
  'no_show',
  'theft_escalation',
  'dispute_filed',
  'suspension',
  'unsuspension',
  'ops_note_added'
);

CREATE TYPE public.job_event_type AS ENUM (
  'status_changed',
  'pickup_acknowledged',
  'handoff_code_attempt',
  'handoff_code_success',
  'handoff_code_locked',
  'no_answer_started',
  'contact_attempt',
  'sender_responded',
  'secure_drop',
  'hold_for_ops',
  'payment_recorded',
  'dispute_filed',
  'dispute_resolved',
  're_pooled',
  'issue_reported',
  'rating_recorded',
  'ops_note',
  'fir_exported'
);

-- ---------------------------------------------------------------------------
-- Tables (FK-safe order; jobs ↔ photos circular FKs resolved after both exist)
-- ---------------------------------------------------------------------------

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  display_name text NOT NULL,
  email_domains text[] NOT NULL DEFAULT '{}',
  status public.org_status NOT NULL DEFAULT 'active',
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_unique UNIQUE (slug)
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  email text NOT NULL,
  name text NOT NULL,
  hostel_block text NOT NULL,
  gender public.user_gender NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  rating numeric(3, 2) NOT NULL DEFAULT 0,
  total_deliveries integer NOT NULL DEFAULT 0,
  total_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  weekly_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  acceptance_rate numeric(5, 2) NOT NULL DEFAULT 0,
  trust_score numeric(5, 2) NOT NULL DEFAULT 0,
  no_show_count integer NOT NULL DEFAULT 0,
  suspension_status public.suspension_status NOT NULL DEFAULT 'active',
  suspension_reason text,
  suspended_at timestamptz,
  streak integer NOT NULL DEFAULT 0,
  best_week_earnings numeric(12, 2) NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  user_id uuid NOT NULL REFERENCES public.users (id),
  role public.member_role NOT NULL DEFAULT 'member',
  status public.member_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_org_user_unique UNIQUE (organization_id, user_id)
);

-- V1: one active organization membership per user
CREATE UNIQUE INDEX organization_members_one_active_org_per_user
  ON public.organization_members (user_id)
  WHERE status = 'active';

-- Photo FKs added after public.photos exists
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  status public.job_status NOT NULL,
  sender_id uuid NOT NULL REFERENCES public.users (id),
  runner_id uuid REFERENCES public.users (id),
  job_type public.job_type NOT NULL,
  handoff_mode public.handoff_mode NOT NULL,
  item_type public.item_type NOT NULL,
  weight public.weight_tier NOT NULL,
  risk public.risk_level NOT NULL,
  purchase_type public.purchase_type NOT NULL DEFAULT 'carry_only',
  pickup_location text NOT NULL,
  drop_location text NOT NULL,
  pickup_location_type public.location_type NOT NULL,
  drop_location_type public.location_type NOT NULL,
  description text NOT NULL DEFAULT '',
  price_floor numeric(12, 2) NOT NULL,
  posted_price numeric(12, 2) NOT NULL,
  agreed_price numeric(12, 2),
  confirmation_code_hash text NOT NULL,
  corridor_landmark text,
  receiver_phone text,
  scheduled_window_start timestamptz,
  scheduled_window_end timestamptz,
  travel_date date,
  expires_at timestamptz NOT NULL,
  condition_acknowledged boolean NOT NULL DEFAULT false,
  no_answer_at timestamptz,
  ops_notified boolean NOT NULL DEFAULT false,
  no_answer_contact_attempts integer NOT NULL DEFAULT 0,
  sender_response_at timestamptz,
  no_answer_resolution public.no_answer_resolution,
  dropoff_secure_location text,
  dropoff_geotag jsonb,
  runner_payout_status public.runner_payout_status,
  dispute_window_ends_at timestamptz,
  declared_value numeric(12, 2),
  matched_at timestamptz,
  pickup_confirmed_at timestamptz,
  delivered_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_posted_price_gte_floor CHECK (posted_price >= price_floor),
  CONSTRAINT jobs_no_mixed_gendered_hostels CHECK (
    NOT (
      (
        pickup_location_type = 'mens_hostel'
        AND drop_location_type = 'womens_hostel'
      )
      OR (
        pickup_location_type = 'womens_hostel'
        AND drop_location_type = 'mens_hostel'
      )
    )
  ),
  CONSTRAINT jobs_scheduled_window_order CHECK (
    scheduled_window_start IS NULL
    OR scheduled_window_end IS NULL
    OR scheduled_window_end > scheduled_window_start
  ),
  CONSTRAINT jobs_declared_value_cap CHECK (
    declared_value IS NULL OR declared_value <= 2000
  )
);

CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.jobs (id),
  kind public.photo_kind NOT NULL,
  storage_path text NOT NULL,
  captured_by uuid NOT NULL REFERENCES public.users (id),
  captured_at timestamptz NOT NULL,
  geotag jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs
  ADD COLUMN pickup_photo_id uuid REFERENCES public.photos (id),
  ADD COLUMN dropoff_photo_id uuid REFERENCES public.photos (id);

CREATE TABLE public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.jobs (id),
  actor_user_id uuid REFERENCES public.users (id),
  event_type public.job_event_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.jobs (id),
  payer_id uuid NOT NULL REFERENCES public.users (id),
  payee_id uuid NOT NULL REFERENCES public.users (id),
  base_amount numeric(12, 2) NOT NULL,
  tip_amount numeric(12, 2) NOT NULL DEFAULT 0,
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL,
  provider_ref text,
  recorded_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_job_id_unique UNIQUE (job_id)
);

CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.jobs (id),
  rater_id uuid NOT NULL REFERENCES public.users (id),
  ratee_id uuid NOT NULL REFERENCES public.users (id),
  stars integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ratings_job_id_unique UNIQUE (job_id),
  CONSTRAINT ratings_stars_range CHECK (stars >= 1 AND stars <= 5)
);

CREATE TABLE public.trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  runner_id uuid NOT NULL REFERENCES public.users (id),
  job_id uuid REFERENCES public.jobs (id),
  type public.trust_event_type NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.jobs (id),
  opened_by uuid NOT NULL REFERENCES public.users (id),
  dispute_type text NOT NULL,
  description text NOT NULL,
  status public.dispute_status NOT NULL,
  resolution_outcome public.dispute_resolution,
  resolution_notes text,
  resolved_by uuid REFERENCES public.users (id),
  opened_at timestamptz NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- At most one non-resolved dispute case file per job (v1)
CREATE UNIQUE INDEX disputes_one_open_per_job
  ON public.disputes (job_id)
  WHERE status <> 'resolved';

CREATE TABLE public.fir_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.jobs (id),
  generated_by uuid REFERENCES public.users (id),
  generated_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes (docs/database/schema-v1.md §4)
-- ---------------------------------------------------------------------------

CREATE INDEX jobs_org_status_idx
  ON public.jobs (organization_id, status);

CREATE INDEX jobs_org_sender_status_idx
  ON public.jobs (organization_id, sender_id, status);

CREATE INDEX jobs_org_runner_status_idx
  ON public.jobs (organization_id, runner_id, status);

CREATE INDEX jobs_org_open_expires_at_idx
  ON public.jobs (organization_id, expires_at)
  WHERE status = 'OPEN';

CREATE INDEX job_events_job_created_at_idx
  ON public.job_events (job_id, created_at);

CREATE INDEX trust_events_runner_created_at_idx
  ON public.trust_events (runner_id, created_at);

CREATE INDEX organization_members_user_id_idx
  ON public.organization_members (user_id);

CREATE INDEX photos_job_kind_idx
  ON public.photos (job_id, kind);

CREATE INDEX disputes_org_status_idx
  ON public.disputes (organization_id, status);

COMMENT ON TABLE public.job_events IS
  'Append-only job timeline. Application paths must not UPDATE or DELETE rows in v1.';

COMMENT ON COLUMN public.users.gender IS
  'Matching-only. Must not be exposed on profiles, runner cards, or public feeds.';

COMMENT ON COLUMN public.jobs.confirmation_code_hash IS
  'Store a hash in production; never return raw codes on list/feed queries.';
