import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import { assertTransition } from '@/domain/jobTransitions';
import { computeDisputeWindowEndsAt } from '@/domain/paymentPolicy';
import { applyNoShowStrike, buildFirExport, createTrustEvent } from '@/domain/trustOps';
import {
  Package, MapPin, Clock, Star, Shield, CheckCircle2,
  AlertCircle, Phone, MessageSquare, X, ChevronRight, Radio, KeyRound, Users, FileWarning, Copy, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TIMELINE_STEPS = [
  { key: 'OPEN', label: 'Finding Buddy', sub: 'Notifying runners...', icon: Radio },
  { key: 'MATCHED', label: 'Buddy Found', sub: 'Runner on the way', icon: Star },
  { key: 'IN_TRANSIT', label: 'Picked Up', sub: 'Item in transit', icon: Package },
  { key: 'PENDING_RATING', label: 'Delivered', sub: 'Rate your Buddy', icon: CheckCircle2 },
];

function getStepIndex(status: string) {
  const map: Record<string, number> = {
    OPEN: 0, MATCHED: 1, IN_TRANSIT: 2,
    DELIVERED: 3, PENDING_RATING: 3, CLOSED: 3, ISSUE_REPORTED: 3, DISPUTED: 3,
  };
  return map[status] ?? 0;
}

const FIND_NEW_BUDDY_WAIT_MS = 10 * 60 * 1000;

export function TrackingPage() {
  const { jobs, setJobs, activeJob: ctxActiveJob, user, appendTrustEvent, updateRunnerTrustRecord } = useApp();
  const navigate = useNavigate();
  const uid = user?.id ?? defaultUser.id;

  const [localJobId, setLocalJobId] = useState<string | null>(null);

  useEffect(() => {
    if (ctxActiveJob) setLocalJobId(ctxActiveJob.id);
    else {
      const j = jobs.find(j => j.sender_id === uid && ['OPEN', 'MATCHED', 'IN_TRANSIT', 'PENDING_RATING', 'ISSUE_REPORTED', 'DISPUTED'].includes(j.status));
      if (j) setLocalJobId(j.id);
      else {
        const last = [...jobs].filter(j => j.sender_id === uid).sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (last) setLocalJobId(last.id);
      }
    }
  }, [ctxActiveJob, jobs, uid]);

  const job = jobs.find(j => j.id === localJobId) || jobs.find(j => j.sender_id === uid);

  const [simStep, setSimStep] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [firData, setFirData] = useState<ReturnType<typeof buildFirExport> | null>(null);
  const [firCopied, setFirCopied] = useState(false);

  const stepIndex = job ? getStepIndex(job.status) : 0;
  const displayStep = simStep !== null ? simStep : stepIndex;

  const canFindNewBuddy = !!job
    && job.status === 'MATCHED'
    && !job.pickup_confirmed_at
    && !!job.matched_at
    && Date.now() - new Date(job.matched_at).getTime() >= FIND_NEW_BUDDY_WAIT_MS;
  const devFindNewBuddyAvailable = !!job && job.status === 'MATCHED' && !job.pickup_confirmed_at && import.meta.env.DEV;

  const simulateProgress = async () => {
    if (!job || simulating) return;
    setSimulating(true);
    const nextStatuses = ['MATCHED', 'IN_TRANSIT', 'PENDING_RATING'] as const;
    let current = job.status;
    for (let i = 0; i < nextStatuses.length; i++) {
      const ns = nextStatuses[i];
      // Handoff completion is modeled as two hops (IN_TRANSIT → DELIVERED → PENDING_RATING);
      // validate both before collapsing into the single PENDING_RATING patch below.
      const result = ns === 'PENDING_RATING'
        ? (() => {
            const toDelivered = assertTransition(current, 'DELIVERED');
            return toDelivered.ok ? assertTransition('DELIVERED', 'PENDING_RATING') : toDelivered;
          })()
        : assertTransition(current, ns);
      if (!result.ok) break;
      current = ns;
      const idx = TIMELINE_STEPS.findIndex(s => s.key === ns);
      await new Promise(r => setTimeout(r, 1500));
      setSimStep(idx);
      const delivered_at = new Date().toISOString();
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j, status: ns,
        runner_name: ns === 'MATCHED' ? (j.runner_name ?? 'Karthik R') : j.runner_name,
        runner_rating: ns === 'MATCHED' ? (j.runner_rating ?? 4.9) : j.runner_rating,
        runner_id: ns === 'MATCHED' ? (j.runner_id ?? 'r-sim') : j.runner_id,
        matched_at: ns === 'MATCHED' ? new Date().toISOString() : j.matched_at,
        pickup_confirmed_at: ns === 'IN_TRANSIT' ? new Date().toISOString() : j.pickup_confirmed_at,
        delivered_at: ns === 'PENDING_RATING' ? delivered_at : j.delivered_at,
        dispute_window_ends_at: ns === 'PENDING_RATING' ? computeDisputeWindowEndsAt(delivered_at) : j.dispute_window_ends_at,
      } : j));
      if (ns === 'PENDING_RATING') {
        await new Promise(r => setTimeout(r, 800));
        setSimulating(false);
        navigate('/rate', { state: { jobId: job.id } });
        return;
      }
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
    if (!job || !job.runner_id) return;
    const result = assertTransition('MATCHED', 'OPEN');
    if (!result.ok) return;
    const runnerId = job.runner_id;
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      status: 'OPEN',
      runner_id: undefined,
      runner_name: undefined,
      runner_rating: undefined,
      runner_hostel: undefined,
      matched_at: undefined,
      agreed_price: undefined,
    } : j));
    updateRunnerTrustRecord(runnerId, prev => applyNoShowStrike(prev));
    appendTrustEvent(createTrustEvent({
      runner_id: runnerId,
      job_id: job.id,
      type: 'no_show',
      description: `Re-pooled ${job.id} to Find New Buddy — no pickup confirmation.`,
    }));
  };

  const handleGenerateFir = async () => {
    if (!job) return;
    const fir = buildFirExport(job);
    setFirData(fir);
    setFirCopied(false);
    try {
      await navigator.clipboard.writeText(JSON.stringify(fir, null, 2));
      setFirCopied(true);
    } catch {
      // clipboard unavailable — FIR JSON still shown inline below
    }
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

      {/* Confirmation code — visible while the job hasn't been handed off yet */}
      {['OPEN', 'MATCHED', 'IN_TRANSIT'].includes(job.status) && (
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-emerald-400" />
            <div>
              <div className="text-[10px]" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                HANDOFF CODE — GIVE TO YOUR RUNNER
              </div>
              <div className="text-emerald-400 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.3rem', letterSpacing: '0.15em' }}>
                {job.confirmation_code}
              </div>
            </div>
          </div>
        </div>
      )}

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
            {displayStep === 3 && (
              <>
                <div className="text-3xl mb-2">
                  {job.status === 'DISPUTED' ? '⚠️' : job.status === 'ISSUE_REPORTED' ? '🛑' : '✅'}
                </div>
                <p className="text-white font-medium">
                  {job.status === 'DISPUTED' ? 'Dispute filed' : job.status === 'ISSUE_REPORTED' ? 'Held for Ops' : 'Delivered!'}
                </p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  {job.status === 'DISPUTED'
                    ? 'Ops is reviewing this dispute.'
                    : job.status === 'ISSUE_REPORTED'
                      ? 'Sender was unreachable — item held by ops.'
                      : 'Please rate your Buddy and confirm payment'}
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Find New Buddy — MATCHED, pre-pickup */}
      {(canFindNewBuddy || devFindNewBuddyAvailable) && job.status === 'MATCHED' && !job.pickup_confirmed_at && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 flex items-center justify-between gap-3" style={{ background: '#1A0F05', border: '1px solid #3B2A0A' }}>
          <div className="flex items-start gap-2">
            <Users size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-amber-300 font-medium">Runner hasn't confirmed pickup</p>
              <p className="text-[11px]" style={{ color: '#92400E' }}>
                {canFindNewBuddy ? 'It\'s been over 10 minutes since match.' : 'Dev shortcut — skip the 10 min wait.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleFindNewBuddy}
            className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626)' }}
          >
            Find New Buddy
          </button>
        </motion.div>
      )}

      {/* CTA to rate — PENDING_RATING / ISSUE_REPORTED */}
      {(job.status === 'PENDING_RATING' || job.status === 'ISSUE_REPORTED') && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/rate', { state: { jobId: job.id } })}
          className="w-full py-3 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}
        >
          {job.status === 'ISSUE_REPORTED' ? 'Review & Report Issue →' : 'Rate & Confirm Payment →'}
        </motion.button>
      )}

      {/* DISPUTED — FIR support package */}
      {job.status === 'DISPUTED' && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: '#1C0A0A', border: '1px solid #3B1111' }}>
          <div className="flex items-center gap-2">
            <FileWarning size={14} className="text-red-400" />
            <span className="text-sm text-red-300 font-medium">Dispute — FIR Support Package</span>
          </div>
          <p className="text-[11px]" style={{ color: '#F87171' }}>
            Generates a structured incident export (job, parties, timeline, dispute) to hand to campus security / police.
          </p>
          <button
            onClick={handleGenerateFir}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
          >
            {firCopied ? <Check size={14} /> : <Copy size={14} />}
            Generate FIR Support Package
          </button>
          {firData && (
            <pre className="text-[10px] p-3 rounded-lg overflow-auto max-h-56" style={{ background: '#0D0303', border: '1px solid #3B1111', color: '#F87171' }}>
              {JSON.stringify(firData, null, 2)}
            </pre>
          )}
          {firCopied && <p className="text-[10px] text-emerald-400">Copied JSON to clipboard.</p>}
        </div>
      )}

      {/* Runner card (visible after matched) */}
      {displayStep >= 1 && (
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
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{job.runner_rating ?? 4.9}</span>
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

      {/* Demo simulate button */}
      {displayStep < 3 && (
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
    </div>
  );
}
