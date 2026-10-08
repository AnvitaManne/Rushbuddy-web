import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Shield, Star, TrendingUp, Package, Award, CheckCircle2,
  AlertCircle, Clock, Zap, BarChart2, Activity, Calendar
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
      <div className="rounded-lg px-3 py-2" style={{ background: '#F3F2EF', border: '1px solid rgba(11,35,64,0.12)' }}>
        <p className="text-xs text-[#0B2340]">₹{payload[0].value}</p>
        <p className="text-[10px]" style={{ color: '#6B7684' }}>{label}</p>
      </div>
    );
  }
  return null;
};

export function ProfilePage() {
  const { user, jobs } = useApp();
  const [tab, setTab] = useState<'overview' | 'history' | 'trust'>('overview');

  const displayUser = user || {
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
    gender: 'female' as const,
    streak: 4,
    best_week_earnings: 450,
  };

  const myRunnerJobs = jobs.filter(j => j.runner_id === 'u1' && j.status === 'CLOSED');
  const mySenderJobs = jobs.filter(j => j.sender_id === 'u1' && j.status !== 'OPEN');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'History' },
    { id: 'trust', label: 'Trust & Safety' },
  ] as const;

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-2xl space-y-4" >

      {/* Profile header */}
      <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid rgba(11,35,64,0.12)' }}>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0"
            style={{ background: '#C44536' }}>
            {displayUser.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[#0B2340]" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {displayUser.name}
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full text-emerald-400"
                style={{ background: '#F3F2EF', border: '1px solid #1A4020' }}>
                ✓ VERIFIED
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#6B7684' }}>
              {displayUser.email}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs" style={{ color: '#6B7684' }}>📍 {displayUser.hostel_block}</span>
              <span className="text-xs" style={{ color: '#6B7684' }}>
                Joined {new Date(displayUser.joined_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4" style={{ borderTop: '1px solid rgba(11,35,64,0.12)' }}>
          {[
            { label: 'Rating', value: `${displayUser.rating}★`, color: '#F59E0B' },
            { label: 'Runs', value: displayUser.total_deliveries, color: '#10B981' },
            { label: 'Earned', value: `₹${displayUser.total_earnings.toLocaleString()}`, color: '#0B2340' },
            { label: 'Streak', value: `${displayUser.streak}🔥`, color: '#F97316' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="font-semibold text-sm" style={{ color }}>{value}</div>
              <div className="text-[9px] mt-0.5" style={{ color: '#6B7684' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(11,35,64,0.12)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2.5 text-sm transition-all"
            style={{
              background: tab === t.id ? '#ffffff' : '#F3F2EF',
              color: tab === t.id ? '#0B2340' : '#6B7684',
              borderBottom: tab === t.id ? '2px solid #C44536' : '2px solid transparent',
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
          <div className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid rgba(11,35,64,0.12)' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs mb-0.5" style={{ color: '#6B7684' }}>
                  THIS WEEK
                </div>
                <div className="text-[#0B2340] font-semibold" style={{ fontSize: '1.3rem' }}>
                  ₹{displayUser.weekly_earnings}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <TrendingUp size={13} />
                <span>+₹80 vs last week</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={weeklyData} barSize={18}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#6B7684', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="earn" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, i) => (
                    <Cell
                      key={`cell-${entry.day}`}
                      fill={i === todayIdx ? '#0B2340' : 'rgba(11,35,64,0.12)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Performance */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(11,35,64,0.12)' }}>
            <div className="px-4 py-3" style={{ background: '#F3F2EF', borderBottom: '1px solid rgba(11,35,64,0.12)' }}>
              <div className="text-xs" style={{ color: '#6B7684' }}>
                RUNNER PERFORMANCE
              </div>
            </div>
            <div className="p-4 space-y-3" style={{ background: '#ffffff' }}>
              {[
                { label: 'Acceptance Rate', value: displayUser.acceptance_rate, max: 100, unit: '%', color: '#10B981', good: displayUser.acceptance_rate >= 80 },
                { label: 'Trust Score', value: displayUser.trust_score, max: 100, unit: '', color: '#0B2340', good: true },
                { label: 'On-Time Delivery', value: 96, max: 100, unit: '%', color: '#10B981', good: true },
                { label: 'Condition Disputes', value: 2, max: 20, unit: ' disputes', color: '#F59E0B', good: true },
              ].map(({ label, value, max, unit, color, good }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs" style={{ color: '#6B7684' }}>{label}</span>
                    <span className="text-xs font-medium" style={{ color }}>
                      {value}{unit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'rgba(11,35,64,0.12)' }}>
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
              <p className="text-sm" style={{ color: '#6B7684' }}>No completed jobs yet.</p>
            </div>
          ) : (
            [...myRunnerJobs, ...mySenderJobs].map(job => (
              <div key={job.id} className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid rgba(11,35,64,0.12)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#F3F2EF', border: '1px solid rgba(11,35,64,0.12)' }}>
                    <Package size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-[#0B2340]">{job.item_type}</span>
                      <span className="text-[10px]" style={{ color: '#6B7684' }}>{job.id}</span>
                      {job.runner_id === 'u1' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: '#F3F2EF', border: '1px solid rgba(11,35,64,0.12)', color: '#0B2340' }}>Runner</span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#6B7684' }}>
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
                      <span className="text-[11px]" style={{ color: '#6B7684' }}>
                        {job.delivered_at
                          ? new Date(job.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                          : new Date(job.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold text-[#0B2340]">
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
          <div className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid rgba(11,35,64,0.12)' }}>
            <div className="text-xs mb-4" style={{ color: '#6B7684' }}>
              IDENTITY VERIFICATION
            </div>
            {[
              { label: 'VIT Email', value: displayUser.email, status: 'verified' },
              { label: 'Student Status', value: 'Active · VIT Vellore', status: 'verified' },
              { label: 'Aadhaar (V2)', value: 'Not required in beta', status: 'pending' },
            ].map(({ label, value, status }) => (
              <div key={label} className="flex items-center justify-between py-2.5"
                style={{ borderBottom: '1px solid #F3F2EF' }}>
                <div>
                  <div className="text-xs text-[#0B2340]">{label}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#6B7684' }}>{value}</div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: status === 'verified' ? '#10B981' : '#F59E0B' }}>
                  {status === 'verified'
                    ? <CheckCircle2 size={12} className="text-emerald-400" />
                    : <Clock size={12} className="text-amber-400" />}
                  {status === 'verified' ? 'Verified' : 'Pending V2'}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid rgba(11,35,64,0.12)' }}>
            <div className="text-xs mb-4" style={{ color: '#6B7684' }}>
              TRUST SCORE BREAKDOWN
            </div>
            {[
              { factor: 'Acceptance Rate', score: 18, max: 20 },
              { factor: 'On-Time Pickup', score: 20, max: 20 },
              { factor: 'Condition Disputes', score: 18, max: 20 },
              { factor: 'Sender Ratings', score: 19, max: 20 },
              { factor: 'No-Show Count', score: 19, max: 20 },
            ].map(({ factor, score, max }) => (
              <div key={factor} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: '#6B7684' }}>{factor}</span>
                  <span style={{ color: '#0B2340' }}>{score}/{max}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'rgba(11,35,64,0.12)' }}>
                  <div className="h-1.5 rounded-full"
                    style={{ width: `${(score / max) * 100}%`, background: score >= max * 0.8 ? '#10B981' : '#F59E0B' }} />
                </div>
              </div>
            ))}
            <div className="pt-3 mt-1" style={{ borderTop: '1px solid rgba(11,35,64,0.12)' }}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[#0B2340]">Total Trust Score</span>
                <span className="font-bold text-[#0B2340]" style={{ fontSize: '1.2rem' }}>
                  {displayUser.trust_score}/100
                </span>
              </div>
            </div>
          </div>

          {/* Policies */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: '#F3F2EF', border: '1px solid rgba(11,35,64,0.10)' }}>
            <div className="text-xs mb-2" style={{ color: '#6B7684' }}>
              PLATFORM POLICIES
            </div>
            {[
              'Items above ₹2,000 require ID-verified runners',
              'Women\'s hostel deliveries: female runners only',
              'Dispute window: 2 hours post-delivery',
              'No-show ×3: automatic ops review + rating drop',
              'Off-platform payment tracking: V2 escrow roadmap',
            ].map(p => (
              <div key={p} className="flex items-start gap-2 text-xs" style={{ color: '#6B7684' }}>
                <Shield size={11} className="text-[#0B2340] flex-shrink-0 mt-0.5" />
                {p}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
