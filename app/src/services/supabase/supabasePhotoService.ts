/**
 * Supabase PhotoService (Phase 16).
 * Uploads to private bucket `job-photos`, then registers via `register_job_photo`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhotoService } from '../types';

const BUCKET = 'job-photos';
const SIGNED_URL_SECONDS = 60 * 60; // 1 hour

function extForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  return 'jpg';
}

export function createSupabasePhotoService(client: SupabaseClient): PhotoService {
  async function getSignedUrl(storagePath: string): Promise<string | null> {
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  return {
    async uploadJobPhoto(input) {
      const { data: orgId, error: orgError } = await client.rpc('current_app_user_org_id');
      if (orgError || !orgId) {
        throw new Error(`PhotoService.upload: org resolve failed: ${orgError?.message ?? 'null org'}`);
      }

      const ext = extForMime(input.blob.type || 'image/jpeg');
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const storage_path = `${orgId}/${input.jobId}/${input.kind}/${fileName}`;

      const { error: uploadError } = await client.storage
        .from(BUCKET)
        .upload(storage_path, input.blob, {
          contentType: input.blob.type || 'image/jpeg',
          upsert: false,
        });
      if (uploadError) {
        throw new Error(`PhotoService.upload: ${uploadError.message}`);
      }

      const { data: photoId, error: rpcError } = await client.rpc('register_job_photo', {
        p_job_id: input.jobId,
        p_kind: input.kind,
        p_storage_path: storage_path,
        p_geotag: input.geotag ?? null,
      });
      if (rpcError) {
        throw new Error(`PhotoService.register: ${rpcError.message}`);
      }

      const url = (await getSignedUrl(storage_path)) ?? `${BUCKET}/${storage_path}`;

      return {
        photo_id: (photoId as string) ?? '',
        url,
        storage_path,
      };
    },

    getSignedUrl,
  };
}
