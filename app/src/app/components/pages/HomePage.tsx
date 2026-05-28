import React from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
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

function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || statusColors.CLOSED;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontFamily: 'JetBrains Mono, monospace' }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {status.replace('_', ' ')}
    </span>
  );
}

export function HomePage() {
  const { user, setCurrentRole, currentRole, jobs } = useApp();
  const navigate = useNavigate();

  const userId = user?.id ?? 'u1';
  const myJobs = jobs.filter(j => j.sender_id === userId || j.runner_id === userId);
  const recentJobs = myJobs.slice(0, 4);
  const runnerActiveJob = jobs.find(
    j => j.runner_id === userId && ['MATCHED', 'IN_TRANSIT'].includes(j.status),
  );
  const senderActiveJob = jobs.find(
    j =>
      j.sender_id === userId &&
      ['OPEN', 'MATCHED', 'IN_TRANSIT'].includes(j.status),
  );
  const activeJob = runnerActiveJob ?? senderActiveJob;

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
              {displayUser.hostel_block} · Verified Runner
            </p>
          </div>

          {/* Role selector */}
          <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid #1E2D45' }}>
            <button
              onClick={() => { setCurrentRole('sender'); navigate('/sender/post'); }}
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
              onClick={() => { setCurrentRole('runner'); navigate('/runner/feed'); }}
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

      {/* Active job alert */}
      {activeJob && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() =>
            navigate(
              runnerActiveJob ? '/runner/active' : '/sender/tracking',
            )
          }
          className="rounded-xl p-4 cursor-pointer transition-all hover:brightness-110"
          style={{ background: '#0A1A10', border: '1px solid #1A3520' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 animate-pulse"
              style={{ background: '#0D2010', border: '1px solid #1A4020' }}>
              <Radio size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {activeJob.status === 'OPEN' ? 'WAITING FOR RUNNER' : 'ACTIVE JOB'}
                </span>
              </div>
              <p className="text-sm text-white truncate">{activeJob.pickup_location} → {activeJob.drop_location}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                {activeJob.item_type} · ₹{activeJob.agreed_price ?? activeJob.posted_price}
              </p>
            </div>
            <ChevronRight size={16} className="text-emerald-400 flex-shrink-0" />
          </div>
        </motion.div>
      )}

      {/* Stats grid */}
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

      {/* Weekly progress */}
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setCurrentRole('sender'); navigate('/sender/post'); }}
          className="rounded-xl p-4 text-left transition-all hover:brightness-110 group"
          style={{ background: '#0D0A1E', border: '1px solid #2D1E45' }}
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
          onClick={() => { setCurrentRole('runner'); navigate('/runner/feed'); }}
          className="rounded-xl p-4 text-left transition-all hover:brightness-110"
          style={{ background: '#061620', border: '1px solid #0E2D3D' }}
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

      {/* Performance metrics */}
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

      {/* Recent activity */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E2D45' }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
          <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
            RECENT JOBS
          </div>
          <button className="text-xs text-cyan-400 flex items-center gap-1 hover:text-cyan-300 transition-colors">
            View all <ChevronRight size={11} />
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="px-4 py-8 text-center" style={{ background: '#0B1120' }}>
            <Package size={24} className="text-slate-600 mx-auto mb-2" />
            <p className="text-sm" style={{ color: '#475569' }}>No jobs yet. Post your first request!</p>
          </div>
        ) : (
          <div style={{ background: '#0B1120' }}>
            {recentJobs.map((job, i) => (
              <div
                key={job.id}
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
                    {job.runner_id === 'u1' ? (
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
