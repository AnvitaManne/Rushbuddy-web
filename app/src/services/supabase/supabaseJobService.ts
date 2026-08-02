/**
 * Supabase JobService (Phase 13 / Slices 13.4; Phase 20 hydration).
 *
 * - list/get: RLS scopes rows to the caller's org. Confirmation codes are
 *   fetched ONLY for the caller's own jobs (never leaked into feeds).
 * - create: INSERT under RLS (sender_id + organization_id must be the caller's).
 *   The AFTER INSERT trigger writes the initial status_changed event.
 * - accept: atomic accept_job RPC; returns job id only, then we re-fetch as the
 *   runner (no code). A second accept of the same job resolves to null (conflict).
 * - Phase 20: list/get attach payment / dispute / rating fields from child tables
 *   so Ops/Tracking survive soft-refresh across accounts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Job, User } from '@/domain/types';
import type { PaymentMethod, PaymentStatus } from '@/domain/enums';
import type { JobService, ReportNoAnswerInput } from '../types';
import {
  JOB_COLUMNS,
  JOB_COLUMNS_WITH_CODE,
  mapJobPatchToDb,
  mapJobRow,
  mapJobToInsert,
  type DbJobRow,
} from './jobMappers';

/** Postgres error raised by RPCs when a job is not in the required state. */
const CONFLICT_SQLSTATE = '55000';
/** Postgres error raised by verify_handoff on a wrong code. */
const INVALID_CODE_SQLSTATE = '22023';

async function currentAppUserId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.rpc('current_app_user_id');
  if (error) throw new Error(`JobService: current_app_user_id: ${error.message}`);
  return (data as string | null) ?? null;
}

async function currentAppUserOrgId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.rpc('current_app_user_org_id');
  if (error) throw new Error(`JobService: current_app_user_org_id: ${error.message}`);
  return (data as string | null) ?? null;
}

