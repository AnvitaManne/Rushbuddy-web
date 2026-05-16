import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import { Star, AlertCircle, CheckCircle2, Shield, Smartphone, Banknote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TIPS = [0, 5, 10, 20];
const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', icon: <Smartphone size={14} /> },
  { id: 'phonepe', label: 'PhonePe', icon: <Smartphone size={14} /> },
  { id: 'cash', label: 'Cash', icon: <Banknote size={14} /> },
];

export function RatingPage() {
  const { jobs, setJobs } = useApp();
  const navigate = useNavigate();

  const job = jobs.find(j => j.sender_id === 'u1' && j.status === 'DELIVERED')
    || jobs.find(j => j.sender_id === 'u1' && ['CLOSED', 'PENDING_RATING', 'DELIVERED'].includes(j.status))
    || jobs.find(j => j.sender_id === 'u1');

  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [tip, setTip] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [disputeMode, setDisputeMode] = useState(false);
  const [disputeType, setDisputeType] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const runnerName = job?.runner_name && job.runner_name !== 'You' ? job.runner_name : 'Karthik R';
  const basePrice = job?.agreed_price ?? job?.posted_price ?? 40;
  const total = basePrice + tip;

  const handleSubmit = async () => {
    if (stars === 0 && !disputeMode) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    if (job) {
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        status: disputeMode ? 'DISPUTED' : 'CLOSED',
        rating: stars,
        tip_amount: tip,
      } : j));
    }
    setLoading(false);
    setSubmitted(true);
    await new Promise(r => setTimeout(r, 1500));
    navigate('/home');
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
              ? 'Ops team will review within 4 hours.'
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

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-md space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div>
        <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
          FLOW 5 · RATING & PAYMENT
        </div>
        <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.2rem' }}>
          Rate your Buddy
        </h1>
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
              {job?.item_type} · {job?.pickup_location?.split(',')[0]} → {job?.drop_location?.split(',')[0]}
            </div>
          </div>
        </div>

        {/* Stars */}
        {!disputeMode && (
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
      </div>

      {/* Tip selector */}
      {!disputeMode && (
        <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
          <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            ADD A TIP
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
          {tip > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[11px] mt-2"
              style={{ color: '#64748B' }}
            >
              RushBuddy shows runners when a tip is added — it's a meaningful nudge. 💚
            </motion.p>
          )}
        </div>
      )}

      {/* Payment method */}
      {!disputeMode && (
        <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
          <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            PAYMENT METHOD
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(({ id, label, icon }) => (
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
                {icon}
                {label}
              </button>
            ))}
          </div>
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
            Ops will review within 4 hours. Dispute window: 2 hours post-delivery. After that, job auto-closes.
          </p>
        </motion.div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={handleSubmit}
          disabled={loading || (!disputeMode && stars === 0)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
          style={{
            background: loading || (!disputeMode && stars === 0)
              ? '#1E2D45'
              : disputeMode
                ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                : 'linear-gradient(135deg, #06B6D4, #6366F1)',
            color: (!disputeMode && stars === 0) ? '#475569' : 'white',
          }}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Processing...
            </>
          ) : disputeMode ? (
            'Submit Dispute'
          ) : (
            `Confirm Payment & Rate · ₹${total}`
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
    </div>
  );
}
