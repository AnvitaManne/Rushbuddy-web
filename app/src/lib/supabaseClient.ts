/**
 * Browser Supabase client (Phase 12 / Slice 12.3).
 * Used by future auth/org adapters — not wired into pages yet.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const dataAdapter = (import.meta.env.VITE_DATA_ADAPTER as string | undefined) ?? 'mock';

function missingEnvMessage(): string {
  return (
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Copy app/.env.example → app/.env.local and paste values from `npx supabase status` (repo root). ' +
    'Required when VITE_DATA_ADAPTER=supabase.'
  );
}

/**
 * Shared browser client when `VITE_DATA_ADAPTER=supabase`.
 * Throws if URL/anon key are missing in supabase mode.
 * Returns null in mock mode (default) so the app can run without env.
 */
export const supabase: SupabaseClient | null = (() => {
  if (dataAdapter !== 'supabase') {
    return null;
  }
  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error(missingEnvMessage());
  }
  return createClient(url.trim(), anonKey.trim());
})();
