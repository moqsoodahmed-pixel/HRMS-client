import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Mail, Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/axios';
import { Modal, FormField, AnimatedLogo } from '../components/ui';
import { errorMessage } from '../lib/format';
import { getCurrentLocation } from '../lib/geolocation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Sign in failed. Check your email and password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-scene flex min-h-screen items-center justify-center p-4">
      {/* Layered depth background — mesh gradient, soft light rays and a
          couple of slow-floating blurred orbs. Pure CSS, transform/opacity
          only, so it costs nothing on low-end devices and respects
          prefers-reduced-motion (see index.css). */}
      <div className="auth-scene__mesh" aria-hidden="true" />
      <div className="auth-scene__rays" aria-hidden="true" />
      <div
        className="auth-orb h-72 w-72 bg-indigo-500/30"
        style={{ top: '8%', left: '8%', animation: 'dl-orb-float-a 12s ease-in-out infinite' }}
        aria-hidden="true"
      />
      <div
        className="auth-orb h-96 w-96 bg-cyan-400/20"
        style={{ bottom: '4%', right: '6%', animation: 'dl-orb-float-b 15s ease-in-out infinite' }}
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
                  className="auth-input pl-10"
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
                  className="auth-input pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded border-gray-300" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button type="button" onClick={() => setForgotOpen(true)} className="text-sm font-medium text-primary-600 hover:underline">
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={submitting} className="auth-btn flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Signing in…' : 'Sign in'}
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