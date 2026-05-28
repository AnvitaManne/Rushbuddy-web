import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Job } from '../../context/AppContext';
import type { JobType, LocationType, ScheduledWindow } from '@/domain';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
} from '@/domain/jobHelpers';
import {
  getLocationTypeConflictError,
  validateLocationTypes,
  validatePostRequestDraft,
} from '@/domain/postingValidation';
import {
  FileText, Coffee, Pill, Box, ChevronRight, AlertTriangle,
  MapPin, AlertCircle, Info, Package, Zap, Calendar, Train
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ItemType = 'Document' | 'Food' | 'Medicine' | 'Object';
type Weight = 'Light' | 'Medium' | 'Heavy';
type Risk = 'Low' | 'Fragile' | 'Valuable';

const JOB_TYPES: { type: JobType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'campus_immediate', label: 'Campus Immediate', desc: 'Urgent on-campus delivery', icon: <Zap size={18} /> },
  { type: 'campus_scheduled', label: 'Campus Scheduled', desc: 'Pick a time window on campus', icon: <Calendar size={18} /> },
  { type: 'intercity', label: 'Intercity', desc: 'Home ↔ college corridor run', icon: <Train size={18} /> },
];

const JOB_TYPE_LABELS: Record<JobType, string> = {
  campus_immediate: 'Campus Immediate',
  campus_scheduled: 'Campus Scheduled',
  intercity: 'Intercity',
};

const LOCATION_TYPE_OPTIONS: { type: LocationType; label: string }[] = [
  { type: 'general', label: 'General / Public Area' },
  { type: 'mens_hostel', label: "Men's Hostel" },
  { type: 'womens_hostel', label: "Women's Hostel" },
];

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  general: 'General / Public Area',
  mens_hostel: "Men's Hostel",
  womens_hostel: "Women's Hostel",
};

const datetimeInputStyle = {
  background: '#060A14',
  border: '1px solid #1E2D45',
} as const;

/** Converts `<input type="datetime-local">` value to ISO 8601 UTC. */
function datetimeLocalToIso(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDatetimeLocalDisplay(local: string): string {
  const iso = datetimeLocalToIso(local);
  if (!iso) return local || '—';
  return new Date(iso).toLocaleString();
}

function validateCampusScheduledWindow(start: string, end: string): string | undefined {
  if (!start.trim() || !end.trim()) {
    return 'Window start and end are required.';
  }
  const startIso = datetimeLocalToIso(start);
  const endIso = datetimeLocalToIso(end);
  if (!startIso || !endIso) {
    return 'Enter valid window start and end times.';
  }
  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    return 'Window end must be after window start.';
  }
  return undefined;
}

function validateIntercityTravelDateTime(local: string): string | undefined {
  if (!local.trim()) {
    return 'Travel date and time are required.';
  }
  if (!datetimeLocalToIso(local)) {
    return 'Enter a valid travel date and time.';
  }
  return undefined;
}

function buildScheduledWindow(start: string, end: string): ScheduledWindow {
  return {
    start: datetimeLocalToIso(start)!,
    end: datetimeLocalToIso(end)!,
  };
}

/** YYYY-MM-DD for `Job.travel_date` from a datetime-local value. */
function toTravelDate(local: string): string {
  return datetimeLocalToIso(local)!.slice(0, 10);
}

function getJobTimingError(
  jobType: JobType | null,
  scheduledStart: string,
  scheduledEnd: string,
  travelDateTime: string,
): string | undefined {
  if (!jobType || jobType === 'campus_immediate') return undefined;
  if (jobType === 'campus_scheduled') {
    return validateCampusScheduledWindow(scheduledStart, scheduledEnd);
  }
  return validateIntercityTravelDateTime(travelDateTime);
}

