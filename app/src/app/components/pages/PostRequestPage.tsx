import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Job } from '../../context/AppContext';
import type { JobType, LocationType } from '@/domain/enums';
import {
  computeExpiresAt,
  computePriceFloor,
  generateConfirmationCode,
  resolveHandoffMode,
} from '@/domain/jobHelpers';
import {
  buildScheduledWindowFromLocal,
  canSenderCancelJob,
  getSenderActiveJob,
  getSenderActiveJobError,
  toTravelDateFromLocal,
  validatePostRequestDraft,
  type PostRequestDraft,
} from '@/domain/postingValidation';
import { assertTransition } from '@/domain/jobTransitions';
import {
  FileText, Coffee, Pill, Box, ChevronRight, AlertTriangle,
  MapPin, AlertCircle, Info, Package, X, Clock, Train
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ItemType = 'Document' | 'Food' | 'Medicine' | 'Object';
type Weight = 'Light' | 'Medium' | 'Heavy';
type Risk = 'Low' | 'Fragile' | 'Valuable';

const JOB_TYPES: { type: JobType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'campus_immediate',
    label: 'Campus Immediate',
    desc: 'Live now · expires in ~30 min',
    icon: <ZapIcon />,
  },
  {
    type: 'campus_scheduled',
    label: 'Campus Scheduled',
    desc: 'Pick a future window on campus',
    icon: <Clock size={18} />,
  },
  {
    type: 'intercity',
    label: 'Intercity',
    desc: 'Landmark handoff · corridor delivery',
    icon: <Train size={18} />,
  },
];

function ZapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

const ITEM_TYPES: { type: ItemType; icon: React.ReactNode; desc: string }[] = [
  { type: 'Document', icon: <FileText size={18} />, desc: 'Notes, printouts, IDs' },
  { type: 'Food', icon: <Coffee size={18} />, desc: 'Canteen orders, parcels' },
  { type: 'Medicine', icon: <Pill size={18} />, desc: 'Pharmacy pickup' },
  { type: 'Object', icon: <Box size={18} />, desc: 'Chargers, packages, misc' },
];

const LOCATION_TYPES: { type: LocationType; label: string }[] = [
  { type: 'general', label: 'General' },
  { type: 'mens_hostel', label: "Men's hostel" },
  { type: 'womens_hostel', label: "Women's hostel" },
];

