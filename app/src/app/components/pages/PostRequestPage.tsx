import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Job } from '../../context/AppContext';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
} from '@/domain/jobHelpers';
import {
  FileText, Coffee, Pill, Box, ChevronRight, AlertTriangle,
  MapPin, AlertCircle, Info, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ItemType = 'Document' | 'Food' | 'Medicine' | 'Object';
type Weight = 'Light' | 'Medium' | 'Heavy';
type Risk = 'Low' | 'Fragile' | 'Valuable';

const BASE_PRICES: Record<ItemType, number> = { Document: 25, Food: 30, Medicine: 35, Object: 40 };
const WEIGHT_MULT: Record<Weight, number> = { Light: 1, Medium: 1.5, Heavy: 2.5 };
const RISK_MULT: Record<Risk, number> = { Low: 1, Fragile: 1.3, Valuable: 1.8 };

const ITEM_TYPES: { type: ItemType; icon: React.ReactNode; desc: string }[] = [
  { type: 'Document', icon: <FileText size={18} />, desc: 'Notes, printouts, IDs' },
  { type: 'Food', icon: <Coffee size={18} />, desc: 'Canteen orders, parcels' },
  { type: 'Medicine', icon: <Pill size={18} />, desc: 'Pharmacy pickup' },
  { type: 'Object', icon: <Box size={18} />, desc: 'Chargers, packages, misc' },
];

function OptionButton<T extends string>({
  value, selected, onClick, children, className = ''
}: {
  value: T; selected: boolean; onClick: () => void; children: React.ReactNode; className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`transition-all duration-150 rounded-lg border text-sm ${className}`}
      style={{
        background: selected ? '#061620' : '#0B1120',
        border: `1px solid ${selected ? '#06B6D4' : '#1E2D45'}`,
        color: selected ? '#22D3EE' : '#94A3B8',
        boxShadow: selected ? '0 0 0 2px rgba(6,182,212,0.1)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

export function PostRequestPage() {
  const { setJobs, setCurrentRole, setActiveJob } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [weight, setWeight] = useState<Weight | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [valuableAck, setValuableAck] = useState(false);

  const priceMin = itemType && weight && risk
    ? Math.round(BASE_PRICES[itemType] * WEIGHT_MULT[weight] * RISK_MULT[risk])
    : 0;
  const priceMax = Math.round(priceMin * 1.4);

  const canProceedStep1 = itemType && weight && risk;
  const canProceedStep2 = pickup.trim() && drop.trim() && (risk !== 'Valuable' || valuableAck);

  const handlePost = async () => {
    const errs: Record<string, string> = {};
    if (!pickup.trim()) errs.pickup = 'Pickup location is required';
    if (!drop.trim()) errs.drop = 'Drop location is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));

    const job_type = 'campus_immediate' as const;
    const created_at = new Date().toISOString();
    const price_floor = computePriceFloor(itemType!, weight!, risk!, job_type);
    const posted_price = priceMax;

    const newJob: Job = {
      id: `JOB-${2410 + Math.floor(Math.random() * 90)}`,
      sender_id: 'u1',
      sender_name: 'You',
      sender_hostel: 'MH-C Block',
      job_type,
      handoff_mode: resolveHandoffMode(job_type),
      item_type: itemType!,
      weight: weight!,
      risk: risk!,
      purchase_type: 'carry_only',
      pickup_location: pickup,
      drop_location: drop,
      pickup_location_type: 'general',
      drop_location_type: 'general',
      description,
      price_floor,
      posted_price,
      confirmation_code: generateConfirmationCode(),
      expires_at: computeExpiresAt(job_type, created_at),
      condition_acknowledged: false,
      status: 'OPEN',
      created_at,
      eta: '~12 min',
      distance: '0.8 km',
    };

    setJobs(prev => [newJob, ...prev]);
    setActiveJob(newJob);
    setCurrentRole('sender');
    setLoading(false);
    navigate('/sender/tracking');
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div className="mb-6">
        <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
          SENDER FLOW · POST REQUEST
        </div>
        <h1 className="text-white mb-1" style={{ fontWeight: 700, fontSize: '1.3rem' }}>
          Post an Urgent Request
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Tell us what you need moved and where.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-6">
        {['Item Details', 'Locations', 'Review'].map((s, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{
                    background: isDone ? '#10B981' : isActive ? '#06B6D4' : '#1E2D45',
                    color: isDone || isActive ? 'white' : '#475569',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                  {isDone ? '✓' : stepNum}
                </div>
                <span className="text-xs hidden sm:block" style={{ color: isActive ? '#E2E8F0' : '#475569' }}>{s}</span>
              </div>
              {i < 2 && (
                <div className="flex-1 mx-2 h-px" style={{ background: isDone ? '#10B981' : '#1E2D45', minWidth: 20 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Item details */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Item type */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                ITEM TYPE
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ITEM_TYPES.map(({ type, icon, desc }) => (
                  <OptionButton key={type} value={type} selected={itemType === type} onClick={() => setItemType(type)}
                    className="p-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">{icon}</div>
                      <div>
                        <div className="font-medium text-sm">{type}</div>
                        <div className="text-[11px] mt-0.5 opacity-60">{desc}</div>
                      </div>
                    </div>
                  </OptionButton>
                ))}
              </div>
            </div>

            {/* Weight */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                WEIGHT TIER
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { w: 'Light' as Weight, desc: '< 0.5 kg', ex: 'Phone, docs' },
                  { w: 'Medium' as Weight, desc: '0.5–2 kg', ex: 'Food, clothes' },
                  { w: 'Heavy' as Weight, desc: '> 2 kg', ex: 'Textbooks, bags' },
                ]).map(({ w, desc, ex }) => (
                  <OptionButton key={w} value={w} selected={weight === w} onClick={() => setWeight(w)} className="p-3 text-center">
                    <div className="font-medium text-sm">{w}</div>
                    <div className="text-[10px] mt-1 opacity-60">{desc}</div>
                    <div className="text-[10px] opacity-40">{ex}</div>
                  </OptionButton>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                RISK LEVEL
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { r: 'Low' as Risk, color: '#10B981', desc: 'Standard item' },
                  { r: 'Fragile' as Risk, color: '#F59E0B', desc: 'Handle with care' },
                  { r: 'Valuable' as Risk, color: '#EF4444', desc: 'High-value item' },
                ]).map(({ r, color, desc }) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRisk(r)}
                    className="p-3 text-center rounded-lg border transition-all duration-150"
                    style={{
                      background: risk === r ? '#061620' : '#0B1120',
                      border: `1px solid ${risk === r ? color : '#1E2D45'}`,
                      color: risk === r ? color : '#94A3B8',
                    }}
                  >
                    <div className="font-medium text-sm">{r}</div>
                    <div className="text-[10px] mt-1 opacity-70">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Live price */}
            {priceMin > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 mb-4"
                style={{ background: '#0A1A10', border: '1px solid #1A3520' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                      CALCULATED PRICE RANGE
                    </div>
                    <div className="text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1.5rem' }}>
                      ₹{priceMin} – ₹{priceMax}
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#64748B' }}>
                      Based on {itemType} × {weight} × {risk} risk
                    </div>
                  </div>
                  <Info size={16} className="text-slate-600" />
                </div>
              </motion.div>
            )}

            <button
              onClick={() => canProceedStep1 && setStep(2)}
              disabled={!canProceedStep1}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
              style={{
                background: canProceedStep1 ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45',
                color: canProceedStep1 ? 'white' : '#475569',
              }}
            >
              Continue to Locations
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Step 2: Locations */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

            {/* Valuable disclaimer */}
            {risk === 'Valuable' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl p-4 mb-4"
                style={{ background: '#1C0A0A', border: '1px solid #3B1111' }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300 font-medium mb-1">Valuable Item Notice</p>
                    <p className="text-xs" style={{ color: '#F87171' }}>
                      Items above ₹2,000 value require your runner to be ID-verified. This may increase matching time.
                      RushBuddy is a peer platform — not an insurer. Review our T&Cs.
                    </p>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={valuableAck}
                        onChange={e => setValuableAck(e.target.checked)}
                        className="w-4 h-4 accent-red-400"
                      />
                      <span className="text-xs text-red-300">I acknowledge the risk and want to proceed</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="rounded-xl p-4 mb-4 space-y-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                ROUTE DETAILS
              </div>

              {/* Pickup */}
              <div>
                <label className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  Pickup Location
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={pickup}
                    onChange={e => { setPickup(e.target.value); setErrors(p => ({ ...p, pickup: '' })); }}
                    placeholder="e.g. MBA Hall Gate, SJT Ground Floor"
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{
                      background: '#060A14',
                      border: `1px solid ${errors.pickup ? '#EF4444' : '#1E2D45'}`,
                    }}
                    onFocus={e => e.target.style.borderColor = '#06B6D4'}
                    onBlur={e => e.target.style.borderColor = errors.pickup ? '#EF4444' : '#1E2D45'}
                  />
                </div>
                {errors.pickup && (
                  <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} />{errors.pickup}
                  </p>
                )}
              </div>

              {/* Drop */}
              <div>
                <label className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  Drop Location
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={drop}
                    onChange={e => { setDrop(e.target.value); setErrors(p => ({ ...p, drop: '' })); }}
                    placeholder="e.g. MH-B Block 3, Room 214"
                    className="w-full pl-8 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{
                      background: '#060A14',
                      border: `1px solid ${errors.drop ? '#EF4444' : '#1E2D45'}`,
                    }}
                    onFocus={e => e.target.style.borderColor = '#6366F1'}
                    onBlur={e => e.target.style.borderColor = errors.drop ? '#EF4444' : '#1E2D45'}
                  />
                </div>
                {errors.drop && (
                  <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} />{errors.drop}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Any specific instructions for your runner..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none resize-none"
                  style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  onFocus={e => e.target.style.borderColor = '#06B6D4'}
                  onBlur={e => e.target.style.borderColor = '#1E2D45'}
                />
              </div>
            </div>

            {/* Price summary */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
              <div className="flex items-center justify-between text-sm">
                <div style={{ color: '#64748B' }}>
                  {itemType} · {weight} · {risk} risk
                </div>
                <div className="text-emerald-400 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  ₹{priceMin}–₹{priceMax}
                </div>
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: '#475569' }}>
                System-calculated. Not editable. Platform fee: ₹0 (beta).
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-lg text-sm border transition-all"
                style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
              >
                ← Back
              </button>
              <button
                onClick={() => canProceedStep2 && setStep(3)}
                disabled={!canProceedStep2}
                className="flex-1 py-3 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: canProceedStep2 ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45',
                  color: canProceedStep2 ? 'white' : '#475569',
                }}
              >
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1E2D45' }}>
              <div className="px-4 py-3" style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  JOB PREVIEW · {new Date().toLocaleDateString()}
                </div>
              </div>
              <div className="p-4 space-y-3" style={{ background: '#0B1120' }}>
                {[
                  { label: 'Item Type', value: itemType },
                  { label: 'Weight Tier', value: weight },
                  { label: 'Risk Level', value: risk },
                  { label: 'Pickup', value: pickup },
                  { label: 'Drop', value: drop },
                  { label: 'Description', value: description || '—' },
                  { label: 'Price Range', value: `₹${priceMin} – ₹${priceMax}`, mono: true, highlight: true },
                  { label: 'Platform Fee', value: '₹0 (Beta)', mono: true },
                ].map(({ label, value, mono, highlight }) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>{label}</span>
                    <span
                      className="text-xs text-right"
                      style={{
                        color: highlight ? '#10B981' : '#E2E8F0',
                        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
                        fontWeight: highlight ? 600 : 400,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
              style={{ background: '#070B17', border: '1px solid #1A2535' }}>
              <Info size={13} className="text-cyan-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px]" style={{ color: '#64748B' }}>
                Posting this job will notify all available runners on campus. Matching is first-come, first-served.
                You can cancel before a runner accepts.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-lg text-sm border"
                style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
              >
                ← Back
              </button>
              <button
                onClick={handlePost}
                disabled={loading}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)', opacity: loading ? 0.8 : 1 }}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Package size={15} />
                    Post Request
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
