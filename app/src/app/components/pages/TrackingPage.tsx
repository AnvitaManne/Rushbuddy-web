import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import {
  Package, MapPin, Clock, Star, Shield, CheckCircle2,
  AlertCircle, Phone, MessageSquare, X, ChevronRight, Radio, Copy, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { assertTransition } from '@/domain/jobTransitions';
import { applyNoShowStrike, buildFirExport, applyDisputeRunnerFaultPenalty, payoutStatusForDisputeResolution, unsuspendRunner, type DisputeResolutionOutcome } from '@/domain/trustOps';
import { logJobTransition } from '@/domain/devJobDebug';
import type { FIRExport, Job, User } from '@/domain/types';

/** Mock runner identity for FIR package when only job fields exist. */
function mockRunnerFromJob(job: Job): User {
  const id = job.runner_id ?? 'r-unknown';
  return {
    ...defaultUser,
    id,
    name: job.runner_name ?? 'Unknown Runner (mock)',
    email: `mock.runner.${id}@vitstudent.ac.in`,
    hostel_block: job.runner_hostel ?? 'MOCK-HOSTEL',
    current_role: 'runner',
  };
}

function mockSenderFromJob(job: Job, currentUser: User | null): User {
  if (currentUser && currentUser.id === job.sender_id) return currentUser;
  return {
    ...defaultUser,
    id: job.sender_id,
    name: job.sender_name,
    hostel_block: job.sender_hostel,
    email:
      job.sender_id === defaultUser.id
        ? defaultUser.email
        : `mock.sender.${job.sender_id}@vitstudent.ac.in`,
  };
}

const TIMELINE_STEPS = [
  { key: 'OPEN', label: 'Finding Buddy', sub: 'Notifying runners...', icon: Radio },
  { key: 'MATCHED', label: 'Buddy Found', sub: 'Runner on the way', icon: Star },
  { key: 'IN_TRANSIT', label: 'Picked Up', sub: 'Item in transit', icon: Package },
  { key: 'DELIVERED', label: 'Delivered', sub: 'Rate your Buddy', icon: CheckCircle2 },
];

/** Pre-pickup no-show unlock window (matched_at → Find New Buddy). */
const PRE_PICKUP_NOSHOW_MS = 10 * 60 * 1000;

function getStepIndex(status: string) {
  const map: Record<string, number> = {
    OPEN: 0,
    MATCHED: 1,
    IN_TRANSIT: 2,
    DELIVERED: 3,
    CLOSED: 3,
    PENDING_RATING: 3,
    DISPUTED: 3,
  };
  return map[status] ?? 0;
}

export function TrackingPage() {
  const {
    jobs,
    setJobs,
    activeJob: ctxActiveJob,
    user,
    appendTrustEvent,
    updateRunnerTrustRecord,
    trustEvents,
    runnerTrustRecords,
  } = useApp();
  const navigate = useNavigate();

  const [localJobId, setLocalJobId] = useState<string | null>(null);

  useEffect(() => {
    // Always bind tracking to a job we own as sender — never a runner-only activeJob.
    if (ctxActiveJob?.sender_id === 'u1') {
      setLocalJobId(ctxActiveJob.id);
      return;
    }
    const live = jobs.find(j =>
      j.sender_id === 'u1' && ['OPEN', 'MATCHED', 'IN_TRANSIT', 'DISPUTED', 'DELIVERED', 'PENDING_RATING'].includes(j.status),
    );
    if (live) {
      setLocalJobId(live.id);
      return;
    }
    const last = [...jobs]
      .filter(j => j.sender_id === 'u1')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (last) setLocalJobId(last.id);
  }, [ctxActiveJob, jobs]);

  const job =
    jobs.find(j => j.id === localJobId && j.sender_id === 'u1') ||
    jobs.find(j => j.sender_id === 'u1' && ['OPEN', 'MATCHED', 'IN_TRANSIT', 'DISPUTED'].includes(j.status)) ||
    jobs.find(j => j.sender_id === 'u1');

  const [simStep, setSimStep] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);
  /** Dev-only: treat 10 min pre-pickup window as elapsed. */
  const [devNoshowElapsed, setDevNoshowElapsed] = useState(false);
  /** Forces re-render when the real 10 min window unlocks. */
  const [, setNoshowTick] = useState(0);
  /** Mock FIR support package preview (theft escalation only). */
  const [firPackage, setFirPackage] = useState<FIRExport | null>(null);
  const [firCopyHint, setFirCopyHint] = useState<string | null>(null);
  /** DEV mock ops: optionally unsuspend runner on resolve. */
  const [opsUnsuspendRunner, setOpsUnsuspendRunner] = useState(false);
  const [opsResolveHint, setOpsResolveHint] = useState<string | null>(null);

  const stepIndex = job ? getStepIndex(job.status) : 0;
  const displayStep = simStep !== null ? simStep : stepIndex;

  const isPrePickupMatched =
    !!job && job.status === 'MATCHED' && !job.pickup_confirmed_at;

  const isDisputed = !!job && job.status === 'DISPUTED';
  const isClosed = !!job && job.status === 'CLOSED';
  const canRateAndPay =
    !!job &&
    (job.status === 'DELIVERED' || job.status === 'PENDING_RATING');
  const jobTheftEscalation = isDisputed
    ? trustEvents.some(
        (e) => e.job_id === job.id && e.type === 'theft_escalation',
      )
    : false;
  const disputedRunnerSuspended =
    !!job?.runner_id &&
    runnerTrustRecords[job.runner_id]?.suspension_status === 'suspended';

  const tenMinElapsed =
    isPrePickupMatched &&
    !!job.matched_at &&
    (devNoshowElapsed ||
      Date.now() - new Date(job.matched_at).getTime() >= PRE_PICKUP_NOSHOW_MS);

  useEffect(() => {
    setDevNoshowElapsed(false);
    setOpsUnsuspendRunner(false);
    setOpsResolveHint(null);
  }, [job?.id, job?.matched_at, job?.status]);

  useEffect(() => {
    if (!isPrePickupMatched || !job?.matched_at || devNoshowElapsed) return;
    const remaining =
      PRE_PICKUP_NOSHOW_MS - (Date.now() - new Date(job.matched_at).getTime());
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNoshowTick((n) => n + 1), remaining);
    return () => window.clearTimeout(timer);
  }, [isPrePickupMatched, job?.matched_at, job?.id, devNoshowElapsed]);

  const simulateProgress = async () => {
    if (!job || simulating) return;
    setSimulating(true);
    const nextStatuses = ['MATCHED', 'IN_TRANSIT', 'DELIVERED'] as const;
    for (let i = 0; i < nextStatuses.length; i++) {
      const ns = nextStatuses[i];
      const idx = TIMELINE_STEPS.findIndex(s => s.key === ns);
      await new Promise(r => setTimeout(r, 1500));
      setSimStep(idx);
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j, status: ns,
        runner_id: ns === 'MATCHED' ? (j.runner_id ?? 'r-sim') : j.runner_id,
        runner_name: ns === 'MATCHED' ? (j.runner_name ?? 'Karthik R') : j.runner_name,
        runner_rating: ns === 'MATCHED' ? (j.runner_rating ?? 4.9) : j.runner_rating,
        matched_at: ns === 'MATCHED' ? new Date().toISOString() : j.matched_at,
        pickup_confirmed_at: ns === 'IN_TRANSIT' ? new Date().toISOString() : j.pickup_confirmed_at,
        delivered_at: ns === 'DELIVERED' ? new Date().toISOString() : j.delivered_at,
        agreed_price: ns === 'MATCHED' ? (j.agreed_price ?? j.posted_price) : j.agreed_price,
      } : j));
      if (ns === 'DELIVERED') { await new Promise(r => setTimeout(r, 800)); navigate('/rate'); break; }
    }
    setSimulating(false);
  };

  const handleCancel = () => {
    if (job && job.status === 'OPEN') {
      setJobs(prev => prev.filter(j => j.id !== job.id));
      navigate('/home');
    }
  };

  const handleFindNewBuddy = () => {
    if (!job || job.status !== 'MATCHED' || job.pickup_confirmed_at) return;
    if (!job.runner_id) return;

    const transition = assertTransition(job.status, 'OPEN');
    if (!transition.ok) {
      console.warn('[RushBuddy] re-pool blocked:', transition.error);
      return;
    }

    const priorRunnerId = job.runner_id;
    logJobTransition(job.id, job.status, 'OPEN');

    appendTrustEvent({
      type: 'runner_no_show_pre_pickup',
      job_id: job.id,
      actor_user_id: user?.id ?? job.sender_id,
      target_user_id: priorRunnerId,
      message: 'Runner unresponsive before pickup — sender re-pooled job',
      metadata: { matched_at: job.matched_at ?? null, mock: true },
    });

    updateRunnerTrustRecord(priorRunnerId, (prev) => applyNoShowStrike(prev));

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          status: 'OPEN' as const,
          runner_id: undefined,
          runner_name: undefined,
          runner_rating: undefined,
          runner_hostel: undefined,
          matched_at: undefined,
          agreed_price: undefined,
        };
      }),
    );

    setSimStep(null);
    setDevNoshowElapsed(false);
  };

  const RESOLUTION_LABELS: Record<DisputeResolutionOutcome, string> = {
    runner_at_fault: 'Runner at fault',
    sender_error: 'Sender error / pre-existing issue',
    unclear: 'Unclear / goodwill',
  };

  const handleResolveDispute = (outcome: DisputeResolutionOutcome) => {
    if (!job || job.status !== 'DISPUTED') return;

    const transition = assertTransition(job.status, 'CLOSED');
    if (!transition.ok) {
      console.warn('[RushBuddy] ops resolve blocked:', transition.error);
      setOpsResolveHint(transition.error);
      return;
    }

    const closedAt = new Date().toISOString();
    const payout = payoutStatusForDisputeResolution(outcome);
    const label = RESOLUTION_LABELS[outcome];

    logJobTransition(job.id, job.status, 'CLOSED');

    appendTrustEvent({
      type: 'ops_note_added',
      job_id: job.id,
      actor_user_id: user?.id ?? 'ops-mock',
      target_user_id: job.runner_id,
      message: `Mock ops resolved dispute: ${label}`,
      metadata: {
        mock: true,
        resolution: outcome,
        runner_payout_status: payout,
        unsuspend_requested: opsUnsuspendRunner,
        note:
          outcome === 'unclear'
            ? 'Goodwill close — payout released; suspension unchanged unless unchecked below'
            : null,
      },
    });

    if (job.runner_id) {
      if (outcome === 'runner_at_fault') {
        updateRunnerTrustRecord(job.runner_id, (prev) =>
          applyDisputeRunnerFaultPenalty(prev),
        );
      }
      if (opsUnsuspendRunner) {
        updateRunnerTrustRecord(job.runner_id, (prev) => unsuspendRunner(prev));
      }
    }

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          status: 'CLOSED' as const,
          closed_at: closedAt,
          runner_payout_status: payout,
        };
      }),
    );

    setFirPackage(null);
    setOpsUnsuspendRunner(false);
    setOpsResolveHint(`Resolved as “${label}” → CLOSED (mock).`);
  };

  if (!job) {
    return (
      <div className="p-6 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <Package size={32} className="text-slate-600 mx-auto mb-3" />
        <p className="text-sm" style={{ color: '#64748B' }}>No active request found.</p>
        <button onClick={() => navigate('/sender/post')}
          className="mt-4 px-4 py-2 rounded-lg text-sm text-cyan-400 border"
          style={{ border: '1px solid #0E2D3D', background: '#061620' }}>
          Post a Request
        </button>
      </div>
    );
  }

  const runnerName = job.runner_name && job.runner_name !== 'You' ? job.runner_name : 'Karthik R';

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            TRACKING · {job.id}
          </div>
          <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
            Live Job Status
          </h1>
        </div>
        {job.status === 'OPEN' && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
            style={{ background: '#1C0A0A', border: '1px solid #3B1111', color: '#F87171' }}
          >
            <X size={12} />
            Cancel
          </button>
        )}
      </div>

      {/* Status card */}
      <div className="rounded-xl p-5" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
        {/* Timeline */}
        <div className="flex items-start justify-between mb-6">
          {TIMELINE_STEPS.map((s, i) => {
            const isDone = displayStep > i;
            const isActive = displayStep === i;
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${i === 0 ? 'ml-0' : 'ml-auto'} ${i === TIMELINE_STEPS.length - 1 ? 'mr-0' : 'mr-auto'}`}
                    style={{
                      background: isDone ? '#0A2010' : isActive ? '#061620' : '#111827',
                      border: `2px solid ${isDone ? '#10B981' : isActive ? '#06B6D4' : '#1E2D45'}`,
                    }}>
                    <Icon size={14} style={{ color: isDone ? '#10B981' : isActive ? '#06B6D4' : '#475569' }} />
                  </div>
                  {i < TIMELINE_STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1 transition-all duration-700"
                      style={{ background: isDone ? '#10B981' : '#1E2D45' }} />
                  )}
                </div>
                <div className="text-center mt-2">
                  <div className="text-[10px] font-medium" style={{ color: isDone ? '#10B981' : isActive ? '#22D3EE' : '#475569' }}>
                    {s.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current status detail */}
        <AnimatePresence mode="wait">
          <motion.div
            key={displayStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-center py-4"
          >
            {displayStep === 0 && (
              <>
                <div className="flex justify-center gap-1 mb-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
                <p className="text-white font-medium">Finding your Buddy</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  Notifying {3} active runners nearby...
                </p>
              </>
            )}
            {displayStep === 1 && (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: '#0A2010', border: '2px solid #10B981' }}>
                  <CheckCircle2 size={22} className="text-emerald-400" />
                </div>
                <p className="text-white font-medium">Buddy Found!</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  <span className="text-white">{runnerName}</span> accepted your request · ETA ~{job.eta || '10 min'}
                </p>
                {isPrePickupMatched && (
                  <p className="text-sm mt-3" style={{ color: '#FBBF24' }}>
                    Runner hasn't confirmed pickup yet.
                  </p>
                )}
              </>
            )}
            {displayStep === 2 && (
              <>
                <div className="text-3xl mb-2">📦</div>
                <p className="text-white font-medium">Picked up!</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  {runnerName} has your item and is heading to the drop point
                </p>
              </>
            )}
            {displayStep === 3 && !isDisputed && !isClosed && (
              <>
                <div className="text-3xl mb-2">✅</div>
                <p className="text-white font-medium">Delivered!</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  Please rate your Buddy and confirm payment
                </p>
              </>
            )}
            {isClosed && (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: '#0A2010', border: '2px solid #10B981' }}>
                  <CheckCircle2 size={22} className="text-emerald-400" />
                </div>
                <p className="text-white font-medium">Job closed</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  {job.closed_at
                    ? 'Ops resolution complete (mock). No payment step needed.'
                    : 'This job is closed.'}
                </p>
              </>
            )}
            {isDisputed && (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: '#1C0A0A', border: '2px solid #EF4444' }}>
                  <AlertCircle size={22} className="text-red-400" />
                </div>
                <p className="text-white font-medium">Dispute filed</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  Payment on hold while ops reviews
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* DISPUTED — ops / theft escalation + mock FIR support package */}
      {isDisputed && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 space-y-3"
          style={{ background: '#1C0A0A', border: '1px solid #3B1111' }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-sm font-medium text-red-300">Dispute under review</span>
          </div>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Ops notified{job.ops_notified ? ' ✓' : ''}. Case is under review (mock SLA: 4 hours).
          </p>
          {job.runner_payout_status === 'withheld' && (
            <p className="text-xs" style={{ color: '#FBBF24' }}>
              Runner payout withheld pending investigation.
            </p>
          )}
          {(jobTheftEscalation || disputedRunnerSuspended) && (
            <div className="rounded-lg px-3 py-2.5 space-y-2" style={{ background: '#2A0F0F', border: '1px solid #3B1111' }}>
              <p className="text-xs text-red-300 font-medium">
                Theft escalation active
              </p>
              <p className="text-[11px]" style={{ color: '#94A3B8' }}>
                {disputedRunnerSuspended
                  ? 'Runner account suspended pending investigation.'
                  : 'Escalation logged; suspension pending.'}
              </p>
              {jobTheftEscalation && (
                <>
                  <p className="text-[10px]" style={{ color: '#64748B' }}>
                    Mock / dev only — platform support package, not a legal FIR filing.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const pkg = buildFirExport(
                        job,
                        mockRunnerFromJob(job),
                        mockSenderFromJob(job, user),
                        trustEvents,
                      );
                      setFirPackage(pkg);
                      setFirCopyHint(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: '#7F1D1D', border: '1px solid #991B1B' }}
                  >
                    <FileText size={14} />
                    Generate FIR Support Package
                  </button>
                </>
              )}
            </div>
          )}
          {jobTheftEscalation && firPackage && firPackage.job_id === job.id && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-cyan-300">
                    FIR support package preview (mock)
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>
                    {firPackage.package_label}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const text = JSON.stringify(firPackage, null, 2);
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                        setFirCopyHint('Copied to clipboard (mock package).');
                      } else {
                        setFirCopyHint('Clipboard unavailable — select & copy the preview below.');
                      }
                    } catch {
                      setFirCopyHint('Clipboard blocked — select & copy the preview below.');
                    }
                  }}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-cyan-300 transition-colors"
                  style={{ background: '#061620', border: '1px solid #0E2D3D' }}
                >
                  <Copy size={12} />
                  Copy package
                </button>
              </div>
              {firCopyHint && (
                <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                  {firCopyHint}
                </p>
              )}
              <pre
                className="text-[10px] overflow-auto max-h-56 rounded-md p-2 whitespace-pre-wrap break-all"
                style={{
                  background: '#020617',
                  color: '#CBD5E1',
                  fontFamily: 'JetBrains Mono, monospace',
                  border: '1px solid #1E2D45',
                }}
              >
                {JSON.stringify(firPackage, null, 2)}
              </pre>
            </div>
          )}

          {/* DEV / mock ops resolution */}
          <div
            className="rounded-lg p-3 space-y-2.5"
            style={{ background: '#0B1120', border: '1px dashed #334155' }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                DEV / mock ops panel
              </p>
              <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>
                Resolve DISPUTED → CLOSED. Not a real ops dashboard.
              </p>
            </div>
            <div className="space-y-1.5">
              {(
                [
                  ['runner_at_fault', 'Runner at fault'],
                  ['sender_error', 'Sender error / pre-existing issue'],
                  ['unclear', 'Unclear / goodwill'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleResolveDispute(value)}
                  className="w-full text-left rounded-lg px-3 py-2 text-xs text-white transition-opacity hover:opacity-90"
                  style={{ background: '#111827', border: '1px solid #1E2D45' }}
                >
                  <span className="font-medium">{label}</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: '#64748B' }}>
                    {value === 'runner_at_fault'
                      ? 'Payout withheld · trust score −10 · keep suspension'
                      : value === 'sender_error'
                        ? 'Payout earned · suspension unchanged unless opted below'
                        : 'Payout earned (goodwill) · suspension unchanged unless opted below'}
                  </span>
                </button>
              ))}
            </div>
            {disputedRunnerSuspended && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={opsUnsuspendRunner}
                  onChange={(e) => setOpsUnsuspendRunner(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[11px]" style={{ color: '#94A3B8' }}>
                  Also unsuspend runner (explicit — theft suspension is not cleared by default)
                </span>
              </label>
            )}
            {opsResolveHint && (
              <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                {opsResolveHint}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Runner card (visible after matched) */}
      {displayStep >= 1 && !isDisputed && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4"
          style={{ background: '#0B1120', border: '1px solid #1E2D45' }}
        >
          <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            YOUR BUDDY
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)', fontSize: '1.1rem' }}>
              {runnerName.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{runnerName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-cyan-400"
                  style={{ background: '#061620', border: '1px solid #0E2D3D', fontFamily: 'JetBrains Mono, monospace' }}>
                  VERIFIED ✓
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-xs" style={{ color: '#F59E0B' }}>
                  <Star size={11} fill="#F59E0B" />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>4.9</span>
                </div>
                <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                  <Shield size={11} className="text-cyan-400" />
                  <span>Trust: 96</span>
                </div>
                <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                  <Package size={11} />
                  <span>47 runs</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: '#0D1525', border: '1px solid #1E2D45', color: '#64748B' }}>
                <Phone size={14} />
              </button>
              <button className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: '#0D1525', border: '1px solid #1E2D45', color: '#64748B' }}>
                <MessageSquare size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Job details */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E2D45' }}>
        <div className="px-4 py-3" style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
          <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>JOB DETAILS</div>
        </div>
        <div className="p-4 space-y-3" style={{ background: '#0B1120' }}>
          {[
            { label: 'From', value: job.pickup_location, icon: <div className="w-2 h-2 rounded-full bg-cyan-400" /> },
            { label: 'To', value: job.drop_location, icon: <div className="w-2 h-2 rounded-full bg-violet-400" /> },
            { label: 'Item', value: `${job.item_type} · ${job.weight} · ${job.risk} risk` },
            { label: 'Price', value: `₹${job.agreed_price ?? job.posted_price}`, mono: true },
            { label: 'Job ID', value: job.id, mono: true, muted: true },
          ].map(({ label, value, icon, mono, muted }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {icon && <span>{icon}</span>}
                <span className="text-xs" style={{ color: '#475569' }}>{label}</span>
              </div>
              <span className="text-xs text-right" style={{
                color: muted ? '#475569' : '#E2E8F0',
                fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
              }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-pickup no-show / re-pool */}
      {isPrePickupMatched && (
        <div className="space-y-2">
          {import.meta.env.DEV && !tenMinElapsed && (
            <button
              type="button"
              onClick={() => setDevNoshowElapsed(true)}
              className="w-full py-2.5 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-2"
              style={{ background: '#070B17', border: '1px solid #1A2535', color: '#94A3B8' }}
            >
              <Clock size={12} />
              Dev: Simulate 10 min elapsed
            </button>
          )}
          <button
            type="button"
            onClick={handleFindNewBuddy}
            disabled={!tenMinElapsed || !job.runner_id}
            className="w-full py-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2"
            style={{
              background: tenMinElapsed && job.runner_id ? '#1C0A0A' : '#070B17',
              border: `1px solid ${tenMinElapsed && job.runner_id ? '#3B1111' : '#1A2535'}`,
              color: tenMinElapsed && job.runner_id ? '#F87171' : '#475569',
              cursor: tenMinElapsed && job.runner_id ? 'pointer' : 'not-allowed',
            }}
          >
            <AlertCircle size={14} />
            Runner Unresponsive — Find New Buddy
          </button>
        </div>
      )}

      {/* Demo simulate button */}
      {displayStep < 3 && !isDisputed && (
        <button
          onClick={simulateProgress}
          disabled={simulating}
          className="w-full py-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2"
          style={{ background: '#070B17', border: '1px solid #1A2535', color: simulating ? '#475569' : '#94A3B8' }}
        >
          {simulating ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-slate-400 animate-spin" />
              Simulating delivery...
            </>
          ) : (
            <>
              <ChevronRight size={14} />
              Demo: Simulate Delivery Progress
            </>
          )}
        </button>
      )}

      {canRateAndPay && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/rate')}
          className="w-full py-3 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}
        >
          Rate & Confirm Payment →
        </motion.button>
      )}
    </div>
  );
}
