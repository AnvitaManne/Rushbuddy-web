import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Job } from '../../context/AppContext';
import type { JobType, LocationType } from '@/domain/enums';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
  validatePostedPrice,
} from '@/domain/jobHelpers';
import { isJobPostingValid } from '@/domain/runnerEligibility';
import {
  FileText, Coffee, Pill, Box, ChevronRight, AlertTriangle,
  MapPin, AlertCircle, Info, Package, Zap, Clock, Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ItemType = 'Document' | 'Food' | 'Medicine' | 'Object';
type Weight = 'Light' | 'Medium' | 'Heavy';
type Risk = 'Low' | 'Fragile' | 'Valuable';

/** LOCKED MVP — job type chosen first; drives expiry + handoff mode. Do not remove.
 * Descriptions = locked definitions from docs/plans/sjt-mvp-core-loop.md (no invented blurbs).
 * See `.cursor/rules/mvp-locked-fields.mdc` (alwaysApply).
 */
const JOB_TYPES: {
  type: JobType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'campus_immediate',
    label: 'Campus Immediate',
    desc: 'Expires 30 min after posting; sender notified at 25 min with extend/cancel.',
    icon: <Zap size={16} />,
  },
  {
    type: 'campus_scheduled',
    label: 'Campus Scheduled',
    desc: 'Sender picks time window; job goes live instantly, expires at end of window if unmatched.',
    icon: <Clock size={16} />,
  },
  {
    type: 'intercity',
    label: 'Intercity',
    desc: 'Sender picks travel date; job stays live until 2h before; auto-expires if unmatched.',
    icon: <Truck size={16} />,
  },
];

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'mens_hostel', label: "Men's hostel" },
  { value: 'womens_hostel', label: "Women's hostel" },
];

