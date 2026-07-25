-- RushBuddy local seed (Phase 11)
-- Runs after migrations on `supabase db reset` / first `supabase start` (see config.toml [db.seed]).
-- VIT is one organization, not a product-wide hardcode.
-- No separate `locations` table in schema-v1: sample labels live in organizations.settings
-- (see docs/database/schema-v1.md — settings jsonb hostel list). Aligns with mock demo strings.

-- Stable id for local docs / scripts (do not change without updating setup notes).
-- 01000000-0000-4000-8000-000000000001 = vit-vellore

INSERT INTO public.organizations (
  id,
  slug,
  display_name,
  email_domains,
  status,
  settings,
  created_at,
  updated_at
)
VALUES (
  '01000000-0000-4000-8000-000000000001',
  'vit-vellore',
  'VIT Vellore',
  ARRAY['vitstudent.ac.in']::text[],
  'active',
  $json${
    "hostel_blocks": [
      {"label": "MH-A Block", "location_type": "mens_hostel"},
      {"label": "MH-B Block", "location_type": "mens_hostel"},
      {"label": "MH-C Block", "location_type": "mens_hostel"},
      {"label": "MH-D Block", "location_type": "mens_hostel"},
      {"label": "GH-A Block", "location_type": "womens_hostel"},
      {"label": "GH-B Block", "location_type": "womens_hostel"},
      {"label": "GH-C Block", "location_type": "womens_hostel"}
    ],
    "common_landmarks": [
      {"label": "SJT Lobby", "location_type": "general"},
      {"label": "SJT Ground Floor", "location_type": "general"},
      {"label": "MBA Hall Gate", "location_type": "general"},
      {"label": "Tech Tower", "location_type": "general"},
      {"label": "CALS Canteen", "location_type": "general"},
      {"label": "TT Hall Printer Shop", "location_type": "general"},
      {"label": "VIT Pharmacy, Main Gate", "location_type": "general"},
      {"label": "VIT Medical Centre", "location_type": "general"},
      {"label": "Admin Block", "location_type": "general"},
      {"label": "Library", "location_type": "general"},
      {"label": "Food Court", "location_type": "general"},
      {"label": "VIT Main Gate", "location_type": "general"}
    ]
  }$json$::jsonb,
  now(),
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email_domains = EXCLUDED.email_domains,
  status = EXCLUDED.status,
  settings = EXCLUDED.settings,
  updated_at = now();
