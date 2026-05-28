import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import { Shield, RefreshCw, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export function VerifyPage() {
  const {
    pendingEmail,
    pendingName,
    pendingHostel,
    pendingGender,
    setUser,
    setIsAuthenticated,
  } = useApp();
  const navigate = useNavigate();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
    const interval = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { setCanResend(true); clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[i] = val.slice(-1);
    setOtp(newOtp);
    setError('');
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter all 6 digits.'); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));

    if (code === '123456') {
      setSuccess(true);
      setIsAuthenticated(true);
      setUser({
        ...defaultUser,
        email: pendingEmail || defaultUser.email,
        name: pendingName.trim() || defaultUser.name,
        hostel_block: pendingHostel.trim() || defaultUser.hostel_block,
        gender: pendingGender ?? defaultUser.gender,
      });
      await new Promise(r => setTimeout(r, 1200));
      navigate('/home');
    } else {
      const remaining = attempts - 1;
      setAttempts(remaining);
      if (remaining <= 0) {
        setError('Account locked for 15 minutes after too many attempts.');
      } else {
        setError(`Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
      }
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  const handleResend = () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    setAttempts(3);
    setTimer(60);
    setCanResend(false);
    inputRefs.current[0]?.focus();
    const interval = setInterval(() => {
      setTimer(t => { if (t <= 1) { setCanResend(true); clearInterval(interval); return 0; } return t - 1; });
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: '#060A14', fontFamily: 'Inter, sans-serif' }}>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: '#475569' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
        >
          <ArrowLeft size={14} />
          Back to login
        </button>

        <div className="rounded-2xl p-8" style={{ background: '#0B1120', border: '1px solid #1E2D45' }}>
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#0A2010', border: '1px solid #1A4020' }}>
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-white mb-2" style={{ fontWeight: 600 }}>Verified!</h3>
              <p className="text-sm" style={{ color: '#64748B' }}>Entering RushBuddy...</p>
              <div className="mt-4 flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: '#0D1525', border: '1px solid #1E2D45' }}>
                  <Shield size={24} className="text-cyan-400" />
                </div>
                <div className="text-xs mb-1" style={{ color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                  OTP VERIFICATION
                </div>
                <h2 className="text-white mb-2" style={{ fontWeight: 600 }}>Check your inbox</h2>
                <p className="text-sm" style={{ color: '#64748B' }}>
                  6-digit code sent to
                </p>
                <p className="text-sm text-cyan-400 mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {pendingEmail || 'your@vitstudent.ac.in'}
                </p>
              </div>

              {/* OTP inputs */}
              <div className="flex gap-2 justify-center mb-5" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-11 h-12 text-center rounded-lg text-white text-lg outline-none transition-all"
                    style={{
                      background: '#060A14',
                      border: `1px solid ${error ? '#3B1111' : digit ? '#06B6D4' : '#1E2D45'}`,
                      fontFamily: 'JetBrains Mono, monospace',
                      boxShadow: digit ? '0 0 0 2px rgba(6,182,212,0.1)' : 'none',
                    }}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-4"
                  style={{ background: '#1C0A0A', border: '1px solid #3B1111', color: '#F87171' }}
                >
                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Verify button */}
              <button
                onClick={handleVerify}
                disabled={loading || attempts <= 0 || otp.join('').length < 6}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all mb-4"
                style={{
                  background: attempts <= 0 || otp.join('').length < 6
                    ? '#0E1525'
                    : 'linear-gradient(135deg, #06B6D4, #6366F1)',
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Verifying...
                  </span>
                ) : 'Verify & Enter'}
              </button>

              {/* Resend */}
              <div className="text-center text-xs" style={{ color: '#475569' }}>
                {canResend ? (
                  <button
                    onClick={handleResend}
                    className="flex items-center gap-1.5 mx-auto text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <RefreshCw size={11} />
                    Resend code
                  </button>
                ) : (
                  <span>
                    Resend in{' '}
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}>
                      {timer}s
                    </span>
                  </span>
                )}
              </div>

              {/* Validity */}
              <div className="mt-4 px-3 py-2 rounded-lg text-xs text-center"
                style={{ background: '#070B17', border: '1px solid #1A2535', color: '#475569' }}>
                Code valid for <span className="text-amber-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>10:00</span> minutes
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
