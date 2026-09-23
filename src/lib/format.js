import { MONTHS } from '../constants';

const EM_DASH = '—';

/** Pulls the human-readable message out of an axios/API error, with a sensible fallback. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const payload = error?.response?.data?.error;
  if (payload?.message) return payload.message;
  if (error?.response?.status === 403) return 'You do not have permission to do that.';
  if (error?.response?.status === 404) return 'That record could not be found.';
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check that the API is running.';
  return error?.message || fallback;
}

/** Field-level validation details returned by the API, as `{ field: message }`. */
export function fieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((acc, d) => {
    const key = Array.isArray(d.path) ? d.path.join('.') : d.path;
    if (key && !acc[key]) acc[key] = d.message;
    return acc;
  }, {});
}

export function formatDate(value, fallback = EM_DASH) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value, fallback = EM_DASH) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(value, fallback = EM_DASH) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** `YYYY-MM-DD` for date inputs. */
export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

/** `HH:mm` for time inputs. */
export function toTimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatCurrency(value, { compact = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return EM_DASH;
  // Indian short scale: 1,00,000 → 1.0 L, 1,00,00,000 → 1.00 Cr
  if (compact && Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (compact && Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return EM_DASH;
  return new Intl.NumberFormat('en-IN').format(n);
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return EM_DASH;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** `SOME_STATUS` → `Some status`, with acronyms preserved where obvious. */
export function humanise(value) {
  if (!value) return EM_DASH;
  return String(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\b(hr|it|pf|esi|tds|hra|ceo|cto|coo|qa|ux)\b/gi, (m) => m.toUpperCase());
}

export function monthName(month) {
  return MONTHS[Number(month) - 1] || EM_DASH;
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** "3 hours ago" style relative time for feeds and notifications. */
export function relativeTime(value) {
  if (!value) return EM_DASH;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return EM_DASH;
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(value);
}

/** Duration between two timestamps as `7h 45m`. */
export function duration(from, to) {
  if (!from) return EM_DASH;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return EM_DASH;
  const minutes = Math.floor((end - start) / 60000);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

// Matches the paid-shift math already described in the UI copy ("Includes
// 1 hr paid break · 8 hrs counted = 9 hrs on site") — 8 working hours plus
// the 1 hour paid break someone actually spends on site.
export const WORKDAY_HOURS = 8;
export const PAID_BREAK_HOURS = 1;

/**
 * Minutes actually spent on break so far, from real breakStart/breakEnd
 * timestamps — live (counts up to `now`) while on break, frozen once
 * breakEnd is recorded, 0 before a break has started.
 */
export function breakMinutesTaken(breakStart, breakEnd, now = Date.now()) {
  if (!breakStart) return 0;
  const start = new Date(breakStart).getTime();
  if (Number.isNaN(start)) return 0;
  const end = breakEnd ? new Date(breakEnd).getTime() : now;
  if (Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 60000);
}

/** `1h 12m` / `40m` from real break timestamps — null before a break starts. */
export function formatBreakDuration(breakStart, breakEnd, now = Date.now()) {
  if (!breakStart) return null;
  const mins = breakMinutesTaken(breakStart, breakEnd, now);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// Matches the server's break-deduction rule (attendanceController.js
// recomputeDerivedFields): the deduction is the ACTUAL break duration taken
// — symmetric both ways. Break out early (say 35 min instead of the
// standard 60) and the deduction is the real 35, which pulls the expected
// check-out earlier by the same 25 min — they're free to check out that
// much sooner, the check-out button was never gated on net hours anyway.
// Run the break long (say 72 min) and the deduction is the real 72, which
// pushes the expected check-out later by the 12-minute overage instead.
// Before any break is started at all, the org's standard break is used as
// the day's baseline assumption (unchanged from before).
export function effectiveBreakMinutes(breakStart, breakEnd, now = Date.now()) {
  const standard = PAID_BREAK_HOURS * 60;
  if (!breakStart) return standard;
  return breakMinutesTaken(breakStart, breakEnd, now);
}

/**
 * The actual clock time someone checking in NOW should expect to check out
 * — computed from their REAL check-in timestamp for today (not a generic
 * static string), and adjusted live to the ACTUAL break duration taken: a
 * shorter break pulls this earlier (they can check out that much sooner), a
 * longer break pushes it later by the overage. Returns null once they've
 * already checked out (the real check-out time is shown instead) or if
 * there's no check-in yet. `breakStart`/`breakEnd` are optional — omitting
 * them keeps the original fixed-9-hours behaviour for existing callers.
 */
export function expectedCheckOutTime(checkIn, breakStart = null, breakEnd = null, now = Date.now()) {
  if (!checkIn) return null;
  const start = new Date(checkIn).getTime();
  if (Number.isNaN(start)) return null;
  const breakMins = effectiveBreakMinutes(breakStart, breakEnd, now);
  const end = new Date(start + WORKDAY_HOURS * 3600000 + breakMins * 60000);
  return end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** Whole days between two `YYYY-MM-DD` values, inclusive. Returns 0 when invalid. */
export function daysBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((b - a) / 86400000) + 1;
}

/** Triggers a browser download for a Blob returned by the API. */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Opens a Blob in a browser tab for inline viewing (e.g. image or PDF). */
export function viewBlob(blob, targetWindow = null) {
  const url = window.URL.createObjectURL(blob);
  if (targetWindow && !targetWindow.closed) {
    try {
      targetWindow.location.href = url;
    } catch {
      window.open(url, '_blank');
    }
  } else {
    window.open(url, '_blank');
  }
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

/** Serialises rows to CSV and downloads them. `columns` is `[{ key, label, value? }]`. */
export function exportCsv(filename, columns, rows) {
  const escape = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(c.value ? c.value(row) : row[c.key])).join(',')).join('\n');
  downloadBlob(new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' }), filename);
}