export function createSupabaseJobService(client: SupabaseClient): JobService {
  async function signedUrlForPath(path: string): Promise<string | null> {
    const { data, error } = await client.storage
      .from('job-photos')
      .createSignedUrl(path, 60 * 60);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  /** Attach photo_url / dropoff_photo_url from photos FKs (best-effort). */
  async function withPhotoUrls(job: Job, row: DbJobRow): Promise<Job> {
    const next = { ...job };
    const ids = [row.pickup_photo_id, row.dropoff_photo_id].filter(Boolean) as string[];
    if (!ids.length) return next;

    const { data: photos } = await client
      .from('photos')
      .select('id, storage_path, kind')
      .in('id', ids);
    for (const p of photos ?? []) {
      const url = await signedUrlForPath(p.storage_path as string);
      if (!url) continue;
      if (p.kind === 'pickup' || p.id === row.pickup_photo_id) next.photo_url = url;
      if (p.kind === 'dropoff_secure' || p.id === row.dropoff_photo_id) next.dropoff_photo_url = url;
    }
    return next;
  }

  /**
   * Batch-attach payment / rating / dispute display fields from child tables.
   * Prefer the open (non-resolved) dispute; else the newest dispute row.
   */
  async function withRelatedFields(jobs: Job[]): Promise<Job[]> {
    if (!jobs.length) return jobs;
    const ids = jobs.map((j) => j.id);

    const [payRes, ratingRes, disputeRes] = await Promise.all([
      client
        .from('payments')
        .select('job_id, method, status, tip_amount, recorded_at')
        .in('job_id', ids),
      client.from('ratings').select('job_id, stars').in('job_id', ids),
      client
        .from('disputes')
        .select('job_id, dispute_type, description, status, opened_at')
        .in('job_id', ids)
        .order('opened_at', { ascending: false }),
    ]);

    if (payRes.error) {
      console.warn('[RushBuddy] payment hydrate failed', payRes.error.message);
    }
    if (ratingRes.error) {
      console.warn('[RushBuddy] rating hydrate failed', ratingRes.error.message);
    }
    if (disputeRes.error) {
      console.warn('[RushBuddy] dispute hydrate failed', disputeRes.error.message);
    }

    const payByJob = new Map<string, {
      method: PaymentMethod;
      status: PaymentStatus;
      tip_amount: number;
      recorded_at: string | null;
    }>();
    for (const r of payRes.data ?? []) {
      payByJob.set(r.job_id as string, {
        method: r.method as PaymentMethod,
        status: r.status as PaymentStatus,
        tip_amount: Number(r.tip_amount ?? 0),
        recorded_at: (r.recorded_at as string | null) ?? null,
      });
    }

    const ratingByJob = new Map<string, number>();
    for (const r of ratingRes.data ?? []) {
      ratingByJob.set(r.job_id as string, Number(r.stars));
    }

    type DisputeRow = {
      job_id: string;
      dispute_type: string;
      description: string;
      status: string;
      opened_at: string;
    };
    const disputeByJob = new Map<string, DisputeRow>();
    for (const r of (disputeRes.data ?? []) as DisputeRow[]) {
      const existing = disputeByJob.get(r.job_id);
      if (!existing) {
        disputeByJob.set(r.job_id, r);
        continue;
      }
      // Prefer open case file over a resolved one (query is newest-first).
      if (existing.status === 'resolved' && r.status !== 'resolved') {
        disputeByJob.set(r.job_id, r);
      }
    }

    return jobs.map((job) => {
      const next = { ...job };
      const pay = payByJob.get(job.id);
      if (pay) {
        next.payment_method = pay.method;
        next.payment_status = pay.status;
        next.tip_amount = pay.tip_amount;
        next.paid_at = pay.recorded_at ?? undefined;
      }
      const stars = ratingByJob.get(job.id);
      if (stars != null) next.rating = stars;
      const dispute = disputeByJob.get(job.id);
      if (dispute) {
        next.dispute_type = dispute.dispute_type;
        next.dispute_description = dispute.description;
        next.disputed_at = dispute.opened_at;
      }
      return next;
    });
  }

  async function fetchJob(id: string, includeCode: boolean): Promise<Job | null> {
    const { data, error } = await client
      .from('jobs')
      .select(includeCode ? JOB_COLUMNS_WITH_CODE : JOB_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`JobService.getJob: ${error.message}`);
    if (!data) return null;
    const row = data as unknown as DbJobRow;
    const job = await withPhotoUrls(
      mapJobRow(row, { includeConfirmationCode: includeCode }),
      row,
    );
    const [hydrated] = await withRelatedFields([job]);
    return hydrated;
  }

  /** Run a lifecycle RPC (returns job id), then re-fetch the runner view (no code). */
  async function callLifecycleRpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<Job | null> {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      const code = (error as { code?: string }).code;
      if (code === CONFLICT_SQLSTATE) return null;
      throw new Error(`JobService.${fn}: ${error.message}`);
    }
    const jobId = (data as string | null) ?? (args.p_job_id as string);
    return fetchJob(jobId, false);
  }

  return {
    async listJobs() {
      // Close expired OPEN jobs before listing so feeds stay clean.
      try {
        await client.rpc('expire_stale_open_jobs');
      } catch (err) {
        console.warn('[RushBuddy] expire on list failed', err);
      }

      const me = await currentAppUserId(client);

      // Others' jobs: never select the code column (no over-the-wire leak).
      const othersQuery = client.from('jobs').select(JOB_COLUMNS).order('created_at', {
        ascending: false,
      });
      if (me) othersQuery.neq('sender_id', me);

      const { data: others, error: othersError } = await othersQuery;
      if (othersError) throw new Error(`JobService.listJobs: ${othersError.message}`);

      const jobs: Job[] = [];
      for (const r of others ?? []) {
        const row = r as unknown as DbJobRow;
        jobs.push(
          await withPhotoUrls(mapJobRow(row, { includeConfirmationCode: false }), row),
        );
      }

      if (me) {
        const { data: mine, error: mineError } = await client
          .from('jobs')
          .select(JOB_COLUMNS_WITH_CODE)
          .eq('sender_id', me)
          .order('created_at', { ascending: false });
        if (mineError) throw new Error(`JobService.listJobs(own): ${mineError.message}`);
        for (const r of mine ?? []) {
          const row = r as unknown as DbJobRow;
          jobs.push(
            await withPhotoUrls(mapJobRow(row, { includeConfirmationCode: true }), row),
          );
        }
      }

      jobs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return withRelatedFields(jobs);
    },

    async getJob(id) {
      const me = await currentAppUserId(client);
      const base = await fetchJob(id, false);
      if (!base) return null;
      // Re-fetch with the code only when the caller owns the job.
      if (me && base.sender_id === me) {
        return (await fetchJob(id, true)) ?? base;
      }
      return base;
    },

    async createJob(job) {
      const [me, orgId] = await Promise.all([
        currentAppUserId(client),
        currentAppUserOrgId(client),
      ]);
      if (!me) throw new Error('JobService.createJob: not authenticated');
      if (!orgId) throw new Error('JobService.createJob: no active organization for user');

      const insert = mapJobToInsert(job, { organizationId: orgId, senderId: me });
      const { data, error } = await client
        .from('jobs')
        .insert(insert)
        .select(JOB_COLUMNS_WITH_CODE)
        .single();
      if (error) throw new Error(`JobService.createJob: ${error.message}`);
      // Sender created it → return with the confirmation code for the Tracking card.
      return mapJobRow(data as unknown as DbJobRow, { includeConfirmationCode: true });
    },

    async updateJob(id, patch) {
      const db = mapJobPatchToDb(patch);
      const { data, error } = await client
        .from('jobs')
        .update(db)
        .eq('id', id)
        .select(JOB_COLUMNS)
        .maybeSingle();
      if (error) throw new Error(`JobService.updateJob: ${error.message}`);
      if (!data) return null;
      return mapJobRow(data as unknown as DbJobRow, { includeConfirmationCode: false });
    },

    async acceptJob(jobId, _runner: Pick<User, 'id' | 'name' | 'rating' | 'hostel_block'>) {
      const { data, error } = await client.rpc('accept_job', { p_job_id: jobId });
      if (error) {
        // Already matched / not open → surface as a graceful conflict, not a throw.
        const code = (error as { code?: string }).code;
        if (code === CONFLICT_SQLSTATE || /no longer open|suspended/i.test(error.message)) {
          return null;
        }
        throw new Error(`JobService.acceptJob: ${error.message}`);
      }
      const acceptedId = (data as string | null) ?? jobId;
      // Re-fetch as the runner: never includes the confirmation code.
      return fetchJob(acceptedId, false);
    },

    async acknowledgePickup(jobId, _options) {
      return callLifecycleRpc('acknowledge_pickup', { p_job_id: jobId });
    },

    async completeHandoff(jobId, confirmationCode) {
      const { data, error } = await client.rpc('verify_handoff', {
        p_job_id: jobId,
        p_code: confirmationCode,
      });
      if (error) {
        const code = (error as { code?: string }).code;
        // Wrong code (or not in transit) → null so the page shows its own error.
        if (code === INVALID_CODE_SQLSTATE || code === CONFLICT_SQLSTATE || /invalid handoff code/i.test(error.message)) {
          return null;
        }
        throw new Error(`JobService.completeHandoff: ${error.message}`);
      }
      return fetchJob((data as string | null) ?? jobId, false);
    },

    async reportNoAnswer(jobId, input: ReportNoAnswerInput) {
      if (input.kind === 'contact_attempt') {
        return callLifecycleRpc('report_contact_attempt', { p_job_id: jobId });
      }
      if (input.kind === 'secure_drop') {
        return callLifecycleRpc('resolve_secure_drop', {
          p_job_id: jobId,
          p_location: input.location ?? null,
        });
      }
      return callLifecycleRpc('hold_for_ops', { p_job_id: jobId });
    },

    async reportIssue(jobId) {
      return callLifecycleRpc('report_issue', { p_job_id: jobId });
    },

    async closeJob(jobId) {
      return callLifecycleRpc('close_job', { p_job_id: jobId });
    },

    async fileDispute(jobId, input) {
      const { data, error } = await client.rpc('file_dispute', {
        p_job_id: jobId,
        p_type: input.dispute_type,
        p_description: input.description,
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === CONFLICT_SQLSTATE || /not disputable/i.test(error.message)) {
          // Surface status in the message so RatingPage can show it (not a vague "sign in").
          throw new Error(
            error.message.includes('status=')
              ? `Cannot file dispute — ${error.message.replace(/^file_dispute:\s*/i, '')}. Complete a real handoff first (Tracking DEV simulate does not persist).`
              : 'Cannot file dispute — job is not awaiting payment/rating on the server, or you are not the sender.',
          );
        }
        throw new Error(`JobService.fileDispute: ${error.message}`);
      }
      return fetchJob((data as string | null) ?? jobId, true);
    },

    async resolveDispute(jobId, input) {
      return callLifecycleRpc('resolve_dispute', {
        p_job_id: jobId,
        p_outcome: input.outcome,
        p_unsuspend: input.unsuspend ?? false,
      });
    },

    async repoolNoShow(jobId) {
      // Sender needs confirmation_code after re-pool (job is theirs again).
      const { data, error } = await client.rpc('record_no_show_and_repool', {
        p_job_id: jobId,
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === CONFLICT_SQLSTATE) return null;
        throw new Error(`JobService.repoolNoShow: ${error.message}`);
      }
      return fetchJob((data as string | null) ?? jobId, true);
    },

    async cancelOpenJob(jobId) {
      return callLifecycleRpc('cancel_open_job', { p_job_id: jobId });
    },

    async extendOpenJob(jobId) {
      const { data, error } = await client.rpc('extend_open_job', { p_job_id: jobId });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === CONFLICT_SQLSTATE || /not extendable|too early/i.test(error.message)) {
          return null;
        }
        throw new Error(`JobService.extendOpenJob: ${error.message}`);
      }
      return fetchJob((data as string | null) ?? jobId, true);
    },

    async expireStaleOpenJobs() {
      const { data, error } = await client.rpc('expire_stale_open_jobs');
      if (error) {
        console.warn('[RushBuddy] expire_stale_open_jobs failed', error.message);
        return 0;
      }
      return Number(data ?? 0);
    },

    async removeJob(id) {
      const { data, error } = await client
        .from('jobs')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) throw new Error(`JobService.removeJob: ${error.message}`);
      return (data ?? []).length > 0;
    },
  };
}
