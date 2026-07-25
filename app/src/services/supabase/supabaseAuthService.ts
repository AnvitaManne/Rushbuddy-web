/**
 * Supabase AuthService (Phase 12 / Slice 12.4).
 * Email OTP → profile UPDATE → organization_members via ensure RPC (RLS blocks direct INSERT).
 * Not wired to Auth/Verify pages yet.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthService, AuthSignupInput } from '../types';
import {
  mapUserRow,
  USER_OWN_COLUMNS,
  type DbUserRow,
} from './mappers';
import { resolveOrganizationIdFromEmail } from './supabaseOrganizationService';

function requireOtp(input: AuthSignupInput): string {
  const otp = input.otp?.trim();
  if (!otp) {
    throw new Error('AuthService.completeSignup: otp is required for Supabase email verification');
  }
  return otp;
}

async function fetchUserByAuthId(client: SupabaseClient, authUserId: string) {
  const { data, error } = await client
    .from('users')
    .select(USER_OWN_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw new Error(`AuthService: load profile failed: ${error.message}`);
  return mapUserRow(data as DbUserRow | null);
}

export function createSupabaseAuthService(client: SupabaseClient): AuthService {
  return {
    async getCurrentUser() {
      const { data: sessionData, error } = await client.auth.getSession();
      if (error) throw new Error(`AuthService.getCurrentUser: ${error.message}`);
      const authUserId = sessionData.session?.user?.id;
      if (!authUserId) return null;
      return fetchUserByAuthId(client, authUserId);
    },

    async isAuthenticated() {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error(`AuthService.isAuthenticated: ${error.message}`);
      return !!data.session?.user?.id;
    },

    async beginSignup(input) {
      const orgId = await resolveOrganizationIdFromEmail(client, input.email);
      if (!orgId) {
        throw new Error('Email domain is not allowed for signup on any active organization.');
      }

      const { error } = await client.auth.signInWithOtp({
        email: input.email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw new Error(`AuthService.beginSignup: ${error.message}`);
    },

    async completeSignup(input) {
      const otp = requireOtp(input);
      const email = input.email.trim().toLowerCase();

      const { data: verifyData, error: verifyError } = await client.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      if (verifyError) throw new Error(`AuthService.completeSignup: ${verifyError.message}`);

      const authUserId = verifyData.session?.user?.id ?? verifyData.user?.id;
      if (!authUserId) {
        throw new Error('AuthService.completeSignup: no session after OTP verify');
      }

      // Profile fields (gender matching-only). Trigger already created minimal row.
      const { data: updated, error: updateError } = await client
        .from('users')
        .update({
          name: input.name.trim(),
          hostel_block: input.hostel_block.trim(),
          gender: input.gender,
          verified: true,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('auth_user_id', authUserId)
        .select(USER_OWN_COLUMNS)
        .maybeSingle();

      if (updateError) {
        throw new Error(`AuthService.completeSignup: profile update failed: ${updateError.message}`);
      }
      if (!updated) {
        throw new Error(
          'AuthService.completeSignup: public.users row missing after Auth trigger — try again or check migration 0002',
        );
      }

      // Membership INSERT is SECURITY DEFINER (no broad INSERT policy on organization_members).
      const { error: memberError } = await client.rpc('ensure_organization_membership');
      if (memberError) {
        throw new Error(`AuthService.completeSignup: membership failed: ${memberError.message}`);
      }

      const user = mapUserRow(updated as DbUserRow);
      if (!user) {
        throw new Error('AuthService.completeSignup: profile still incomplete after update');
      }
      return user;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(`AuthService.signOut: ${error.message}`);
    },
  };
}
