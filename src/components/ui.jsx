import { useEffect, useRef, useState } from 'react';
import { X, Search, ChevronLeft, ChevronRight, AlertTriangle, Inbox, RefreshCw, UploadCloud, FileText } from 'lucide-react';
import { STATUS_TONES, ACCEPTED_FILE_TYPES, MAX_UPLOAD_BYTES } from '../constants';
import { humanise, formatFileSize } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Page furniture                                                      */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle && <p className="page-subtitle mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Spinner({ size = 'md', className = '' }) {
  const s = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return <div className={`${s} border-2 border-gray-200 border-t-primary-600 rounded-full animate-spin ${className}`} />;
}

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-gray-500">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  );
}

/** Grey placeholder rows shown while a table loads. */
export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <div className="card overflow-hidden">
      <div className="animate-pulse divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 p-4">
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="h-4 flex-1 rounded bg-gray-100" style={{ maxWidth: c === 0 ? '18rem' : undefined }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse p-5">
          <div className="h-3 w-24 rounded bg-gray-100" />
          <div className="mt-3 h-7 w-16 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load this data' }) {
  const message = typeof error === 'string' ? error : error?.message;
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-5">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data display                                                        */
/* ------------------------------------------------------------------ */

const TONE_CLASSES = {
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  blue: 'bg-blue-100 text-blue-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  purple: 'bg-purple-100 text-purple-700',
  gray: 'bg-gray-100 text-gray-600',
};

export function StatusBadge({ status, label, tone }) {
  if (!status && !label) return <span className="text-gray-400">—</span>;
  const resolved = tone || STATUS_TONES[status] || 'gray';
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[resolved]}`}>
      {label || humanise(status)}
    </span>
  );
}

/**
 * Every "clickable" stat/summary/KPI card in the app renders through this
 * one component, so the premium hover/press feel and keyboard/ARIA support
 * only need to live here once — any page that passes `onClick` gets it for
 * free, and any page that later grows an `onClick` inherits the same feel
 * automatically. A native `<button>` already gives Enter/Space activation
 * and a browser focus outline for free; this only adds the visual polish
 * (elevation, subtle lift, icon nudge, border glow, ~1.02 scale, ~200ms
 * easing) and an explicit `aria-label` so a screen reader announces the
 * metric ("Pending Verification: 8"), not just "button".
 */
export function StatCard({ label, value, icon: Icon, tone = 'indigo', hint, onClick }) {
  const tones = {
    indigo: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-100 text-gray-600',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? {
        type: 'button',
        onClick,
        'aria-label': hint ? `${label}: ${value} (${hint})` : `${label}: ${value}`,
      } : {})}
      className={`card group p-5 text-left ${onClick ? 'cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary-300/70 hover:shadow-lg hover:shadow-primary-100/50 active:translate-y-0 active:scale-[0.99] active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 [&:hover]:scale-[1.02]' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-gray-400">{hint}</p>}
        </div>
        {Icon && (
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ${tones[tone]} ${onClick ? 'group-hover:scale-110 group-hover:rotate-3' : ''}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Wrapper>
  );
}

/**
 * A small pill-shaped action button, shaded the same way StatusBadge is
 * (rounded-full + a light tone background) instead of plain underlined
 * text — used for row-level actions like View/Download/Verify/Reject/
 * Archive so each action reads as clearly as the Verified/Missing badges
 * next to it, not just as a link.
 */
export function ActionButton({ icon: Icon, children, onClick, tone = 'gray', disabled, title, type = 'button' }) {
  const tones = {
    indigo: 'bg-primary-50 text-primary-700 hover:bg-primary-100',
    gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    green: 'bg-green-50 text-green-700 hover:bg-green-100',
    red: 'bg-red-50 text-red-700 hover:bg-red-100',
    purple: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone] || tones.gray}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />} {children}
    </button>
  );
}

