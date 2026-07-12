import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import { assertTransition } from '@/domain/jobTransitions';
import type { JobStatus } from '@/domain/enums';
import { computeDisputeWindowEndsAt } from '@/domain/paymentPolicy';
import {
  canMarkSenderUnreachable,
  canUseSecureDrop,
  createMockDropoffEvidence,
  markRunnerPayoutEarnedPatch,
  requiresOpsHold,
} from '@/domain/failureHandling';
import {
  MapPin, Package, CheckCircle2, AlertTriangle, AlertCircle, Phone,
  Clock, ArrowRight, KeyRound, PhoneMissed, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type DeliveryPhase = 'going_pickup' | 'condition_ack' | 'in_transit' | 'resolved';

/**
 * Handoff completion is a single user action (correct code / secure drop) that the state
 * machine models as two hops: IN_TRANSIT → DELIVERED → PENDING_RATING. Validates both hops
 * with `assertTransition` before the caller applies the final `PENDING_RATING` patch.
 */
function assertHandoffToPendingRating(status: JobStatus) {
  const toDelivered = assertTransition(status, 'DELIVERED');
  if (!toDelivered.ok) return toDelivered;
  return assertTransition('DELIVERED', 'PENDING_RATING');
}

const RUNNER_LIVE_STATUSES = ['MATCHED', 'IN_TRANSIT', 'ISSUE_REPORTED', 'PENDING_RATING', 'DISPUTED', 'CLOSED'] as const;

export function ActiveDeliveryPage() {
  const { jobs, setJobs, activeJob: ctxActiveJob, user } = useApp();
  const navigate = useNavigate();
  const uid = user?.id ?? defaultUser.id;

  const isRunnerLive = (status: string) =>
    (RUNNER_LIVE_STATUSES as readonly string[]).includes(status);

  // Prefer Home's selected job (incl. ISSUE_REPORTED hold-for-ops), then any live runner job.
  const activeJob =
    (ctxActiveJob && ctxActiveJob.runner_id === uid && isRunnerLive(ctxActiveJob.status)
      ? ctxActiveJob
      : null)
    ?? jobs.find(j => j.runner_id === uid && (j.status === 'MATCHED' || j.status === 'IN_TRANSIT'))
    ?? jobs.find(j => j.runner_id === uid && j.status === 'ISSUE_REPORTED')
    ?? null;
  // Keep working against the live job record so status/field patches are always current.
  const job = activeJob ? jobs.find(j => j.id === activeJob.id) ?? activeJob : null;

  const [phase, setPhase] = useState<DeliveryPhase>(job?.status === 'IN_TRANSIT' ? 'in_transit' : 'going_pickup');
  const [condAckLoading, setCondAckLoading] = useState(false);
  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeAttemptsLeft, setCodeAttemptsLeft] = useState(3);
  const [showNoAnswerPanel, setShowNoAnswerPanel] = useState(false);
  const [secureLocation, setSecureLocation] = useState('');

  useEffect(() => {
    if (job?.status === 'IN_TRANSIT' && phase !== 'in_transit' && phase !== 'resolved') {
      setPhase('in_transit');
    }
  }, [job?.status, phase]);

  // Fresh attempt budget when switching jobs / re-entering transit.
  useEffect(() => {
    setCodeAttemptsLeft(3);
    setCodeInput('');
    setCodeError('');
  }, [job?.id]);

  useEffect(() => {
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;

  const canAckCondition = job?.risk === 'Low' || photoCaptured;

  const handleConditionAck = async () => {
    if (!job || !canAckCondition) return;
    const result = assertTransition(job.status, 'IN_TRANSIT');
    if (!result.ok) { return; }
    setCondAckLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      status: 'IN_TRANSIT',
      pickup_confirmed_at: new Date().toISOString(),
      condition_acknowledged: true,
      photo_url: photoCaptured ? `mock://pickup/${j.id}.jpg` : j.photo_url,
    } : j));
    setPhase('in_transit');
    setCondAckLoading(false);
  };

  const handleConfirmCode = () => {
    if (!job) return;
    if (codeAttemptsLeft <= 0) {
      setCodeError('Handoff code locked after 3 wrong tries. Use “Sender not answering?” or Report an Issue.');
      return;
    }
    if (codeInput.trim() !== job.confirmation_code) {
      const left = codeAttemptsLeft - 1;
      setCodeAttemptsLeft(left);
      setCodeInput('');
      if (left <= 0) {
        setCodeError('Incorrect code. Locked after 3 failed attempts — delivery not completed. Open “Sender not answering?” or Report an Issue.');
      } else {
        setCodeError(`Incorrect code — delivery not completed. ${left} attempt${left === 1 ? '' : 's'} left.`);
      }
      return;
    }
    const result = assertHandoffToPendingRating(job.status);
    if (!result.ok) { setCodeError(result.error); return; }
    const delivered_at = new Date().toISOString();
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      status: 'PENDING_RATING',
      delivered_at,
      dispute_window_ends_at: computeDisputeWindowEndsAt(delivered_at),
      ...markRunnerPayoutEarnedPatch(),
    } : j));
    setCodeError('');
    setPhase('resolved');
    navigate('/rate', { state: { jobId: job.id } });
  };

  const handleLogContactAttempt = () => {
    if (!job) return;
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      no_answer_contact_attempts: (j.no_answer_contact_attempts ?? 0) + 1,
      no_answer_at: j.no_answer_at ?? new Date().toISOString(),
    } : j));
  };

  const handleSecureDrop = () => {
    if (!job) return;
    const result = assertHandoffToPendingRating(job.status);
    if (!result.ok) return;
    const delivered_at = new Date().toISOString();
    const evidence = createMockDropoffEvidence(job.id);
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      status: 'PENDING_RATING',
      delivered_at,
      dispute_window_ends_at: computeDisputeWindowEndsAt(delivered_at),
      no_answer_resolution: 'secure_drop',
      dropoff_secure_location: secureLocation || 'Left at door / reception, per policy',
      ...evidence,
      ...markRunnerPayoutEarnedPatch(),
    } : j));
    navigate('/rate', { state: { jobId: job.id } });
  };

  const handleHoldForOps = () => {
    if (!job) return;
    const result = assertTransition(job.status, 'ISSUE_REPORTED');
    if (!result.ok) return;
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      status: 'ISSUE_REPORTED',
      ops_notified: true,
      no_answer_resolution: 'hold_for_ops',
      ...markRunnerPayoutEarnedPatch(),
    } : j));
    setPhase('resolved');
  };

  const handleIssue = () => {
    if (!job) return;
    const result = assertTransition(job.status, 'ISSUE_REPORTED');
    if (result.ok) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'ISSUE_REPORTED', ops_notified: true } : j));
    }
    setShowIssuePanel(false);
  };

  if (!job) {
    return (
      <div className="p-6 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <Package size={32} className="text-slate-600 mx-auto mb-3" />
        <p className="text-sm mb-4" style={{ color: '#64748B' }}>No active delivery right now.</p>
        <button onClick={() => navigate('/runner/feed')}
          className="px-4 py-2 rounded-lg text-sm text-cyan-400"
          style={{ background: '#061620', border: '1px solid #0E2D3D' }}>
          Browse Job Feed
        </button>
      </div>
    );
  }

  if (job.status === 'ISSUE_REPORTED') {
    return (
      <div className="p-6 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <ShieldAlert size={32} className="text-amber-400 mx-auto mb-3" />
        <h3 className="text-white font-semibold mb-1">Held for Ops</h3>
        <p className="text-sm mb-1 text-white/80" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{job.id}</p>
        <p className="text-sm mb-4" style={{ color: '#64748B' }}>
          {job.pickup_location} → {job.drop_location}
          <br />
          Sender unreachable — item held per fragile/valuable policy. Your payout is earned.
        </p>
        <button type="button" onClick={() => navigate('/runner/feed')}
          className="px-4 py-2 rounded-lg text-sm text-cyan-400"
          style={{ background: '#061620', border: '1px solid #0E2D3D' }}>
          Browse Job Feed
        </button>
      </div>
    );
  }

  if (job.status === 'PENDING_RATING' || job.status === 'CLOSED' || job.status === 'DISPUTED') {
    return (
      <div className="p-6 text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
        <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-3" />
        <h3 className="text-white font-semibold mb-1">
          {job.status === 'DISPUTED' ? 'Under ops review' : job.status === 'CLOSED' ? 'Job closed' : 'Handoff complete'}
        </h3>
        <p className="text-sm mb-1 text-white/80" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{job.id}</p>
        <p className="text-sm mb-4" style={{ color: '#64748B' }}>
          {job.status === 'PENDING_RATING'
            ? 'Waiting on sender payment & rating.'
            : job.status === 'DISPUTED'
              ? 'Sender filed a dispute — ops will resolve (mock).'
              : `Closed · payout ${job.runner_payout_status ?? 'n/a'}`}
        </p>
        <button type="button" onClick={() => navigate('/home')}
          className="px-4 py-2 rounded-lg text-sm text-cyan-400"
          style={{ background: '#061620', border: '1px solid #0E2D3D' }}>
          Back to Home
        </button>
      </div>
    );
  }

  const phaseLabels: Record<Exclude<DeliveryPhase, 'resolved'>, { title: string; sub: string }> = {
    going_pickup: { title: 'Go to Pickup', sub: 'Head to the sender\'s pickup point' },
    condition_ack: { title: 'Condition Check', sub: 'Acknowledge item condition at pickup' },
    in_transit: { title: 'In Transit', sub: 'Deliver to the drop location' },
  };

  const steps: DeliveryPhase[] = ['going_pickup', 'condition_ack', 'in_transit'];
  const stepIdx = steps.indexOf(phase === 'resolved' ? 'in_transit' : phase);

  const canMarkUnreachable = canMarkSenderUnreachable(job);
  const canSecureDrop = canUseSecureDrop(job);
  const needsOpsHold = requiresOpsHold(job);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-xl space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            ACTIVE DELIVERY · {job.id}
          </div>
          <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
            {phaseLabels[phase === 'resolved' ? 'in_transit' : phase].title}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            {phaseLabels[phase === 'resolved' ? 'in_transit' : phase].sub}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {elapsed}
          </span>
        </div>
      </div>

      {/* Delivery progress */}
      <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => {
            const isDone = stepIdx > i;
            const isActive = stepIdx === i;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500"
                    style={{
                      background: isDone ? '#0A2010' : isActive ? '#061620' : '#111827',
                      border: `2px solid ${isDone ? '#10B981' : isActive ? '#06B6D4' : '#1E2D45'}`,
                    }}>
                    {isDone
                      ? <CheckCircle2 size={13} className="text-emerald-400" />
                      : <span className="text-[10px]" style={{
                          color: isActive ? '#22D3EE' : '#475569',
                          fontFamily: 'JetBrains Mono, monospace'
                        }}>{i + 1}</span>
                    }
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-px" style={{ background: isDone ? '#10B981' : '#1E2D45' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Phase content */}
        <AnimatePresence mode="wait">
          {phase === 'going_pickup' && (
            <motion.div key="phase1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="rounded-lg p-3 mb-4" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>PICKUP LOCATION</span>
                </div>
                <p className="text-sm text-white">{job.pickup_location}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                    <MapPin size={11} />
                    {job.distance || '0.8 km'}
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                    <Clock size={11} />
                    ~{job.eta || '8 min'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg mb-4"
                style={{ background: '#0B1525', border: '1px solid #1E2D45' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fontSize: '0.9rem' }}>
                  {job.sender_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white">{job.sender_name}</div>
                  <div className="text-[10px]" style={{ color: '#64748B' }}>Sender · {job.sender_hostel}</div>
                </div>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
                  <Phone size={13} className="text-slate-400" />
                </button>
              </div>

              <button
                onClick={() => setPhase('condition_ack')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #06B6D4, #0EA5E9)' }}
              >
                I've reached the pickup point
                <ArrowRight size={15} />
              </button>
            </motion.div>
          )}

          {phase === 'condition_ack' && (
            <motion.div key="phase2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="rounded-lg p-4 mb-4" style={{ background: '#1A0F05', border: '1px solid #3B2A0A' }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300 mb-1">Mandatory Condition Check</p>
                    <p className="text-xs" style={{ color: '#92400E' }}>
                      By tapping "Condition Acknowledged", you confirm the item was received in acceptable condition.
                      This is a <strong>timestamped legal record</strong>. The job cannot proceed without this step.
                    </p>
                  </div>
                </div>
              </div>

              {/* Item details */}
              <div className="rounded-lg p-3 mb-4 space-y-2" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>ITEM TO PICK UP</div>
                {[
                  { label: 'Type', value: job.item_type },
                  { label: 'Weight', value: job.weight },
                  { label: 'Risk', value: job.risk },
                  { label: 'Description', value: job.description || 'None provided' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: '#475569' }}>{label}</span>
                    <span style={{ color: '#E2E8F0' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Photo gate for fragile/valuable */}
              {(job.risk === 'Fragile' || job.risk === 'Valuable') && (
                <div className="rounded-lg p-3 mb-4" style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
                  <p className="text-xs font-medium text-white mb-2">
                    📸 Required: Photograph item at pickup
                  </p>
                  <p className="text-[11px] mb-3" style={{ color: '#64748B' }}>
                    Risk level is <span className="text-amber-400">{job.risk}</span>. A photo is required before you can acknowledge condition.
                  </p>
                  <button
                    onClick={() => setPhotoCaptured(true)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: photoCaptured ? '#0A2010' : '#0B1120',
                      border: `1px solid ${photoCaptured ? '#1A4020' : '#1E2D45'}`,
                      color: photoCaptured ? '#10B981' : '#64748B',
                    }}
                  >
                    {photoCaptured ? '✓ Photo captured' : 'Capture photo (simulated)'}
                  </button>
                </div>
              )}

              <button
                onClick={handleConditionAck}
                disabled={condAckLoading || !canAckCondition}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white mb-1"
                style={{
                  background: condAckLoading ? '#1A1005' : canAckCondition ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : '#1E2D45',
                  color: canAckCondition ? 'white' : '#475569',
                  opacity: condAckLoading ? 0.8 : 1,
                }}
              >
                {condAckLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    Condition Acknowledged — Start Delivery
                  </>
                )}
              </button>
              {!canAckCondition && (
                <p className="text-[10px] mb-3 text-center" style={{ color: '#F59E0B' }}>
                  Capture a pickup photo first — required for Fragile / Valuable items.
                </p>
              )}
              {canAckCondition && <div className="mb-3" />}

              <button
                onClick={() => setShowIssuePanel(true)}
                className="w-full py-2 rounded-lg text-sm border transition-all"
                style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
              >
                Report an Issue
              </button>
            </motion.div>
          )}

          {phase === 'in_transit' && (
            <motion.div key="phase3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Route */}
              <div className="rounded-lg p-3 mb-4 space-y-3" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <div className="w-px bg-slate-700" style={{ height: 20 }} />
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-white">{job.pickup_location}</p>
                      <p className="text-[10px] text-emerald-400">✓ Picked up</p>
                    </div>
                    <div>
                      <p className="text-xs text-white">{job.drop_location}</p>
                      <p className="text-[10px]" style={{ color: '#64748B' }}>Heading here</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Handoff code entry */}
              <div className="rounded-lg p-4 mb-4" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound size={13} className="text-emerald-400" />
                  <span className="text-xs text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    HANDOFF CODE
                  </span>
                </div>
                <p className="text-[11px] mb-3" style={{ color: '#64748B' }}>
                  Ask the person receiving the package for the sender’s 4-digit code. Wrong code will not complete the job · {codeAttemptsLeft}/3 attempts left.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={codeInput}
                    disabled={codeAttemptsLeft <= 0}
                    onChange={e => { setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setCodeError(''); }}
                    placeholder="0000"
                    className="flex-1 px-3 py-2.5 rounded-lg text-center text-lg text-white outline-none tracking-widest disabled:opacity-50"
                    style={{
                      background: '#060A14',
                      border: `1px solid ${codeError ? '#EF4444' : '#1A3520'}`,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                  <button
                    onClick={handleConfirmCode}
                    disabled={codeAttemptsLeft <= 0 || codeInput.length < 4}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                    style={{
                      background: codeAttemptsLeft <= 0 || codeInput.length < 4
                        ? '#1E2D45'
                        : 'linear-gradient(135deg, #10B981, #059669)',
                    }}
                    title={
                      codeAttemptsLeft <= 0
                        ? 'Locked after 3 wrong codes'
                        : codeInput.length < 4
                          ? 'Enter all 4 digits'
                          : 'Submit handoff code'
                    }
                  >
                    {codeAttemptsLeft <= 0
                      ? 'Locked'
                      : codeInput.length < 4
                        ? 'Enter 4 digits'
                        : 'Submit code'}
                  </button>
                </div>
                {codeError && (
                  <p className="text-[11px] mt-2 text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} />{codeError}
                  </p>
                )}
              </div>

              {/* No answer / sender unreachable flow */}
              <div className="rounded-lg p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <button
                  onClick={() => setShowNoAnswerPanel(s => !s)}
                  className="w-full flex items-center justify-between text-xs"
                  style={{ color: '#94A3B8' }}
                >
                  <span className="flex items-center gap-1.5">
                    <PhoneMissed size={12} />
                    Sender not answering?
                  </span>
                  <span className="text-[10px]" style={{ color: '#475569' }}>
                    {job.no_answer_contact_attempts ?? 0} attempt(s) logged
                  </span>
                </button>

                {showNoAnswerPanel && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 space-y-3">
                    {!canMarkUnreachable && (
                      <button
                        onClick={handleLogContactAttempt}
                        className="w-full py-2 rounded-lg text-xs border"
                        style={{ background: '#070B17', border: '1px solid #1A2535', color: '#94A3B8' }}
                      >
                        Log contact attempt ({job.no_answer_contact_attempts ?? 0}/2 required)
                      </button>
                    )}

                    {canMarkUnreachable && (
                      <div className="rounded-lg p-3 space-y-2" style={{ background: '#1A0F05', border: '1px solid #3B2A0A' }}>
                        <p className="text-[11px] text-amber-300">
                          Sender unreachable after {job.no_answer_contact_attempts ?? 0} attempts.
                          {canSecureDrop ? ' Low-risk item — you may use a secure drop.' : ' This item must be held for ops.'}
                        </p>

                        {canSecureDrop && (
                          <>
                            <input
                              type="text"
                              value={secureLocation}
                              onChange={e => setSecureLocation(e.target.value)}
                              placeholder="Where did you leave it? e.g. reception desk"
                              className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder-slate-600 outline-none"
                              style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                            />
                            <button
                              onClick={handleSecureDrop}
                              className="w-full py-2 rounded-lg text-xs font-semibold text-white"
                              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                            >
                              Confirm Secure Drop — Complete Delivery
                            </button>
                          </>
                        )}

                        {needsOpsHold && (
                          <button
                            onClick={handleHoldForOps}
                            className="w-full py-2 rounded-lg text-xs font-semibold text-white"
                            style={{ background: 'linear-gradient(135deg, #F59E0B, #DC2626)' }}
                          >
                            Hold for Ops — Do Not Leave Unattended
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <button
                onClick={() => setShowIssuePanel(true)}
                className="w-full py-2 rounded-lg text-sm border"
                style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
              >
                Report an Issue
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Earnings preview */}
      <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
        <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>EARNINGS PREVIEW</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.2rem' }}>
              ₹{job.agreed_price ?? job.posted_price}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>Agreed base fee</div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: '#64748B' }}>Platform fee: <span className="text-emerald-400">₹0</span> (beta)</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Tip set by sender after delivery</div>
          </div>
        </div>
      </div>

      {/* Issue panel */}
      <AnimatePresence>
        {showIssuePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-5"
              style={{ background: '#0B1120', border: '1px solid #1E2D45' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-amber-400" />
                <h3 className="text-white font-medium">Report an Issue</h3>
              </div>

              <textarea
                value={issueText}
                onChange={e => setIssueText(e.target.value)}
                rows={3}
                placeholder="Describe the issue (sender unreachable, location wrong, etc.)"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none resize-none mb-4"
                style={{ background: '#060A14', border: '1px solid #1E2D45' }}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowIssuePanel(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm border"
                  style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleIssue}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white"
                  style={{ background: '#3B1A05', border: '1px solid #6B3010', color: '#F97316' }}
                >
                  Flag to Ops
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
