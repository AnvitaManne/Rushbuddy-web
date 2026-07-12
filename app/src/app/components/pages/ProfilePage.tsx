import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield, Star, TrendingUp, Package, Award, CheckCircle2,
  AlertCircle, Zap, BarChart2, Activity, Calendar
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

const weeklyData = [
  { day: 'Mon', earn: 45 },
  { day: 'Tue', earn: 80 },
  { day: 'Wed', earn: 30 },
  { day: 'Thu', earn: 120 },
  { day: 'Fri', earn: 95 },
  { day: 'Sat', earn: 60 },
  { day: 'Sun', earn: 0 },
];

const today = new Date().getDay();
// Sunday=0, Mon=1...
const dayMap = [6, 0, 1, 2, 3, 4, 5]; // maps JS day to array index
const todayIdx = dayMap[today];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg px-3 py-2" style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
        <p className="text-xs text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>₹{payload[0].value}</p>
        <p className="text-[10px]" style={{ color: '#64748B' }}>{label}</p>
      </div>
    );
  }
  return null;
};

export function ProfilePage() {
  const { user, jobs, runnerTrustRecords, trustEvents } = useApp();
  const [tab, setTab] = useState<'overview' | 'history' | 'trust'>('overview');

  const displayUser = user || {
    id: 'u1',
    name: 'Aditi Krishnan',
    email: 'aditi.k@vitstudent.ac.in',
    hostel_block: 'MH-C Block',
    verified: true,
    rating: 4.8,
    total_deliveries: 23,
    total_earnings: 1840,
    weekly_earnings: 320,
    acceptance_rate: 91,
    trust_score: 94,
    joined_at: '2026-03-01T00:00:00Z',
    no_show_count: 0,
    suspension_status: 'active' as const,
    streak: 4,
    best_week_earnings: 450,
  };

  const runnerId = displayUser.id;
  const trustRecord = runnerTrustRecords[runnerId] ?? {
    runner_id: runnerId,
    no_show_count: displayUser.no_show_count ?? 0,
    suspension_status: displayUser.suspension_status ?? 'active',
    trust_score: displayUser.trust_score,
  };
  const isSuspended = trustRecord.suspension_status === 'suspended';
  /** Events that affect this account as runner (not disputes they filed as sender). */
  const runnerTargetEvents = [...trustEvents]
    .filter((e) => e.target_user_id === runnerId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const myTrustEvents = runnerTargetEvents.slice(0, 5);

  const myRunnerJobs = jobs.filter(j => j.runner_id === 'u1' && j.status === 'CLOSED');
  const mySenderJobs = jobs.filter(j => j.sender_id === 'u1' && j.status !== 'OPEN');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'trust', label: 'Trust & Safety' },
  ] as const;

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl space-y-4" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Profile header */}
      <div className="rounded-xl p-5" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}>
            {displayUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {displayUser.name}
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-emerald-400"
                style={{ background: '#0A2010', border: '1px solid #1A4020', fontFamily: 'JetBrains Mono, monospace' }}>
                ✓ VERIFIED
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
              {displayUser.email}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs" style={{ color: '#64748B' }}>📍 {displayUser.hostel_block}</span>
              <span className="text-xs" style={{ color: '#64748B' }}>
                Joined {new Date(displayUser.joined_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
              {isSuspended && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-red-300"
                  style={{ background: '#1C0A0A', border: '1px solid #3B1111', fontFamily: 'JetBrains Mono, monospace' }}>
                  SUSPENDED
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4" style={{ borderTop: '1px solid #1E2D45' }}>
          {[
            { label: 'Rating', value: `${displayUser.rating}★`, color: '#F59E0B' },
            { label: 'Runs', value: displayUser.total_deliveries, color: '#10B981' },
            { label: 'Earned', value: `₹${displayUser.total_earnings.toLocaleString()}`, color: '#06B6D4' },
            { label: 'Streak', value: `${displayUser.streak}🔥`, color: '#F97316' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="font-semibold text-sm" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
              <div className="text-[9px] mt-0.5" style={{ color: '#475569' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1E2D45' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 text-sm transition-all"
            style={{
              background: tab === t.id ? '#111E35' : '#0B1120',
              color: tab === t.id ? '#22D3EE' : '#64748B',
              borderBottom: tab === t.id ? '2px solid #06B6D4' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Earnings chart */}
          <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs mb-0.5" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  THIS WEEK
                </div>
                <div className="text-white font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.3rem' }}>
                  ₹{displayUser.weekly_earnings}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <TrendingUp size={13} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>+₹80 vs last week</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={weeklyData} barSize={18}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="earn" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, i) => (
                    <Cell
                      key={`cell-${entry.day}`}
                      fill={i === todayIdx ? '#06B6D4' : '#1E2D45'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Performance */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E2D45' }}>
            <div className="px-4 py-3" style={{ background: '#0D1525', borderBottom: '1px solid #1E2D45' }}>
              <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                RUNNER PERFORMANCE
              </div>
            </div>
            <div className="p-4 space-y-3" style={{ background: '#0B1120' }}>
              {[
                { label: 'Acceptance Rate', value: displayUser.acceptance_rate, max: 100, unit: '%', color: '#10B981', good: displayUser.acceptance_rate >= 80 },
                { label: 'Trust Score', value: trustRecord.trust_score, max: 100, unit: '', color: '#06B6D4', good: true },
                { label: 'On-Time Delivery', value: 96, max: 100, unit: '%', color: '#10B981', good: true },
                { label: 'Condition Disputes', value: 2, max: 20, unit: ' disputes', color: '#F59E0B', good: true },
              ].map(({ label, value, max, unit, color, good }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: '#64748B' }}>{label}</span>
                    <span className="text-xs font-medium" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {value}{unit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: '#1E2D45' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(value / max) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-1.5 rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {[...myRunnerJobs, ...mySenderJobs].length === 0 ? (
            <div className="text-center py-10">
              <Package size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm" style={{ color: '#475569' }}>No completed jobs yet.</p>
            </div>
          ) : (
            [...myRunnerJobs, ...mySenderJobs].map(job => (
              <div key={job.id} className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
                    <Package size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-white">{job.item_type}</span>
                      <span className="text-[10px]" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>{job.id}</span>
                      {job.runner_id === 'u1' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded text-cyan-400"
                          style={{ background: '#061620', border: '1px solid #0E2D3D' }}>Runner</span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>
                      {job.pickup_location} → {job.drop_location}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {job.rating && (
                        <div className="flex items-center gap-1 text-[11px]" style={{ color: '#F59E0B' }}>
                          <Star size={10} fill="#F59E0B" />
                          {job.rating}
                        </div>
                      )}
                      {job.tip_amount !== undefined && job.tip_amount > 0 && (
                        <span className="text-[11px] text-emerald-400">+₹{job.tip_amount} tip</span>
                      )}
                      <span className="text-[11px]" style={{ color: '#475569' }}>
                        {job.delivered_at
                          ? new Date(job.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      ₹{(job.agreed_price ?? job.posted_price) + (job.tip_amount || 0)}
                    </div>
                    <div className="text-[10px]" style={{ color: '#10B981' }}>CLOSED</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}

      {/* Tab: Trust & Safety */}
      {tab === 'trust' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Live trust status (from runnerTrustRecords — no gender/KYC) */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
            <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              RUNNER TRUST STATUS
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-2.5 text-center" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                <div className="text-sm font-semibold text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {trustRecord.trust_score}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: '#475569' }}>Trust score</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                <div className="text-sm font-semibold" style={{ color: trustRecord.no_show_count > 0 ? '#FBBF24' : '#E2E8F0', fontFamily: 'JetBrains Mono, monospace' }}>
                  {trustRecord.no_show_count}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: '#475569' }}>No-shows</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                <div className="text-sm font-semibold" style={{ color: isSuspended ? '#F87171' : '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>
                  {isSuspended ? 'Suspended' : 'Active'}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: '#475569' }}>Status</div>
              </div>
            </div>
            {isSuspended && (
              <div className="rounded-lg px-3 py-2.5 flex items-start gap-2" style={{ background: '#1C0A0A', border: '1px solid #3B1111' }}>
                <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-red-300 font-medium">Account suspended</p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>
                    {trustRecord.suspension_reason || 'Pending ops review (mock).'}
                  </p>
                </div>
              </div>
            )}
            {trustRecord.last_incident_at && (
              <p className="text-[10px]" style={{ color: '#475569' }}>
                Last incident:{' '}
                {new Date(trustRecord.last_incident_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                RECENT TRUST EVENTS (AS RUNNER)
              </div>
              <span className="text-[10px]" style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                {runnerTargetEvents.length} total
              </span>
            </div>
            {myTrustEvents.length === 0 ? (
              <p className="text-xs" style={{ color: '#475569' }}>
                No runner-targeted trust events on this account. Disputes you file as sender appear on the other party&apos;s record.
              </p>
            ) : (
              <div className="space-y-2">
                {myTrustEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg px-3 py-2"
                    style={{ background: '#070B17', border: '1px solid #1A2535' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-medium text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        {ev.type}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{
                          color:
                            ev.severity === 'critical'
                              ? '#F87171'
                              : ev.severity === 'warning'
                                ? '#FBBF24'
                                : '#94A3B8',
                          background: '#0B1120',
                          border: '1px solid #1E2D45',
                        }}
                      >
                        {ev.severity}
                      </span>
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: '#94A3B8' }}>
                      {ev.message}
                    </p>
                    <p className="text-[9px] mt-1" style={{ color: '#475569' }}>
                      {new Date(ev.created_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-4" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
            <div className="text-xs mb-4" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              IDENTITY (PUBLIC-SAFE)
            </div>
            {[
              { label: 'VIT Email', value: displayUser.email, status: 'verified' as const },
              { label: 'Student Status', value: 'Active · VIT Vellore', status: 'verified' as const },
            ].map(({ label, value, status }) => (
              <div key={label} className="flex items-center justify-between py-2.5"
                style={{ borderBottom: '1px solid #111E35' }}>
                <div>
                  <div className="text-xs text-white">{label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#10B981' }}>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  {status === 'verified' ? 'Verified' : 'Pending'}
                </div>
              </div>
            ))}
            <p className="text-[10px] mt-3" style={{ color: '#475569' }}>
              Gender, phone, college ID, and Aadhaar are not shown on profile (privacy).
            </p>
          </div>

          {/* Policies */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
            <div className="text-xs mb-2" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
              PLATFORM POLICIES
            </div>
            {[
              'Items above ₹2,000 require ID-verified runners',
              'Women\'s hostel deliveries: female runners only',
              'Dispute window: 2 hours post-delivery',
              'No-show ×2: suspension eligibility (ops mock)',
              'Off-platform payment tracking: V2 escrow roadmap',
            ].map(p => (
              <div key={p} className="flex items-start gap-2 text-xs" style={{ color: '#64748B' }}>
                <Shield size={11} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                {p}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
