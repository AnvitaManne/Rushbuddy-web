/**
 * Pilot ops queue (Phase 18) — disputed + hold-for-ops jobs for the org.
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { services, isSupabaseAdapter } from '@/services';
import {
  applyDisputeRunnerFaultPenalty,
  createTrustEvent,
  payoutStatusForDisputeResolution,
  unsuspendRunner,
  type DisputeResolutionOutcome,
} from '@/domain/trustOps';
import { assertTransition } from '@/domain/jobTransitions';
import { Shield, AlertTriangle, Package, CheckCircle2 } from 'lucide-react';

const OUTCOMES: { id: DisputeResolutionOutcome; label: string }[] = [
  { id: 'runner_at_fault', label: 'Runner at fault' },
  { id: 'sender_error', label: 'Sender error / pre-existing' },
  { id: 'unclear', label: 'Unclear / goodwill' },
];

export function OpsPage() {
  const {
    jobs,
    setJobs,
    appendTrustEvent,
    updateRunnerTrustRecord,
    refreshData,
  } = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unsuspend, setUnsuspend] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const queue = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'DISPUTED' || j.status === 'ISSUE_REPORTED')
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [jobs],
  );

  const selected = queue.find((j) => j.id === selectedId) ?? queue[0] ?? null;

  const resolve = async (outcome: DisputeResolutionOutcome) => {
    if (!selected || selected.status !== 'DISPUTED') return;
    const transition = assertTransition(selected.status, 'CLOSED');
    if (!transition.ok) {
      setHint(transition.error ?? 'Cannot resolve');
      return;
    }
    setBusy(true);
    setHint(null);
    try {
      const resolved = await services.jobs.resolveDispute(selected.id, {
        outcome,
        unsuspend,
      });
      if (!resolved) {
        setHint('Resolve failed — check you are signed in and in the same org.');
        return;
      }
      const payout = payoutStatusForDisputeResolution(outcome);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === selected.id
            ? { ...j, status: 'CLOSED', closed_at: new Date().toISOString(), runner_payout_status: payout }
            : j,
        ),
      );
      if (!isSupabaseAdapter && selected.runner_id) {
        appendTrustEvent(
          createTrustEvent({
            runner_id: selected.runner_id,
            job_id: selected.id,
            type: 'ops_note_added',
            description: `Ops resolved ${selected.id} as "${outcome}" · payout=${payout}`,
          }),
        );
        if (outcome === 'runner_at_fault') {
          updateRunnerTrustRecord(selected.runner_id, (prev) => applyDisputeRunnerFaultPenalty(prev));
        }
        if (unsuspend) {
          updateRunnerTrustRecord(selected.runner_id, (prev) => unsuspendRunner(prev));
        }
      } else {
        await refreshData();
      }
      setHint(`Resolved: ${outcome} → CLOSED`);
      setSelectedId(null);
    } finally {
      setBusy(false);
    }
  };

  const closeHold = async () => {
    if (!selected || selected.status !== 'ISSUE_REPORTED') return;
    setBusy(true);
    setHint(null);
    try {
      const closed = await services.jobs.closeJob(selected.id);
      if (!closed) {
        setHint('Close failed — check session / org membership.');
        return;
      }
      setJobs((prev) =>
        prev.map((j) =>
          j.id === selected.id
            ? { ...j, status: 'CLOSED', closed_at: new Date().toISOString() }
            : j,
        ),
      );
      await refreshData();
      setHint('Hold closed → CLOSED');
      setSelectedId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: '#1A0F05', border: '1px solid #3B2A0A' }}
        >
          <Shield size={18} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-white font-semibold text-lg">Ops queue</h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Disputed jobs and hold-for-ops. Pilot: any active org member can resolve.
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#0B1120', border: '1px solid #1E2D45' }}
        >
          <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-white/80">Queue clear</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            No DISPUTED or ISSUE_REPORTED jobs in your org right now.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {queue.map((j) => {
              const active = (selected?.id ?? '') === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(j.id);
                    setHint(null);
                    setUnsuspend(false);
                  }}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{
                    background: active ? '#111E35' : '#0B1120',
                    border: `1px solid ${active ? '#06B6D4' : '#1E2D45'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {j.status === 'DISPUTED' ? (
                      <AlertTriangle size={14} className="text-red-400" />
                    ) : (
                      <Package size={14} className="text-amber-400" />
                    )}
                    <span className="text-xs font-medium text-white">{j.status}</span>
                  </div>
                  <div className="text-[11px] text-white/70" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {j.id.slice(0, 8)}…
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                    {j.pickup_location} → {j.drop_location}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: '#64748B' }}>
                    {j.dispute_type || j.no_answer_resolution || j.item_type} · ₹{j.agreed_price ?? j.posted_price}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                {selected.id}
              </div>
              <div className="text-sm text-white">
                {selected.sender_name} · runner {selected.runner_name ?? '—'}
              </div>
              <div className="text-xs" style={{ color: '#94A3B8' }}>
                {selected.pickup_location} → {selected.drop_location}
              </div>
              {selected.dispute_description && (
                <p className="text-xs" style={{ color: '#64748B' }}>{selected.dispute_description}</p>
              )}

              {selected.status === 'DISPUTED' && (
                <>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#475569' }}>
                    Resolve dispute
                  </div>
                  <div className="space-y-2">
                    {OUTCOMES.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={busy}
                        onClick={() => resolve(o.id)}
                        className="w-full py-2 rounded-lg text-xs font-medium text-white"
                        style={{ background: '#111E35', border: '1px solid #1E2D45' }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                    <input
                      type="checkbox"
                      checked={unsuspend}
                      onChange={(e) => setUnsuspend(e.target.checked)}
                    />
                    Unsuspend runner after resolve
                  </label>
                </>
              )}

              {selected.status === 'ISSUE_REPORTED' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeHold}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626)' }}
                >
                  Close hold-for-ops job
                </button>
              )}

              {hint && (
                <p className="text-xs text-cyan-400">{hint}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
