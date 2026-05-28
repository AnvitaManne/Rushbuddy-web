import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import type { UserGender } from '@/domain/enums';
import { Mail, ArrowRight, AlertCircle, Zap, Shield, Package } from 'lucide-react';
import { motion } from 'motion/react';

type AuthStep = 'register' | 'confirm_email';

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function AuthPage() {
  const { setPendingEmail, setPendingName, setPendingHostel, setPendingGender } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<AuthStep>('register');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [hostel, setHostel] = useState('');
  const [gender, setGender] = useState<UserGender | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.endsWith('@vitstudent.ac.in')) {
      setError('Only VIT email addresses are accepted during beta.');
      return;
    }
    if (!name.trim()) { setError('Full name is required.'); return; }
    if (!hostel.trim()) { setError('Hostel block is required.'); return; }
    if (!gender) { setError('Please select a gender option.'); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setLoading(false);
    setStep('confirm_email');
  };

  const handleConfirmSendOtp = async () => {
    if (!gender) {
      setError('Please select a gender option.');
      setStep('register');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setPendingEmail(email);
    setPendingName(name.trim());
    setPendingHostel(hostel.trim());
    setPendingGender(gender);
    setLoading(false);
    navigate('/verify');
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#060A14', fontFamily: 'Inter, sans-serif' }}>
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ background: '#070B17', borderRight: '1px solid #1A2535' }}>

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}>
            <span className="text-white font-bold text-base" style={{ fontFamily: 'JetBrains Mono, monospace' }}>RB</span>
          </div>
          <div>
            <div className="text-white font-semibold">RushBuddy</div>
            <div className="text-[10px]" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>BETA · VIT VELLORE</div>
          </div>
        </div>

        {/* Center content */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                PLATFORM ONLINE · 3 RUNNERS ACTIVE
              </span>
            </div>
            <h1 className="text-white mb-4" style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 }}>
              Campus delivery,<br />
              <span style={{ background: 'linear-gradient(90deg, #06B6D4, #6366F1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                peer-powered.
              </span>
            </h1>
            <p className="text-sm" style={{ color: '#64748B', lineHeight: 1.7 }}>
              RushBuddy formalises the informal delivery network that already exists on campus.
              Verified. Fast. Trusted.
            </p>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            {[
              { label: 'Deliveries', value: '1,240+', sub: 'total' },
              { label: 'Avg ETA', value: '11 min', sub: 'intra-campus' },
              { label: 'Trust Score', value: '96%', sub: 'platform avg' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg p-3" style={{ background: '#0D1525', border: '1px solid #1A2535' }}>
                <div className="text-white font-semibold text-lg" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{stat.value}</div>
                <div className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>{stat.label}</div>
                <div className="text-[9px]" style={{ color: '#334155' }}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature pills */}
        <div className="space-y-2.5">
          {[
            { icon: Shield, text: 'VIT email verified — no anonymous runners' },
            { icon: Zap, text: 'Real-time matching & tracking on every job' },
            { icon: Package, text: 'Intra-campus + intercity corridors' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-xs" style={{ color: '#64748B' }}>
              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: '#111827' }}>
                <Icon size={12} className="text-cyan-400" />
              </div>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-8 lg:hidden">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #06B6D4, #6366F1)' }}>
            <span className="text-white font-bold text-sm" style={{ fontFamily: 'JetBrains Mono, monospace' }}>RB</span>
          </div>
          <span className="text-white font-semibold">RushBuddy</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl p-8" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
            {/* Header */}
            <div className="mb-6">
              <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                AUTH · VIT BETA
              </div>
              <h2 className="text-white mb-1" style={{ fontSize: '1.4rem', fontWeight: 600 }}>
                Access RushBuddy
              </h2>
              <p className="text-sm" style={{ color: '#64748B' }}>
                Sign in with your VIT student email to continue.
              </p>
            </div>

            {step === 'confirm_email' ? (
              <div className="space-y-4">
                <div className="rounded-lg px-4 py-4" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
                  <p className="text-sm mb-2" style={{ color: '#94A3B8' }}>
                    We&apos;ll send a 6-digit OTP to:
                  </p>
                  <p className="text-cyan-400 text-sm break-all" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                    {email}
                  </p>
                  <p className="text-xs mt-3" style={{ color: '#64748B' }}>
                    Is this the correct VIT email? Typos can lock you out until the code expires.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmSendOtp}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                  style={{
                    background: loading ? '#0E2030' : 'linear-gradient(135deg, #06B6D4, #6366F1)',
                    opacity: loading ? 0.8 : 1,
                  }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Yes, send OTP
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('register'); setError(''); }}
                  className="w-full py-2.5 rounded-lg text-sm transition-colors"
                  style={{ background: '#0B1120', border: '1px solid #1E2D45', color: '#94A3B8' }}
                >
                  Edit email
                </button>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>
                  VIT Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="yourname@vitstudent.ac.in"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all"
                    style={{
                      background: '#060A14',
                      border: `1px solid ${error && !email.endsWith('@vitstudent.ac.in') ? '#EF4444' : '#1E2D45'}`,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#06B6D4'; e.target.style.boxShadow = '0 0 0 2px rgba(6,182,212,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#1E2D45'; e.target.style.boxShadow = 'none'; }}
                    required
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="As on college ID"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all"
                  style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  onFocus={e => { e.target.style.borderColor = '#06B6D4'; e.target.style.boxShadow = '0 0 0 2px rgba(6,182,212,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#1E2D45'; e.target.style.boxShadow = 'none'; }}
                  required
                />
              </div>

              {/* Hostel */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>
                  Hostel Block
                </label>
                <input
                  type="text"
                  value={hostel}
                  onChange={e => setHostel(e.target.value)}
                  placeholder="e.g. MH-C Block, GH-A Block"
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-white placeholder-slate-600 outline-none transition-all"
                  style={{ background: '#060A14', border: '1px solid #1E2D45' }}
                  onFocus={e => { e.target.style.borderColor = '#06B6D4'; e.target.style.boxShadow = '0 0 0 2px rgba(6,182,212,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#1E2D45'; e.target.style.boxShadow = 'none'; }}
                  required
                />
              </div>

              {/* Gender — matching only; not shown elsewhere in app */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#94A3B8' }}>
                  Gender
                </label>
                <p className="text-[10px] mb-2" style={{ color: '#475569' }}>
                  Used only for hostel safety matching. Cannot be changed after verification.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {GENDER_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setGender(value); setError(''); }}
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all"
                      style={{
                        background: gender === value ? '#061620' : '#060A14',
                        border: `1px solid ${gender === value ? '#06B6D4' : '#1E2D45'}`,
                        color: gender === value ? '#E2E8F0' : '#94A3B8',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                  style={{ background: '#1C0A0A', border: '1px solid #3B1111', color: '#F87171' }}
                >
                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-200 mt-2"
                style={{
                  background: loading ? '#0E2030' : 'linear-gradient(135deg, #06B6D4, #6366F1)',
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Validating email...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
            )}

            {/* Demo hint */}
            <div className="mt-5 px-3 py-2.5 rounded-lg text-xs" style={{ background: '#070B17', border: '1px solid #1A2535' }}>
              <span style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>DEMO → </span>
              <span style={{ color: '#64748B' }}>use any </span>
              <span className="text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>@vitstudent.ac.in</span>
              <span style={{ color: '#64748B' }}> email. OTP is </span>
              <span className="text-cyan-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>123456</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
