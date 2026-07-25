import React from 'react';
import { useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import {
  Package, Zap, TrendingUp, Star, Shield, Clock,
  ChevronRight, ArrowUpRight, Award, CheckCircle2,
  AlertCircle, Radio
} from 'lucide-react';
import { motion } from 'motion/react';

const statusColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  OPEN: { bg: '#0D1A2D', text: '#60A5FA', border: '#1E3A5F', dot: '#60A5FA' },
  MATCHED: { bg: '#0D1A0D', text: '#34D399', border: '#1A3520', dot: '#34D399' },
  IN_TRANSIT: { bg: '#1A1005', text: '#FCD34D', border: '#3B2A0A', dot: '#FCD34D' },
  DELIVERED: { bg: '#0A1A0D', text: '#10B981', border: '#1A3520', dot: '#10B981' },
  CLOSED: { bg: '#0D1120', text: '#64748B', border: '#1E2D45', dot: '#64748B' },
  DISPUTED: { bg: '#1C0A0A', text: '#F87171', border: '#3B1111', dot: '#F87171' },
  ISSUE_REPORTED: { bg: '#1C0A0A', text: '#F97316', border: '#3B1811', dot: '#F97316' },
  PENDING_RATING: { bg: '#1A1005', text: '#FCD34D', border: '#3B2A0A', dot: '#FCD34D' },
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'FINDING BUDDY',
  MATCHED: 'MATCHED',
  IN_TRANSIT: 'IN TRANSIT',
  DELIVERED: 'DELIVERED',
  PENDING_RATING: 'PAYMENT PENDING',
  CLOSED: 'CLOSED',
  DISPUTED: 'OPS REVIEW',
  ISSUE_REPORTED: 'NEEDS REVIEW',
};

function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || statusColors.CLOSED;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontFamily: 'JetBrains Mono, monospace' }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {STATUS_LABELS[status] ?? status.replace(/_/g, ' ')}
    </span>
  );
}

const ACTIVE_STATUSES = ['MATCHED', 'IN_TRANSIT', 'PENDING_RATING', 'ISSUE_REPORTED'] as const;

