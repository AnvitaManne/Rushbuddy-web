import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useApp } from '../../context/AppContext';
import {
  Package, MapPin, Clock, Star, Shield, CheckCircle2,
  AlertCircle, Phone, MessageSquare, X, ChevronRight, Radio,
  AlertTriangle, UserX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TIMELINE_STEPS = [
  { key: 'OPEN', label: 'Finding Buddy', sub: 'Notifying runners...', icon: Radio },
  { key: 'MATCHED', label: 'Buddy Found', sub: 'Runner on the way', icon: Star },
  { key: 'IN_TRANSIT', label: 'Picked Up', sub: 'Item in transit', icon: Package },
  { key: 'DELIVERED', label: 'Delivered', sub: 'Rate your Buddy', icon: CheckCircle2 },
];

function getStepIndex(status: string) {
  const map: Record<string, number> = {
    OPEN: 0, MATCHED: 1, IN_TRANSIT: 2,
    DELIVERED: 3, CLOSED: 3, PENDING_RATING: 3,
    // ISSUE_REPORTED: item was picked up but not delivered normally
    ISSUE_REPORTED: 2,
  };
  return map[status] ?? 0;
}

export function TrackingPage() {
  const { jobs, setJobs, activeJob: ctxActiveJob } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  // Job ID passed via navigation state from HomePage job-row click.
  // Takes priority over everything else so the user always sees the job they tapped.
  const navJobId = (location.state as { jobId?: string } | null)?.jobId ?? null;

  const [localJobId, setLocalJobId] = useState<string | null>(null);

  useEffect(() => {
    if (navJobId) {
      // Explicit navigation from a job row — always show that exact job.
      setLocalJobId(navJobId);
    } else if (ctxActiveJob) {
      setLocalJobId(ctxActiveJob.id);
    } else {
      // Prefer active-status jobs; fall back to most-recently-created sender job.
      const active = jobs.find(j =>
        j.sender_id === 'u1' && ['OPEN', 'MATCHED', 'IN_TRANSIT', 'ISSUE_REPORTED'].includes(j.status)
      );
      if (active) {
        setLocalJobId(active.id);
      } else {
        const last = [...jobs]
          .filter(j => j.sender_id === 'u1')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (last) setLocalJobId(last.id);
      }
    }
  }, [navJobId, ctxActiveJob, jobs]);

  const job = jobs.find(j => j.id === localJobId) || jobs.find(j => j.sender_id === 'u1');

  const [simStep, setSimStep] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);

  const stepIndex = job ? getStepIndex(job.status) : 0;
  // For failure-path jobs, always use the real step — ignore any stale simStep
  // left over from a previous "Simulate Delivery Progress" run on the same component instance.
  const isFailureState = job?.status === 'ISSUE_REPORTED' || !!job?.no_answer_resolution;
  const displayStep = isFailureState ? stepIndex : simStep !== null ? simStep : stepIndex;

  const simulateProgress = async () => {
    if (!job || simulating) return;
    setSimulating(true);

    // Each entry: the status to set and the timeline display index.
    // PENDING_RATING reuses simIdx 3 (same "Delivered" step) so the UI
    // doesn't flicker, then we navigate to /rate with the job in the
    // correct state for RatingPage (PENDING_RATING → CLOSED/DISPUTED).
    const stages: Array<{ status: 'MATCHED' | 'IN_TRANSIT' | 'DELIVERED' | 'PENDING_RATING'; simIdx: number }> = [
      { status: 'MATCHED',        simIdx: 1 },
      { status: 'IN_TRANSIT',     simIdx: 2 },
      { status: 'DELIVERED',      simIdx: 3 },
      { status: 'PENDING_RATING', simIdx: 3 },
    ];

    for (const { status, simIdx } of stages) {
      // PENDING_RATING follows DELIVERED immediately (no extra visual pause).
      if (status !== 'PENDING_RATING') {
        await new Promise<void>(r => setTimeout(r, 1500));
      }
      setSimStep(simIdx);
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        status,
        runner_name:         status === 'MATCHED'    ? 'Karthik R'              : j.runner_name,
        runner_rating:       status === 'MATCHED'    ? 4.9                      : j.runner_rating,
        matched_at:          status === 'MATCHED'    ? new Date().toISOString() : j.matched_at,
        pickup_confirmed_at: status === 'IN_TRANSIT' ? new Date().toISOString() : j.pickup_confirmed_at,
        delivered_at:        status === 'DELIVERED'  ? new Date().toISOString() : j.delivered_at,
      } : j));
      if (status === 'PENDING_RATING') {
        await new Promise<void>(r => setTimeout(r, 800));
        navigate('/rate');
        break;
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
              job.status === 'ISSUE_REPORTED' ? (
                <>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ background: '#2D1A00', border: '2px solid #D97706' }}>
                    <AlertTriangle size={20} className="text-amber-400" />
                  </div>
                  <p className="text-white font-medium">
                    {job.no_answer_resolution === 'hold_for_ops' ? 'Runner Holding Item' : 'Delivery Issue'}
                  </p>
                  <p className="text-sm mt-1" style={{ color: '#D97706' }}>
                    {job.no_answer_resolution === 'hold_for_ops'
                      ? 'Sender unreachable · Ops has been notified'
                      : 'Issue reported · Ops reviewing'}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2">📦</div>
                  <p className="text-white font-medium">Picked up!</p>
                  <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                    {runnerName} has your item and is heading to the drop point
                  </p>
                </>
              )
            )}
            {displayStep === 3 && (
              <>
                <div className="text-3xl mb-2">✅</div>
                <p className="text-white font-medium">Delivered!</p>
                <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                  Please rate your Buddy and confirm payment
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* No-answer failure evidence card — shown when runner resolved a no-answer event */}
      {job.no_answer_resolution && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl overflow-hidden"
          style={{
            border: `1px solid ${job.no_answer_resolution === 'secure_drop' ? '#1A4020' : '#7C2D12'}`,
          }}
        >
          {/* Card header */}
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{
              background: job.no_answer_resolution === 'secure_drop' ? '#0A1A10' : '#1A0F05',
              borderBottom: `1px solid ${job.no_answer_resolution === 'secure_drop' ? '#1A4020' : '#3B1111'}`,
            }}
          >
            {job.no_answer_resolution === 'secure_drop' ? (
              <Shield size={13} className="text-emerald-400" />
            ) : (
              <AlertTriangle size={13} className="text-amber-400" />
            )}
            <span
              className="text-xs font-semibold"
              style={{
                color: job.no_answer_resolution === 'secure_drop' ? '#6EE7B7' : '#FCD34D',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {job.no_answer_resolution === 'secure_drop'
                ? 'SECURE DROP COMPLETED'
                : 'RUNNER HOLDING ITEM — OPS NOTIFIED'}
            </span>
          </div>

          {/* Card body */}
          <div className="p-4 space-y-2.5" style={{ background: '#0B1120' }}>
            {/* No-answer timeline */}
            {job.no_answer_at && (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: '#475569' }}>No answer at</span>
                <span style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                  {new Date(job.no_answer_at).toLocaleTimeString()}
                </span>
              </div>
            )}
            {job.no_answer_contact_attempts !== undefined && (
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: '#475569' }}>Contact attempts</span>
                <span style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                  {job.no_answer_contact_attempts} / 2
                </span>
              </div>
            )}
            {job.sender_unreachable_at && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <UserX size={11} className="text-red-400" />
                  <span style={{ color: '#475569' }}>Sender unreachable at</span>
                </div>
                <span style={{ color: '#FCA5A5', fontFamily: 'JetBrains Mono, monospace' }}>
                  {new Date(job.sender_unreachable_at).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Secure drop evidence */}
            {job.no_answer_resolution === 'secure_drop' && (
              <>
                {job.dropoff_secure_location && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#475569' }}>Dropped at</span>
                    <span className="text-emerald-400 font-medium">{job.dropoff_secure_location}</span>
                  </div>
                )}
                {job.dropoff_photo_url && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#475569' }}>Drop photo</span>
                    <span className="text-emerald-400">Uploaded ✓</span>
                  </div>
                )}
                {job.dropoff_geotag && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: '#475569' }}>Geotag</span>
                    <span style={{ color: '#94A3B8' }}>{job.dropoff_geotag.label}</span>
                  </div>
                )}
              </>
            )}

            {/* Hold-for-ops notice */}
            {job.no_answer_resolution === 'hold_for_ops' && (
              <div
                className="rounded-lg px-3 py-2.5 text-xs leading-relaxed"
                style={{ background: '#2D1A00', border: '1px solid #3B2A0A', color: '#D97706' }}
              >
                Runner is holding the item and awaiting ops instruction.
                Do not expect an unattended drop.
              </div>
            )}

            {/* Ops + payout summary */}
            <div className="border-t pt-2.5" style={{ borderColor: '#1E2D45' }}>
              <div className="flex items-center justify-between text-xs mb-2">
                <span style={{ color: '#475569' }}>Ops notified</span>
                <span style={{ color: job.ops_notified ? '#10B981' : '#64748B' }}>
                  {job.ops_notified ? '✓ Yes' : 'Pending'}
                </span>
              </div>
              <div
                className="rounded-lg px-3 py-2 text-xs flex items-center justify-between"
                style={{ background: '#0A1A0D', border: '1px solid #1A3520' }}
              >
                <span style={{ color: '#475569' }}>Runner payout</span>
                <span className="text-emerald-400 font-medium">Earned — full amount</span>
              </div>
              <div
                className="rounded-lg px-3 py-2 mt-1.5 text-xs flex items-center justify-between"
                style={{ background: '#0D1120', border: '1px solid #1E2D45' }}
              >
                <span style={{ color: '#475569' }}>Sender refund</span>
                <span style={{ color: '#64748B' }}>None</span>
              </div>
            </div>
          </div>
        </motion.div>
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

      {/* Demo simulate button — hidden once a no-answer path has been resolved */}
      {displayStep < 3 && !job.no_answer_resolution && job.status !== 'ISSUE_REPORTED' && (
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

      {displayStep === 3 && (
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
