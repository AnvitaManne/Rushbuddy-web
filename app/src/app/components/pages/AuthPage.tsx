import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';
import type { UserGender } from '@/domain/enums';
import { services } from '@/services';
import { Mail, ArrowRight, AlertCircle, Zap, Shield, Package } from 'lucide-react';
import { motion } from 'motion/react';
import { RushMark } from '../brand/BrandMark';

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const isMockAdapter = (import.meta.env.VITE_DATA_ADAPTER ?? 'mock') !== 'supabase';

export function AuthPage() {
  const { setPendingEmail, setPendingSignup, isAuthenticated } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [hostel, setHostel] = useState('');
  const [gender, setGender] = useState<UserGender | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Full name is required.'); return; }
    if (!hostel.trim()) { setError('Hostel block is required.'); return; }
    if (!gender) { setError('Please select a gender — used only for hostel-matching.'); return; }

    setLoading(true);
    try {
      const org = await services.organizations.getBySlug('vit-vellore');
      if (!org) {
        setError('Campus organization unavailable. Try again later.');
        return;
      }

      const allowed = await services.organizations.isEmailAllowed(org.id, email.trim());
      if (!allowed) {
        setError('Only VIT email addresses are accepted during beta.');
        return;
      }

      const signup = {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        hostel_block: hostel.trim(),
        gender,
      };

      await services.auth.beginSignup(signup);

      setPendingEmail(signup.email);
      setPendingSignup(signup);
      navigate('/verify');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send OTP. Try again.';
      setError(message.replace(/^AuthService\.beginSignup:\s*/i, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rb-app min-h-screen flex" style={{ background: '#F3F2EF' }}>
      {/* Left panel — branding */}
      <div className="rb-banner hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <RushMark size={40} />
          <div>
            <div className="text-white font-semibold">RushBuddy</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.7)' }}>Beta · VIT Vellore</div>
          </div>
        </div>

        {/* Center content */}
        <div>
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(11,35,64,0.45)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#E8A04A' }} />
              <span className="text-[11px] text-white/85">
                Peer logistics. Reimagined.
              </span>
            </div>
            <h1 className="rb-display mb-4" style={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1.2, color: '#ffffff' }}>
              Campus delivery,<br />
              peer-powered.
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.7 }}>
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
              <div key={stat.label} className="rounded-lg p-3" style={{ background: 'rgba(11,35,64,0.4)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="text-white font-semibold text-lg">{stat.value}</div>
                <div className="text-[10px] mt-0.5 text-white/70">{stat.label}</div>
                <div className="text-[9px] text-white/45">{stat.sub}</div>
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
            <div key={text} className="flex items-center gap-3 text-xs text-white/80">
              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(11,35,64,0.45)' }}>
                <Icon size={12} color="#E8A04A" />
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
          <RushMark size={36} />
          <span className="font-semibold" style={{ color: '#0B2340' }}>RushBuddy</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="rb-card rounded-2xl p-8">
            {/* Header */}
            <div className="mb-6">
              <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: '#6B7684' }}>
                Auth · VIT beta
              </div>
              <h2 className="rb-display mb-1" style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0B2340' }}>
                Access RushBuddy
              </h2>
              <p className="text-sm" style={{ color: '#6B7684' }}>
                Sign in with your VIT student email to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7684' }}>
                  VIT Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#6B7684' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="yourname@vitstudent.ac.in"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{
                      background: '#F3F2EF',
                      color: '#0B2340',
                      border: `1px solid ${error && error.toLowerCase().includes('vit email') ? '#C44536' : 'rgba(11,35,64,0.12)'}`,
                    }}
                    onFocus={e => { e.target.style.borderColor = '#7BA3C4'; e.target.style.boxShadow = '0 0 0 2px rgba(123,163,196,0.25)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(11,35,64,0.12)'; e.target.style.boxShadow = 'none'; }}
                    required
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7684' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="As on college ID"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ background: '#F3F2EF', color: '#0B2340', border: '1px solid rgba(11,35,64,0.12)' }}
                  onFocus={e => { e.target.style.borderColor = '#7BA3C4'; e.target.style.boxShadow = '0 0 0 2px rgba(123,163,196,0.25)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(11,35,64,0.12)'; e.target.style.boxShadow = 'none'; }}
                  required
                />
              </div>

              {/* Hostel */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7684' }}>
                  Hostel Block
                </label>
                <input
                  type="text"
                  value={hostel}
                  onChange={e => setHostel(e.target.value)}
                  placeholder="e.g. MH-C Block, GH-A Block"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ background: '#F3F2EF', color: '#0B2340', border: '1px solid rgba(11,35,64,0.12)' }}
                  onFocus={e => { e.target.style.borderColor = '#7BA3C4'; e.target.style.boxShadow = '0 0 0 2px rgba(123,163,196,0.25)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(11,35,64,0.12)'; e.target.style.boxShadow = 'none'; }}
                  required
                />
              </div>

              {/* Gender — matching-only, hidden elsewhere in the UI */}
              <div>
                <label className="text-xs mb-1.5 block" style={{ color: '#6B7684' }}>
                  Gender
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDER_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGender(value)}
                      className="py-2 rounded-lg text-xs border transition-all"
                      style={{
                        background: '#ffffff',
                        border: `1px solid ${gender === value ? '#C44536' : 'rgba(11,35,64,0.12)'}`,
                        color: gender === value ? '#0B2340' : '#6B7684',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: '#8A93A0' }}>
                  Used only to match gendered-hostel deliveries. Never shown on your profile.
                </p>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                  style={{ background: '#C4453612', border: '1px solid #C4453644', color: '#C44536' }}
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
                  background: loading ? '#6B7684' : '#C44536',
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
                    Send OTP
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* Demo hint — mock adapter only */}
            {isMockAdapter && (
              <div className="mt-5 px-3 py-2.5 rounded-lg text-xs" style={{ background: '#F3F2EF', border: '1px solid rgba(11,35,64,0.08)' }}>
                <span style={{ color: '#6B7684' }}>DEMO → </span>
                <span style={{ color: '#6B7684' }}>use any </span>
                <span style={{ color: '#0B2340' }}>@vitstudent.ac.in</span>
                <span style={{ color: '#6B7684' }}> email. OTP is </span>
                <span style={{ color: '#0B2340' }}>123456</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
