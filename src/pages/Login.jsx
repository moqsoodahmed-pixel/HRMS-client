import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Mail, ShieldCheck, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/axios';
import { Modal, FormField, AnimatedLogo } from '../components/ui';
import { errorMessage } from '../lib/format';
import { getCurrentLocation } from '../lib/geolocation';

// All of the following arrays are fixed (not re-randomized per render) so
// none of these ambient layers ever causes a reflow or a visual "jump" on
// re-render — every one is only generated once, on module load.

// Layer 3 — diagonal light beams: each its own angle/peak opacity/speed/
// delay so none of the sweeps ever move in lockstep.
const BEAMS = [
  { top: '8%', angle: -16, peak: 0.6, duration: 27, delay: 0 },
  { top: '34%', angle: -22, peak: 0.45, duration: 42, delay: -14 },
  { top: '58%', angle: -12, peak: 0.5, duration: 34, delay: -6 },
  { top: '80%', angle: -20, peak: 0.4, duration: 55, delay: -30 },
];

// Layer 4 — floating 3D glass ribbons ("glass bridges"): kept off to the
// sides so they never cross behind the logo or the Sign In card. Each
// carries its own rotation range, drift distance, depth (translateZ) and
// duration so every ribbon tumbles through 3D space differently.
const RIBBONS = [
  { top: '6%', left: '4%', w: 260, h: 120, rx0: 10, ry0: -14, rz0: 6, rx1: -16, ry1: 18, rz1: -8, dx: 22, dy: -26, tz: 60, opLo: 0.55, opHi: 0.9, duration: 38 },
  { top: '68%', left: '2%', w: 220, h: 100, rx0: -8, ry0: 12, rz0: -4, rx1: 14, ry1: -10, rz1: 10, dx: -18, dy: 22, tz: 40, opLo: 0.5, opHi: 0.85, duration: 49 },
  { top: '14%', left: '80%', w: 300, h: 140, rx0: 6, ry0: 16, rz0: -6, rx1: -12, ry1: -20, rz1: 8, dx: -24, dy: 20, tz: 70, opLo: 0.55, opHi: 0.9, duration: 61 },
  { top: '74%', left: '84%', w: 210, h: 95, rx0: -12, ry0: -8, rz0: 5, rx1: 18, ry1: 14, rz1: -10, dx: 20, dy: -18, tz: 30, opLo: 0.45, opHi: 0.8, duration: 27 },
];

// Layer 5 — floating glass rings (large translucent rings / abstract glass
// architecture): each its own tilt range and duration.
const RINGS = [
  { top: '20%', left: '10%', size: 130, rx0: 58, ry0: 0, rx1: 66, ry1: 180, op: 0.6, duration: 44 },
  { top: '64%', left: '88%', size: 100, rx0: 50, ry0: 0, rx1: 58, ry1: 180, op: 0.55, duration: 57 },
];

// Layer 6 — rotating glass arcs (partial rings): each its own radius/speed.
const ARCS = [
  { top: '10%', left: '92%', size: 220, duration: 70 },
  { top: '80%', left: '6%', size: 170, duration: 52 },
];

// Layer 7 — floating translucent glass spheres.
const SPHERES = [
  { top: '30%', left: '92%', size: 46, dx: 14, dy: -20, op: 0.75, duration: 20 },
  { top: '84%', left: '14%', size: 34, dx: -12, dy: 16, op: 0.7, duration: 26 },
  { top: '48%', left: '5%', size: 26, dx: 10, dy: -14, op: 0.65, duration: 17 },
];

// Layer 8 — tiny sparkle / crystal-fragment glints, twinkling independently.
const SPARKLES = Array.from({ length: 14 }, (_, i) => ({
  top: `${(i * 17 + 6) % 92}%`,
  left: `${(i * 29 + 4) % 96}%`,
  opacity: 0.55 + ((i * 13) % 40) / 100,
  duration: 5 + ((i * 3) % 6),
  delay: -(i * 1.1),
}));

