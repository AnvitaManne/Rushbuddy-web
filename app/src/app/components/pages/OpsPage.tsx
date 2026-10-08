/**
 * Pilot ops queue (Phase 18) — disputed + hold-for-ops jobs for the org.
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { services, isSupabaseAdapter } from '@/services';
import type { FIRExport } from '@/domain/types';
import { FirPackagePanel } from '../FirPackagePanel';
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
  const [fir, setFir] = useState<FIRExport | null>(null);
  const [firCopied, setFirCopied] = useState(false);

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
    <div className="p-4 md:p-6 max-w-3xl space-y-4" >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: '#FFF6EA', border: '1px solid #E8A04A66' }}
        >
          <Shield size={18} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-[#0B2340] font-semibold text-lg">Ops queue</h1>
          <p className="text-sm" style={{ color: '#6B7684' }}>
            Disputed jobs and hold-for-ops. Pilot: any active org member can resolve.
          </p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#ffffff', border: '1px solid rgba(11,35,64,0.12)' }}
        >
          <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-[#0B2340]/80">Queue clear</p>
          <p className="text-xs mt-1" style={{ color: '#6B7684' }}>
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
                    setFir(null);
                    setFirCopied(false);
                  }}
                  className="w-full text-left rounded-xl p-3 transition-all"
                  style={{
                    background: active ? '#F3F2EF' : '#ffffff',
                    border: `1px solid ${active ? '#0B2340' : 'rgba(11,35,64,0.12)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {j.status === 'DISPUTED' ? (
                      <AlertTriangle size={14} className="text-red-400" />
                    ) : (
                      <Package size={14} className="text-amber-400" />
                    )}
                    <span className="text-xs font-medium text-[#0B2340]">{j.status}</span>
                  </div>
                  <div className="text-[11px] text-[#0B2340]/70">
                    {j.id.slice(0, 8)}…
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#6B7684' }}>
                    {j.pickup_location} → {j.drop_location}
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: '#6B7684' }}>
                    {j.dispute_type || j.no_answer_resolution || j.item_type} · ₹{j.agreed_price ?? j.posted_price}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: '#ffffff', border: '1px solid rgba(11,35,64,0.12)' }}>
              <div className="text-xs" style={{ color: '#6B7684' }}>
                {selected.id}
              </div>
              <div className="text-sm text-[#0B2340]">
                {selected.sender_name} · runner {selected.runner_name ?? '—'}
              </div>
              <div className="text-xs" style={{ color: '#6B7684' }}>
                {selected.pickup_location} → {selected.drop_location}
              </div>
              {selected.dispute_description && (
                <p className="text-xs" style={{ color: '#6B7684' }}>{selected.dispute_description}</p>
              )}

              {selected.status === 'DISPUTED' && (
                <>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: '#6B7684' }}>
                    Support package (FIR)
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setHint(null);
                      try {
                        const latest = await services.fir.getLatest(selected.id);
                        const next = latest ?? (await services.fir.generate(selected.id));
                        if (!next) {
                          setHint('No support package yet — generate as sender or retry.');
                          return;
                        }
                        setFir(next);
                      } catch (err) {
                        setHint(err instanceof Error ? err.message : 'FIR load failed');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="w-full py-2 rounded-lg text-xs font-medium text-[#0B2340]"
                    style={{ background: '#C4453612', border: '1px solid #C4453644' }}
                  >
                    Load / generate support package
                  </button>
                  {fir && (
                    <FirPackagePanel
                      fir={fir}
                      copied={firCopied}
                      onCopy={async () => {
                        try {
                          await navigator.clipboard.writeText(JSON.stringify(fir, null, 2));
                          setFirCopied(true);
                        } catch {
                          // ignore
                        }
                      }}
                    />
                  )}

                  <div className="text-[10px] uppercase tracking-wide pt-2" style={{ color: '#6B7684' }}>
                    Resolve dispute
                  </div>
                  <div className="space-y-2">
                    {OUTCOMES.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={busy}
                        onClick={() => resolve(o.id)}
                        className="w-full py-2 rounded-lg text-xs font-medium text-[#0B2340]"
                        style={{ background: '#F3F2EF', border: '1px solid rgba(11,35,64,0.12)' }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs" style={{ color: '#6B7684' }}>
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
                  className="w-full py-2.5 rounded-lg text-xs font-semibold text-[#0B2340]"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626)' }}
                >
                  Close hold-for-ops job
                </button>
              )}

              {hint && (
                <p className="text-xs text-[#0B2340]">{hint}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