function getTimingReviewValue(
  jobType: JobType | null,
  scheduledStart: string,
  scheduledEnd: string,
  travelDt: string,
): string {
  if (!jobType) return '—';
  if (jobType === 'campus_immediate') return 'Expires 30 min after posting';
  if (jobType === 'campus_scheduled') {
    return `${formatDatetimeLocalDisplay(scheduledStart)} → ${formatDatetimeLocalDisplay(scheduledEnd)}`;
  }
  return formatDatetimeLocalDisplay(travelDt);
}

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
  const [carryOnlyAck, setCarryOnlyAck] = useState(false);
  const [foodReadyAck, setFoodReadyAck] = useState(false);
  const [scheduledWindowStart, setScheduledWindowStart] = useState('');
  const [scheduledWindowEnd, setScheduledWindowEnd] = useState('');
  const [travelDateTime, setTravelDateTime] = useState('');

  // priceMin = system floor (single source of truth from domain helper)
  const priceMin = jobType && itemType && weight && risk
    ? computePriceFloor(itemType, weight, risk, jobType)
    : 0;
  // priceMax = display-only upper bound shown to sender; actual posted_price set in handlePost
  const priceMax = Math.round(priceMin * 1.4);

  const locationTypeConflict = getLocationTypeConflictError(pickupLocationType, dropLocationType);

  const schedulingError = getJobTimingError(
    jobType,
    scheduledWindowStart,
    scheduledWindowEnd,
    travelDateTime,
  );

  const canProceedStep1 = jobType !== null && schedulingError === undefined;
  const canProceedStep2 =
    itemType &&
    weight &&
    risk &&
    carryOnlyAck &&
    (itemType !== 'Food' || foodReadyAck);
  const canProceedStep3 =
    pickup.trim() &&
    drop.trim() &&
    (risk !== 'Valuable' || valuableAck) &&
    validateLocationTypes(pickupLocationType, dropLocationType);

  const handlePost = async () => {
    if (!jobType || !itemType || !weight || !risk) return;

    const job_type = jobType;
    const price_floor = computePriceFloor(itemType, weight, risk, job_type);
    const posted_price = priceMax;

    const validation = validatePostRequestDraft({
      pickup_location: pickup,
      drop_location: drop,
      pickup_location_type: pickupLocationType,
      drop_location_type: dropLocationType,
      price_floor,
      posted_price,
    });

    if (!validation.valid) {
      const errs: Record<string, string> = {};
      if (validation.errors.pickup_location) errs.pickup = validation.errors.pickup_location;
      if (validation.errors.drop_location) errs.drop = validation.errors.drop_location;
      if (validation.errors.pickup_location_type) errs.locationType = validation.errors.pickup_location_type;
      setErrors(errs);
      setStep(3);
      return;
    }

    const timingError = getJobTimingError(
      jobType,
      scheduledWindowStart,
      scheduledWindowEnd,
      travelDateTime,
    );
    if (timingError) {
      setErrors({ scheduling: timingError });
      setStep(1);
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));

    const created_at = new Date().toISOString();

    let scheduled_window: ScheduledWindow | undefined;
    let travel_date: string | undefined;
    let travelDateTimeIso: string | undefined;

    if (job_type === 'campus_scheduled') {
      scheduled_window = buildScheduledWindow(scheduledWindowStart, scheduledWindowEnd);
    } else if (job_type === 'intercity') {
      travelDateTimeIso = datetimeLocalToIso(travelDateTime)!;
      travel_date = toTravelDate(travelDateTime);
    }

    const expires_at = computeExpiresAt(
      job_type,
      created_at,
      scheduled_window,
      travelDateTimeIso,
    );

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
      pickup_location_type: pickupLocationType,
      drop_location_type: dropLocationType,
      description,
      price_floor,
      posted_price,
      confirmation_code: generateConfirmationCode(),
      expires_at,
      scheduled_window,
      travel_date,
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
                <div className="flex-1 mx-2 h-px" style={{ background: isDone ? '#10B981' : '#1E2D45', minWidth: 20 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Job type */}
        {step === 1 && (
          <motion.div key="step1-job-type" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                JOB TYPE
              </div>
              <div className="grid gap-2">
                {JOB_TYPES.map(({ type, label, desc, icon }) => (
                  <OptionButton
                    key={type}
                    value={type}
                    selected={jobType === type}
                    onClick={() => {
                      setJobType(type);
                      setErrors(p => ({ ...p, scheduling: '' }));
                      if (type !== 'campus_scheduled') {
                        setScheduledWindowStart('');
                        setScheduledWindowEnd('');
                      }
                      if (type !== 'intercity') {
                        setTravelDateTime('');
                      }
                    }}
                    className="p-3 text-left w-full"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">{icon}</div>
                      <div>
                        <div className="font-medium text-sm">{label}</div>
                        <div className="text-[11px] mt-0.5 opacity-60">{desc}</div>
                      </div>
                    </div>
                  </OptionButton>
                ))}
              </div>
            </div>

            {jobType === 'campus_immediate' && (
              <div className="rounded-xl p-4 mb-4" style={{ background: '#0A1520', border: '1px solid #1A3045' }}>
                <div className="flex items-start gap-3">
                  <Info size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs" style={{ color: '#94A3B8' }}>
                    This request goes live immediately and expires 30 minutes after posting if unmatched.
                  </p>
                </div>
              </div>
            )}

            {jobType === 'campus_scheduled' && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  SCHEDULED WINDOW
                </div>
                <p className="text-[11px]" style={{ color: '#64748B' }}>
                  Job goes live immediately. It expires at the end of your window if still unmatched.
                </p>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Window start</label>
                  <input
                    type="datetime-local"
                    value={scheduledWindowStart}
                    onChange={e => {
                      setScheduledWindowStart(e.target.value);
                      setErrors(p => ({ ...p, scheduling: '' }));
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{
                      ...datetimeInputStyle,
                      border: `1px solid ${schedulingError && !scheduledWindowStart ? '#EF4444' : '#1E2D45'}`,
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Window end</label>
                  <input
                    type="datetime-local"
                    value={scheduledWindowEnd}
                    onChange={e => {
                      setScheduledWindowEnd(e.target.value);
                      setErrors(p => ({ ...p, scheduling: '' }));
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{
                      ...datetimeInputStyle,
                      border: `1px solid ${schedulingError ? '#EF4444' : '#1E2D45'}`,
                    }}
                  />
                </div>
              </div>
            )}

            {jobType === 'intercity' && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  TRAVEL DATE &amp; TIME
                </div>
                <p className="text-[11px]" style={{ color: '#64748B' }}>
                  Required for intercity jobs. The listing expires 2 hours before your travel time.
                </p>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>When are you travelling?</label>
                  <input
                    type="datetime-local"
                    value={travelDateTime}
                    onChange={e => {
                      setTravelDateTime(e.target.value);
                      setErrors(p => ({ ...p, scheduling: '' }));
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{
                      ...datetimeInputStyle,
                      border: `1px solid ${schedulingError ? '#EF4444' : '#1E2D45'}`,
                    }}
                  />
                </div>
              </div>
            )}

            {(schedulingError || errors.scheduling) && jobType && jobType !== 'campus_immediate' && (
              <p className="text-[11px] mb-4 text-red-400 flex items-center gap-1">
                <AlertCircle size={10} />
                {errors.scheduling || schedulingError}
              </p>
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
              Continue to Item Details
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Step 2: Item details */}
        {step === 2 && (
          <motion.div key="step2-item-details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {/* Carry-only hard restriction */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0A1520', border: '1px solid #1A3045' }}>
              <div className="flex items-start gap-3">
                <Info size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-cyan-200 font-medium mb-1">Carry-Only Service</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>
                    RushBuddy only supports carry-and-deliver. Items must already be in your possession or at a fixed pickup point.
                    Purchase-and-deliver is not supported.
                  </p>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={carryOnlyAck}
                      onChange={e => setCarryOnlyAck(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400"
                    />
                    <span className="text-xs text-cyan-200">I understand — carry-and-deliver only</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Item type */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                ITEM TYPE
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ITEM_TYPES.map(({ type, icon, desc }) => (
                  <OptionButton
                    key={type}
                    value={type}
                    selected={itemType === type}
                    onClick={() => {
                      setItemType(type);
                      if (type !== 'Food') setFoodReadyAck(false);
                    }}
                    className="p-3 text-left"
                  >
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

            {/* Food ready confirmation */}
            {itemType === 'Food' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl p-4 mb-4"
                style={{ background: '#15120A', border: '1px solid #3B3511' }}
              >
                <div className="flex items-start gap-3">
                  <Coffee size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-200 font-medium mb-1">Food Pickup Check</p>
                    <p className="text-xs" style={{ color: '#D4A574' }}>
                      Is this food already ordered and ready for pickup?
                    </p>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={foodReadyAck}
                        onChange={e => setFoodReadyAck(e.target.checked)}
                        className="w-4 h-4 accent-amber-400"
                      />
                      <span className="text-xs text-amber-200">Yes, it&apos;s ready</span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

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
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background: canProceedStep2 ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45',
                  color: canProceedStep2 ? 'white' : '#475569',
                }}
              >
                Continue to Locations
                <ChevronRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Locations */}
        {step === 3 && (
          <motion.div key="step3-locations" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

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
                <div className="mt-2">
                  <div className="text-[10px] mb-1.5" style={{ color: '#64748B' }}>Pickup area type</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {LOCATION_TYPE_OPTIONS.map(({ type, label }) => (
                      <OptionButton
                        key={`pickup-${type}`}
                        value={type}
                        selected={pickupLocationType === type}
                        onClick={() => {
                          setPickupLocationType(type);
                          setErrors(p => ({ ...p, locationType: '' }));
                        }}
                        className="px-2 py-2 text-[10px] text-center leading-tight"
                      >
                        {label}
                      </OptionButton>
                    ))}
                  </div>
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
                <div className="mt-2">
                  <div className="text-[10px] mb-1.5" style={{ color: '#64748B' }}>Drop area type</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {LOCATION_TYPE_OPTIONS.map(({ type, label }) => (
                      <OptionButton
                        key={`drop-${type}`}
                        value={type}
                        selected={dropLocationType === type}
                        onClick={() => {
                          setDropLocationType(type);
                          setErrors(p => ({ ...p, locationType: '' }));
                        }}
                        className="px-2 py-2 text-[10px] text-center leading-tight"
                      >
                        {label}
                      </OptionButton>
                    ))}
                  </div>
                </div>
              </div>

              {(locationTypeConflict || errors.locationType) && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.locationType || locationTypeConflict}
                </p>
              )}

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
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <motion.div key="step4-review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1E2D45' }}>
              <div className="px-4 py-3" style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  JOB PREVIEW · {new Date().toLocaleDateString()}
                </div>
              </div>
              <div className="p-4 space-y-3" style={{ background: '#0B1120' }}>
                {[
                  { label: 'Job Type', value: jobType ? JOB_TYPE_LABELS[jobType] : '—' },
                  {
                    label: 'Timing',
                    value: getTimingReviewValue(jobType, scheduledWindowStart, scheduledWindowEnd, travelDateTime),
                  },
                  { label: 'Item Type', value: itemType },
                  { label: 'Weight Tier', value: weight },
                  { label: 'Risk Level', value: risk },
                  { label: 'Pickup', value: pickup },
                  { label: 'Pickup Type', value: LOCATION_TYPE_LABELS[pickupLocationType] },
                  { label: 'Drop', value: drop },
                  { label: 'Drop Type', value: LOCATION_TYPE_LABELS[dropLocationType] },
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
