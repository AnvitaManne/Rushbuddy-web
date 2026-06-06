import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { assertTransition } from '@/domain/jobTransitions';
import {
  Star, AlertCircle, CheckCircle2, Shield, Smartphone,
  ArrowRight, Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type PageStep = 'payment' | 'rating' | 'processing_payment' | 'payment_done';

export function RatingPage() {
  const { jobs, setJobs, user } = useApp();
  const navigate = useNavigate();
  const userId = user?.id ?? 'u1';

  const job =
    jobs.find(j => j.sender_id === userId && j.status === 'PENDING_RATING') ||
    jobs.find(j => j.sender_id === userId && j.status === 'DELIVERED');

  const [step, setStep] = useState<PageStep>('payment');
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [disputeMode, setDisputeMode] = useState(false);
  const [disputeType, setDisputeType] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const runnerName =
    job?.runner_name && job.runner_name !== 'You' ? job.runner_name : 'Karthik R';
  const basePrice = job?.agreed_price ?? job?.posted_price ?? 40;

  const ratingLabels = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];

  const handlePayNow = async () => {
    setStep('processing_payment');
    await new Promise(r => setTimeout(r, 1800));
    setStep('payment_done');
    await new Promise(r => setTimeout(r, 1000));
    setStep('rating');
  };

  const handleSubmitRating = async () => {
    if (stars === 0 && !disputeMode) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    if (job) {
      const targetStatus = disputeMode ? ('DISPUTED' as const) : ('DELIVERED' as const);
      const transition = assertTransition(job.status, targetStatus);
      if (transition.ok) {
        setJobs(prev =>
          prev.map(j =>
            j.id === job.id
              ? {
                  ...j,
                  status: targetStatus,
                  rating: stars,
                  tip_amount: 0,
                  delivered_at: new Date().toISOString(),
                }
              : j,
          ),
        );
      }
    }
    setLoading(false);
    setSubmitted(true);
    await new Promise(r => setTimeout(r, 1800));
    navigate('/home');
  };

  // No pending job — nothing to pay/rate. Bounce the user back home.
  if (!job) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#0A2010', border: '2px solid #10B981' }}>
            <CheckCircle2 size={28} className="text-emerald-400" />
          </div>
          <p className="text-white font-medium mb-1">All caught up!</p>
          <p className="text-sm mb-4" style={{ color: '#64748B' }}>No payment pending right now.</p>
          <button onClick={() => navigate('/home')}
            className="px-4 py-2 rounded-lg text-sm text-cyan-400 border"
            style={{ border: '1px solid #0E2D3D', background: '#061620' }}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className="min-h-[60vh] flex items-center justify-center p-6"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: '#0A2010', border: '2px solid #10B981' }}
          >
            <CheckCircle2 size={38} className="text-emerald-400" />
          </div>
          <h2 className="text-white mb-2" style={{ fontWeight: 600, fontSize: '1.2rem' }}>
            {disputeMode ? 'Dispute Filed' : 'Delivered & Closed!'}
          </h2>
          <p className="text-sm" style={{ color: '#64748B' }}>
            {disputeMode
              ? 'Ops team will review within 4 hours.'
              : `Paid ₹${basePrice} · ${runnerName} rated ${stars} ⭐`}
          </p>
          <div className="mt-4 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-md space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div>
        <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
          FLOW 5 · PAYMENT & RATING
        </div>
        <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
          {step === 'rating' ? 'Rate your Buddy' : 'Pay your Buddy'}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
          {step === 'rating'
            ? 'Delivery confirmed — leave a rating to close the job.'
            : 'Complete payment to confirm delivery and close the job.'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['payment', 'rating'] as const).map((s, i) => {
          const isDone = step === 'rating' && s === 'payment';
          const isActive =
            s === 'payment'
              ? ['payment', 'processing_payment', 'payment_done'].includes(step)
              : step === 'rating';
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isDone ? '#0A2010' : isActive ? '#061620' : '#111827',
                    border: `2px solid ${isDone ? '#10B981' : isActive ? '#06B6D4' : '#1E2D45'}`,
                  }}
                >
                  {isDone ? (
                    <CheckCircle2 size={10} className="text-emerald-400" />
                  ) : (
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: isActive ? '#22D3EE' : '#475569' }}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>
                <span
                  className="text-xs"
                  style={{ color: isDone ? '#10B981' : isActive ? '#22D3EE' : '#475569' }}
                >
                  {s === 'payment' ? 'Pay' : 'Rate'}
                </span>
              </div>
              {i === 0 && (
                <div
                  className="flex-1 h-px"
                  style={{ background: isDone ? '#10B981' : '#1E2D45' }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Runner card — always visible */}
      <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}
          >
            {runnerName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{runnerName}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full text-cyan-400"
                style={{ background: '#061620', border: '1px solid #0E2D3D', fontFamily: 'JetBrains Mono, monospace' }}
              >
                VERIFIED
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: '#64748B' }}>
              <Shield size={11} className="text-cyan-400" />
              Trust Score: 96 · 47 deliveries
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>
              {job?.item_type} · {job?.pickup_location?.split(',')[0]} → {job?.drop_location?.split(',')[0]}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Payment ── */}
        {['payment', 'processing_payment', 'payment_done'].includes(step) && (
          <motion.div
            key="payment-step"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Amount summary */}
            <div className="rounded-xl p-4" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                PAYMENT SUMMARY
              </div>
              {[
                { label: 'Delivery fee', value: `₹${basePrice}` },
                { label: 'Platform fee', value: '₹0 (Beta)' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm mb-2">
                  <span style={{ color: '#64748B' }}>{label}</span>
                  <span style={{ color: '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
                </div>
              ))}
              <div className="h-px my-2" style={{ background: '#1A3520' }} />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">Total</span>
                <span
                  className="font-semibold text-emerald-400"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem' }}
                >
                  ₹{basePrice}
                </span>
              </div>
            </div>

            {/* UPI method */}
            <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                PAY VIA UPI · POWERED BY RAZORPAY
              </div>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-lg"
                style={{ background: '#061620', border: '2px solid #06B6D4' }}
              >
                <Smartphone size={16} className="text-cyan-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">UPI</div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                    PhonePe · Google Pay · Paytm · any UPI app
                  </div>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                <Lock size={10} className="text-slate-500" />
                <span className="text-[10px]" style={{ color: '#475569' }}>
                  Secured by Razorpay · 256-bit TLS encryption
                </span>
              </div>
            </div>

            {/* Pay button */}
            <button
              onClick={handlePayNow}
              disabled={step === 'processing_payment' || step === 'payment_done'}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{
                background:
                  step === 'payment_done'
                    ? '#0A2010'
                    : step === 'processing_payment'
                      ? '#0B1D28'
                      : 'linear-gradient(135deg, #06B6D4, #6366F1)',
                border:
                  step === 'payment_done'
                    ? '1px solid #10B981'
                    : step === 'processing_payment'
                      ? '1px solid #0E2D3D'
                      : 'none',
              }}
            >
              {step === 'processing_payment' && (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Processing payment...
                </>
              )}
              {step === 'payment_done' && (
                <>
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-emerald-400">Payment confirmed</span>
                </>
              )}
              {step === 'payment' && (
                <>
                  <Smartphone size={15} />
                  Pay ₹{basePrice} via UPI
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* ── Step 2: Rating ── */}
        {step === 'rating' && (
          <motion.div
            key="rating-step"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Stars */}
            {!disputeMode && (
              <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
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
                <div className="mb-3">
                  <div className="text-xs mb-2" style={{ color: '#F87171' }}>Issue type</div>
                  <div className="grid grid-cols-3 gap-2">
                    {['Item damaged', 'Not delivered', 'Wrong item'].map(t => (
                      <button
                        key={t}
                        onClick={() => setDisputeType(t)}
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
                </div>
                <textarea
                  value={disputeDesc}
                  onChange={e => setDisputeDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe what happened..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none resize-none"
                  style={{ background: '#0D0303', border: '1px solid #3B1111' }}
                />
                <p className="text-[10px] mt-2" style={{ color: '#6B2121' }}>
                  Ops will review within 4 hours. Dispute window: 2 hours post-delivery.
                </p>
              </motion.div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleSubmitRating}
                disabled={loading || (!disputeMode && stars === 0)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background:
                    loading || (!disputeMode && stars === 0)
                      ? '#1E2D45'
                      : disputeMode
                        ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                        : 'linear-gradient(135deg, #06B6D4, #6366F1)',
                  color: !disputeMode && stars === 0 ? '#475569' : 'white',
                }}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Closing job...
                  </>
                ) : disputeMode ? (
                  'Submit Dispute'
                ) : (
                  `Submit Rating`
                )}
              </button>

              <button
                onClick={() => { setDisputeMode(d => !d); setStars(0); }}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
