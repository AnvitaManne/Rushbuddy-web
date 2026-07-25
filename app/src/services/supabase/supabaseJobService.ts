/**
 * Supabase JobService (Phase 13 / Slices 13.4).
 *
 * - list/get: RLS scopes rows to the caller's org. Confirmation codes are
 *   fetched ONLY for the caller's own jobs (never leaked into feeds).
 * - create: INSERT under RLS (sender_id + organization_id must be the caller's).
 *   The AFTER INSERT trigger writes the initial status_changed event.
 * - accept: atomic accept_job RPC; returns job id only, then we re-fetch as the
 *   runner (no code). A second accept of the same job resolves to null (conflict).
 *
 * Payment / dispute / photo lifecycle fields are not on public.jobs and stay
 * mock/local until later phases.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Job, User } from '@/domain/types';
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
  async function fetchJob(id: string, includeCode: boolean): Promise<Job | null> {
    const { data, error } = await client
      .from('jobs')
      .select(includeCode ? JOB_COLUMNS_WITH_CODE : JOB_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`JobService.getJob: ${error.message}`);
    if (!data) return null;
    return mapJobRow(data as unknown as DbJobRow, { includeConfirmationCode: includeCode });
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
      const me = await currentAppUserId(client);

      // Others' jobs: never select the code column (no over-the-wire leak).
      const othersQuery = client.from('jobs').select(JOB_COLUMNS).order('created_at', {
        ascending: false,
      });
      if (me) othersQuery.neq('sender_id', me);

      const { data: others, error: othersError } = await othersQuery;
      if (othersError) throw new Error(`JobService.listJobs: ${othersError.message}`);

      const jobs = (others ?? []).map((r) =>
        mapJobRow(r as unknown as DbJobRow, { includeConfirmationCode: false }),
      );

      if (me) {
        const { data: mine, error: mineError } = await client
          .from('jobs')
          .select(JOB_COLUMNS_WITH_CODE)
          .eq('sender_id', me)
          .order('created_at', { ascending: false });
        if (mineError) throw new Error(`JobService.listJobs(own): ${mineError.message}`);
        for (const r of mine ?? []) {
          jobs.push(mapJobRow(r as unknown as DbJobRow, { includeConfirmationCode: true }));
        }
      }

      jobs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return jobs;
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
        if (code === CONFLICT_SQLSTATE || /no longer open/i.test(error.message)) {
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
      return callLifecycleRpc('file_dispute', {
        p_job_id: jobId,
        p_type: input.dispute_type,
        p_description: input.description,
      });
    },

    async resolveDispute(jobId, input) {
      return callLifecycleRpc('resolve_dispute', {
        p_job_id: jobId,
        p_outcome: input.outcome,
        p_unsuspend: input.unsuspend ?? false,
      });
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