export function HomePage() {
  const { user, setCurrentRole, currentRole, jobs, setActiveJob } = useApp();
  const navigate = useNavigate();

  const uid = user?.id ?? defaultUser.id;
  const isSenderMode = currentRole === 'sender';
  const isRunnerMode = currentRole === 'runner';

  // Home view follows the mode toggle — do not mix runner jobs into sender home.
  const myJobs = jobs.filter(j => {
    if (isSenderMode) return j.sender_id === uid;
    if (isRunnerMode) return j.runner_id === uid;
    return j.sender_id === uid || j.runner_id === uid;
  });
  const recentJobs = myJobs.slice(0, 4);
  const activeJob = jobs.find(j => {
    if (!ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])) return false;
    if (isSenderMode) return j.sender_id === uid;
    if (isRunnerMode) return j.runner_id === uid;
    return j.sender_id === uid || j.runner_id === uid;
  });

  const openJob = (job: (typeof jobs)[number]) => {
    setActiveJob(job);
    const iAmSender = job.sender_id === uid;
    const iAmRunner = job.runner_id === uid;

    // Respect Home mode toggle — never force-switch role out from under the user.
    const preferRunner = isRunnerMode || (!isSenderMode && iAmRunner && !iAmSender);
    const preferSender = isSenderMode || (!isRunnerMode && iAmSender);

    // —— Sender mode ——
    if (preferSender && iAmSender) {
      if (job.status === 'PENDING_RATING' || job.status === 'DELIVERED' || job.status === 'ISSUE_REPORTED') {
        navigate('/rate', { state: { jobId: job.id } });
        return;
      }
      navigate('/sender/tracking');
      return;
    }

    // —— Runner mode ——
    // MATCHED / IN_TRANSIT / ISSUE_REPORTED (hold-for-ops) all live on Active Delivery.
    if (preferRunner && iAmRunner) {
      if (job.status === 'MATCHED' || job.status === 'IN_TRANSIT' || job.status === 'ISSUE_REPORTED') {
        navigate('/runner/active');
        return;
      }
      // Delivery complete from runner POV — Active still shows resolved/hold copy when possible.
      if (job.status === 'PENDING_RATING' || job.status === 'DISPUTED' || job.status === 'CLOSED') {
        navigate('/runner/active');
        return;
      }
    }

    // Job doesn't match current mode (e.g. runner-only job while in Sender mode).
    navigate('/home');
  };

  const displayUser = user || {
    name: 'Aditi Krishnan',
    hostel_block: 'MH-C Block',
    weekly_earnings: 320,
    total_earnings: 1840,
    total_deliveries: 23,
    rating: 4.8,
    trust_score: 94,
    acceptance_rate: 91,
    streak: 4,
    best_week_earnings: 450,
  };

  const weeksProgress = Math.round((displayUser.weekly_earnings / displayUser.best_week_earnings) * 100);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-5" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Welcome header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              COMMAND CENTER · {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
            </div>
            <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.35rem' }}>
              Hey, {displayUser.name.split(' ')[0]} 👋
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
              {displayUser.hostel_block}
              {' · '}
              {currentRole === 'sender'
                ? 'Sender mode'
                : currentRole === 'runner'
                  ? 'Runner mode'
                  : 'Pick Sender or Runner'}
            </p>
          </div>

          {/* Role selector — stays on Home; post/feed are via quick actions below */}
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid #1E2D45' }}>
            <button
              type="button"
              onClick={() => setCurrentRole('sender')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all"
              style={{
                background: currentRole === 'sender' ? '#1A0F2E' : '#0B1120',
                color: currentRole === 'sender' ? '#A78BFA' : '#64748B',
                borderRight: '1px solid #1E2D45',
              }}
            >
              <Package size={14} />
              Sender
            </button>
            <button
              type="button"
              onClick={() => setCurrentRole('runner')}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all"
              style={{
                background: currentRole === 'runner' ? '#061620' : '#0B1120',
                color: currentRole === 'runner' ? '#22D3EE' : '#64748B',
              }}
            >
              <Zap size={14} />
              Runner
            </button>
          </div>
        </div>
      </motion.div>

      {import.meta.env.DEV && (
        <div className="rounded-lg px-3 py-2.5 text-[11px]" style={{ background: '#070B17', border: '1px solid #1A2535', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
          DEV dogfood: <span className="text-cyan-400">__rushbuddyDev.loadPilotScenarios()</span>
          {' · '}
          <span className="text-cyan-400">bypassNoAnswerWait(true)</span>
          {' · '}
          <span className="text-cyan-400">unsuspendRunner('u1')</span>
          {' — '}refresh resets in-memory state
        </div>
      )}

      {/* Active job alert */}
      {activeJob && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => openJob(activeJob)}
          className="rounded-xl p-4 cursor-pointer transition-all hover:brightness-110"
          style={{
            background: activeJob.status === 'PENDING_RATING' || activeJob.status === 'ISSUE_REPORTED' ? '#1A1005' : '#0A1A10',
            border: `1px solid ${activeJob.status === 'PENDING_RATING' || activeJob.status === 'ISSUE_REPORTED' ? '#3B2A0A' : '#1A3520'}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse"
              style={{ background: '#0D2010', border: '1px solid #1A4020' }}>
              <Radio size={18} className={activeJob.status === 'PENDING_RATING' ? 'text-amber-400' : 'text-emerald-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className={`w-2 h-2 rounded-full animate-pulse ${activeJob.status === 'PENDING_RATING' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className={`text-xs ${activeJob.status === 'PENDING_RATING' ? 'text-amber-400' : 'text-emerald-400'}`} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {activeJob.status === 'PENDING_RATING' ? 'PAYMENT PENDING' : activeJob.status === 'ISSUE_REPORTED' ? 'NEEDS REVIEW' : 'ACTIVE JOB'}
                </span>
              </div>
              <p className="text-sm text-white truncate">{activeJob.pickup_location} → {activeJob.drop_location}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {isSenderMode && (activeJob.status === 'PENDING_RATING' || activeJob.status === 'ISSUE_REPORTED')
                  ? 'Tap to confirm payment & rate'
                  : isRunnerMode && activeJob.status === 'ISSUE_REPORTED'
                    ? 'Tap to open hold-for-ops status'
                    : isRunnerMode
                      ? 'Tap to open active delivery'
                      : isSenderMode
                        ? 'Tap to open sender tracking'
                        : `${activeJob.item_type} · ₹${activeJob.agreed_price ?? activeJob.posted_price}`}
              </p>
            </div>
            <ChevronRight size={16} className={activeJob.status === 'PENDING_RATING' ? 'text-amber-400' : 'text-emerald-400'} style={{ flexShrink: 0 }} />
          </div>
        </motion.div>
      )}

      {/* Stats — sender vs runner */}
      {isSenderMode ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'My requests', value: String(myJobs.length),
              sub: `${myJobs.filter(j => j.status === 'OPEN').length} finding buddy`, icon: Package,
              color: '#A78BFA', bg: '#0D0A1E', border: '#2D1E45',
            },
            {
              label: 'In progress', value: String(myJobs.filter(j => ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])).length),
              sub: 'Matched / transit / pay', icon: Radio,
              color: '#FCD34D', bg: '#1A1005', border: '#3B2A0A',
            },
            {
              label: 'Closed', value: String(myJobs.filter(j => j.status === 'CLOSED').length),
              sub: 'Completed sends', icon: CheckCircle2,
              color: '#10B981', bg: '#0A1A10', border: '#1A3520',
            },
            {
              label: 'Trust', value: `${displayUser.trust_score}`,
              sub: displayUser.hostel_block, icon: Shield,
              color: '#06B6D4', bg: '#061620', border: '#0E2D3D',
            },
          ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-xl p-4"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs" style={{ color: '#64748B' }}>{label}</span>
                <Icon size={14} style={{ color }} />
              </div>
              <div className="text-white mb-0.5" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '1.2rem', color }}>
                {value}
              </div>
              <div className="text-[10px]" style={{ color: '#475569' }}>{sub}</div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'This Week', value: `₹${displayUser.weekly_earnings}`,
              sub: `${weeksProgress}% of best week`, icon: TrendingUp,
              color: '#10B981', bg: '#0A1A10', border: '#1A3520',
            },
            {
              label: 'Total Earned', value: `₹${displayUser.total_earnings.toLocaleString()}`,
              sub: `${displayUser.total_deliveries} deliveries`, icon: Award,
              color: '#6366F1', bg: '#0D0D20', border: '#1E1E45',
            },
            {
              label: 'Rating', value: `${displayUser.rating}★`,
              sub: 'Platform avg 4.6', icon: Star,
              color: '#F59E0B', bg: '#1A1005', border: '#3B2A0A',
            },
            {
              label: 'Trust Score', value: `${displayUser.trust_score}`,
              sub: `${displayUser.streak}-day streak`, icon: Shield,
              color: '#06B6D4', bg: '#061620', border: '#0E2D3D',
            },
          ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-xl p-4"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs" style={{ color: '#64748B' }}>{label}</span>
                <Icon size={14} style={{ color }} />
              </div>
              <div className="text-white mb-0.5" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '1.2rem', color }}>
                {value}
              </div>
              <div className="text-[10px]" style={{ color: '#475569' }}>{sub}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Weekly progress — runner only */}
      {!isSenderMode && (
      <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs mb-0.5" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>WEEKLY PROGRESS</div>
            <p className="text-sm text-white">
              ₹{displayUser.best_week_earnings - displayUser.weekly_earnings} away from your best week
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ color: '#64748B' }}>Best: ₹{displayUser.best_week_earnings}</div>
            <div className="text-xs text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {displayUser.streak} 🔥 streak
            </div>
          </div>
        </div>
        <div className="w-full rounded-full h-2" style={{ background: '#1E2D45' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${weeksProgress}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-2 rounded-full"
            style={{ background: 'linear-gradient(90deg, #06B6D4, #10B981)' }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>₹0</span>
          <span className="text-[10px]" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>₹{displayUser.best_week_earnings}</span>
        </div>
      </div>
      )}

      {/* Quick actions — highlight the mode's primary CTA */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { setCurrentRole('sender'); navigate('/sender/post'); }}
          className="rounded-xl p-4 text-left transition-all hover:brightness-110 group"
          style={{
            background: '#0D0A1E',
            border: `1px solid ${isSenderMode ? '#7C3AED' : '#2D1E45'}`,
            opacity: isRunnerMode ? 0.55 : 1,
          }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ background: '#1A0F2E', border: '1px solid #3D2060' }}>
            <Package size={18} className="text-violet-400" />
          </div>
          <p className="text-sm font-medium text-white mb-0.5">Post a Request</p>
          <p className="text-[11px]" style={{ color: '#64748B' }}>Send something across campus</p>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-violet-400">
            <span>Get started</span>
            <ArrowUpRight size={10} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setCurrentRole('runner'); navigate('/runner/feed'); }}
          className="rounded-xl p-4 text-left transition-all hover:brightness-110"
          style={{
            background: '#061620',
            border: `1px solid ${isRunnerMode ? '#22D3EE' : '#0E2D3D'}`,
            opacity: isSenderMode ? 0.55 : 1,
          }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
            style={{ background: '#0A2030', border: '1px solid #1A4050' }}>
            <Zap size={18} className="text-cyan-400" />
          </div>
          <p className="text-sm font-medium text-white mb-0.5">Browse Jobs</p>
          <p className="text-[11px]" style={{ color: '#64748B' }}>
            <span className="text-cyan-400 font-medium">{jobs.filter(j => j.status === 'OPEN').length} open</span> right now
          </p>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-cyan-400">
            <span>View feed</span>
            <ArrowUpRight size={10} />
          </div>
        </button>
      </div>

      {/* Metrics — role-specific */}
      {isSenderMode ? (
        <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
          <div className="text-xs mb-4" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            SENDER SNAPSHOT
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Open', value: myJobs.filter(j => j.status === 'OPEN').length, good: true },
              { label: 'Active', value: myJobs.filter(j => ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])).length, good: true },
              { label: 'Disputed', value: myJobs.filter(j => j.status === 'DISPUTED').length, good: myJobs.filter(j => j.status === 'DISPUTED').length === 0 },
            ].map(({ label, value, good }) => (
              <div key={label} className="text-center">
                <div className="mb-1" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: good ? '#10B981' : '#F59E0B', fontSize: '1.1rem' }}>
                  {value}
                </div>
                <div className="text-[10px]" style={{ color: '#475569' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
          <div className="text-xs mb-4" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            RUNNER METRICS
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Acceptance Rate', value: `${displayUser.acceptance_rate}%`, good: displayUser.acceptance_rate >= 80 },
              { label: 'Deliveries', value: displayUser.total_deliveries, good: true },
              { label: 'Rating', value: `${displayUser.rating}/5.0`, good: displayUser.rating >= 4 },
            ].map(({ label, value, good }) => (
              <div key={label} className="text-center">
                <div className="mb-1" style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: good ? '#10B981' : '#F59E0B', fontSize: '1.1rem' }}>
                  {value}
                </div>
                <div className="text-[10px]" style={{ color: '#475569' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E2D45' }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
          <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            {isSenderMode ? 'MY REQUESTS' : isRunnerMode ? 'MY RUNS' : 'RECENT JOBS'}
          </div>
          <button type="button" className="text-xs text-cyan-400 flex items-center gap-1 hover:text-cyan-300 transition-colors">
            View all <ChevronRight size={11} />
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="px-4 py-8 text-center" style={{ background: '#0B1120' }}>
            <Package size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm" style={{ color: '#475569' }}>
              {isSenderMode
                ? 'No requests yet. Post a request to get started.'
                : isRunnerMode
                  ? 'No runs yet. Browse the job feed.'
                  : 'No jobs yet. Pick Sender or Runner above.'}
            </p>
          </div>
        ) : (
          <div style={{ background: '#0B1120' }}>
            {recentJobs.map((job, i) => (
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => openJob(job)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openJob(job); } }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                style={{ borderBottom: i < recentJobs.length - 1 ? '1px solid #111E35' : 'none' }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
                  {job.item_type === 'Document' ? <Package size={14} className="text-blue-400" /> :
                    job.item_type === 'Food' ? <span className="text-sm">🍱</span> :
                      job.item_type === 'Medicine' ? <span className="text-sm">💊</span> :
                        <Package size={14} className="text-slate-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs text-white truncate">
                      {job.pickup_location} → {job.drop_location}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={job.status} />
                    {isSenderMode ? (
                      <span className="text-[10px]" style={{ color: '#475569' }}>as Sender</span>
                    ) : isRunnerMode ? (
                      <span className="text-[10px]" style={{ color: '#475569' }}>as Runner</span>
                    ) : job.sender_id === uid && job.runner_id === uid ? (
                      <span className="text-[10px]" style={{ color: '#64748B' }}>you = sender + runner</span>
                    ) : job.runner_id === uid ? (
                      <span className="text-[10px]" style={{ color: '#475569' }}>as Runner</span>
                    ) : (
                      <span className="text-[10px]" style={{ color: '#475569' }}>as Sender</span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-medium text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    ₹{job.agreed_price ?? job.posted_price}
                  </div>
                  {job.tip_amount && job.tip_amount > 0 ? (
                    <div className="text-[10px] text-amber-400">+₹{job.tip_amount} tip</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