const ITEM_TYPES: { type: ItemType; icon: React.ReactNode; desc: string }[] = [
  { type: 'Document', icon: <FileText size={18} />, desc: 'Notes, printouts, IDs' },
  { type: 'Food', icon: <Coffee size={18} />, desc: 'Canteen orders, parcels' },
  { type: 'Medicine', icon: <Pill size={18} />, desc: 'Pharmacy pickup' },
  { type: 'Object', icon: <Box size={18} />, desc: 'Chargers, packages, misc' },
];

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

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
  const { setJobs, setCurrentRole, setActiveJob, user } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  // LOCKED MVP: job type first
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [weight, setWeight] = useState<Weight | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupLocationType, setPickupLocationType] = useState<LocationType>('general');
  const [dropLocationType, setDropLocationType] = useState<LocationType>('general');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [valuableAck, setValuableAck] = useState(false);
  const [foodReadyAck, setFoodReadyAck] = useState(false);

  // campus_scheduled
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  // intercity
  const [travelDate, setTravelDate] = useState('');
  const [corridorLandmark, setCorridorLandmark] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  // LOCKED MVP: system floor + sender-editable offer (>= floor). Do not remove.
  // See `.cursor/rules/mvp-locked-fields.mdc` (alwaysApply).
  const priceFloor = itemType && weight && risk && jobType
    ? computePriceFloor(itemType, weight, risk, jobType)
    : 0;
  const [postedPrice, setPostedPrice] = useState<number>(0);
  const suggestedMax = priceFloor > 0 ? Math.round(priceFloor * 1.4) : 0;

  useEffect(() => {
    if (priceFloor <= 0) return;
    setPostedPrice((prev) => (prev < priceFloor ? priceFloor : prev));
  }, [priceFloor]);

  const selectJobType = (type: JobType) => {
    setJobType(type);
    setErrors((p) => ({ ...p, job_type: '', schedule: '', travel: '' }));
    if (type === 'campus_scheduled' && !windowStart) {
      const start = new Date(Date.now() + 60 * 60 * 1000);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      setWindowStart(toDatetimeLocalValue(start));
      setWindowEnd(toDatetimeLocalValue(end));
    }
    if (type === 'intercity' && !travelDate) {
      const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setTravelDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
  };

  const scheduleOk =
    jobType !== 'campus_scheduled' ||
    (!!windowStart && !!windowEnd && new Date(windowEnd) > new Date(windowStart));
  const intercityOk =
    jobType !== 'intercity' ||
    (!!travelDate && corridorLandmark.trim().length > 0 && receiverPhone.trim().length >= 10);
  const foodOk = itemType !== 'Food' || foodReadyAck;
  const locationTypesOk = isJobPostingValid({
    pickup_location_type: pickupLocationType,
    drop_location_type: dropLocationType,
  });

  const canProceedStep1 =
    !!jobType &&
    !!itemType &&
    !!weight &&
    !!risk &&
    foodOk &&
    scheduleOk &&
    intercityOk &&
    postedPrice >= priceFloor &&
    priceFloor > 0;

  const canProceedStep2 =
    pickup.trim() &&
    drop.trim() &&
    (risk !== 'Valuable' || valuableAck) &&
    locationTypesOk;

  const handlePost = async () => {
    const errs: Record<string, string> = {};
    if (!jobType) errs.job_type = 'Select a job type';
    if (!pickup.trim()) errs.pickup = 'Pickup location is required';
    if (!drop.trim()) errs.drop = 'Drop location is required';
    if (!locationTypesOk) {
      errs.location_type = "Can't mix men's and women's hostel on the same job.";
    }
    if (!validatePostedPrice(priceFloor, postedPrice)) {
      errs.posted_price = `Offer must be at least ₹${priceFloor} (system floor).`;
    }
    if (jobType === 'campus_scheduled' && !scheduleOk) {
      errs.schedule = 'Scheduled window end must be after start.';
    }
    if (jobType === 'intercity' && !intercityOk) {
      errs.travel = 'Travel date, corridor landmark, and receiver phone are required.';
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));

    const created_at = new Date().toISOString();
    const scheduled_window =
      jobType === 'campus_scheduled'
        ? { start: localInputToIso(windowStart), end: localInputToIso(windowEnd) }
        : undefined;
    const travel_date = jobType === 'intercity' ? travelDate : undefined;

    const newJob: Job = {
      id: `JOB-${2410 + Math.floor(Math.random() * 90)}`,
      sender_id: user?.id ?? 'u1',
      sender_name: user?.name ?? 'You',
      sender_hostel: user?.hostel_block ?? 'MH-C Block',
      job_type: jobType!,
      handoff_mode: resolveHandoffMode(jobType!),
      item_type: itemType!,
      weight: weight!,
      risk: risk!,
      purchase_type: 'carry_only',
      pickup_location: pickup,
      drop_location: drop,
      pickup_location_type: pickupLocationType,
      drop_location_type: dropLocationType,
      description,
      price_floor: priceFloor,
      posted_price: postedPrice,
      confirmation_code: generateConfirmationCode(),
      expires_at: computeExpiresAt(jobType!, created_at, scheduled_window, travel_date),
      scheduled_window,
      travel_date,
      corridor_landmark: jobType === 'intercity' ? corridorLandmark.trim() : undefined,
      receiver_phone: jobType === 'intercity' ? receiverPhone.trim() : undefined,
      condition_acknowledged: false,
      status: 'OPEN',
      created_at,
      eta: jobType === 'intercity' ? '~same day' : '~12 min',
      distance: jobType === 'intercity' ? 'corridor' : '0.8 km',
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
            {/* LOCKED MVP: job type first */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                JOB TYPE
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {JOB_TYPES.map(({ type, label, desc, icon }) => (
                  <OptionButton
                    key={type}
                    value={type}
                    selected={jobType === type}
                    onClick={() => selectJobType(type)}
                    className="p-3 text-left"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">{icon}</div>
                      <div>
                        <div className="font-medium text-sm">{label}</div>
                        <div className="text-[11px] mt-0.5 opacity-60">{desc}</div>
                      </div>
                    </div>
                  </OptionButton>
                ))}
              </div>
              {errors.job_type && (
                <p className="text-[11px] mt-2 text-red-400">{errors.job_type}</p>
              )}
            </div>

            {jobType === 'campus_scheduled' && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  SCHEDULED WINDOW
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Window start</label>
                    <input
                      type="datetime-local"
                      value={windowStart}
                      onChange={(e) => setWindowStart(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                      style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Window end</label>
                    <input
                      type="datetime-local"
                      value={windowEnd}
                      onChange={(e) => setWindowEnd(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                      style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                    />
                  </div>
                </div>
                {!scheduleOk && (
                  <p className="text-[11px] text-amber-400">End must be after start.</p>
                )}
              </div>
            )}

            {jobType === 'intercity' && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  INTERCITY DETAILS
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Travel date</label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Corridor landmark</label>
                  <input
                    type="text"
                    value={corridorLandmark}
                    onChange={(e) => setCorridorLandmark(e.target.value)}
                    placeholder="e.g. Katpadi station exit, VIT Main Gate"
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Receiver phone</label>
                  <input
                    type="tel"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  />
                </div>
                {errors.travel && (
                  <p className="text-[11px] text-red-400">{errors.travel}</p>
                )}
              </div>
            )}

            {/* Item type */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                ITEM TYPE
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ITEM_TYPES.map(({ type, icon, desc }) => (
                  <OptionButton key={type} value={type} selected={itemType === type} onClick={() => { setItemType(type); setFoodReadyAck(false); }}
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
              {itemType === 'Food' && (
                <label className="flex items-start gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={foodReadyAck}
                    onChange={(e) => setFoodReadyAck(e.target.checked)}
                    className="mt-0.5 accent-cyan-400"
                  />
                  <span className="text-xs" style={{ color: '#94A3B8' }}>
                    Food is already ordered and ready for pickup (carry-only — no purchase runs).
                  </span>
                </label>
              )}
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

            {/* LOCKED MVP: floor + editable offer */}
            {priceFloor > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 mb-4"
                style={{ background: '#0A1A10', border: '1px solid #1A3520' }}
              >
                <div className="text-xs mb-2" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  YOUR OFFER
                </div>
                <div className="flex items-end justify-between gap-4 mb-2">
                  <div>
                    <div className="text-[10px] mb-1" style={{ color: '#64748B' }}>
                      System floor (minimum)
                    </div>
                    <div className="text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1.25rem' }}>
                      ₹{priceFloor}
                    </div>
                  </div>
                  <div className="flex-1 max-w-[160px]">
                    <label className="text-[10px] mb-1 block" style={{ color: '#64748B' }}>
                      Your offer (₹)
                    </label>
                    <input
                      type="number"
                      min={priceFloor}
                      step={1}
                      value={postedPrice || ''}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPostedPrice(Number.isFinite(n) ? n : priceFloor);
                        setErrors((p) => ({ ...p, posted_price: '' }));
                      }}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                      style={{
                        background: '#060A14',
                        border: `1px solid ${errors.posted_price ? '#EF4444' : '#1E2D45'}`,
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>
                {errors.posted_price && (
                  <p className="text-[11px] text-red-400 mb-1">{errors.posted_price}</p>
                )}
                {postedPrice < priceFloor && (
                  <p className="text-[11px] text-amber-400 mb-1">
                    Offer can't be below the floor of ₹{priceFloor}.
                  </p>
                )}
                <div className="text-xs" style={{ color: '#64748B' }}>
                  Based on {itemType} × {weight} × {risk} risk
                  {suggestedMax > priceFloor ? ` · typical range up to ~₹${suggestedMax}` : ''}
                </div>
              </motion.div>
            )}

            <button
              onClick={() => {
                if (!canProceedStep1) return;
                if (!validatePostedPrice(priceFloor, postedPrice)) {
                  setErrors((p) => ({
                    ...p,
                    posted_price: `Offer must be at least ₹${priceFloor} (system floor).`,
                  }));
                  return;
                }
                setStep(2);
              }}
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
                <div className="flex flex-wrap gap-2 mt-2">
                  {LOCATION_TYPES.map(({ value, label }) => (
                    <button
                      key={`pickup-${value}`}
                      type="button"
                      onClick={() => setPickupLocationType(value)}
                      className="px-2.5 py-1 rounded text-[10px] transition-all"
                      style={{
                        background: pickupLocationType === value ? '#061620' : '#060A14',
                        border: `1px solid ${pickupLocationType === value ? '#06B6D4' : '#1E2D45'}`,
                        color: pickupLocationType === value ? '#22D3EE' : '#64748B',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {label}
                    </button>
                  ))}
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
                <div className="flex flex-wrap gap-2 mt-2">
                  {LOCATION_TYPES.map(({ value, label }) => (
                    <button
                      key={`drop-${value}`}
                      type="button"
                      onClick={() => setDropLocationType(value)}
                      className="px-2.5 py-1 rounded text-[10px] transition-all"
                      style={{
                        background: dropLocationType === value ? '#061620' : '#060A14',
                        border: `1px solid ${dropLocationType === value ? '#6366F1' : '#1E2D45'}`,
                        color: dropLocationType === value ? '#A78BFA' : '#64748B',
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {errors.drop && (
                  <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} />{errors.drop}
                  </p>
                )}
                {!locationTypesOk && (
                  <p className="text-[11px] mt-2 text-red-400">
                    Can't mix men's and women's hostel endpoints on one job.
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

            {/* Price summary — editable offer already set on step 1 */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
              <div className="flex items-center justify-between text-sm">
                <div style={{ color: '#64748B' }}>
                  {itemType} · {weight} · {risk} risk
                </div>
                <div className="text-emerald-400 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  ₹{postedPrice}
                </div>
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: '#475569' }}>
                Your offer · floor ₹{priceFloor} · Platform fee: ₹0 (beta).
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
                  { label: 'Job Type', value: JOB_TYPES.find(j => j.type === jobType)?.label ?? jobType },
                  { label: 'Item Type', value: itemType },
                  { label: 'Weight Tier', value: weight },
                  { label: 'Risk Level', value: risk },
                  { label: 'Pickup', value: `${pickup} (${LOCATION_TYPES.find(l => l.value === pickupLocationType)?.label})` },
                  { label: 'Drop', value: `${drop} (${LOCATION_TYPES.find(l => l.value === dropLocationType)?.label})` },
                  ...(jobType === 'campus_scheduled'
                    ? [{ label: 'Window', value: `${windowStart.replace('T', ' ')} → ${windowEnd.replace('T', ' ')}` }]
                    : []),
                  ...(jobType === 'intercity'
                    ? [
                        { label: 'Travel Date', value: travelDate },
                        { label: 'Landmark', value: corridorLandmark },
                        { label: 'Receiver Phone', value: receiverPhone },
                      ]
                    : []),
                  { label: 'Description', value: description || '—' },
                  { label: 'System Floor', value: `₹${priceFloor}`, mono: true },
                  { label: 'Your Offer', value: `₹${postedPrice}`, mono: true, highlight: true },
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
