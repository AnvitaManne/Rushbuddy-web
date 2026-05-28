import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Job } from '../../context/AppContext';
import type { JobType, LocationType, ScheduledWindow } from '@/domain';
import { DECLARED_VALUE_MAX_INR } from '@/domain/constants';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
  validatePostedPrice,
} from '@/domain/jobHelpers';
import {
  buildScheduledWindowFromLocal,
  getDeclaredValueError,
  getLocationTypeConflictError,
  getSenderActiveJobError,
  parseDatetimeLocalToIso,
  toTravelDateFromLocal,
  validateLocationTypes,
  validatePostRequestDraft,
  validatePostRequestMode2,
  validatePostRequestTiming,
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

function formatDatetimeLocalDisplay(local: string): string {
  const iso = parseDatetimeLocalToIso(local);
  if (!iso) return local || '—';
  return new Date(iso).toLocaleString();
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

function getPostReviewNotice(jobType: JobType | null): string {
  if (jobType === 'intercity') {
    return 'Posting this job will notify eligible runners on the corridor route. Matching is first-come, first-served. You can cancel before a runner accepts.';
  }
  return 'Posting this job will notify eligible runners on campus. Matching is first-come, first-served. You can cancel before a runner accepts.';
}

function parsePostedPriceInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function getPostedPriceError(priceFloor: number, input: string): string | undefined {
  if (priceFloor <= 0) return undefined;
  if (!input.trim()) return 'Posted price is required.';
  const posted = parsePostedPriceInput(input);
  if (posted === null) return 'Enter a valid posted price.';
  if (!validatePostedPrice(priceFloor, posted)) {
    return `Posted price must be at or above the system floor (₹${priceFloor}).`;
  }
  return undefined;
}

function parseDeclaredValueInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.round(value);
}

function validationErrorStep(errors: Partial<Record<string, string>>): number {
  if (errors.scheduling || errors.corridorLandmark || errors.receiverPhone || errors.mode2 || errors.activeJob) {
    return 1;
  }
  if (errors.postedPrice || errors.declaredValue) return 2;
  return 3;
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
  const { user, jobs, setJobs, setCurrentRole, setActiveJob } = useApp();
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
  const [corridorLandmark, setCorridorLandmark] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [postedPriceInput, setPostedPriceInput] = useState('');
  const [postedPriceTouched, setPostedPriceTouched] = useState(false);
  const [declaredValueInput, setDeclaredValueInput] = useState('');

  const price_floor =
    jobType && itemType && weight && risk
      ? computePriceFloor(itemType, weight, risk, jobType)
      : 0;
  const suggestedPostedPrice = price_floor > 0 ? Math.round(price_floor * 1.4) : 0;

  useEffect(() => {
    if (price_floor > 0 && !postedPriceTouched && !postedPriceInput.trim()) {
      setPostedPriceInput(String(suggestedPostedPrice));
    }
  }, [price_floor, suggestedPostedPrice, postedPriceTouched, postedPriceInput]);

  const parsedPostedPrice = parsePostedPriceInput(postedPriceInput);
  const postedPriceError = getPostedPriceError(price_floor, postedPriceInput);
  const parsedDeclaredValue = parseDeclaredValueInput(declaredValueInput);
  const declaredValueError = getDeclaredValueError(parsedDeclaredValue);

  const locationTypeConflict = getLocationTypeConflictError(pickupLocationType, dropLocationType);
  const senderActiveJobError = user ? getSenderActiveJobError(jobs, user.id) : undefined;

  const schedulingError = jobType
    ? validatePostRequestTiming(
        jobType,
        scheduledWindowStart,
        scheduledWindowEnd,
        travelDateTime,
      )
    : undefined;

  const mode2FieldErrors =
    jobType === 'intercity'
      ? validatePostRequestMode2(jobType, corridorLandmark, receiverPhone)
      : {};
  const mode2Error =
    mode2FieldErrors.corridor_landmark || mode2FieldErrors.receiver_phone;

  const canProceedStep1 =
    jobType !== null &&
    !senderActiveJobError &&
    schedulingError === undefined &&
    !mode2Error;
  const canProceedStep2 =
    itemType &&
    weight &&
    risk &&
    carryOnlyAck &&
    (itemType !== 'Food' || foodReadyAck) &&
    price_floor > 0 &&
    parsedPostedPrice !== null &&
    !postedPriceError &&
    parsedDeclaredValue !== null &&
    !declaredValueError;
  const canProceedStep3 =
    pickup.trim() &&
    drop.trim() &&
    (risk !== 'Valuable' || valuableAck) &&
    validateLocationTypes(pickupLocationType, dropLocationType);

  const handlePost = async () => {
    if (!user || !jobType || !itemType || !weight || !risk) return;

    const job_type = jobType;
    const price_floor = computePriceFloor(itemType, weight, risk, job_type);
    const posted_price = parsedPostedPrice;
    const declared_value = parsedDeclaredValue;

    const validation = validatePostRequestDraft({
      job_type,
      pickup_location: pickup,
      drop_location: drop,
      pickup_location_type: pickupLocationType,
      drop_location_type: dropLocationType,
      price_floor,
      posted_price: posted_price ?? 0,
      declared_value: declared_value ?? undefined,
      scheduled_window_start: scheduledWindowStart,
      scheduled_window_end: scheduledWindowEnd,
      travel_datetime: travelDateTime,
      corridor_landmark: corridorLandmark,
      receiver_phone: receiverPhone,
      sender_id: user.id,
      existing_jobs: jobs,
    });

    if (!validation.valid) {
      const errs: Record<string, string> = {};
      if (validation.errors.sender_active) errs.activeJob = validation.errors.sender_active;
      if (validation.errors.scheduling) errs.scheduling = validation.errors.scheduling;
      if (validation.errors.corridor_landmark) errs.corridorLandmark = validation.errors.corridor_landmark;
      if (validation.errors.receiver_phone) errs.receiverPhone = validation.errors.receiver_phone;
      if (validation.errors.pickup_location) errs.pickup = validation.errors.pickup_location;
      if (validation.errors.drop_location) errs.drop = validation.errors.drop_location;
      if (validation.errors.pickup_location_type) errs.locationType = validation.errors.pickup_location_type;
      if (validation.errors.posted_price) errs.postedPrice = validation.errors.posted_price;
      if (validation.errors.declared_value) errs.declaredValue = validation.errors.declared_value;
      if (validation.errors.corridor_landmark || validation.errors.receiver_phone) {
        errs.mode2 =
          validation.errors.corridor_landmark ||
          validation.errors.receiver_phone ||
          'Complete landmark handoff details.';
      }
      setErrors(errs);
      setStep(validationErrorStep(errs));
      return;
    }

    if (posted_price === null || declared_value === null) return;

    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));

    const created_at = new Date().toISOString();

    let scheduled_window: ScheduledWindow | undefined;
    let travel_date: string | undefined;
    let travelDateTimeIso: string | undefined;

    if (job_type === 'campus_scheduled') {
      scheduled_window = buildScheduledWindowFromLocal(scheduledWindowStart, scheduledWindowEnd);
    } else if (job_type === 'intercity') {
      travelDateTimeIso = parseDatetimeLocalToIso(travelDateTime)!;
      travel_date = toTravelDateFromLocal(travelDateTime);
    }

    const expires_at = computeExpiresAt(
      job_type,
      created_at,
      scheduled_window,
      travelDateTimeIso,
    );

    const newJob: Job = {
      id: `JOB-${2410 + Math.floor(Math.random() * 90)}`,
      sender_id: user.id,
      sender_name: user.name,
      sender_hostel: user.hostel_block,
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
      declared_value,
      confirmation_code: generateConfirmationCode(),
      expires_at,
      scheduled_window,
      travel_date,
      corridor_landmark: job_type === 'intercity' ? corridorLandmark.trim() : undefined,
      receiver_phone: job_type === 'intercity' ? receiverPhone.trim() : undefined,
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
        {(senderActiveJobError || errors.activeJob) && (
          <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
            style={{ background: '#1C0A0A', border: '1px solid #3B1111' }}>
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{errors.activeJob || senderActiveJobError}</p>
          </div>
        )}
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
                        setCorridorLandmark('');
                        setReceiverPhone('');
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

            {jobType === 'intercity' && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  LANDMARK HANDOFF · MODE 2
                </div>
                <p className="text-[11px]" style={{ color: '#64748B' }}>
                  Receiver meets the runner at the corridor landmark. Share your confirmation code with them before handoff.
                </p>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Corridor landmark</label>
                  <input
                    type="text"
                    value={corridorLandmark}
                    onChange={e => {
                      setCorridorLandmark(e.target.value);
                      setErrors(p => ({ ...p, corridorLandmark: '', mode2: '' }));
                    }}
                    placeholder="e.g. Katpadi Junction north exit"
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{
                      ...datetimeInputStyle,
                      border: `1px solid ${mode2FieldErrors.corridor_landmark || errors.corridorLandmark ? '#EF4444' : '#1E2D45'}`,
                    }}
                  />
                  {(errors.corridorLandmark || mode2FieldErrors.corridor_landmark) && (
                    <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                      <AlertCircle size={10} />{errors.corridorLandmark || mode2FieldErrors.corridor_landmark}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>Receiver phone</label>
                  <input
                    type="tel"
                    value={receiverPhone}
                    onChange={e => {
                      setReceiverPhone(e.target.value);
                      setErrors(p => ({ ...p, receiverPhone: '', mode2: '' }));
                    }}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                    style={{
                      ...datetimeInputStyle,
                      border: `1px solid ${(mode2FieldErrors.receiver_phone && !receiverPhone.trim()) || errors.receiverPhone ? '#EF4444' : '#1E2D45'}`,
                    }}
                  />
                  {(errors.receiverPhone || mode2FieldErrors.receiver_phone) && (
                    <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                      <AlertCircle size={10} />{errors.receiverPhone || mode2FieldErrors.receiver_phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {(schedulingError || errors.scheduling) && jobType && jobType !== 'campus_immediate' && (
              <p className="text-[11px] mb-4 text-red-400 flex items-center gap-1">
                <AlertCircle size={10} />
                {errors.scheduling || schedulingError}
              </p>
            )}

            {(mode2Error || errors.mode2) && jobType === 'intercity' && (
              <p className="text-[11px] mb-4 text-red-400 flex items-center gap-1">
                <AlertCircle size={10} />
                {errors.mode2 || mode2Error}
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

            {/* Declared value */}
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                DECLARED ITEM VALUE
              </div>
              <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>
                Estimated value (₹1 – ₹{DECLARED_VALUE_MAX_INR.toLocaleString('en-IN')})
              </label>
              <input
                type="number"
                min={1}
                max={DECLARED_VALUE_MAX_INR}
                step={1}
                value={declaredValueInput}
                onChange={e => {
                  setDeclaredValueInput(e.target.value);
                  setErrors(p => ({ ...p, declaredValue: '' }));
                }}
                placeholder="e.g. 500"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none"
                style={{
                  background: '#060A14',
                  border: `1px solid ${declaredValueError || errors.declaredValue ? '#EF4444' : '#1E2D45'}`,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              <div className="text-[10px] mt-1.5" style={{ color: '#475569' }}>
                V1 hard cap: items above ₹{DECLARED_VALUE_MAX_INR.toLocaleString('en-IN')} cannot be posted.
              </div>
              {(declaredValueError || errors.declaredValue) && (
                <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                  <AlertCircle size={10} />
                  {errors.declaredValue || declaredValueError}
                </p>
              )}
            </div>

            {/* Hybrid floor pricing */}
            {price_floor > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-4 mb-4 space-y-4"
                style={{ background: '#0A1A10', border: '1px solid #1A3520' }}
              >
                <div>
                  <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                    SYSTEM PRICE FLOOR
                  </div>
                  <div className="text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '1.5rem' }}>
                    ₹{price_floor}
                  </div>
                  <div className="text-xs mt-1" style={{ color: '#64748B' }}>
                    Non-negotiable minimum based on {itemType} × {weight} × {risk} risk
                  </div>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>
                    Your posted offer (≥ ₹{price_floor})
                  </label>
                  <input
                    type="number"
                    min={price_floor}
                    step={1}
                    value={postedPriceInput}
                    onChange={e => {
                      setPostedPriceTouched(true);
                      setPostedPriceInput(e.target.value);
                      setErrors(p => ({ ...p, postedPrice: '' }));
                    }}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                    style={{
                      background: '#060A14',
                      border: `1px solid ${postedPriceError || errors.postedPrice ? '#EF4444' : '#1E2D45'}`,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <div className="text-[10px]" style={{ color: '#475569' }}>
                      Suggested: ₹{suggestedPostedPrice}. Runners accept this amount as-is.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPostedPriceInput(String(suggestedPostedPrice));
                        setPostedPriceTouched(true);
                        setErrors(p => ({ ...p, postedPrice: '' }));
                      }}
                      className="text-[10px] px-2 py-1 rounded border transition-all"
                      style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#94A3B8' }}
                    >
                      Use suggested
                    </button>
                  </div>
                  {(postedPriceError || errors.postedPrice) && (
                    <p className="text-[11px] mt-1 text-red-400 flex items-center gap-1">
                      <AlertCircle size={10} />
                      {errors.postedPrice || postedPriceError}
                    </p>
                  )}
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
              <div className="flex items-center justify-between text-sm mb-2">
                <div style={{ color: '#64748B' }}>
                  {itemType} · {weight} · {risk} risk
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div style={{ color: '#64748B' }}>Floor</div>
                <div className="text-slate-300 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  ₹{price_floor}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <div style={{ color: '#64748B' }}>Declared value</div>
                <div className="text-slate-300 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  ₹{parsedDeclaredValue ?? '—'}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <div style={{ color: '#64748B' }}>Your offer</div>
                <div className="text-emerald-400 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  ₹{parsedPostedPrice ?? '—'}
                </div>
              </div>
              <div className="text-[10px] mt-1.5" style={{ color: '#475569' }}>
                Platform fee: ₹0 (beta).
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
                  ...(jobType === 'intercity'
                    ? [
                        { label: 'Corridor Landmark', value: corridorLandmark || '—' },
                        { label: 'Receiver Phone', value: receiverPhone || '—' },
                      ]
                    : []),
                  { label: 'Item Type', value: itemType },
                  { label: 'Weight Tier', value: weight },
                  { label: 'Risk Level', value: risk },
                  { label: 'Declared Value', value: parsedDeclaredValue !== null ? `₹${parsedDeclaredValue}` : '—', mono: true },
                  { label: 'Pickup', value: pickup },
                  { label: 'Pickup Type', value: LOCATION_TYPE_LABELS[pickupLocationType] },
                  { label: 'Drop', value: drop },
                  { label: 'Drop Type', value: LOCATION_TYPE_LABELS[dropLocationType] },
                  { label: 'Description', value: description || '—' },
                  { label: 'Price Floor', value: `₹${price_floor}`, mono: true },
                  { label: 'Posted Price', value: `₹${parsedPostedPrice ?? '—'}`, mono: true, highlight: true },
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
                {getPostReviewNotice(jobType)}
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
                disabled={loading || !!senderActiveJobError}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #06B6D4, #6366F1)',
                  opacity: loading || senderActiveJobError ? 0.8 : 1,
                }}
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
