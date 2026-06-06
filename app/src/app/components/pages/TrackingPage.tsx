import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { assertTransition } from '@/domain/jobTransitions';
import { canSenderCancelJob } from '@/domain/postingValidation';
import {
  Package, MapPin, Clock, Star, Shield, CheckCircle2,
  AlertCircle, Phone, MessageSquare, X, ChevronRight, Radio, KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TIMELINE_STEPS = [
  { key: 'OPEN', label: 'Finding Buddy', sub: 'Notifying runners...', icon: Radio },
  { key: 'MATCHED', label: 'Buddy Found', sub: 'Runner on the way', icon: Star },
  { key: 'IN_TRANSIT', label: 'Picked Up', sub: 'Item in transit', icon: Package },
  { key: 'DELIVERED', label: 'Delivered', sub: 'Rate your Buddy', icon: CheckCircle2 },
];

function getStepIndex(status: string) {
  const map: Record<string, number> = { OPEN: 0, MATCHED: 1, IN_TRANSIT: 2, DELIVERED: 3, CLOSED: 3, PENDING_RATING: 3 };
  return map[status] ?? 0;
}

export function TrackingPage() {
  const { jobs, setJobs, setActiveJob, activeJob: ctxActiveJob, user } = useApp();
  const navigate = useNavigate();
  const senderId = user?.id ?? 'u1';

  const [localJobId, setLocalJobId] = useState<string | null>(null);

  useEffect(() => {
    if (ctxActiveJob?.sender_id === senderId) setLocalJobId(ctxActiveJob.id);
    else {
      const j = jobs.find(
        j =>
          j.sender_id === senderId &&
          ['OPEN', 'MATCHED', 'IN_TRANSIT', 'PENDING_RATING'].includes(j.status),
      );
      if (j) setLocalJobId(j.id);
      else {
        const last = [...jobs]
          .filter(j => j.sender_id === senderId)
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          )[0];
        if (last) setLocalJobId(last.id);
      }
    }
  }, [ctxActiveJob, jobs, senderId]);

  /**
   * Priority: pinned localJobId → most recent active → most recently created.
   * Never filters by status so DELIVERED jobs remain visible for rating.
   */
  const job = (() => {
    const senderJobs = jobs.filter(j => j.sender_id === senderId);
    if (!senderJobs.length) return undefined;

    if (localJobId) {
      const pinned = senderJobs.find(j => j.id === localJobId);
      if (pinned) return pinned;
    }

    const active = senderJobs.find(j =>
      ['OPEN', 'MATCHED', 'IN_TRANSIT', 'PENDING_RATING'].includes(j.status),
    );
    if (active) return active;

    return [...senderJobs].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )[0];
  })();

  const isMode2Landmark = job?.handoff_mode === 'mode_2_landmark';

  const [simStep, setSimStep] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);

  const stepIndex = job ? getStepIndex(job.status) : 0;
  const displayStep = simStep !== null ? simStep : stepIndex;

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
        runner_name: ns === 'MATCHED' ? 'Karthik R' : j.runner_name,
        runner_rating: ns === 'MATCHED' ? 4.9 : j.runner_rating,
        matched_at: ns === 'MATCHED' ? new Date().toISOString() : j.matched_at,
        pickup_confirmed_at: ns === 'IN_TRANSIT' ? new Date().toISOString() : j.pickup_confirmed_at,
        delivered_at: ns === 'DELIVERED' ? new Date().toISOString() : j.delivered_at,
      } : j));
      if (ns === 'DELIVERED') { await new Promise(r => setTimeout(r, 800)); navigate('/rate'); break; }
    }
    setSimulating(false);
  };

  const handleCancel = () => {
    if (!job || !user) return;
    if (!canSenderCancelJob(job, user.id)) return;
    const transition = assertTransition(job.status, 'CLOSED');
    if (!transition.ok) return;
    setJobs(prev =>
      prev.map(j => (j.id === job.id ? { ...j, status: 'CLOSED' as const } : j)),
    );
    setActiveJob(null);
    navigate('/home');
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
            {displayStep === 3 && job?.status === 'PENDING_RATING' && (
              <>
                <div className="text-3xl mb-2">🔒</div>
                <p className="text-white font-medium">Code Verified — Payment Pending</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  Runner confirmed handoff. Pay and rate to mark job delivered.
                </p>
              </>
            )}
            {displayStep === 3 && job?.status !== 'PENDING_RATING' && (
              <>
                <div className="text-3xl mb-2">✅</div>
                <p className="text-white font-medium">Delivered!</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  Payment received · Rated & closed
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Sender-only handoff code — receiver uses app-less verbal handoff */}
      {job.confirmation_code && !['CLOSED', 'DELIVERED', 'PENDING_RATING'].includes(job.status) && (
        <div
          className="rounded-xl p-4"
          style={{ background: '#0D1525', border: '1px solid #2D3A5C' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={14} className="text-cyan-400" />
            <div
              className="text-xs"
              style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}
            >
              HANDOFF CODE · FOR YOU ONLY
            </div>
          </div>
          <div
            className="text-center py-3 mb-3 rounded-lg tracking-[0.35em]"
            style={{
              background: '#060A14',
              border: '1px solid #1E2D45',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '1.75rem',
              fontWeight: 600,
              color: '#22D3EE',
            }}
          >
            {job.confirmation_code}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
            {isMode2Landmark ? (
              <>
                Share this code only with the person meeting your runner at the landmark
                {job.corridor_landmark ? (
                  <>
                    {' '}
                    (<span className="text-white">{job.corridor_landmark}</span>)
                  </>
                ) : null}
                . The runner will enter it at the landmark handoff. The receiver does not need
                the RushBuddy app.
              </>
            ) : (
              <>
                Share this code only with the person receiving the package. The runner will
                enter it at handoff. The receiver does not need the RushBuddy app.
              </>
            )}
          </p>
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

      {displayStep === 3 && job?.status === 'PENDING_RATING' && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => navigate('/rate')}
          className="w-full py-3.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
        >
          <span>Pay & Rate Now</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>→</span>
        </motion.button>
      )}

    </div>
  );
}
