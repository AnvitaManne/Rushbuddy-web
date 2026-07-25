/**
 * Supabase PaymentService (Phase 15 / Slice 15.3).
 * Off-platform cash/UPI is recorded via the `record_payment` RPC (owner-side write);
 * an optional rating routes to `submit_rating`. Reads come from `public.payments`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentMethod, PaymentStatus } from '@/domain/enums';
import type { JobPaymentRecord, PaymentService } from '../types';

interface DbPaymentRow {
  job_id: string;
  method: PaymentMethod;
  status: PaymentStatus;
  tip_amount: number | string | null;
  recorded_at: string | null;
}

export function createSupabasePaymentService(client: SupabaseClient): PaymentService {
  return {
    async getPaymentForJob(jobId) {
      const { data, error } = await client
        .from('payments')
        .select('job_id, method, status, tip_amount, recorded_at')
        .eq('job_id', jobId)
        .maybeSingle();
      if (error) throw new Error(`PaymentService.getPaymentForJob: ${error.message}`);
      if (!data) return null;
      const row = data as DbPaymentRow;
      return {
        job_id: row.job_id,
        method: row.method,
        status: row.status,
        tip_amount: Number(row.tip_amount ?? 0),
        paid_at: row.recorded_at ?? undefined,
      };
    },

    async recordPayment(jobId, input) {
      const { error } = await client.rpc('record_payment', {
        p_job_id: jobId,
        p_method: input.method,
        p_tip: input.tip_amount ?? 0,
      });
      if (error) throw new Error(`PaymentService.recordPayment: ${error.message}`);

      if (input.rating != null) {
        const { error: ratingError } = await client.rpc('submit_rating', {
          p_job_id: jobId,
          p_stars: input.rating,
        });
        if (ratingError) {
          throw new Error(`PaymentService.recordPayment(rating): ${ratingError.message}`);
        }
      }

      const record: JobPaymentRecord = {
        job_id: jobId,
        method: input.method,
        status: 'paid',
        tip_amount: input.tip_amount ?? 0,
        rating: input.rating,
        paid_at: new Date().toISOString(),
      };
      return record;
    },
  };
}
