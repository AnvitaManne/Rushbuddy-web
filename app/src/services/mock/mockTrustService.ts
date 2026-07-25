/**
 * In-memory TrustService mock (Phase 10).
 * Mirrors AppContext `trustEvents` + `runnerTrustRecords`; uses trustOps helpers for suspension.
 * Not wired to UI yet.
 */

import type { RunnerTrustRecord, TrustEvent } from '@/domain/types';
import type { SuspensionStatus } from '@/domain/enums';
import { suspendRunner, unsuspendRunner } from '@/domain/trustOps';
import type { TrustService } from '../types';

function emptyTrustRecord(runnerId: string): RunnerTrustRecord {
  return { runner_id: runnerId, no_show_count: 0, suspension_status: 'active' };
}

/** Mutable trust store accessors — typically AppContext trust state later. */
export interface MockTrustStore {
  getEvents(): TrustEvent[];
  setEvents(events: TrustEvent[]): void;
  getRecords(): Record<string, RunnerTrustRecord>;
  setRecords(records: Record<string, RunnerTrustRecord>): void;
}

function createInternalStore(
  initialEvents: TrustEvent[] = [],
  initialRecords: Record<string, RunnerTrustRecord> = {},
): MockTrustStore {
  let events = [...initialEvents];
  let records = { ...initialRecords };
  return {
    getEvents: () => events,
    setEvents: (next) => {
      events = next;
    },
    getRecords: () => records,
    setRecords: (next) => {
      records = next;
    },
  };
}

export function createMockTrustService(
  store: MockTrustStore = createInternalStore(),
): TrustService {
  return {
    async appendEvent(event) {
      store.setEvents([event, ...store.getEvents()]);
    },

    async getEventsForRunner(runnerId) {
      return store.getEvents().filter((e) => e.runner_id === runnerId);
    },

    async getRunnerRecord(runnerId) {
      return store.getRecords()[runnerId] ?? emptyTrustRecord(runnerId);
    },

    async updateRunnerRecord(runnerId, updater) {
      const current = store.getRecords()[runnerId] ?? emptyTrustRecord(runnerId);
      const next = updater(current);
      store.setRecords({ ...store.getRecords(), [runnerId]: next });
      return next;
    },

    async setSuspension(runnerId, status: SuspensionStatus, reason?: string) {
      const current = store.getRecords()[runnerId] ?? emptyTrustRecord(runnerId);
      const next =
        status === 'suspended'
          ? suspendRunner(current, reason ?? 'Suspended')
          : unsuspendRunner(current);
      store.setRecords({ ...store.getRecords(), [runnerId]: next });
      return next;
    },
  };
}
