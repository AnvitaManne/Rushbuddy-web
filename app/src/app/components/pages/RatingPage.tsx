import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import { assertTransition } from '@/domain/jobTransitions';
import { getAllowedPaymentMethods } from '@/domain/paymentPolicy';
import { createTrustEvent, isTheftLikeDispute, suspendRunner } from '@/domain/trustOps';
import { services, isSupabaseAdapter } from '@/services';
import type { PaymentMethod } from '@/domain/enums';
import { Star, AlertCircle, CheckCircle2, Shield, Smartphone, Banknote, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';

const TIPS = [0, 5, 10, 20];
const PAYMENT_LABELS: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  upi: { label: 'UPI', icon: <Smartphone size={14} /> },
  phonepe: { label: 'PhonePe', icon: <CreditCard size={14} /> },
  cash: { label: 'Cash', icon: <Banknote size={14} /> },
};

const DISPUTE_TYPES = ['Item damaged', 'Not delivered', 'Wrong item'];

export function RatingPage() {
  const { jobs, setJobs, user, appendTrustEvent, updateRunnerTrustRecord, refreshData } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const jobId = (location.state as { jobId?: string } | null)?.jobId;
  const uid = user?.id ?? defaultUser.id;

  // Prefer explicit jobId from navigation (simulate / home / tracking).
  // Fall back by sender + payable status — never require user to be non-null.
  const job =
    (jobId ? jobs.find(j => j.id === jobId) : undefined)
    || jobs.find(j => j.sender_id === uid && j.status === 'PENDING_RATING')
    || jobs.find(j => j.sender_id === uid && j.status === 'DELIVERED')
    || jobs.find(j => j.sender_id === uid && j.status === 'ISSUE_REPORTED');

  // Payment & rating are the sender's job. A runner who reaches this route (e.g. an
  // old link) is bounced back to their active-delivery view.
  const isSender = !job || job.sender_id === uid;
  useEffect(() => {
    if (job && !isSender) navigate('/runner/active', { replace: true });
  }, [job, isSender, navigate]);

  const allowedMethods = job ? getAllowedPaymentMethods(job) : (['upi', 'phonepe', 'cash'] as PaymentMethod[]);

  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [tip, setTip] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(allowedMethods[0] ?? 'upi');
  const [paymentConfirmed, setPaymentConfirmed] = useState(job?.payment_status === 'paid');
  const [disputeMode, setDisputeMode] = useState(false);
  const [disputeType, setDisputeType] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [disputeError, setDisputeError] = useState('');

  const runnerName = job?.runner_name && job.runner_name !== 'You' ? job.runner_name : 'Karthik R';
  const basePrice = job?.agreed_price ?? job?.posted_price ?? 40;
  const total = basePrice + tip;

  const canDispute = job ? assertTransition(job.status, 'DISPUTED').ok : false;
  const primaryDisabled = loading || (!disputeMode && paymentConfirmed && stars === 0) || (disputeMode && !disputeType);

  const handleConfirmPayment = async () => {
    if (!job) return;
    try {
      await services.payments.recordPayment(job.id, { method: paymentMethod, tip_amount: tip });
    } catch (err) {
      console.warn('[RushBuddy] recordPayment failed', err);
    }
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      payment_method: paymentMethod,
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      tip_amount: tip,
    } : j));
    setPaymentConfirmed(true);
  };

  const handleRateAndClose = async () => {
    if (!job || stars === 0) return;
    const result = assertTransition(job.status, 'CLOSED');
    if (!result.ok) return;
    setLoading(true);
    // Persist rating (+ payment upsert) then the terminal close so both accounts sync.
    try {
      await services.payments.recordPayment(job.id, { method: paymentMethod, tip_amount: tip, rating: stars });
    } catch (err) {
      console.warn('[RushBuddy] rating persist failed', err);
    }
    await services.jobs.closeJob(job.id);
    setJobs(prev => prev.map(j => j.id === job.id ? {
      ...j,
      status: 'CLOSED',
      rating: stars,
      tip_amount: tip,
      closed_at: new Date().toISOString(),
    } : j));
    setLoading(false);
    setSubmitted(true);
    await new Promise(r => setTimeout(r, 1500));
    navigate('/home');
  };

  const handleDispute = async () => {
    if (!job) return;
    if (!disputeType) {
      setDisputeError('Pick an issue type above first.');
      return;
    }
    if (!canDispute) {
      setDisputeError(
        `Cannot dispute while job is ${job.status}. Finish a real handoff (runner enters confirmation code) so status is PENDING_RATING, then soft-refresh and try again.`,
      );
      return;
    }
    setLoading(true);
    setDisputeError('');

    try {
      // Persist the dispute (supabase RPC also suspends the runner on theft-like types).
      const updated = await services.jobs.fileDispute(job.id, {
        dispute_type: disputeType || 'Not specified',
        description: disputeDesc,
      });
      if (!updated) {
        setLoading(false);
        setDisputeError('Could not file the dispute — job missing after sync. Soft-refresh and retry.');
        return;
      }

      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        ...updated,
        dispute_type: disputeType || 'Not specified',
        dispute_description: disputeDesc,
        disputed_at: new Date().toISOString(),
      } : j));

      if (isTheftLikeDispute(disputeType) && job.runner_id) {
        if (isSupabaseAdapter) {
          // Server-side RPC already logged escalation + suspension; pull the truth in.
          await refreshData();
        } else {
          appendTrustEvent(createTrustEvent({
            runner_id: job.runner_id,
            job_id: job.id,
            type: 'theft_escalation',
            description: `Theft-like dispute "${disputeType}" on ${job.id} — escalated for investigation (mock).`,
          }));
          appendTrustEvent(createTrustEvent({
            runner_id: job.runner_id,
            job_id: job.id,
            type: 'suspension',
            description: `Runner suspended pending theft investigation on ${job.id} (mock).`,
          }));
          updateRunnerTrustRecord(job.runner_id, prev => suspendRunner(prev, `Theft escalation: "${disputeType}" dispute`));
        }
      }

      setLoading(false);
      setSubmitted(true);
      await new Promise(r => setTimeout(r, 1500));
      navigate('/home');
    } catch (err) {
      setLoading(false);
      setDisputeError(err instanceof Error ? err.message : 'Could not file the dispute — try again.');
    }
  };

  const handleSubmit = () => {
    if (disputeMode) handleDispute();
    else if (!paymentConfirmed) handleConfirmPayment();
    else handleRateAndClose();
  };

  const ratingLabels = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" style={{ fontFamily: 'Inter, sans-serif' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#0A2010', border: '2px solid #10B981' }}>
            <CheckCircle2 size={38} className="text-emerald-400" />
          </div>
          <h2 className="text-white mb-2" style={{ fontWeight: 600, fontSize: '1.2rem' }}>
            {disputeMode ? 'Dispute Filed' : 'Thanks for rating!'}
          </h2>
          <p className="text-sm" style={{ color: '#64748B' }}>
            {disputeMode
              ? isTheftLikeDispute(disputeType)
                ? 'Theft escalation logged — runner suspended pending review. Ops team will review within 4 hours.'
                : 'Ops team will review within 4 hours.'
              : `You rated ${runnerName} ${stars} stars. Job closed.`}
          </p>
          <div className="mt-4 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 text-center space-y-3" style={{ fontFamily: 'Inter, sans-serif' }}>
        <p className="text-sm" style={{ color: '#64748B' }}>No delivery ready to rate yet.</p>
        <button
          onClick={() => navigate('/home')}
          className="px-4 py-2 rounded-lg text-sm text-cyan-400"
          style={{ background: '#061620', border: '1px solid #0E2D3D' }}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-md space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div>
        <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
          {paymentConfirmed ? 'STEP 2 · RATE YOUR BUDDY' : 'STEP 1 · CONFIRM PAYMENT'}
        </div>
        <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
          {paymentConfirmed ? 'How was the delivery?' : 'Pay your Buddy'}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>
          {paymentConfirmed
            ? 'Stars only — tip and payment were already confirmed.'
            : 'Choose tip + payment method first. Rating comes next.'}
        </p>
      </div>

      {/* Runner card */}
      <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}>
            {runnerName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{runnerName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-cyan-400"
                style={{ background: '#061620', border: '1px solid #0E2D3D', fontFamily: 'JetBrains Mono, monospace' }}>
                VERIFIED
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: '#64748B' }}>
              <Shield size={11} className="text-cyan-400" />
              Trust Score: 96 · 47 deliveries
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              {job.item_type} · {job.pickup_location?.split(',')[0]} → {job.drop_location?.split(',')[0]}
            </div>
          </div>
        </div>

        {/* Stars */}
        {!disputeMode && paymentConfirmed && (
          <div>
            <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              HOW WAS YOUR DELIVERY?
            </div>
            <div className="flex gap-2 justify-center mb-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => setStars(s)}
                  onMouseEnter={() => setHoveredStar(s)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    size={32}
                    fill={(hoveredStar || stars) >= s ? '#F59E0B' : 'transparent'}
                    className="transition-colors"
                    style={{ color: (hoveredStar || stars) >= s ? '#F59E0B' : '#1E2D45' }}
                  />
                </button>
              ))}
            </div>
            {stars > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm text-amber-400"
              >
                {ratingLabels[stars]}
              </motion.div>
            )}
          </div>
        )}

        {!disputeMode && !paymentConfirmed && (
          <div className="text-xs" style={{ color: '#475569' }}>
            Tip + payment method below — then confirm. Rating is the next step.
          </div>
        )}
      </div>

      {/* Tip — part of payment (before confirm), not during rating */}
      {!disputeMode && !paymentConfirmed && (
        <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
          <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            ADD A TIP (OPTIONAL)
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TIPS.map(t => (
              <button
                key={t}
                onClick={() => setTip(t)}
                className="py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: tip === t ? '#0A1A10' : '#070B17',
                  border: `1px solid ${tip === t ? '#10B981' : '#1E2D45'}`,
                  color: tip === t ? '#10B981' : '#64748B',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {t === 0 ? '₹0' : `₹${t}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment method */}
      {!disputeMode && !paymentConfirmed && (
        <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
          <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            PAYMENT METHOD
          </div>
          <div className="grid grid-cols-3 gap-2">
            {allowedMethods.map(id => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  background: paymentMethod === id ? '#061620' : '#070B17',
                  border: `1px solid ${paymentMethod === id ? '#06B6D4' : '#1E2D45'}`,
                  color: paymentMethod === id ? '#22D3EE' : '#64748B',
                }}
              >
                {PAYMENT_LABELS[id].icon}
                {PAYMENT_LABELS[id].label}
              </button>
            ))}
          </div>
          {job.handoff_mode === 'mode_2_landmark' && (
            <p className="text-[10px] mt-2" style={{ color: '#475569' }}>
              Cash is hidden for intercity (Mode 2) jobs — the receiver is off-campus and unverified in person.
            </p>
          )}
          {paymentMethod === 'cash' && (
            <p className="text-[10px] mt-2" style={{ color: '#475569' }}>
              Cash payments are recorded as intent but not verified. UPI escrow is coming in v2.
            </p>
          )}
        </div>
      )}

      {/* Payment summary */}
      {!disputeMode && (
        <div className="rounded-xl p-4" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
          <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            PAYMENT SUMMARY
          </div>
          {[
            { label: 'Base fee', value: `₹${basePrice}` },
            { label: 'Platform fee', value: '₹0 (Beta)' },
            { label: 'Tip', value: `₹${tip}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm mb-2">
              <span style={{ color: '#64748B' }}>{label}</span>
              <span style={{ color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
            </div>
          ))}
          <div className="h-px my-2" style={{ background: '#1A3520' }} />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Total</span>
            <span className="font-semibold text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem' }}>₹{total}</span>
          </div>
          {paymentConfirmed && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 size={11} />
              Payment confirmed via {PAYMENT_LABELS[job.payment_method ?? paymentMethod].label}
            </div>
          )}
        </div>
      )}

      {/* Dispute mode */}
      {disputeMode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4"
          style={{ background: '#1C0A0A', border: '1px solid #3B1111' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} className="text-red-400" />
            <span className="text-sm font-medium text-red-300">File a Dispute</span>
          </div>

          {!canDispute && (
            <p className="text-[11px] mb-3 text-amber-300/90 flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span>
                Job is still <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{job.status}</span>.
                Disputes need <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>PENDING_RATING</span> after
                a real handoff (runner enters the confirmation code). Soft-refresh after that, then retry.
              </span>
            </p>
          )}

          <div className="mb-3">
            <div className="text-xs mb-2" style={{ color: '#F87171' }}>Issue type</div>
            <div className="grid grid-cols-3 gap-2">
              {DISPUTE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setDisputeType(t); setDisputeError(''); }}
                  className="py-2 rounded text-xs transition-all"
                  style={{
                    background: disputeType === t ? '#3B1111' : '#1C0A0A',
                    border: `1px solid ${disputeType === t ? '#EF4444' : '#3B1111'}`,
                    color: disputeType === t ? '#F87171' : '#EF4444',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {!disputeType && (
              <p className="text-[10px] mt-2" style={{ color: '#92400E' }}>
                Select an issue type to unlock Submit Dispute.
              </p>
            )}
          </div>

          <textarea
            value={disputeDesc}
            onChange={e => setDisputeDesc(e.target.value)}
            rows={3}
            placeholder="Describe what happened..."
            className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none resize-none"
            style={{ background: '#0D0303', border: '1px solid #3B1111' }}
          />

          {isTheftLikeDispute(disputeType) && (
            <p className="text-[10px] mt-2 text-red-300">
              Theft-like reports ("{disputeType}") immediately suspend the runner and open a theft escalation pending ops review.
            </p>
          )}

          {disputeError && (
            <p className="text-[11px] mt-2 text-red-300 flex items-start gap-1">
              <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />{disputeError}
            </p>
          )}

          <p className="text-[10px] mt-2" style={{ color: '#6B2121' }}>
            Ops will review within 4 hours. Dispute window: 2 hours post-delivery. After that, job auto-closes.
          </p>
        </motion.div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={primaryDisabled}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
          style={{
            background: primaryDisabled
              ? '#1E2D45'
              : disputeMode
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : 'linear-gradient(135deg, #06B6D4, #6366F1)',
            color: primaryDisabled ? '#475569' : 'white',
          }}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Processing...
            </>
          ) : disputeMode ? (
            !disputeType ? 'Pick an issue type first' : 'Submit Dispute'
          ) : !paymentConfirmed ? (
            `Confirm Payment · ₹${total}`
          ) : stars === 0 ? (
            'Pick a star rating to close'
          ) : (
            'Submit rating & close job'
          )}
        </button>
        {!disputeMode && paymentConfirmed && stars === 0 && (
          <p className="text-[10px] text-center" style={{ color: '#64748B' }}>
            Button unlocks after you select 1–5 stars.
          </p>
        )}
        {disputeMode && !disputeType && (
          <p className="text-[10px] text-center" style={{ color: '#64748B' }}>
            Select Item damaged / Not delivered / Wrong item above.
          </p>
        )}

        <button
          type="button"
          onClick={() => { setDisputeMode(d => !d); setStars(0); setDisputeError(''); }}
          className="w-full py-2.5 rounded-lg text-sm border transition-all"
          style={{
            background: '#0B1120',
            border: `1px solid ${disputeMode ? '#1E2D45' : '#3B1111'}`,
            color: disputeMode ? '#64748B' : '#F87171',
          }}
        >
          {disputeMode ? '← Back to Rating' : 'Report an Issue Instead'}
        </button>
      </div>
    </div>
  );
}
