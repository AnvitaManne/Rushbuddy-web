import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { assertTransition } from '@/domain/jobTransitions';
import { REQUIRED_CONTACT_ATTEMPTS } from '@/domain/failureHandling';
import {
  MapPin, Package, CheckCircle2, AlertTriangle, Phone,
  Clock, ArrowRight, Shield, Star, ChevronDown, PhoneOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type DeliveryPhase = 'going_pickup' | 'condition_ack' | 'in_transit' | 'delivered';

export function ActiveDeliveryPage() {
  const { jobs, setJobs } = useApp();
  const navigate = useNavigate();

  const activeJob = jobs.find(j =>
    j.runner_id === 'u1' && ['MATCHED', 'IN_TRANSIT'].includes(j.status)
  ) || jobs.find(j => j.runner_id === 'u1' && j.status !== 'CLOSED');

  const [phase, setPhase] = useState<DeliveryPhase>('going_pickup');
  const [condAckLoading, setCondAckLoading] = useState(false);
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [showIssuePanel, setShowIssuePanel] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  // true once runner taps "No Answer at Door"; panel stays until resolved or delivery confirmed
  const [showNoAnswerPanel, setShowNoAnswerPanel] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Open no-answer panel if job has no_answer_at; close it if sender already responded.
  // Handles page refreshes and dev-console job seeding.
  useEffect(() => {
    if (activeJob?.sender_response_at) {
      setShowNoAnswerPanel(false);
    } else if (activeJob?.no_answer_at) {
      setShowNoAnswerPanel(true);
    }
  }, [activeJob?.no_answer_at, activeJob?.sender_response_at]);

  const elapsed = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;

  const handleConditionAck = async () => {
    setCondAckLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setPhase('in_transit');
    if (activeJob) {
      setJobs(prev => prev.map(j => j.id === activeJob.id ? {
        ...j, status: 'IN_TRANSIT', pickup_confirmed_at: new Date().toISOString()
      } : j));
    }
    setCondAckLoading(false);
  };

  const handleConfirmDelivery = async () => {
    setDeliverLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setPhase('delivered');
    if (activeJob) {
      setJobs(prev => prev.map(j => j.id === activeJob.id ? {
        ...j, status: 'DELIVERED', delivered_at: new Date().toISOString()
      } : j));
    }
    setDeliverLoading(false);
    await new Promise(r => setTimeout(r, 800));
    navigate('/home');
  };

  const handleIssue = () => {
    if (activeJob) {
      const result = assertTransition(activeJob.status, 'ISSUE_REPORTED');
      if (!result.ok) {
        console.error('[RushBuddy] Invalid transition in handleIssue:', result.error);
        setShowIssuePanel(false);
        return;
      }
      setJobs(prev => prev.map(j => j.id === activeJob.id ? { ...j, status: 'ISSUE_REPORTED' } : j));
    }
    setShowIssuePanel(false);
    navigate('/home');
  };

  /** Runner taps "No Answer at Door" at the dropoff location.
   *  Always starts fresh: resets contact attempts to 0 and stamps a new no_answer_at.
   *  This button is only reachable when !showNoAnswerPanel, so it is always a fresh start. */
  const handleNoAnswer = () => {
    if (!activeJob) return;
    setJobs(prev => prev.map(j => j.id === activeJob.id ? {
      ...j,
      no_answer_at: new Date().toISOString(),
      no_answer_contact_attempts: 0,
    } : j));
    setShowNoAnswerPanel(true);
  };

  /** Increments contact attempt counter up to REQUIRED_CONTACT_ATTEMPTS. */
  const handleLogContactAttempt = () => {
    if (!activeJob) return;
    setJobs(prev => prev.map(j => {
      if (j.id !== activeJob.id) return j;
      const current = j.no_answer_contact_attempts ?? 0;
      if (current >= REQUIRED_CONTACT_ATTEMPTS) return j;
      return { ...j, no_answer_contact_attempts: current + 1 };
    }));
  };

  /**
   * Sender responded during the 20-minute wait window.
   * Records sender_response_at, collapses the no-answer panel, and
   * returns the runner to the normal in-transit delivery view.
   * Job status stays IN_TRANSIT; runner proceeds to Confirm Delivery normally.
   */
  const handleSenderResponded = () => {
    if (!activeJob) return;
    setJobs(prev => prev.map(j => j.id === activeJob.id ? {
      ...j,
      sender_response_at: new Date().toISOString(),
    } : j));
    setShowNoAnswerPanel(false);
  };

  if (!activeJob) {
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

  const phaseLabels: Record<DeliveryPhase, { title: string; sub: string }> = {
    going_pickup: { title: 'Go to Pickup', sub: 'Head to the sender\'s pickup point' },
    condition_ack: { title: 'Condition Check', sub: 'Acknowledge item condition at pickup' },
    in_transit: showNoAnswerPanel
      ? { title: 'No Answer at Door', sub: 'Sender notified — wait 20 min, make 2 contact attempts' }
      : { title: 'In Transit', sub: 'Deliver to the drop location' },
    delivered: { title: 'Delivered!', sub: 'Job complete. Earnings updated.' },
  };

  const steps: DeliveryPhase[] = ['going_pickup', 'condition_ack', 'in_transit', 'delivered'];
  const stepIdx = steps.indexOf(phase);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-xl space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            ACTIVE DELIVERY · {activeJob.id}
          </div>
          <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
            {phaseLabels[phase].title}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            {phaseLabels[phase].sub}
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
                <p className="text-sm text-white">{activeJob.pickup_location}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                    <MapPin size={11} />
                    {activeJob.distance || '0.8 km'}
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                    <Clock size={11} />
                    ~{activeJob.eta || '8 min'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg mb-4"
                style={{ background: '#0B1525', border: '1px solid #1E2D45' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fontSize: '0.9rem' }}>
                  {activeJob.sender_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-white">{activeJob.sender_name}</div>
                  <div className="text-[10px]" style={{ color: '#64748B' }}>Sender · {activeJob.sender_hostel}</div>
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
                  { label: 'Type', value: activeJob.item_type },
                  { label: 'Weight', value: activeJob.weight },
                  { label: 'Risk', value: activeJob.risk },
                  { label: 'Description', value: activeJob.description || 'None provided' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: '#475569' }}>{label}</span>
                    <span style={{ color: '#E2E8F0' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Photo option for fragile/valuable */}
              {(activeJob.risk === 'Fragile' || activeJob.risk === 'Valuable') && (
                <div className="rounded-lg p-3 mb-4" style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
                  <p className="text-xs font-medium text-white mb-2">
                    📸 Recommended: Photograph item at pickup
                  </p>
                  <p className="text-[11px] mb-3" style={{ color: '#64748B' }}>
                    Risk level is <span className="text-amber-400">{activeJob.risk}</span>. A photo protects both parties in a dispute.
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
                disabled={condAckLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white mb-3"
                style={{ background: condAckLoading ? '#1A1005' : 'linear-gradient(135deg, #F59E0B, #EF4444)', opacity: condAckLoading ? 0.8 : 1 }}
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
              {/* Route — always visible */}
              <div className="rounded-lg p-3 mb-4 space-y-3" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <div className="w-px bg-slate-700" style={{ height: 20 }} />
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-white">{activeJob.pickup_location}</p>
                      <p className="text-[10px] text-emerald-400">✓ Picked up</p>
                    </div>
                    <div>
                      <p className="text-xs text-white">{activeJob.drop_location}</p>
                      <p className="text-[10px]" style={{ color: '#64748B' }}>
                        {showNoAnswerPanel ? 'No answer — waiting' : 'Heading here'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {!showNoAnswerPanel ? (
                /* ── Normal happy-path view ─────────────────────────────── */
                <>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-4"
                    style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      IN TRANSIT
                    </div>
                    <span className="text-xs" style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>

                  <button
                    onClick={handleConfirmDelivery}
                    disabled={deliverLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white mb-3"
                    style={{ background: deliverLoading ? '#0A2010' : 'linear-gradient(135deg, #10B981, #059669)', opacity: deliverLoading ? 0.8 : 1 }}
                  >
                    {deliverLoading ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        Confirm Delivery — Job Done
                      </>
                    )}
                  </button>

                  {/* No Answer at Door — separate from generic issue reporting */}
                  <button
                    onClick={handleNoAnswer}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm border mb-2 transition-all"
                    style={{ background: '#1A0F05', border: '1px solid #3B2A0A', color: '#F59E0B' }}
                  >
                    <PhoneOff size={13} />
                    No Answer at Door
                  </button>

                  <button
                    onClick={() => setShowIssuePanel(true)}
                    className="w-full py-2 rounded-lg text-sm border"
                    style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
                  >
                    Report an Issue
                  </button>
                </>
              ) : (
                /* ── No-answer protocol view ────────────────────────────── */
                <>
                  {/* Status banner */}
                  <div className="rounded-lg p-3 mb-4 flex items-center justify-between"
                    style={{ background: '#1A1100', border: '1px solid #3B2700' }}>
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      NO ANSWER — WAITING
                    </div>
                    <span className="text-xs" style={{ color: '#78350F', fontFamily: 'JetBrains Mono, monospace' }}>
                      {activeJob.no_answer_at
                        ? new Date(activeJob.no_answer_at).toLocaleTimeString()
                        : '—'}
                    </span>
                  </div>

                  {/* Protocol instructions card */}
                  <div className="rounded-lg p-4 mb-4" style={{ background: '#1A0F05', border: '1px solid #3B2A0A' }}>
                    <div className="flex items-start gap-3 mb-4">
                      <PhoneOff size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-300 mb-1">Sender has been notified</p>
                        <p className="text-xs" style={{ color: '#92400E' }}>
                          Wait <strong>20 minutes</strong> at or near the drop location and make{' '}
                          <strong>2 contact attempts</strong> before marking the sender unreachable.
                          Your payout is secured regardless of outcome.
                        </p>
                      </div>
                    </div>

                    {/* Contact attempt tracker */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs" style={{ color: '#92400E' }}>Contact attempts</span>
                      <div className="flex gap-2">
                        {Array.from({ length: REQUIRED_CONTACT_ATTEMPTS }).map((_, i) => {
                          const logged = (activeJob.no_answer_contact_attempts ?? 0) > i;
                          return (
                            <div
                              key={i}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all"
                              style={{
                                background: logged ? '#3B2A0A' : '#1A0F05',
                                border: `1px solid ${logged ? '#F59E0B' : '#3B2A0A'}`,
                                color: logged ? '#FCD34D' : '#475569',
                              }}
                            >
                              {logged ? '✓' : i + 1}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleLogContactAttempt}
                      disabled={(activeJob.no_answer_contact_attempts ?? 0) >= REQUIRED_CONTACT_ATTEMPTS}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: (activeJob.no_answer_contact_attempts ?? 0) >= REQUIRED_CONTACT_ATTEMPTS
                          ? '#1A1505' : '#2A1A05',
                        border: '1px solid #3B2A0A',
                        color: (activeJob.no_answer_contact_attempts ?? 0) >= REQUIRED_CONTACT_ATTEMPTS
                          ? '#475569' : '#F59E0B',
                        opacity: (activeJob.no_answer_contact_attempts ?? 0) >= REQUIRED_CONTACT_ATTEMPTS ? 0.6 : 1,
                      }}
                    >
                      <Phone size={13} />
                      {(activeJob.no_answer_contact_attempts ?? 0) >= REQUIRED_CONTACT_ATTEMPTS
                        ? '2 / 2 attempts logged'
                        : `Log contact attempt (${activeJob.no_answer_contact_attempts ?? 0} / ${REQUIRED_CONTACT_ATTEMPTS})`}
                    </button>
                  </div>

                  {/* Sender responded: record timestamp, collapse panel, resume normal delivery */}
                  <button
                    onClick={handleSenderResponded}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white mb-2"
                    style={{ background: 'linear-gradient(135deg, #06B6D4, #0EA5E9)' }}
                  >
                    <CheckCircle2 size={15} />
                    Sender Responded — Continue Delivery
                  </button>

                  <button
                    onClick={() => setShowIssuePanel(true)}
                    className="w-full py-2 rounded-lg text-sm border"
                    style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
                  >
                    Report an Issue
                  </button>
                </>
              )}
            </motion.div>
          )}

          {phase === 'delivered' && (
            <motion.div key="phase4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-white font-semibold text-lg mb-1">Delivered!</h3>
              <p className="text-sm" style={{ color: '#64748B' }}>Earnings updated. Dispute window: 2 hours.</p>
              <div className="mt-4 px-4 py-3 rounded-lg inline-block"
                style={{ background: '#0A2010', border: '1px solid #1A4020' }}>
                <div className="text-emerald-400 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.3rem' }}>
                  +₹{activeJob.agreed_price ?? activeJob.posted_price}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>Base earnings</div>
              </div>
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
              ₹{activeJob.agreed_price ?? activeJob.posted_price}
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