// Layer 9 — volumetric particles: varied size/opacity/duration/delay, each
// on a loose non-repeating drift path (see .auth-glow-particle's keyframe,
// which reads --p1x/--p1y/--p2x/--p2y/--p3x/--p3y per-particle).
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 5) % 100}%`,
  size: 1.5 + ((i * 7) % 4),
  opacity: 0.4 + ((i * 11) % 40) / 100,
  duration: 16 + ((i * 5) % 18),
  delay: -(i * 1.7),
  p1x: `${((i * 13) % 27) - 13}px`, p1y: `${-14 - ((i * 9) % 12)}px`,
  p2x: `${((i * 19) % 33) - 16}px`, p2y: `${-30 - ((i * 7) % 16)}px`,
  p3x: `${((i * 23) % 29) - 14}px`, p3y: `${-48 - ((i * 11) % 20)}px`,
}));

// Layer 11 — enormous, barely-visible glass waves, each at a very different
// vertical position/duration so they never appear to move as one.
const WAVES = [
  { top: '18%', duration: 68, delay: 0 },
  { top: '52%', duration: 90, delay: -30 },
  { top: '86%', duration: 55, delay: -18 },
];

// Layer 13 — ambient reflections: long, unsynchronized cycles so each one
// appears, sweeps, fades, and only returns much later, independently of
// the others.
const REFLECTIONS = [
  { duration: 46, delay: 0 },
  { duration: 63, delay: -28 },
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
      {/* Premium light-theme "glass architecture" background — thirteen
          independent depth layers (base wash, glow wash, diagonal beams, 3D
          glass ribbons, glass rings, glass arcs, glass spheres, sparkles,
          volumetric particles, tinted fog, giant glass waves, a faint
          blueprint grid and slow ambient reflections), every one animated
          with transform/opacity/filter only (GPU-composited) on its own
          unsynchronized duration. All z-index 0 — strictly behind the
          logo/card, which live in the z-index 10 block below and are
          completely untouched. The whole stack collapses to a still frame
          under prefers-reduced-motion (see index.css). */}

      {/* Layer 2 — soft glow wash behind the logo/upper scene */}
      <div className="auth-glow-wash auth-parallax" style={{ '--depth': 0.35 }} aria-hidden="true" />

      {/* Layer 3 — diagonal light beams */}
      {BEAMS.map((b, i) => (
        <div
          key={i}
          className="auth-beam"
          style={{
            top: b.top, '--beam-angle': `${b.angle}deg`, '--beam-peak': b.peak,
            animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 4 — floating 3D glass ribbons */}
      {RIBBONS.map((r, i) => (
        <div
          key={i}
          className="auth-glass-ribbon auth-parallax"
          style={{
            top: r.top, left: r.left, width: r.w, height: r.h,
            '--rx0': `${r.rx0}deg`, '--ry0': `${r.ry0}deg`, '--rz0': `${r.rz0}deg`,
            '--rx1': `${r.rx1}deg`, '--ry1': `${r.ry1}deg`, '--rz1': `${r.rz1}deg`,
            '--dx': `${r.dx}px`, '--dy': `${r.dy}px`, '--tz': `${r.tz}px`,
            '--ribbon-op-lo': r.opLo, '--ribbon-op-hi': r.opHi,
            '--depth': 0.3 + i * 0.08,
            animationDuration: `${r.duration}s`, animationDelay: `${-i * 5}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 5 — floating glass rings (large translucent rings / abstract
          glass architecture), tumbling slowly in 3D */}
      {RINGS.map((r, i) => (
        <div
          key={i}
          className="auth-glass-ring auth-parallax"
          style={{
            top: r.top, left: r.left, width: r.size, height: r.size,
            borderWidth: Math.max(1, Math.round(r.size * 0.012)),
            '--rx0': `${r.rx0}deg`, '--ry0': `${r.ry0}deg`,
            '--rx1': `${r.rx1}deg`, '--ry1': `${r.ry1}deg`,
            '--ring-op': r.op,
            '--depth': 0.22 + i * 0.06,
            animationDuration: `${r.duration}s`, animationDelay: `${-i * 9}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 6 — rotating glass arcs (partial rings) */}
      {ARCS.map((a, i) => (
        <div
          key={i}
          className="auth-glass-arc"
          style={{
            top: a.top, left: a.left, width: a.size, height: a.size,
            animationDuration: `${a.duration}s`, animationDelay: `${-i * 12}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 7 — floating translucent glass spheres */}
      {SPHERES.map((s, i) => (
        <div
          key={i}
          className="auth-glass-sphere"
          style={{
            top: s.top, left: s.left, width: s.size, height: s.size,
            '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, '--sphere-op': s.op,
            animationDuration: `${s.duration}s`, animationDelay: `${-i * 4}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 8 — tiny sparkle / crystal-fragment glints */}
      {!reducedMotion && SPARKLES.map((sp, i) => (
        <div
          key={i}
          className="auth-sparkle"
          style={{
            top: sp.top, left: sp.left,
            '--sparkle-op': sp.opacity,
            animationDuration: `${sp.duration}s`, animationDelay: `${sp.delay}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 9 — volumetric particles */}
      {!reducedMotion && PARTICLES.map((p, i) => (
        <span
          key={i}
          className="auth-glow-particle"
          style={{
            left: p.left, bottom: '-6%', width: p.size, height: p.size,
            boxShadow: `0 0 ${p.size * 2}px ${p.size * 0.6}px rgba(147, 197, 253, 0.45)`,
            '--p-op': p.opacity,
            '--p1x': p.p1x, '--p1y': p.p1y, '--p2x': p.p2x, '--p2y': p.p2y, '--p3x': p.p3x, '--p3y': p.p3y,
            animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 10 — tinted depth fog (masked away from the logo/card column) */}
      <div className="auth-fog auth-fog--near" aria-hidden="true" />
      <div className="auth-fog auth-fog--far" aria-hidden="true" />

      {/* Layer 11 — enormous barely-visible glass waves */}
      {WAVES.map((w, i) => (
        <div
          key={i}
          className="auth-wave"
          style={{ top: w.top, animationDuration: `${w.duration}s`, animationDelay: `${w.delay}s` }}
          aria-hidden="true"
        />
      ))}

      {/* Layer 12 — faint blueprint grid */}
      <div className="auth-blueprint" aria-hidden="true" />

      {/* Layer 13 — slow ambient reflections */}
      {REFLECTIONS.map((r, i) => (
        <div
          key={i}
          className="auth-reflection"
          style={{ animationDuration: `${r.duration}s`, animationDelay: `${r.delay}s` }}
          aria-hidden="true"
        />
      ))}

      <div className="dl-stagger relative z-10 w-full max-w-md">
        <div className="relative mb-8 flex flex-col items-center text-center">
          {/* No card, no box, no plate — the mark floats directly on the
              scene, exactly as asked. The halo is a sibling behind it
              (lower in the stacking order), never touching AnimatedLogo
              itself, so the logo now reads as lit from behind. */}
          <div className="auth-logo-halo" aria-hidden="true" />
          {!reducedMotion && <div className="auth-logo-halo-ring" aria-hidden="true" />}
          <div className="relative mb-4">
            <AnimatedLogo className="h-16" />
          </div>
          <p className="relative flex items-center gap-1.5 text-sm font-medium tracking-wide text-indigo-900/80">
            <ShieldCheck className="h-4 w-4 text-indigo-500" /> HRMS Portal
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
                <input
                  type="email"
                  className={`auth-input pr-10 ${shake ? 'is-invalid' : ''}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </FormField>

            <FormField label="Password" required>
              <div className="auth-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`auth-input pr-10 ${shake ? 'is-invalid' : ''}`}
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

        <p className="mt-6 text-center text-xs text-slate-500/90">
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