/**
 * Supabase OrganizationService (Phase 12 / Slice 12.4).
 * Reads `organizations` / `organization_members` under RLS.
 * Domain allowlist before membership uses SECURITY DEFINER RPC
 * `resolve_organization_id_from_email` (anon-safe).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrganizationService } from '../types';
import { emailDomainAllowed } from './orgDomain';
import {
  mapOrganizationMemberRow,
  mapOrganizationRow,
  ORGANIZATION_COLUMNS,
  ORGANIZATION_MEMBER_COLUMNS,
  type DbOrganizationMemberRow,
  type DbOrganizationRow,
} from './mappers';

export function createSupabaseOrganizationService(client: SupabaseClient): OrganizationService {
  return {
    async getById(id) {
      const { data, error } = await client
        .from('organizations')
        .select(ORGANIZATION_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`OrganizationService.getById: ${error.message}`);
      return mapOrganizationRow(data as DbOrganizationRow | null);
    },

    async getBySlug(slug) {
      const { data, error } = await client
        .from('organizations')
        .select(ORGANIZATION_COLUMNS)
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw new Error(`OrganizationService.getBySlug: ${error.message}`);
      return mapOrganizationRow(data as DbOrganizationRow | null);
    },

    async listOrganizations() {
      const { data, error } = await client
        .from('organizations')
        .select(ORGANIZATION_COLUMNS)
        .order('created_at', { ascending: true });
      if (error) throw new Error(`OrganizationService.listOrganizations: ${error.message}`);
      const rows = (data ?? []) as DbOrganizationRow[];
      return rows.map((r) => mapOrganizationRow(r)).filter((o): o is NonNullable<typeof o> => o != null);
    },

    async getMembership(userId) {
      const { data, error } = await client
        .from('organization_members')
        .select(ORGANIZATION_MEMBER_COLUMNS)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw new Error(`OrganizationService.getMembership: ${error.message}`);
      return mapOrganizationMemberRow(data as DbOrganizationMemberRow | null);
    },

    async isEmailAllowed(organizationId, email) {
      // Prefer in-memory check when the org row is readable (member session).
      const { data: orgRow, error: orgError } = await client
        .from('organizations')
        .select('id, email_domains')
        .eq('id', organizationId)
        .maybeSingle();

      if (!orgError && orgRow) {
        const domains = (orgRow as { email_domains?: string[] | null }).email_domains ?? [];
        return emailDomainAllowed(email, domains);
      }

      // Pre-membership / anon: SECURITY DEFINER resolve (no broad org SELECT).
      const { data: resolvedId, error } = await client.rpc('resolve_organization_id_from_email', {
        p_email: email,
      });
      if (error) throw new Error(`OrganizationService.isEmailAllowed: ${error.message}`);
      return resolvedId === organizationId;
    },
  };
}

/** Resolve active org id for an email domain (RPC; works before membership). */
export async function resolveOrganizationIdFromEmail(
  client: SupabaseClient,
  email: string,
): Promise<string | null> {
  const { data, error } = await client.rpc('resolve_organization_id_from_email', {
    p_email: email,
  });
  if (error) throw new Error(`resolveOrganizationIdFromEmail: ${error.message}`);
  return (data as string | null) ?? null;
}
