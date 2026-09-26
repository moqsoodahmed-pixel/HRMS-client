import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Mail, Lock, ShieldCheck, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/axios';
import { Modal, FormField, AnimatedLogo } from '../components/ui';
import { errorMessage } from '../lib/format';
import { getCurrentLocation } from '../lib/geolocation';

// Fixed (not re-randomized per render) so the ambient particle field
// never causes a reflow or a visual "jump" on re-render — only generated
// once, on module load.
const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37 + 5) % 100}%`,
  size: 2 + ((i * 7) % 3),
  duration: 14 + ((i * 5) % 10),
  delay: -(i * 1.3),
}));

const SHARDS = [
  { top: '14%', left: '14%', size: 90, rotate: 18 },
  { top: '68%', left: '20%', size: 60, rotate: -10 },
  { top: '20%', left: '80%', size: 70, rotate: 8 },
  { top: '72%', left: '82%', size: 110, rotate: -16 },
];

/** True once, read synchronously so the very first render already knows
 * whether to skip the pointer-driven tilt/parallax (keeps things simple
 * — no layout jump from a later effect switching it off). */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sceneRef = useRef(null);
  const reducedMotion = useMemo(prefersReducedMotion, []);

  // Subtle pointer-driven depth: a small tilt on the card and independent
  // parallax drift on the background layers. Pure CSS custom properties
  // updated via rAF-throttled transform writes only — no layout reads in
  // the handler, so this never triggers layout thrashing. Skipped
  // entirely for touch devices and prefers-reduced-motion.
  useEffect(() => {
    if (reducedMotion) return undefined;
    const el = sceneRef.current;
    if (!el) return undefined;
    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const rect = el.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty('--tilt-x', (nx * 4).toFixed(2));
        el.style.setProperty('--tilt-y', (-ny * 4).toFixed(2));
        el.style.setProperty('--px', `${(nx * 18).toFixed(1)}px`);
        el.style.setProperty('--py', `${(ny * 18).toFixed(1)}px`);
      });
    };
    const onLeave = () => {
      el.style.setProperty('--tilt-x', 0);
      el.style.setProperty('--tilt-y', 0);
      el.style.setProperty('--px', '0px');
      el.style.setProperty('--py', '0px');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      // Attempts to read the device's current location so the server can
      // apply office geo-fencing when it's turned on for this account's
      // role (see server/services/accessControlService.js). This never
      // blocks or fails the submit itself — if permission is denied, the
      // browser doesn't support it, or it times out, `geo` is simply null
      // and the login proceeds without it; the server is the one that
      // decides whether a missing location matters for this particular
      // account. Roles exempt from geo-fencing (CEO/CTO/Project Head) are
      // unaffected either way.
      const geo = await getCurrentLocation();
      await login(email.trim(), password, remember, geo);
      toast.success('Welcome back');
      setSuccess(true);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed. Check your email and password.'));
      setShake(true);
      setTimeout(() => setShake(false), 420);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={sceneRef} className="auth-scene flex min-h-screen items-center justify-center p-4">
      {/* Layered depth background — mesh gradient, light rays, drifting
          fog, moving light beams, floating glass shards, an ambient
          particle field and two slow orbs. Every layer is pure CSS
          (transform/opacity), and the whole stack is skipped in favor of
          a still frame under prefers-reduced-motion (see index.css). */}
      <div className="auth-scene__mesh auth-parallax" style={{ '--depth': 0.6 }} aria-hidden="true" />
      <div className="auth-scene__rays" aria-hidden="true" />
      <div className="auth-scene__fog" aria-hidden="true" />

      <div className="auth-beam auth-parallax" style={{ top: '22%', left: '5%', width: '38%', '--depth': 1.2 }} aria-hidden="true" />
      <div className="auth-beam auth-parallax" style={{ top: '74%', left: '55%', width: '42%', animationDelay: '4s', '--depth': 0.9 }} aria-hidden="true" />

      {SHARDS.map((s, i) => (
        <div
          key={i}
          className="auth-shard auth-parallax"
          style={{
            top: s.top, left: s.left, width: s.size, height: s.size,
            '--r': `${s.rotate}deg`, '--depth': 0.5 + i * 0.15,
            animationDelay: `${i * 1.2}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {!reducedMotion && PARTICLES.map((p, i) => (
        <span
          key={i}
          className="auth-particle"
          style={{
            left: p.left, bottom: '-4%', width: p.size, height: p.size,
            animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
          }}
          aria-hidden="true"
        />
      ))}

      <div
        className="auth-orb h-72 w-72 bg-indigo-500/30 auth-parallax"
        style={{ top: '8%', left: '8%', animation: 'dl-orb-float-a 12s ease-in-out infinite', '--depth': 1.4 }}
        aria-hidden="true"
      />
      <div
        className="auth-orb h-96 w-96 bg-cyan-400/20 auth-parallax"
        style={{ bottom: '4%', right: '6%', animation: 'dl-orb-float-b 15s ease-in-out infinite', '--depth': 1.1 }}
        aria-hidden="true"
      />

      <div className="dl-stagger relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-7 py-4 backdrop-blur-sm">
            <AnimatedLogo className="h-11" />
          </div>
          <p className="flex items-center gap-1.5 text-sm font-medium tracking-wide text-indigo-200/90">
            <ShieldCheck className="h-4 w-4 text-cyan-300" /> HRMS Portal
          </p>
        </div>

        <div className="auth-card rounded-2xl p-7">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Sign in</h2>
          <p className="mb-6 mt-1.5 text-sm text-gray-500">Enter your credentials to access the portal</p>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/90 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField label="Email address" required>
              <div className="auth-input-wrap">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  className={`auth-input pl-10 ${shake ? 'is-invalid' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </FormField>

            <FormField label="Password" required>
              <div className="auth-input-wrap">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input pl-10 pr-10 ${shake ? 'is-invalid' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className={`auth-eye-icon ${showPassword ? '' : 'is-hidden'}`}><EyeOff className="h-4 w-4" /></span>
                  <span className={`auth-eye-icon ${showPassword ? 'is-hidden' : ''}`}><Eye className="h-4 w-4" /></span>
                </button>
              </div>
            </FormField>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <span
                  role="checkbox"
                  aria-checked={remember}
                  tabIndex={0}
                  className={`auth-check ${remember ? 'is-checked' : ''}`}
                  onClick={() => setRemember((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRemember((v) => !v); } }}
                >
                  <svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9" /></svg>
                </span>
                Remember me
              </label>
              <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-medium text-primary-600 hover:underline">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`auth-btn flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${success ? 'is-success' : ''}`}
            >
              {success ? <><Check className="h-4 w-4" /> Signed in</> : submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-indigo-200/70">
          &copy; {new Date().getFullYear()} DutyLaunch Solutions Private Limited
        </p>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} defaultEmail={email} />
    </div>
  );
}

function ForgotPasswordModal({ open, onClose, defaultEmail }) {
  const [email, setEmail] = useState(defaultEmail || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const close = () => { setSent(false); onClose(); };

  return (
    <Modal open={open} onClose={close} title="Reset your password" size="sm">
      <div className="p-5">
        {sent ? (
          <>
            <p className="text-sm text-gray-600">
              If an account exists for <span className="font-medium">{email}</span>, a reset link has been sent to
              that address. The link is valid for one hour.
            </p>
            <div className="mt-6 flex justify-end">
              <button type="button" className="btn-primary" onClick={close}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter your work email address and we will send you a link to set a new password.
            </p>
            <FormField label="Email address" required>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={sending}>
                {sending ? 'Sending…' : 'Send reset link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}