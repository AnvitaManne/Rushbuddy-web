import React from 'react';
import { useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import { canRunnerSeeJob } from '@/domain/runnerEligibility';
import { isOpenJobExpired } from '@/domain/jobHelpers';
import { ChevronRight, ArrowUpRight, Package, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Finding buddy',
  MATCHED: 'Matched',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  PENDING_RATING: 'Payment pending',
  CLOSED: 'Closed',
  DISPUTED: 'Ops review',
  ISSUE_REPORTED: 'Needs review',
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'DISPUTED' || status === 'ISSUE_REPORTED'
      ? { bg: '#C4453618', color: '#C44536' }
      : status === 'IN_TRANSIT' || status === 'PENDING_RATING'
        ? { bg: '#E8A04A22', color: '#9A6A1E' }
        : { bg: '#0B234012', color: '#0B2340' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium tracking-wide"
      style={{ background: tone.bg, color: tone.color, borderRadius: 4 }}
    >
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

  const feedOpenCount = jobs.filter(
    j => j.status === 'OPEN' && !isOpenJobExpired(j) && canRunnerSeeJob(user ?? defaultUser, j),
  ).length;

  const openJob = (job: (typeof jobs)[number]) => {
    setActiveJob(job);
    const iAmSender = job.sender_id === uid;
    const iAmRunner = job.runner_id === uid;

    const preferRunner = isRunnerMode || (!isSenderMode && iAmRunner && !iAmSender);
    const preferSender = isSenderMode || (!isRunnerMode && iAmSender);

    if (preferSender && iAmSender) {
      if (job.status === 'PENDING_RATING' || job.status === 'DELIVERED' || job.status === 'ISSUE_REPORTED') {
        navigate('/rate', { state: { jobId: job.id } });
        return;
      }
      navigate('/sender/tracking');
      return;
    }

    if (preferRunner && iAmRunner) {
      if (job.status === 'MATCHED' || job.status === 'IN_TRANSIT' || job.status === 'ISSUE_REPORTED') {
        navigate('/runner/active');
        return;
      }
      if (job.status === 'PENDING_RATING' || job.status === 'DISPUTED' || job.status === 'CLOSED') {
        navigate('/runner/active');
        return;
      }
    }

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

  const senderStats = [
    { label: 'My requests', value: String(myJobs.length), sub: `${myJobs.filter(j => j.status === 'OPEN').length} finding buddy` },
    { label: 'In progress', value: String(myJobs.filter(j => ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])).length), sub: 'Matched / transit / pay' },
    { label: 'Closed', value: String(myJobs.filter(j => j.status === 'CLOSED').length), sub: 'Completed sends' },
    { label: 'Trust', value: `${displayUser.trust_score}`, sub: displayUser.hostel_block },
  ];
  const runnerStats = [
    { label: 'This week', value: `₹${displayUser.weekly_earnings}`, sub: `${weeksProgress}% of best week` },
    { label: 'Total earned', value: `₹${displayUser.total_earnings.toLocaleString()}`, sub: `${displayUser.total_deliveries} deliveries` },
    { label: 'Rating', value: `${displayUser.rating}★`, sub: 'Platform avg 4.6' },
    { label: 'Trust', value: `${displayUser.trust_score}`, sub: `${displayUser.streak}-day streak` },
  ];

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-5">
      <motion.div
        className="rb-home-hero"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 w-full">
          <div>
            <div className="text-xs mb-1 uppercase tracking-wider rb-muted-on-dark">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' · '}Command Centre
            </div>
            <h1 className="rb-display font-semibold rb-on-dark" style={{ fontSize: '1.55rem' }}>
              Hello, {displayUser.name.split(' ')[0]}
            </h1>
            <p className="text-sm mt-0.5 rb-muted-on-dark">
              {displayUser.hostel_block}
              {' · '}
              {currentRole === 'sender'
                ? 'Sender mode'
                : currentRole === 'runner'
                  ? 'Runner mode'
                  : 'Pick Sender or Runner'}
            </p>
          </div>

          <div className="flex overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, background: 'rgba(255,255,255,0.12)' }}>
            <button
              type="button"
              onClick={() => setCurrentRole('sender')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: currentRole === 'sender' ? '#fff' : 'transparent',
                color: currentRole === 'sender' ? '#0B2340' : 'rgba(255,255,255,0.8)',
              }}
            >
              Sender
            </button>
            <button
              type="button"
              onClick={() => setCurrentRole('runner')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: currentRole === 'runner' ? '#C44536' : 'transparent',
                color: currentRole === 'runner' ? '#fff' : 'rgba(255,255,255,0.8)',
              }}
            >
              Runner
            </button>
          </div>
        </div>
      </motion.div>

      {import.meta.env.DEV && (
        <div className="rb-card px-3 py-2.5 text-[11px] rounded-lg" style={{ color: '#6B7684' }}>
          DEV dogfood: <span style={{ color: '#0B2340' }}>__rushbuddyDev.loadPilotScenarios()</span>
          {' · '}
          <span style={{ color: '#0B2340' }}>bypassNoAnswerWait(true)</span>
          {' · '}
          <span style={{ color: '#0B2340' }}>unsuspendRunner('u1')</span>
          {' — '}refresh resets in-memory state
        </div>
      )}

      {activeJob && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => openJob(activeJob)}
          className="rb-card p-4 cursor-pointer"
          style={{ borderRadius: 12, borderLeft: `3px solid ${activeJob.status === 'PENDING_RATING' || activeJob.status === 'ISSUE_REPORTED' ? '#E8A04A' : '#C44536'}` }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: '#C44536' }}>
                {activeJob.status === 'PENDING_RATING' ? 'Payment pending' : activeJob.status === 'ISSUE_REPORTED' ? 'Needs review' : 'Active job'}
              </p>
              <p className="text-sm font-medium truncate rb-on-card">{activeJob.pickup_location} → {activeJob.drop_location}</p>
              <p className="text-xs mt-0.5 rb-muted-on-card">
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
            <ChevronRight size={16} style={{ flexShrink: 0, color: '#6B7684' }} />
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(isSenderMode ? senderStats : runnerStats).map(({ label, value, sub }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            className="rb-card p-4 rb-on-card"
            style={{ borderRadius: 12 }}
          >
            <div className="text-xs mb-1 rb-muted-on-card">{label}</div>
            <div className="rb-display font-semibold mb-0.5 rb-on-card" style={{ fontSize: '1.2rem' }}>{value}</div>
            <div className="text-[10px] rb-muted-on-card">{sub}</div>
          </motion.div>
        ))}
      </div>

      {!isSenderMode && (
      <div className="rb-card p-4" style={{ borderRadius: 12 }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-0.5 rb-muted-on-card">Weekly progress</div>
            <p className="text-sm rb-on-card">
              ₹{displayUser.best_week_earnings - displayUser.weekly_earnings} away from your best week
            </p>
          </div>
          <div className="text-right text-xs rb-muted-on-card">
            <div>Best: ₹{displayUser.best_week_earnings}</div>
            <div>{displayUser.streak}-day streak</div>
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ background: '#E8E6E1' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${weeksProgress}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-1.5 rounded-full"
            style={{ background: 'linear-gradient(90deg, #C44536, #E8A04A)' }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: '#8A93A0' }}>
          <span>₹0</span>
          <span>₹{displayUser.best_week_earnings}</span>
        </div>
      </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => { setCurrentRole('sender'); navigate('/sender/post'); }}
          className="rb-card p-4 text-left"
          style={{ borderRadius: 12, opacity: isRunnerMode ? 0.65 : 1 }}
        >
          <Package size={18} color="#0B2340" />
          <p className="text-sm font-medium mt-2 mb-0.5 rb-on-card">Post a Request</p>
          <p className="text-[11px] rb-muted-on-card">Send something across campus</p>
          <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: '#C44536' }}>
            <span>Get started</span>
            <ArrowUpRight size={10} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setCurrentRole('runner'); navigate('/runner/feed'); }}
          className="rb-card p-4 text-left"
          style={{ borderRadius: 12, opacity: isSenderMode ? 0.65 : 1 }}
        >
          <Zap size={18} color="#C44536" />
          <p className="text-sm font-medium mt-2 mb-0.5 rb-on-card">Browse Jobs</p>
          <p className="text-[11px] rb-muted-on-card">
            <span className="font-medium rb-on-card">{feedOpenCount} open</span> you can accept
          </p>
          <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: '#C44536' }}>
            <span>View feed</span>
            <ArrowUpRight size={10} />
          </div>
        </button>
      </div>

      {isSenderMode ? (
        <div className="rb-card p-4" style={{ borderRadius: 12 }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-4 rb-muted-on-card">
            Sender snapshot
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Open', value: myJobs.filter(j => j.status === 'OPEN').length },
              { label: 'Active', value: myJobs.filter(j => ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number])).length },
              { label: 'Disputed', value: myJobs.filter(j => j.status === 'DISPUTED').length },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="rb-display font-semibold mb-1 rb-on-card" style={{ fontSize: '1.1rem' }}>{value}</div>
                <div className="text-[10px] rb-muted-on-card">{label}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rb-card p-4" style={{ borderRadius: 12 }}>
          <div className="text-xs font-medium uppercase tracking-wider mb-4 rb-muted-on-card">
            Runner metrics
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Acceptance rate', value: `${displayUser.acceptance_rate}%` },
              { label: 'Deliveries', value: displayUser.total_deliveries },
              { label: 'Rating', value: `${displayUser.rating}/5.0` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="rb-display font-semibold mb-1 rb-on-card" style={{ fontSize: '1.1rem' }}>{value}</div>
                <div className="text-[10px] rb-muted-on-card">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rb-card overflow-hidden" style={{ borderRadius: 12 }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(11,35,64,0.08)' }}>
          <div className="text-xs font-medium uppercase tracking-wider rb-muted-on-card">
            {isSenderMode ? 'My requests' : isRunnerMode ? 'My runs' : 'Recent jobs'}
          </div>
          <button type="button" className="text-xs flex items-center gap-1" style={{ color: '#C44536' }}>
            View all <ChevronRight size={11} />
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm rb-muted-on-card">
              {isSenderMode
                ? 'No requests yet. Post a request to get started.'
                : isRunnerMode
                  ? 'No runs yet. Browse the job feed.'
                  : 'No jobs yet. Pick Sender or Runner above.'}
            </p>
          </div>
        ) : (
          <div>
            {recentJobs.map((job, i) => (
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => openJob(job)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openJob(job); } }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#EDEBE6]/70 transition-colors"
                style={{ borderBottom: i < recentJobs.length - 1 ? '1px solid rgba(11,35,64,0.06)' : 'none' }}
              >
                <div
                  className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: '#EDEBE6' }}
                >
                  <Package size={14} color="#0B2340" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs truncate font-medium rb-on-card">
                      {job.pickup_location} → {job.drop_location}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={job.status} />
                    {isSenderMode ? (
                      <span className="text-[10px] rb-muted-on-card">as Sender</span>
                    ) : isRunnerMode ? (
                      <span className="text-[10px] rb-muted-on-card">as Runner</span>
                    ) : job.sender_id === uid && job.runner_id === uid ? (
                      <span className="text-[10px] rb-muted-on-card">you = sender + runner</span>
                    ) : job.runner_id === uid ? (
                      <span className="text-[10px] rb-muted-on-card">as Runner</span>
                    ) : (
                      <span className="text-[10px] rb-muted-on-card">as Sender</span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-medium rb-on-card">
                    ₹{job.agreed_price ?? job.posted_price}
                  </div>
                  {job.tip_amount && job.tip_amount > 0 ? (
                    <div className="text-[10px]" style={{ color: '#C44536' }}>+₹{job.tip_amount} tip</div>
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