function OptionButton<T extends string>({
  value, selected, onClick, children, className = '',
}: {
  value: T; selected: boolean; onClick: () => void; children: React.ReactNode; className?: string;
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

const STEP_LABELS = ['Job Type', 'Item Details', 'Route & Price', 'Review'];

export function PostRequestPage() {
  const { jobs, setJobs, setCurrentRole, setActiveJob, user } = useApp();
  const navigate = useNavigate();
  const senderId = user?.id ?? 'u1';

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
  const [postedPrice, setPostedPrice] = useState(0);
  const [postedPriceTouched, setPostedPriceTouched] = useState(false);
  const [declaredValue, setDeclaredValue] = useState('');
  const [carryOnlyAck, setCarryOnlyAck] = useState(false);
  const [foodReadyAck, setFoodReadyAck] = useState(false);
  const [valuableAck, setValuableAck] = useState(false);
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [travelDatetime, setTravelDatetime] = useState('');
  const [corridorLandmark, setCorridorLandmark] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeSenderJob = getSenderActiveJob(jobs, senderId);
  const activeJobBlock = getSenderActiveJobError(jobs, senderId);

  const priceFloor =
    itemType && weight && risk && jobType
      ? computePriceFloor(itemType, weight, risk, jobType)
      : 0;
  const suggestedPrice = priceFloor > 0 ? Math.round(priceFloor * 1.15) : 0;

  useEffect(() => {
    if (!itemType || !weight || !risk || !jobType) return;
    const floor = computePriceFloor(itemType, weight, risk, jobType);
    if (!postedPriceTouched) setPostedPrice(Math.round(floor * 1.15));
  }, [itemType, weight, risk, jobType, postedPriceTouched]);

  const canProceedStep1 = !!jobType;
  const canProceedStep2 =
    itemType &&
    weight &&
    risk &&
    carryOnlyAck &&
    (itemType !== 'Food' || foodReadyAck) &&
    (risk !== 'Valuable' || valuableAck);
  const canProceedStep3 =
    pickup.trim() &&
    drop.trim() &&
    declaredValue.trim() &&
    Number(declaredValue) > 0 &&
    Number(declaredValue) <= 2000 &&
    postedPrice >= priceFloor &&
    (jobType !== 'campus_scheduled' || (scheduledStart && scheduledEnd)) &&
    (jobType !== 'intercity' || (travelDatetime && corridorLandmark.trim() && receiverPhone.trim()));

  const handleCancelActiveJob = () => {
    if (!activeSenderJob || !user) return;
    if (!canSenderCancelJob(activeSenderJob, user.id)) {
      setFormError('Only OPEN requests can be cancelled. Track your job for updates.');
      return;
    }
    const transition = assertTransition(activeSenderJob.status, 'CLOSED');
    if (!transition.ok) {
      setFormError(transition.error);
      return;
    }
    setJobs(prev =>
      prev.map(j => (j.id === activeSenderJob.id ? { ...j, status: 'CLOSED' as const } : j)),
    );
    setActiveJob(null);
    setFormError('');
  };

  const buildDraft = (): PostRequestDraft | null => {
    if (!jobType || !itemType || !weight || !risk) return null;
    const floor = computePriceFloor(itemType, weight, risk, jobType);
    const scheduled_window =
      jobType === 'campus_scheduled'
        ? buildScheduledWindowFromLocal(scheduledStart, scheduledEnd) ?? undefined
        : undefined;
    const travel_date =
      jobType === 'intercity' ? toTravelDateFromLocal(travelDatetime) ?? undefined : undefined;

    return {
      job_type: jobType,
      item_type: itemType,
      weight,
      risk,
      pickup_location: pickup,
      drop_location: drop,
      pickup_location_type: pickupLocationType,
      drop_location_type: dropLocationType,
      price_floor: floor,
      posted_price: postedPrice,
      declared_value: Number(declaredValue),
      carry_only_ack: carryOnlyAck,
      food_ready_ack: foodReadyAck,
      scheduled_window,
      travel_date,
      corridor_landmark: jobType === 'intercity' ? corridorLandmark : undefined,
      receiver_phone: jobType === 'intercity' ? receiverPhone : undefined,
    };
  };

  const handlePost = async () => {
    if (activeJobBlock) {
      setFormError(activeJobBlock);
      return;
    }
    const draft = buildDraft();
    if (!draft) return;
    const validationError = validatePostRequestDraft(draft);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));

    const created_at = new Date().toISOString();
    const newJob: Job = {
      id: `JOB-${2410 + Math.floor(Math.random() * 90)}`,
      sender_id: senderId,
      sender_name: user?.name ?? 'You',
      sender_hostel: user?.hostel_block ?? 'MH-C Block',
      job_type: draft.job_type,
      handoff_mode: resolveHandoffMode(draft.job_type),
      item_type: draft.item_type,
      weight: draft.weight,
      risk: draft.risk,
      purchase_type: 'carry_only',
      pickup_location: draft.pickup_location,
      drop_location: draft.drop_location,
      pickup_location_type: draft.pickup_location_type,
      drop_location_type: draft.drop_location_type,
      description,
      price_floor: draft.price_floor,
      posted_price: draft.posted_price,
      declared_value: draft.declared_value,
      confirmation_code: generateConfirmationCode(),
      expires_at: computeExpiresAt(
        draft.job_type,
        created_at,
        draft.scheduled_window,
        draft.travel_date,
      ),
      condition_acknowledged: false,
      status: 'OPEN',
      created_at,
      scheduled_window: draft.scheduled_window,
      travel_date: draft.travel_date,
      corridor_landmark: draft.corridor_landmark,
      receiver_phone: draft.receiver_phone,
      eta: draft.job_type === 'intercity' ? '~2h' : '~12 min',
      distance: draft.job_type === 'intercity' ? 'corridor' : '0.8 km',
    };

    setJobs(prev => [newJob, ...prev]);
    setActiveJob(newJob);
    setCurrentRole('sender');
    setLoading(false);
    navigate('/sender/tracking');
  };

  const jobTypeLabel = JOB_TYPES.find(j => j.type === jobType)?.label ?? '—';

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl" style={{ fontFamily: 'Inter, sans-serif' }}>

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

      {activeSenderJob && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: '#1A1005', border: '1px solid #3B2A0A' }}
        >
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-200 font-medium">Active request in progress</p>
              <p className="text-xs mt-1" style={{ color: '#92400E' }}>
                {activeSenderJob.id} · {activeSenderJob.status} · {activeSenderJob.pickup_location} →{' '}
                {activeSenderJob.drop_location}
              </p>
              <p className="text-xs mt-2" style={{ color: '#64748B' }}>
                Finish or cancel your current request before posting another.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => navigate('/sender/tracking')}
              className="px-3 py-1.5 rounded-lg text-xs text-cyan-400"
              style={{ background: '#061620', border: '1px solid #0E2D3D' }}
            >
              View tracking
            </button>
            {canSenderCancelJob(activeSenderJob, senderId) && (
              <button
                type="button"
                onClick={handleCancelActiveJob}
                className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                style={{ background: '#1C0A0A', border: '1px solid #3B1111', color: '#F87171' }}
              >
                <X size={11} />
                Cancel OPEN request
              </button>
            )}
          </div>
        </div>
      )}

      {formError && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-4"
          style={{ background: '#1C0A0A', border: '1px solid #3B1111', color: '#F87171' }}
        >
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          {formError}
        </div>
      )}

      <div className="flex items-center gap-0 mb-6 overflow-x-auto">
        {STEP_LABELS.map((s, i) => {
          const stepNum = i + 1;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{
                    background: isDone ? '#10B981' : isActive ? '#06B6D4' : '#1E2D45',
                    color: isDone || isActive ? 'white' : '#475569',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {isDone ? '✓' : stepNum}
                </div>
                <span className="text-xs hidden sm:block" style={{ color: isActive ? '#E2E8F0' : '#475569' }}>
                  {s}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className="flex-1 mx-2 h-px min-w-[16px]" style={{ background: isDone ? '#10B981' : '#1E2D45' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                JOB TYPE · CHOOSE FIRST
              </div>
              <div className="space-y-2">
                {JOB_TYPES.map(({ type, label, desc, icon }) => (
                  <OptionButton
                    key={type}
                    value={type}
                    selected={jobType === type}
                    onClick={() => { setJobType(type); setFormError(''); }}
                    className="w-full p-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5 text-cyan-400">{icon}</div>
                      <div>
                        <div className="font-medium text-sm">{label}</div>
                        <div className="text-[11px] mt-0.5 opacity-70">{desc}</div>
                      </div>
                    </div>
                  </OptionButton>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => canProceedStep1 && !activeJobBlock && setStep(2)}
              disabled={!canProceedStep1 || !!activeJobBlock}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white"
              style={{
                background: canProceedStep1 && !activeJobBlock ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45',
                color: canProceedStep1 && !activeJobBlock ? 'white' : '#475569',
              }}
            >
              Continue to Item Details
              <ChevronRight size={16} />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>ITEM TYPE</div>
              <div className="grid grid-cols-2 gap-2">
                {ITEM_TYPES.map(({ type, icon, desc }) => (
                  <OptionButton key={type} value={type} selected={itemType === type} onClick={() => setItemType(type)} className="p-3 text-left">
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

            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>WEIGHT TIER</div>
              <div className="grid grid-cols-3 gap-2">
                {(['Light', 'Medium', 'Heavy'] as Weight[]).map(w => (
                  <OptionButton key={w} value={w} selected={weight === w} onClick={() => setWeight(w)} className="p-3 text-center">
                    <div className="font-medium text-sm">{w}</div>
                  </OptionButton>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs mb-3" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>RISK LEVEL</div>
              <div className="grid grid-cols-3 gap-2">
                {(['Low', 'Fragile', 'Valuable'] as Risk[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRisk(r)}
                    className="p-3 text-center rounded-lg border text-sm"
                    style={{
                      background: risk === r ? '#061620' : '#0B1120',
                      border: `1px solid ${risk === r ? '#06B6D4' : '#1E2D45'}`,
                      color: risk === r ? '#22D3EE' : '#94A3B8',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={carryOnlyAck} onChange={e => setCarryOnlyAck(e.target.checked)} className="mt-0.5 accent-cyan-400" />
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  Carry-only delivery (V1). Runner picks up an item you already have — no purchase-and-deliver.
                </span>
              </label>
              {itemType === 'Food' && (
                <label className="flex items-start gap-2 cursor-pointer mt-3">
                  <input type="checkbox" checked={foodReadyAck} onChange={e => setFoodReadyAck(e.target.checked)} className="mt-0.5 accent-cyan-400" />
                  <span className="text-xs" style={{ color: '#94A3B8' }}>
                    Food is already ordered and ready for pickup.
                  </span>
                </label>
              )}
              {risk === 'Valuable' && (
                <label className="flex items-start gap-2 cursor-pointer mt-3">
                  <input type="checkbox" checked={valuableAck} onChange={e => setValuableAck(e.target.checked)} className="mt-0.5 accent-red-400" />
                  <span className="text-xs text-red-300">
                    I acknowledge valuable-item risk and the ₹2,000 declared cap.
                  </span>
                </label>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 rounded-lg text-sm border" style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}>← Back</button>
              <button
                type="button"
                onClick={() => canProceedStep2 && setStep(3)}
                disabled={!canProceedStep2}
                className="flex-1 py-3 rounded-lg text-sm font-semibold"
                style={{ background: canProceedStep2 ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45', color: canProceedStep2 ? 'white' : '#475569' }}
              >
                Route & Price →
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {jobType === 'campus_scheduled' && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>SCHEDULED WINDOW</div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#94A3B8' }}>Window start</label>
                  <input type="datetime-local" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm text-white" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#94A3B8' }}>Window end</label>
                  <input type="datetime-local" value={scheduledEnd} onChange={e => setScheduledEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm text-white" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
                </div>
              </div>
            )}

            {jobType === 'intercity' && (
              <div className="rounded-xl p-4 mb-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>INTERCITY · MODE 2</div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#94A3B8' }}>Travel date & time</label>
                  <input type="datetime-local" value={travelDatetime} onChange={e => setTravelDatetime(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm text-white" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#94A3B8' }}>Corridor landmark</label>
                  <input type="text" value={corridorLandmark} onChange={e => setCorridorLandmark(e.target.value)} placeholder="e.g. Katpadi Junction east exit" className="w-full px-3 py-2 rounded-lg text-sm text-white" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
                </div>
                <div>
                  <label className="text-xs block mb-1" style={{ color: '#94A3B8' }}>Receiver phone</label>
                  <input type="tel" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} placeholder="10-digit mobile" className="w-full px-3 py-2 rounded-lg text-sm text-white" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
                </div>
              </div>
            )}

            <div className="rounded-xl p-4 mb-4 space-y-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>ROUTE</div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#94A3B8' }}>Pickup</label>
                <input type="text" value={pickup} onChange={e => setPickup(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm text-white mb-2" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
                <div className="flex gap-2 flex-wrap">
                  {LOCATION_TYPES.map(({ type, label }) => (
                    <OptionButton key={type} value={type} selected={pickupLocationType === type} onClick={() => setPickupLocationType(type)} className="px-2 py-1 text-[11px]">{label}</OptionButton>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#94A3B8' }}>Drop</label>
                <input type="text" value={drop} onChange={e => setDrop(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm text-white mb-2" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
                <div className="flex gap-2 flex-wrap">
                  {LOCATION_TYPES.map(({ type, label }) => (
                    <OptionButton key={type} value={type} selected={dropLocationType === type} onClick={() => setDropLocationType(type)} className="px-2 py-1 text-[11px]">{label}</OptionButton>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: '#94A3B8' }}>Description (optional)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm text-white resize-none" style={{ background: '#060A14', border: '1px solid #1E2D45' }} />
              </div>
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ background: '#0A1A10', border: '1px solid #1A3520' }}>
              <div className="text-xs mb-2" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>HYBRID PRICING</div>
              <p className="text-xs mb-3" style={{ color: '#64748B' }}>
                System floor: <span className="text-emerald-400 font-mono">₹{priceFloor}</span> · Suggested:{' '}
                <span className="text-emerald-400 font-mono">₹{suggestedPrice}</span>
              </p>
              <label className="text-xs mb-1 block" style={{ color: '#94A3B8' }}>Your posted price (≥ floor)</label>
              <input
                type="number"
                min={priceFloor}
                value={postedPrice || ''}
                onChange={e => {
                  setPostedPriceTouched(true);
                  setPostedPrice(Number(e.target.value));
                }}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white mb-2"
                style={{ background: '#060A14', border: `1px solid ${postedPrice < priceFloor ? '#EF4444' : '#1E2D45'}`, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <button
                type="button"
                onClick={() => { setPostedPrice(suggestedPrice); setPostedPriceTouched(true); }}
                className="text-xs text-cyan-400"
              >
                Use suggested ₹{suggestedPrice}
              </button>
            </div>

            <div className="rounded-xl p-4 mb-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
              <label className="text-xs mb-1 block" style={{ color: '#94A3B8' }}>Declared value (INR, max ₹2,000)</label>
              <input
                type="number"
                min={1}
                max={2000}
                value={declaredValue}
                onChange={e => setDeclaredValue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white"
                style={{ background: '#060A14', border: '1px solid #1E2D45', fontFamily: 'JetBrains Mono, monospace' }}
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="flex-1 py-3 rounded-lg text-sm border" style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}>← Back</button>
              <button
                type="button"
                onClick={() => canProceedStep3 && setStep(4)}
                disabled={!canProceedStep3}
                className="flex-1 py-3 rounded-lg text-sm font-semibold"
                style={{ background: canProceedStep3 ? 'linear-gradient(135deg, #06B6D4, #6366F1)' : '#1E2D45', color: canProceedStep3 ? 'white' : '#475569' }}
              >
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #1E2D45' }}>
              <div className="px-4 py-3" style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
                <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>JOB PREVIEW</div>
              </div>
              <div className="p-4 space-y-2" style={{ background: '#0B1120' }}>
                {[
                  { label: 'Job Type', value: jobTypeLabel },
                  { label: 'Item', value: `${itemType} · ${weight} · ${risk}` },
                  { label: 'Pickup', value: pickup },
                  { label: 'Drop', value: drop },
                  { label: 'Posted Price', value: `₹${postedPrice}`, mono: true, highlight: true },
                  { label: 'Floor', value: `₹${priceFloor}`, mono: true },
                  { label: 'Declared Value', value: `₹${declaredValue}`, mono: true },
                ].map(({ label, value, mono, highlight }) => (
                  <div key={label} className="flex justify-between text-xs gap-4">
                    <span style={{ color: '#475569' }}>{label}</span>
                    <span style={{ color: highlight ? '#10B981' : '#E2E8F0', fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', fontWeight: highlight ? 600 : 400 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] mb-4" style={{ color: '#64748B' }}>
              You can cancel before a runner accepts. Share the handoff code with your receiver after posting.
            </p>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="flex-1 py-3 rounded-lg text-sm border" style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}>← Back</button>
              <button
                type="button"
                onClick={handlePost}
                disabled={loading || !!activeJobBlock}
                className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)', opacity: loading || activeJobBlock ? 0.6 : 1 }}
              >
                {loading ? 'Posting...' : <><Package size={15} /> Post Request</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
