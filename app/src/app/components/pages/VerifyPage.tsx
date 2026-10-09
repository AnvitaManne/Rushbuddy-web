import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp, defaultUser } from '../../context/AppContext';
import { services } from '@/services';
import { Shield, RefreshCw, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

const isMockAdapter = (import.meta.env.VITE_DATA_ADAPTER ?? 'mock') !== 'supabase';

function startResendTimer(
  setTimer: React.Dispatch<React.SetStateAction<number>>,
  setCanResend: React.Dispatch<React.SetStateAction<boolean>>,
) {
  setTimer(60);
  setCanResend(false);
  const interval = setInterval(() => {
    setTimer((t) => {
      if (t <= 1) {
        setCanResend(true);
        clearInterval(interval);
        return 0;
      }
      return t - 1;
    });
  }, 1000);
  return interval;
}

export function VerifyPage() {
  const { pendingEmail, pendingSignup, setUser, setIsAuthenticated } = useApp();
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
    const interval = startResendTimer(setTimer, setCanResend);
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

  const failAttempt = (detail?: string) => {
    const remaining = attempts - 1;
    setAttempts(remaining);
    if (remaining <= 0) {
      setError(
        isMockAdapter
          ? 'Too many incorrect codes. Tap Resend code below to unlock and try again. (Demo lock — not a real 15‑minute ban.)'
          : 'Too many incorrect codes. Tap Resend code below to unlock and try again.',
      );
    } else {
      const demoHint = isMockAdapter ? ' Demo OTP is 123456.' : '';
      const suffix = detail && !isMockAdapter ? ` (${detail})` : '';
      setError(
        `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.${demoHint}${suffix}`,
      );
    }
    setOtp(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    if (!pendingSignup) {
      setError('Signup session expired. Go back and enter your details again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Mock adapter: keep demo OTP 123456; still apply via completeSignup for consistency.
      if (isMockAdapter) {
        await new Promise((r) => setTimeout(r, 600));
        if (code !== '123456') {
          failAttempt();
          return;
        }
        const user = await services.auth.completeSignup(pendingSignup);
        setSuccess(true);
        setIsAuthenticated(true);
        setUser({ ...defaultUser, ...user });
        await new Promise((r) => setTimeout(r, 1200));
        navigate('/home');
        return;
      }

      const user = await services.auth.completeSignup({
        ...pendingSignup,
        otp: code,
      });
      setSuccess(true);
      setIsAuthenticated(true);
      setUser(user);
      await new Promise((r) => setTimeout(r, 1200));
      navigate('/home');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Verification failed.';
      const cleaned = raw.replace(/^AuthService\.completeSignup:\s*/i, '');
      failAttempt(cleaned);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setOtp(['', '', '', '', '', '']);
    setError('');
    setAttempts(3);
    inputRefs.current[0]?.focus();
    startResendTimer(setTimer, setCanResend);

    if (!pendingSignup) {
      setError('Signup session expired. Go back and enter your details again.');
      return;
    }

    if (isMockAdapter) return;

    try {
      await services.auth.beginSignup(pendingSignup);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not resend code.';
      setError(message.replace(/^AuthService\.beginSignup:\s*/i, ''));
    }
  };

  return (
    <div className="rb-app rb-auth-stage flex items-center justify-center p-6">

      <div className="relative z-[1] w-full max-w-sm rb-auth-enter">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm mb-6 transition-colors rb-muted-on-dark hover:opacity-100 opacity-85"
        >
          <ArrowLeft size={14} />
          Wrong email? Back to login
        </button>

        <div className="rb-card rounded-2xl p-8 rb-on-card">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: '#F3F2EF', border: '1px solid #1A4020' }}>
                <CheckCircle size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-[#0B2340] mb-2" style={{ fontWeight: 600 }}>Verified!</h3>
              <p className="text-sm" style={{ color: '#6B7684' }}>Entering RushBuddy...</p>
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
                  style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(11,35,64,0.12)' }}>
                  <Shield size={24} color="#0B2340" />
                </div>
                <div className="text-xs mb-1 uppercase tracking-wider" style={{ color: '#4A5560' }}>
                  OTP VERIFICATION
                </div>
                <h2 className="mb-2" style={{ fontWeight: 600, color: '#0B2340' }}>Check your inbox</h2>
                <p className="text-sm" style={{ color: '#4A5560' }}>
                  6-digit code sent to
                </p>
                <p className="text-sm mt-0.5" style={{ color: '#0B2340' }}>
                  {pendingEmail || pendingSignup?.email || 'your@vitstudent.ac.in'}
                </p>
              </div>

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
                    className="w-11 h-12 text-center rounded-lg text-lg outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.9)',
                      color: '#0B2340',
                      border: `1px solid ${error ? '#C4453644' : digit ? '#0B2340' : 'rgba(11,35,64,0.14)'}`,
                      boxShadow: digit ? '0 0 0 2px rgba(11,35,64,0.12)' : 'none',
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
                  style={{ background: '#C4453612', border: '1px solid #C4453644', color: '#F87171' }}
                >
                  <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Verify button */}
              <button
                onClick={handleVerify}
                disabled={loading || attempts <= 0 || otp.join('').length < 6}
                className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all mb-2"
                style={{
                  background: attempts <= 0 || otp.join('').length < 6
                    ? '#C9CDD3'
                    : '#C44536',
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Verifying...
                  </span>
                ) : attempts <= 0 ? (
                  'Locked — use Resend code'
                ) : otp.join('').length < 6 ? (
                  'Enter all 6 digits'
                ) : (
                  'Verify & Enter'
                )}
              </button>
              {attempts <= 0 && (
                <p className="text-[10px] text-center mb-3" style={{ color: '#4A5560' }}>
                  Button stays locked until you resend a new code.
                </p>
              )}

              <div className="text-center text-xs" style={{ color: '#4A5560' }}>
                {canResend ? (
                  <button
                    onClick={handleResend}
                    className="flex items-center gap-1.5 mx-auto transition-colors"
                    style={{ color: '#0B2340' }}
                  >
                    <RefreshCw size={11} />
                    Resend code
                  </button>
                ) : (
                  <span>
                    Resend in{' '}
                    <span style={{ color: '#0B2340' }}>
                      {timer}s
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-4 px-3 py-2 rounded-lg text-xs text-center"
                style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(11,35,64,0.1)', color: '#4A5560' }}>
                Code valid for <span style={{ color: '#9A6A1E' }}>10:00</span> minutes
                {isMockAdapter && (
                  <>
                    {' · Demo OTP '}
                    <span style={{ color: '#0B2340' }}>123456</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
