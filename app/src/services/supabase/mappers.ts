/**
 * DB row ↔ domain mappers (Phase 12 / Slice 12.4).
 * Gender is matching-only — never include it in public/list column sets.
 */

import type { User } from '@/domain/types';
import type { SuspensionStatus, UserGender, UserRole } from '@/domain/enums';
import type { Organization, OrganizationMember } from '../types';

/** Own-session profile (includes gender for matching). */
export const USER_OWN_COLUMNS =
  'id, auth_user_id, email, name, hostel_block, gender, verified, verified_at, rating, total_deliveries, total_earnings, weekly_earnings, acceptance_rate, trust_score, no_show_count, suspension_status, streak, best_week_earnings, joined_at' as const;

/**
 * Public / card projections — intentionally omit `gender`.
 * Use for feeds, runner cards, and any non-self query.
 */
export const USER_PUBLIC_COLUMNS =
  'id, email, name, hostel_block, verified, rating, total_deliveries, trust_score, suspension_status, joined_at' as const;

export const ORGANIZATION_COLUMNS =
  'id, slug, display_name, email_domains, status, settings' as const;

export const ORGANIZATION_MEMBER_COLUMNS =
  'organization_id, user_id, role, status' as const;

export interface DbUserRow {
  id: string;
  auth_user_id?: string | null;
  email: string;
  name: string | null;
  hostel_block: string | null;
  gender: UserGender | null;
  verified: boolean;
  verified_at?: string | null;
  rating?: number | string | null;
  total_deliveries?: number | null;
  total_earnings?: number | string | null;
  weekly_earnings?: number | string | null;
  acceptance_rate?: number | string | null;
  trust_score?: number | string | null;
  no_show_count?: number | null;
  suspension_status?: SuspensionStatus | null;
  streak?: number | null;
  best_week_earnings?: number | string | null;
  joined_at?: string | null;
}

export interface DbOrganizationRow {
  id: string;
  slug: string;
  display_name: string;
  email_domains: string[] | null;
  status: 'active' | 'paused' | string;
  settings?: Record<string, unknown> | null;
}

export interface DbOrganizationMemberRow {
  organization_id: string;
  user_id: string;
  role: 'member' | 'ops' | 'admin' | string;
  status: 'active' | 'removed' | string;
}

function num(value: number | string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** True when name, hostel_block, and gender are present (post-OTP profile). */
export function isProfileComplete(row: Pick<DbUserRow, 'name' | 'hostel_block' | 'gender'>): boolean {
  return (
    typeof row.name === 'string' &&
    row.name.trim() !== '' &&
    typeof row.hostel_block === 'string' &&
    row.hostel_block.trim() !== '' &&
    row.gender != null
  );
}

/**
 * Map own `public.users` row → domain `User`.
 * Returns null if profile fields are still incomplete (Auth trigger minimal row).
 */
export function mapUserRow(row: DbUserRow | null | undefined, currentRole: UserRole = null): User | null {
  if (!row || !isProfileComplete(row)) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name!.trim(),
    hostel_block: row.hostel_block!.trim(),
    verified: !!row.verified,
    current_role: currentRole,
    rating: num(row.rating),
    total_deliveries: num(row.total_deliveries),
    total_earnings: num(row.total_earnings),
    weekly_earnings: num(row.weekly_earnings),
    acceptance_rate: num(row.acceptance_rate),
    trust_score: num(row.trust_score),
    joined_at: row.joined_at ?? new Date().toISOString(),
    gender: row.gender!,
    no_show_count: num(row.no_show_count),
    suspension_status: row.suspension_status ?? 'active',
    streak: num(row.streak),
    best_week_earnings: num(row.best_week_earnings),
  };
}

export function mapOrganizationRow(row: DbOrganizationRow | null | undefined): Organization | null {
  if (!row) return null;
  const status = row.status === 'paused' ? 'paused' : 'active';
  return {
    id: row.id,
    slug: row.slug,
    display_name: row.display_name,
    email_domains: Array.isArray(row.email_domains) ? row.email_domains : [],
    status,
    settings: row.settings ?? undefined,
  };
}

export function mapOrganizationMemberRow(
  row: DbOrganizationMemberRow | null | undefined,
): OrganizationMember | null {
  if (!row) return null;
  const role =
    row.role === 'ops' || row.role === 'admin' || row.role === 'member' ? row.role : 'member';
  const status = row.status === 'removed' ? 'removed' : 'active';
  return {
    organization_id: row.organization_id,
    user_id: row.user_id,
    role,
    status,
  };
}
