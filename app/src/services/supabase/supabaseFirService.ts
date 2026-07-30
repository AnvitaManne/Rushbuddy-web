/**
 * Supabase FirService (Phase 16).
 * Persists FIR support packages via `generate_fir_export`; reads from `fir_exports`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FIRExport } from '@/domain/types';
import type { FirService } from '../types';

interface DbFirRow {
  id: string;
  job_id: string;
  payload: FIRExport | Record<string, unknown>;
  generated_at: string;
}

function mapPayload(payload: unknown): FIRExport | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Partial<FIRExport>;
  if (!p.job_id || !p.generated_at) return null;
  return {
    job_id: String(p.job_id),
    generated_at: String(p.generated_at),
    sender_name: String(p.sender_name ?? ''),
    sender_hostel: String(p.sender_hostel ?? ''),
    runner_id: String(p.runner_id ?? 'unknown'),
    runner_name: String(p.runner_name ?? 'unknown'),
    item_description: String(p.item_description ?? ''),
    declared_value: typeof p.declared_value === 'number' ? p.declared_value : undefined,
    pickup_location: String(p.pickup_location ?? ''),
    drop_location: String(p.drop_location ?? ''),
    dispute_type: p.dispute_type ? String(p.dispute_type) : undefined,
    dispute_description: p.dispute_description ? String(p.dispute_description) : undefined,
    confirmation_code: String(p.confirmation_code ?? ''),
    timeline: {
      created_at: String(p.timeline?.created_at ?? p.generated_at),
      matched_at: p.timeline?.matched_at ? String(p.timeline.matched_at) : undefined,
      pickup_confirmed_at: p.timeline?.pickup_confirmed_at
        ? String(p.timeline.pickup_confirmed_at)
        : undefined,
      delivered_at: p.timeline?.delivered_at ? String(p.timeline.delivered_at) : undefined,
      disputed_at: p.timeline?.disputed_at ? String(p.timeline.disputed_at) : undefined,
    },
  };
}

export function createSupabaseFirService(client: SupabaseClient): FirService {
  return {
    async generate(jobId) {
      const { data: exportId, error } = await client.rpc('generate_fir_export', {
        p_job_id: jobId,
      });
      if (error) throw new Error(`FirService.generate: ${error.message}`);
      if (!exportId) return null;

      const { data, error: readError } = await client
        .from('fir_exports')
        .select('id, job_id, payload, generated_at')
        .eq('id', exportId)
        .maybeSingle();
      if (readError) throw new Error(`FirService.generate(read): ${readError.message}`);
      return mapPayload((data as DbFirRow | null)?.payload);
    },

    async getLatest(jobId) {
      const { data, error } = await client
        .from('fir_exports')
        .select('id, job_id, payload, generated_at')
        .eq('job_id', jobId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`FirService.getLatest: ${error.message}`);
      if (!data) return null;
      return mapPayload((data as DbFirRow).payload);
    },
  };
}
