/**
 * Supabase FirService (Phase 16 / Phase 22 solid package).
 * Persists FIR support packages via `generate_fir_export`; hydrates signed photo URLs.
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
  const p = payload as Partial<FIRExport> & Record<string, unknown>;
  if (!p.job_id || !p.generated_at) return null;

  const eventsRaw = Array.isArray(p.events) ? p.events : [];
  const events = eventsRaw.map((e) => {
    const row = e as Record<string, unknown>;
    return {
      at: String(row.at ?? ''),
      type: String(row.type ?? ''),
      actor_user_id: row.actor_user_id != null ? String(row.actor_user_id) : null,
      payload:
        row.payload && typeof row.payload === 'object'
          ? (row.payload as Record<string, unknown>)
          : undefined,
    };
  }).filter((e) => e.at && e.type);

  return {
    job_id: String(p.job_id),
    generated_at: String(p.generated_at),
    disclaimer: p.disclaimer ? String(p.disclaimer) : undefined,
    sender_name: String(p.sender_name ?? ''),
    sender_hostel: String(p.sender_hostel ?? ''),
    sender_email: p.sender_email ? String(p.sender_email) : undefined,
    runner_id: String(p.runner_id ?? 'unknown'),
    runner_name: String(p.runner_name ?? 'unknown'),
    runner_hostel: p.runner_hostel ? String(p.runner_hostel) : undefined,
    runner_email: p.runner_email ? String(p.runner_email) : undefined,
    item_description: String(p.item_description ?? ''),
    declared_value: typeof p.declared_value === 'number' ? p.declared_value : undefined,
    pickup_location: String(p.pickup_location ?? ''),
    drop_location: String(p.drop_location ?? ''),
    receiver_phone: p.receiver_phone ? String(p.receiver_phone) : undefined,
    corridor_landmark: p.corridor_landmark ? String(p.corridor_landmark) : undefined,
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
    events: events.length ? events : undefined,
    pickup_photo_id: p.pickup_photo_id ? String(p.pickup_photo_id) : undefined,
    dropoff_photo_id: p.dropoff_photo_id ? String(p.dropoff_photo_id) : undefined,
    pickup_photo_path: p.pickup_photo_path ? String(p.pickup_photo_path) : undefined,
    dropoff_photo_path: p.dropoff_photo_path ? String(p.dropoff_photo_path) : undefined,
  };
}

export function createSupabaseFirService(client: SupabaseClient): FirService {
  async function signedUrlForPath(path: string | undefined): Promise<string | undefined> {
    if (!path) return undefined;
    const { data, error } = await client.storage
      .from('job-photos')
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  }

  async function withPhotoUrls(fir: FIRExport): Promise<FIRExport> {
    const [pickup_photo_url, dropoff_photo_url] = await Promise.all([
      signedUrlForPath(fir.pickup_photo_path),
      signedUrlForPath(fir.dropoff_photo_path),
    ]);
    return {
      ...fir,
      pickup_photo_url: pickup_photo_url ?? fir.pickup_photo_url,
      dropoff_photo_url: dropoff_photo_url ?? fir.dropoff_photo_url,
    };
  }

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
      const mapped = mapPayload((data as DbFirRow | null)?.payload);
      return mapped ? withPhotoUrls(mapped) : null;
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
      const mapped = mapPayload((data as DbFirRow).payload);
      return mapped ? withPhotoUrls(mapped) : null;
    },
  };
}
