import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp, Job } from '../../context/AppContext';
import { canRunnerSeeJob, matchJobForRunner } from '@/domain/runnerEligibility';
import {
  Zap, MapPin, Package, Clock, Filter, Star, Shield,
  AlertCircle, ChevronRight, Lock, RefreshCw, FileText, Coffee, Pill, Box
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const itemIcon = (type: string) => {
  switch (type) {
    case 'Document': return <FileText size={15} className="text-blue-400" />;
    case 'Food': return <Coffee size={15} className="text-amber-400" />;
    case 'Medicine': return <Pill size={15} className="text-emerald-400" />;
    default: return <Box size={15} className="text-violet-400" />;
  }
};

const riskBadge = (risk: string) => {
  const c = risk === 'Low' ? '#10B981' : risk === 'Fragile' ? '#F59E0B' : '#EF4444';
  const bg = risk === 'Low' ? '#0A1A10' : risk === 'Fragile' ? '#1A1005' : '#1C0A0A';
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: bg, color: c, fontFamily: 'JetBrains Mono, monospace' }}>
      {risk.toUpperCase()}
    </span>
  );
};

function JobCard({
  job,
  onAccept,
  accepted,
  onAcceptAttempt,
}: {
  job: Job;
  onAccept: (id: string) => boolean;
  accepted: boolean;
  onAcceptAttempt: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const isWomensHostelJob =
    job.pickup_location_type === 'womens_hostel' || job.drop_location_type === 'womens_hostel';
  const timeSince = (() => {
    const diff = Date.now() - new Date(job.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  })();

  const handleAccept = async () => {
    if (accepting || accepted) return;
    onAcceptAttempt();
    setAccepting(true);
    await new Promise(r => setTimeout(r, 900));
    onAccept(job.id);
    setAccepting(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: accepted ? '#0A2010' : '#0B1120',
        border: `1px solid ${accepted ? '#1A4020' : '#1E2D45'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid #111E35' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
            {itemIcon(job.item_type)}
          </div>
          <div>
            <div className="text-xs font-medium text-white">{job.item_type}</div>
            <div className="text-[10px]" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{job.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {riskBadge(job.risk)}
          {isWomensHostelJob && (
            <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ background: '#1A0F2E', color: '#A78BFA', fontFamily: 'JetBrains Mono, monospace' }}>
              <Lock size={8} />
              WOMEN ONLY
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Route */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex flex-col items-center mt-1 gap-1 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <div className="w-px flex-1 bg-slate-700" style={{ height: 20 }} />
            <div className="w-2 h-2 rounded-full bg-violet-400" />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <p className="text-xs text-white">{job.pickup_location}</p>
              <p className="text-[10px]" style={{ color: '#475569' }}>Pickup</p>
            </div>
            <div>
              <p className="text-xs text-white">{job.drop_location}</p>
              <p className="text-[10px]" style={{ color: '#475569' }}>Drop</p>
            </div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1 text-[11px]" style={{ color: '#64748B' }}>
            <Clock size={11} />
            {timeSince}
          </div>
          {job.distance && (
            <div className="flex items-center gap-1 text-[11px]" style={{ color: '#64748B' }}>
              <MapPin size={11} />
              {job.distance}
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px]" style={{ color: '#64748B' }}>
            <Package size={11} />
            {job.weight}
          </div>
          {job.eta && (
            <div className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: '#0A1A10', color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
              ~{job.eta}
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px]" style={{ color: '#64748B' }}>
            by {job.sender_name}
          </div>
        </div>

        {job.description && (
          <div className="text-[11px] px-2.5 py-1.5 rounded-md mb-3" style={{ background: '#070B17', color: '#64748B' }}>
            "{job.description}"
          </div>
        )}

        {/* Accept row */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem' }}>
              ₹{job.price_floor}–{job.posted_price}
            </div>
            <div className="text-[10px]" style={{ color: '#475569' }}>Sender-set range</div>
          </div>

          {accepted ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#0A2010', border: '1px solid #1A4020', color: '#10B981' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                ✓
              </motion.div>
              Accepted
            </div>
          ) : (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: accepting ? '#0A2030' : 'linear-gradient(135deg, #06B6D4, #0EA5E9)', minWidth: 110 }}
            >
              {accepting ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <Zap size={13} />
                  Accept ₹{job.posted_price}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function RunnerFeedPage() {
  const { jobs, setJobs, setCurrentRole, setActiveJob, user, isAuthenticated } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>('All');
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const unassignedOpen = jobs.filter(j => j.status === 'OPEN' && !j.runner_id);
  const openJobs = user
    ? unassignedOpen.filter(j => canRunnerSeeJob(user, j))
    : [];
  const filters = ['All', 'Document', 'Food', 'Medicine', 'Object'];
  const filteredJobs = filter === 'All' ? openJobs : openJobs.filter(j => j.item_type === filter);

  const handleAccept = (jobId: string): boolean => {
    if (!user) {
      const msg = 'Log in to accept jobs.';
      setAcceptError(msg);
      console.warn('[RunnerFeed] Accept failed:', msg);
      return false;
    }

    const { jobs: nextJobs, error } = matchJobForRunner(jobs, jobId, user);
    if (error) {
      setAcceptError(error);
      console.warn('[RunnerFeed] Accept failed:', error);
      return false;
    }

    const matched = nextJobs.find(j => j.id === jobId);
    setAcceptError(null);
    setCurrentRole('runner');
    setJobs(nextJobs);
    if (matched) setActiveJob(matched);
    navigate('/runner/active');
    return true;
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            RUNNER FEED · {user ? `${openJobs.length} OPEN` : 'SIGN IN REQUIRED'}
          </div>
          <h1 className="text-white" style={{ fontWeight: 700, fontSize: '1.2rem' }}>Job Listings</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            Pick up jobs that match your route
          </p>
        </div>
        <button
          onClick={() => {}}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#64748B' }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {acceptError && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
          style={{ background: '#1C0A0A', border: '1px solid #3B1A1A' }}>
          <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px]" style={{ color: '#FCA5A5' }}>{acceptError}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open Jobs', value: openJobs.length, color: '#06B6D4' },
          { label: 'Potential', value: `₹${openJobs.reduce((s, j) => s + j.posted_price, 0)}`, color: '#10B981' },
          { label: 'Avg ETA', value: '~11 min', color: '#F59E0B' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg px-3 py-2.5" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
            <div className="font-semibold text-sm" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter size={13} className="text-slate-500 flex-shrink-0" />
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs transition-all"
            style={{
              background: filter === f ? '#061620' : '#0B1120',
              border: `1px solid ${filter === f ? '#06B6D4' : '#1E2D45'}`,
              color: filter === f ? '#22D3EE' : '#64748B',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Women's hostel notice */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg"
        style={{ background: '#0D0D20', border: '1px solid #2D1E45' }}>
        <Shield size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px]" style={{ color: '#64748B' }}>
          Jobs tagged <span className="text-violet-400">WOMEN ONLY</span> are restricted to verified female runners. This filter is automatic.
        </p>
      </div>

      {/* Job cards */}
      <AnimatePresence>
        {filteredJobs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Zap size={28} className="text-slate-600 mx-auto mb-3" />
            {!user || !isAuthenticated ? (
              <>
                <p className="text-sm" style={{ color: '#475569' }}>
                  Sign in to see jobs matched to your profile.
                </p>
                <p className="text-xs mt-1 mb-4" style={{ color: '#334155' }}>
                  The feed uses your account for hostel and safety filters — it stays empty until you verify OTP.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-cyan-400"
                  style={{ background: '#061620', border: '1px solid #0E2D3D' }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                <p className="text-sm" style={{ color: '#475569' }}>
                  No open jobs {filter !== 'All' ? `for ${filter}` : ''} right now.
                </p>
                {unassignedOpen.length > 0 && openJobs.length === 0 && (
                  <p className="text-xs mt-2" style={{ color: '#92400E' }}>
                    {unassignedOpen.length} job{unassignedOpen.length !== 1 ? 's are' : ' is'} open on campus, but none match your profile (hostel/gender rules).
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: '#334155' }}>
                  New requests show up in real time.
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onAccept={handleAccept}
                accepted={job.runner_id === user?.id && job.status === 'MATCHED'}
                onAcceptAttempt={() => setAcceptError(null)}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Skip warning */}
      {openJobs.length > 0 && (
        <div className="rounded-lg px-3 py-2.5 flex items-start gap-2"
          style={{ background: '#1A1005', border: '1px solid #3B2A0A' }}>
          <AlertCircle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px]" style={{ color: '#92400E' }}>
            Skipping more than 5 consecutive jobs is logged for ops review and may affect your access to high-value requests.
          </p>
        </div>
      )}
    </div>
  );
}