/** Horizontal progress bar with an optional caption. */
export function ProgressBar({ value, tone = 'primary', label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const tones = {
    primary: 'bg-primary-600',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${tones[tone]}`} style={{ width: `${pct}%` }} />
      </div>
      {label && <p className="mt-1 text-xs text-gray-500">{label}</p>}
    </div>
  );
}

/**
 * Table with a sticky-ish header, horizontal scrolling and built-in
 * loading / empty / error states.
 * `columns`: [{ key, header, render?, className?, headerClassName? }]
 */
export function DataTable({
  columns, rows, rowKey = (r) => r._id, isLoading, error, onRetry,
  empty, onRowClick, footer,
}) {
  if (isLoading) return <TableSkeleton columns={columns.length} />;
  if (error) return <div className="card"><ErrorState error={error} onRetry={onRetry} /></div>;
  if (!rows?.length) return <div className="card">{empty || <EmptyState title="Nothing to show" description="No records match the current filters." />}</div>;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {columns.map((col) => (
                <th key={col.key} className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 align-middle text-gray-700 ${col.className || ''}`}>
                    {col.render ? col.render(row) : row[col.key] ?? <span className="text-gray-400">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

export function Pagination({ page, totalPages, total, limit, onChange }) {
  if (!totalPages || totalPages <= 1) {
    return total ? (
      <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">{total} record{total === 1 ? '' : 's'}</div>
    ) : null;
  }
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}</span>–<span className="font-medium text-gray-700">{to}</span> of{' '}
        <span className="font-medium text-gray-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-ghost disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 text-xs text-gray-600">Page {page} of {totalPages}</span>
        <button type="button" className="btn-ghost disabled:opacity-40" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mb-6 overflow-x-auto border-b border-gray-200">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const value = tab.value ?? tab;
          const label = tab.label ?? tab;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${active === value
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
            >
              {label}
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${active === value ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        className="input pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Label + control + error message. Pass `as="select"`/`"textarea"` or children. */
export function FormField({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder, className = '', ...rest }) {
  return (
    <select className={`input ${className}`} value={value} onChange={onChange} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? humanise(opt) : opt.label;
        return <option key={val} value={val}>{label}</option>;
      })}
    </select>
  );
}

/** Filter toolbar wrapper — keeps the same look on every list page. */
export function FilterBar({ children, onReset }) {
  return (
    <div className="card mb-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        {onReset && (
          <button type="button" onClick={onReset} className="btn-ghost text-xs text-gray-500 hover:text-gray-800">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

const MODAL_SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, size = 'md', footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // Stop the page behind the dialog from scrolling.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose} role="dialog" aria-modal="true">
      <div
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-xl ${MODAL_SIZES[size]}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-ghost -mr-2 -mt-1" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-gray-200 p-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', tone = 'danger', loading,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="p-5">
        <p className="text-sm text-gray-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Click-outside dropdown used by the header menus. */
export function Dropdown({ trigger, children, align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div className={`absolute z-40 mt-2 rounded-xl border border-gray-200 bg-white shadow-lg ${align === 'right' ? 'right-0' : 'left-0'} ${className}`}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

/** File picker with client-side type/size validation before anything is sent. */
export function FileUpload({ file, onChange, accept = ACCEPTED_FILE_TYPES, maxBytes = MAX_UPLOAD_BYTES, error, progress }) {
  const [localError, setLocalError] = useState('');

  const handle = (selected) => {
    setLocalError('');
    if (!selected) { onChange(null); return; }
    if (selected.size > maxBytes) {
      setLocalError(`File is ${formatFileSize(selected.size)} — the limit is ${formatFileSize(maxBytes)}.`);
      onChange(null);
      return;
    }
    const extension = `.${selected.name.split('.').pop()?.toLowerCase()}`;
    if (accept && !accept.split(',').map((a) => a.trim()).includes(extension)) {
      setLocalError(`${extension} files are not accepted. Allowed: ${accept}`);
      onChange(null);
      return;
    }
    onChange(selected);
  };

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-center transition hover:border-primary-400 hover:bg-primary-50/40">
        {file ? <FileText className="h-7 w-7 text-primary-600" /> : <UploadCloud className="h-7 w-7 text-gray-400" />}
        <span className="text-sm font-medium text-gray-700">
          {file ? file.name : 'Click to choose a file'}
        </span>
        <span className="text-xs text-gray-400">
          {file ? formatFileSize(file.size) : `${accept} · up to ${formatFileSize(maxBytes)}`}
        </span>
        <input type="file" className="hidden" accept={accept} onChange={(e) => handle(e.target.files?.[0] || null)} />
      </label>
      {progress > 0 && progress < 100 && (
        <div className="mt-2"><ProgressBar value={progress} label={`Uploading… ${progress}%`} /></div>
      )}
      {(localError || error) && <p className="mt-1 text-xs text-red-600">{localError || error}</p>}
    </div>
  );
}

/** Small label/value row used across detail panels. */
export function InfoRow({ label, value, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <span className="flex-shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">
        {value === undefined || value === null || value === '' ? <span className="text-gray-400">—</span> : value}
      </span>
    </div>
  );
}

/** Circular initials avatar. */
export function Avatar({ name, size = 'md' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' };
  const letters = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`flex flex-shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700 ${sizes[size]}`}>
      {letters}
    </div>
  );
}