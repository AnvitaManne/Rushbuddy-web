import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Job } from '../../context/AppContext';
import type { ItemType, JobType, LocationType, RiskLevel, WeightTier } from '@/domain/enums';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
} from '@/domain/jobHelpers';
import { validatePostRequestDraft } from '@/domain/postingValidation';
import { DECLARED_VALUE_MAX_INR } from '@/domain/constants';
import { services } from '@/services';
import {
  FileText, Coffee, Pill, Box, ChevronRight, AlertTriangle,
  MapPin, AlertCircle, Info, Package, Clock, CalendarClock, Route
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ITEM_TYPES: { type: ItemType; icon: React.ReactNode; desc: string }[] = [
  { type: 'Document', icon: <FileText size={18} />, desc: 'Notes, printouts, IDs' },
  { type: 'Food', icon: <Coffee size={18} />, desc: 'Canteen orders, parcels' },
  { type: 'Medicine', icon: <Pill size={18} />, desc: 'Pharmacy pickup' },
  { type: 'Object', icon: <Box size={18} />, desc: 'Chargers, packages, misc' },
];

/** Locked job-type definitions — copy verbatim, do not invent new blurbs. */
const JOB_TYPES: { type: JobType; icon: React.ReactNode; label: string; definition: string }[] = [
  {
    type: 'campus_immediate',
    icon: <Clock size={18} />,
    label: 'Campus Immediate',
    definition: 'Expires 30 min after posting; sender notified at 25 min with extend/cancel.',
  },
  {
    type: 'campus_scheduled',
    icon: <CalendarClock size={18} />,
    label: 'Campus Scheduled',
    definition: 'Sender picks time window; job goes live instantly, expires at end of window if unmatched.',
  },
  {
    type: 'intercity',
    icon: <Route size={18} />,
    label: 'Intercity',
    definition: 'Sender picks travel date; job stays live until 2h before; auto-expires if unmatched.',
  },
];

const LOCATION_TYPES: { type: LocationType; label: string }[] = [
  { type: 'general', label: 'General' },
  { type: 'mens_hostel', label: "Men's Hostel" },
  { type: 'womens_hostel', label: "Women's Hostel" },
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

function toDatetimeLocalValue(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 3_600_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function todayPlusDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function PostRequestPage() {
  const { user, setJobs, setCurrentRole, setActiveJob } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  // Step 1: job type
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [scheduledStart, setScheduledStart] = useState(toDatetimeLocalValue(2));
  const [scheduledEnd, setScheduledEnd] = useState(toDatetimeLocalValue(4));
  const [travelDate, setTravelDate] = useState(todayPlusDays(1));
  const [corridorLandmark, setCorridorLandmark] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  // Step 2: item details
  const [itemType, setItemType] = useState<ItemType | null>(null);
  const [weight, setWeight] = useState<WeightTier | null>(null);
  const [risk, setRisk] = useState<RiskLevel | null>(null);
  const [foodReadyAck, setFoodReadyAck] = useState(false);
  const [declaredValue, setDeclaredValue] = useState('');

  // Step 3: locations
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [pickupType, setPickupType] = useState<LocationType>('general');
  const [dropType, setDropType] = useState<LocationType>('general');
  const [description, setDescription] = useState('');
  const [valuableAck, setValuableAck] = useState(false);

  // Step 4: review + editable price
  const [postedPrice, setPostedPrice] = useState<number | null>(null);
  const [priceTouched, setPriceTouched] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const priceFloor = itemType && weight && risk && jobType
    ? computePriceFloor(itemType, weight, risk, jobType)
    : 0;

  // Keep the editable offer seeded to a sensible default above the floor until the sender edits it.
  useEffect(() => {
    if (!priceTouched && priceFloor > 0) {
      setPostedPrice(Math.round(priceFloor * 1.15));
    }
  }, [priceFloor, priceTouched]);

  const canProceedStep1 = jobType !== null
    && (jobType !== 'campus_scheduled' || (scheduledStart && scheduledEnd))
    && (jobType !== 'intercity' || (travelDate && corridorLandmark.trim() && receiverPhone.trim()));
  const canProceedStep2 = itemType && weight && risk
    && (itemType !== 'Food' || foodReadyAck)
    && (!declaredValue || Number(declaredValue) <= DECLARED_VALUE_MAX_INR);
  const canProceedStep3 = pickup.trim() && drop.trim()
    && (risk !== 'Valuable' || valuableAck)
    && !(
      (pickupType === 'mens_hostel' && dropType === 'womens_hostel')
      || (pickupType === 'womens_hostel' && dropType === 'mens_hostel')
    );

  const handlePost = async () => {
    const errs: Record<string, string> = {};
    if (!pickup.trim()) errs.pickup = 'Pickup location is required';
    if (!drop.trim()) errs.drop = 'Drop location is required';
    if (Object.keys(errs).length) { setErrors(errs); setStep(3); return; }
    if (!jobType || !itemType || !weight || !risk || postedPrice === null) return;

    const declared_value = declaredValue ? Number(declaredValue) : undefined;
    const scheduled_window = jobType === 'campus_scheduled'
      ? { start: new Date(scheduledStart).toISOString(), end: new Date(scheduledEnd).toISOString() }
      : undefined;

    const validationErrors = validatePostRequestDraft({
      job_type: jobType,
      item_type: itemType,
      pickup_location_type: pickupType,
      drop_location_type: dropType,
      price_floor: priceFloor,
      posted_price: postedPrice,
      declared_value,
      scheduled_window,
      travel_date: jobType === 'intercity' ? travelDate : undefined,
      corridor_landmark: jobType === 'intercity' ? corridorLandmark : undefined,
      receiver_phone: jobType === 'intercity' ? receiverPhone : undefined,
      food_ready_ack: foodReadyAck,
    });
    if (validationErrors.length) { setFormErrors(validationErrors); return; }

    setLoading(true);

    const created_at = new Date().toISOString();

    const newJob: Job = {
      id: `JOB-${2410 + Math.floor(Math.random() * 90)}`,
      sender_id: user?.id ?? 'u1',
      sender_name: user?.name ?? 'You',
      sender_hostel: user?.hostel_block ?? 'MH-C Block',
      job_type: jobType,
      handoff_mode: resolveHandoffMode(jobType),
      item_type: itemType,
      weight,
      risk,
      purchase_type: 'carry_only',
      pickup_location: pickup,
      drop_location: drop,
      pickup_location_type: pickupType,
      drop_location_type: dropType,
      description,
      price_floor: priceFloor,
      posted_price: postedPrice,
      declared_value,
      confirmation_code: generateConfirmationCode(),
      expires_at: computeExpiresAt(jobType, created_at, scheduled_window, jobType === 'intercity' ? travelDate : undefined),
      condition_acknowledged: false,
      status: 'OPEN',
      created_at,
      scheduled_window,
      travel_date: jobType === 'intercity' ? travelDate : undefined,
      corridor_landmark: jobType === 'intercity' ? corridorLandmark : undefined,
      receiver_phone: jobType === 'intercity' ? receiverPhone : undefined,
      eta: jobType === 'campus_immediate' ? '~12 min' : jobType === 'campus_scheduled' ? 'window' : 'travel day',
      distance: jobType === 'intercity' ? 'corridor' : '0.8 km',
    };

    try {
      // Mock adapter updates AppContext `jobs` via the bound store; the Supabase
      // adapter inserts the row and returns it with a real id + confirmation code.
      const created = await services.jobs.createJob(newJob);
      // Upsert into jobs so Tracking finds it in both modes (idempotent for mock).
      setJobs(prev =>
        prev.some(j => j.id === created.id)
          ? prev.map(j => (j.id === created.id ? created : j))
          : [created, ...prev],
      );
      setActiveJob(created);
      setCurrentRole('sender');
      navigate('/sender/tracking');
    } catch (err) {
      setFormErrors([
        err instanceof Error ? err.message : 'Could not post request. Please try again.',
      ]);
    } finally {
      setLoading(false);
    }
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
        {['Job Type', 'Item Details', 'Locations', 'Review'].map((s, i) => {
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
              {i < 3 && (
                <div className="flex-1 mx-2 h-px" style={{ background: isDone ? '#10B981' : '#1E2D45', minWidth: 16 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Job type */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                JOB TYPE
              </div>
              <div className="space-y-2">
                {JOB_TYPES.map(({ type, icon, label, definition }) => (
                  <OptionButton key={type} value={type} selected={jobType === type} onClick={() => setJobType(type)}
                    className="p-3 text-left w-full">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">{icon}</div>
                      <div>
                        <div className="font-medium text-sm">{label}</div>
                        <div className="text-[11px] mt-0.5 opacity-70">{definition}</div>
                      </div>
                    </div>
                  </OptionButton>
                ))}
              </div>
            </div>

            {/* Conditional: campus_scheduled window */}
            {jobType === 'campus_scheduled' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  SCHEDULED WINDOW
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Start</label>
                    <input
                      type="datetime-local"
                      value={scheduledStart}
                      onChange={e => setScheduledStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                      style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>End</label>
                    <input
                      type="datetime-local"
                      value={scheduledEnd}
                      onChange={e => setScheduledEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                      style={{ background: '#060A14', border: `1px solid ${scheduledEnd <= scheduledStart ? '#EF4444' : '#1E2D45'}` }}
                    />
                  </div>
                </div>
                {scheduledEnd <= scheduledStart && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} />End must be after start.
                  </p>
                )}
              </motion.div>
            )}

            {/* Conditional: intercity fields */}
            {jobType === 'intercity' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  INTERCITY DETAILS (MODE 2 · LANDMARK HANDOFF)
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Travel Date</label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={e => setTravelDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Corridor Landmark</label>
                  <input
                    type="text"
                    value={corridorLandmark}
                    onChange={e => setCorridorLandmark(e.target.value)}
                    placeholder="e.g. Chennai Central — Platform 1 entrance"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Receiver Phone</label>
                  <input
                    type="tel"
                    value={receiverPhone}
                    onChange={e => setReceiverPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  />
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
              {canProceedStep1 ? (
                <>Continue to Item Details <ChevronRight size={16} /></>
              ) : (
                'Select a job type to continue'
              )}
            </button>
          </motion.div>
        )}

        {/* Step 2: Item details */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
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

              {/* Food ready-to-carry ack */}
              {itemType === 'Food' && (
                <motion.label initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-start gap-2 mt-3 p-3 rounded-lg cursor-pointer"
                  style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                  <input
                    type="checkbox"
                    checked={foodReadyAck}
                    onChange={e => setFoodReadyAck(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-cyan-400"
                  />
                  <span className="text-xs" style={{ color: '#94A3B8' }}>
                    The food is already ordered and ready for pickup. RushBuddy runners are carry-only — they cannot order on your behalf.
                  </span>
                </motion.label>
              )}
            </div>

            {/* Weight */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                WEIGHT TIER
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { w: 'Light' as WeightTier, desc: '< 0.5 kg', ex: 'Phone, docs' },
                  { w: 'Medium' as WeightTier, desc: '0.5–2 kg', ex: 'Food, clothes' },
                  { w: 'Heavy' as WeightTier, desc: '> 2 kg', ex: 'Textbooks, bags' },
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
                  { r: 'Low' as RiskLevel, color: '#10B981', desc: 'Standard item' },
                  { r: 'Fragile' as RiskLevel, color: '#F59E0B', desc: 'Handle with care' },
                  { r: 'Valuable' as RiskLevel, color: '#EF4444', desc: 'High-value item' },
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

            {/* Declared value */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-2" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                DECLARED VALUE (OPTIONAL)
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#64748B' }}>₹</span>
                <input
                  type="number"
                  min={0}
                  max={DECLARED_VALUE_MAX_INR}
                  value={declaredValue}
                  onChange={e => setDeclaredValue(e.target.value)}
                  placeholder={`Up to ₹${DECLARED_VALUE_MAX_INR}`}
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                  style={{
                    background: '#060A14',
                    border: `1px solid ${declaredValue && Number(declaredValue) > DECLARED_VALUE_MAX_INR ? '#EF4444' : '#1E2D45'}`,
                  }}
                />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: '#475569' }}>
                Capped at ₹{DECLARED_VALUE_MAX_INR}. Used only for dispute/FIR support — not insured.
              </p>
            </div>

            {/* Live price */}
            {priceFloor > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 mb-4"
                style={{ background: '#0A1A10', border: '1px solid #1A3520' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                      SYSTEM PRICE FLOOR
                    </div>
                    <div className="text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1.5rem' }}>
                      ₹{priceFloor}
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#64748B' }}>
                      Based on {itemType} × {weight} × {risk} risk{jobType === 'intercity' ? ' + corridor' : ''}. Your offer must meet or beat this.
                    </div>
                  </div>
                  <Info size={16} className="text-slate-600" />
                </div>
              </motion.div>
            )}

            <button
              onClick={() => canProceedStep2 && setStep(3)}
              disabled={!canProceedStep2}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
              style={{
                background: canProceedStep2 ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45',
                color: canProceedStep2 ? 'white' : '#475569',
              }}
            >
              {!canProceedStep2 && itemType === 'Food' && !foodReadyAck
                ? 'Confirm food is ready to continue'
                : !canProceedStep2 && risk === 'Valuable' && !valuableAck
                  ? 'Acknowledge valuable disclaimer'
                  : !canProceedStep2 && declaredValue && Number(declaredValue) > DECLARED_VALUE_MAX_INR
                    ? `Declared value must be ≤ ₹${DECLARED_VALUE_MAX_INR}`
                    : !canProceedStep2
                      ? 'Complete item details to continue'
                      : 'Continue to Locations'}
              {canProceedStep2 && <ChevronRight size={16} />}
            </button>
          </motion.div>
        )}

        {/* Step 3: Locations */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

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
                <div className="flex gap-2 mt-2">
                  {LOCATION_TYPES.map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPickupType(type)}
                      className="flex-1 py-1.5 rounded-md text-[11px] border transition-all"
                      style={{
                        background: pickupType === type ? '#061620' : '#070B17',
                        border: `1px solid ${pickupType === type ? '#06B6D4' : '#1A2535'}`,
                        color: pickupType === type ? '#22D3EE' : '#64748B',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
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
                <div className="flex gap-2 mt-2">
                  {LOCATION_TYPES.map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDropType(type)}
                      className="flex-1 py-1.5 rounded-md text-[11px] border transition-all"
                      style={{
                        background: dropType === type ? '#061620' : '#070B17',
                        border: `1px solid ${dropType === type ? '#06B6D4' : '#1A2535'}`,
                        color: dropType === type ? '#22D3EE' : '#64748B',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {(pickupType === 'mens_hostel' && dropType === 'womens_hostel')
                || (pickupType === 'womens_hostel' && dropType === 'mens_hostel') ? (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle size={10} />Pickup and drop can't mix men's and women's hostels.
                </p>
              ) : null}

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

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-lg text-sm border transition-all"
                style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
              >
                ← Back
              </button>
              <button
                onClick={() => canProceedStep3 && setStep(4)}
                disabled={!canProceedStep3}
                className="flex-1 py-3 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: canProceedStep3 ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45',
                  color: canProceedStep3 ? 'white' : '#475569',
                }}
              >
                {!canProceedStep3 && (!pickup.trim() || !drop.trim())
                  ? 'Add pickup & drop'
                  : !canProceedStep3 && ((pickupType === 'mens_hostel' && dropType === 'womens_hostel') || (pickupType === 'womens_hostel' && dropType === 'mens_hostel'))
                    ? 'Fix hostel conflict'
                    : !canProceedStep3 && postedPrice < priceFloor
                      ? `Offer must be ≥ ₹${priceFloor}`
                      : 'Review →'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Review + editable price */}
        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1E2D45' }}>
              <div className="px-4 py-3" style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  JOB PREVIEW · {new Date().toLocaleDateString()}
                </div>
              </div>
              <div className="p-4 space-y-3" style={{ background: '#0B1120' }}>
                {[
                  { label: 'Job Type', value: JOB_TYPES.find(j => j.type === jobType)?.label },
                  { label: 'Item Type', value: itemType },
                  { label: 'Weight Tier', value: weight },
                  { label: 'Risk Level', value: risk },
                  { label: 'Pickup', value: `${pickup} (${pickupType})` },
                  { label: 'Drop', value: `${drop} (${dropType})` },
                  ...(jobType === 'intercity' ? [
                    { label: 'Travel Date', value: travelDate },
                    { label: 'Corridor Landmark', value: corridorLandmark },
                    { label: 'Receiver Phone', value: receiverPhone },
                  ] : []),
                  { label: 'Declared Value', value: declaredValue ? `₹${declaredValue}` : '—' },
                  { label: 'Description', value: description || '—' },
                  { label: 'Price Floor', value: `₹${priceFloor}`, mono: true },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>{label}</span>
                    <span
                      className="text-xs text-right"
                      style={{ color: '#E2E8F0', fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit' }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Editable offer price */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
              <div className="text-xs mb-2" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                YOUR OFFER PRICE
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-emerald-400">₹</span>
                <input
                  type="number"
                  min={priceFloor}
                  value={postedPrice ?? ''}
                  onChange={e => { setPriceTouched(true); setPostedPrice(Number(e.target.value)); }}
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg text-lg text-emerald-400 font-semibold outline-none"
                  style={{
                    background: '#060A14',
                    border: `1px solid ${postedPrice !== null && postedPrice < priceFloor ? '#EF4444' : '#1A3520'}`,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: postedPrice !== null && postedPrice < priceFloor ? '#F87171' : '#475569' }}>
                Must be at least the system floor: ₹{priceFloor}. Platform fee: ₹0 (beta).
              </div>
            </div>

            {formErrors.length > 0 && (
              <div className="rounded-xl p-3 mb-4 space-y-1" style={{ background: '#1C0A0A', border: '1px solid #3B1111' }}>
                {formErrors.map(err => (
                  <p key={err} className="text-[11px] text-red-300 flex items-start gap-1.5">
                    <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />{err}
                  </p>
                ))}
              </div>
            )}

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
                onClick={() => setStep(3)}
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
