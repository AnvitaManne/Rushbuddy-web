/**
 * Mock PhotoService / FirService (Phase 16) — keeps mock:// URLs and in-memory FIR.
 */

import { buildFirExport } from '@/domain/trustOps';
import type { FIRExport, Job } from '@/domain/types';
import type { FirService, PhotoService } from '../types';
import type { MockJobStore } from './mockJobService';

export function createMockPhotoService(): PhotoService {
  return {
    async uploadJobPhoto(input) {
      const storage_path = `mock://${input.kind}/${input.jobId}.jpg`;
      return {
        photo_id: `mock-photo-${Date.now()}`,
        url: storage_path,
        storage_path,
      };
    },
    async getSignedUrl(storagePath) {
      return storagePath.startsWith('mock://') ? storagePath : null;
    },
  };
}

/** In-memory FIR store keyed by job id (latest wins). */
export function createMockFirService(store: MockJobStore): FirService {
  const byJob = new Map<string, FIRExport>();

  return {
    async generate(jobId) {
      const job = store.getJobs().find((j) => j.id === jobId);
      if (!job) return null;
      const fir = buildFirExport(job as Job);
      byJob.set(jobId, fir);
      return fir;
    },
    async getLatest(jobId) {
      return byJob.get(jobId) ?? null;
    },
  };
}
