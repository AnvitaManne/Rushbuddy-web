/**
 * Supabase TrustService (Phase 15 / Slice 15.3).
 * Trust writes are owned by the SECURITY DEFINER RPCs (file_dispute / resolve_dispute),
 * so the client mutators are no-ops. Reads come from `public.trust_events`, which is
 * org-readable — the runner's suspension is DERIVED from those events rather than the
 * `users` table (own-row-only RLS) so a sender can see a runner's status without
 * exposing private columns (e.g. gender).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RunnerTrustRecord, TrustEvent, TrustEventType } from '@/domain/types';
import type { TrustService } from '../types';

interface DbTrustEventRow {
  id: string;
  runner_id: string;
  job_id: string | null;
  type: TrustEventType;
  description: string;
  created_at: string;
}

function emptyTrustRecord(runnerId: string): RunnerTrustRecord {
  return { runner_id: runnerId, no_show_count: 0, suspension_status: 'active' };
}

export function createSupabaseTrustService(client: SupabaseClient): TrustService {
  const svc: TrustService = {
    async appendEvent() {
      // Owned by RPCs; no client-side insert.
    },

    async getEventsForRunner(runnerId) {
      const { data, error } = await client
        .from('trust_events')
        .select('id, runner_id, job_id, type, description, created_at')
        .eq('runner_id', runnerId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`TrustService.getEventsForRunner: ${error.message}`);
      return (data ?? []).map((r): TrustEvent => {
        const row = r as DbTrustEventRow;
        return {
          id: row.id,
          runner_id: row.runner_id,
          job_id: row.job_id ?? undefined,
          type: row.type,
          description: row.description,
          created_at: row.created_at,
        };
      });
    },

    async getRunnerRecord(runnerId) {
      const events = await svc.getEventsForRunner(runnerId); // newest first
      let suspension_status: RunnerTrustRecord['suspension_status'] = 'active';
      let suspended_at: string | undefined;
      let suspension_reason: string | undefined;
      for (const e of events) {
        if (e.type === 'suspension') {
          suspension_status = 'suspended';
          suspended_at = e.created_at;
          suspension_reason = e.description;
          break;
        }
        if (e.type === 'unsuspension') break; // most recent action was a lift
      }
      return {
        runner_id: runnerId,
        no_show_count: events.filter((e) => e.type === 'no_show').length,
        suspension_status,
        suspended_at,
        suspension_reason,
      };
    },

    async updateRunnerRecord(runnerId, updater) {
      return updater(await svc.getRunnerRecord(runnerId));
    },

    async setSuspension(runnerId) {
      return svc.getRunnerRecord(runnerId);
    },
  };

  return svc;
}
