// ─────────────────────────────────────────────────────────────────────────
// Business Development Workspace — the individual-contributor view of the
// Leads module (non-management: EMPLOYEE role, Sales/Business Development
// department).
//
// WHY THIS FILE EXISTS: the page used to render the exact same plain
// filter-bar + table for every role. Management (CEO/Project Head/Sales
// Team Lead) genuinely needs that dense operational table — bulk-assign,
// rebalance, batch upload/delete all live there and are UNCHANGED (see
// SalesLeads.jsx, which still owns all of that). But a Business Development
// Executive's day isn't "manage a spreadsheet of leads" — it's "who do I
// call next, who's waiting on a follow-up, how is my pipeline moving" — so
// this component gives that person a workspace built around their actual
// workflow instead.
//
// DATA HONESTY RULE: every number and section here is computed from fields
// that genuinely exist on the Lead model (status, callStatus,
// serviceInterest, notes, assignedAt, lastContactedAt, statusHistory) via
// the EXISTING /api/leads endpoints, already correctly scoped server-side
// to "my own assigned leads" for the EMPLOYEE role (see getLeads() in
// leadController.js). Nothing here is mocked/sample data — concepts the
// current schema has no field for (lead score, priority, meetings,
// proposals, lead source, industry/website/social fields, revenue) are
// intentionally left out rather than faked, per an explicit product
// decision — see the conversation this shipped from. No backend route,
// schema, or permission changes were made to build this.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search, RefreshCw, ChevronLeft, ChevronRight, Eye, Phone, Mail, Building2,
    Calendar, X, Sparkles, Target, PhoneCall, UserPlus, CheckCircle2, XCircle,
    Clock, History, ListChecks, PhoneMissed, Flame, Archive,
    ArrowRight, Activity as ActivityIcon, Inbox,
} from 'lucide-react';
import { leadsAPI } from '../api/axios';
import { StatCard, StatusBadge, ProgressBar, EmptyState, LoadingBlock, Avatar } from '../components/ui';
import { formatDate, formatDateTime, relativeTime, humanise } from '../lib/format';
import MiniCalendar from '../components/MiniCalendar';

// Safe wrapper — prevents crash if leadsAPI archive methods aren't loaded yet (build cache, etc.)
const safeCall = (fn, ...args) => {
    if (typeof fn !== 'function') return Promise.resolve({ data: { data: [], meta: { total: 0 } } });
    try { return fn(...args); } catch { return Promise.resolve({ data: { data: [], meta: { total: 0 } } }); }
};

// ── Status vocabulary (real enum from HRMS-server/models/Lead.js) ─────────
const FUNNEL_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'CONVERTED'];
const CLOSED_STATUSES = ['NOT_INTERESTED', 'LOST'];
const ALL_STATUSES = ['NEW', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'];

const STATUS_META = {
    NEW: { label: 'New', tone: 'blue', icon: Sparkles },
    CONTACTED: { label: 'Contacted', tone: 'amber', icon: PhoneCall },
    INTERESTED: { label: 'Interested', tone: 'purple', icon: Flame },
    NOT_INTERESTED: { label: 'Not Interested', tone: 'red', icon: XCircle },
    CONVERTED: { label: 'Converted', tone: 'green', icon: CheckCircle2 },
    LOST: { label: 'Lost', tone: 'gray', icon: XCircle },
};

const CALL_STATUS_TONE = {
    'Connected': 'green',
    'Busy': 'amber',
    'Switched Off': 'gray',
    'not answered': 'orange',
    'picked but disconnected': 'orange',
    'out of service': 'red',
    'call later': 'blue',
};

function StatusPill({ status }) {
    const meta = STATUS_META[status] || { label: humanise(status), tone: 'gray' };
    return <StatusBadge status={status} label={meta.label} tone={meta.tone} />;
}

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

// ─────────────────────────────────────────────────────────────────────────
// Insights: KPI counts, funnel, "needs attention" task lists, and a recent
// activity feed. All four are derived from a handful of calls to the
// SAME already-scoped GET /api/leads endpoint the rest of the app uses
// (per-status counts via limit:1, exactly like the existing "New Leads"
// badge did) — no new backend surface at all.
// ─────────────────────────────────────────────────────────────────────────
function useLeadInsights(refreshKey) {
    const [state, setState] = useState({
        loading: true,
        error: '',
        counts: {},        // { NEW: n, CONTACTED: n, ... }
        totalAssigned: 0,
        todayAssigned: 0,
        needsFirstContact: [],  // NEW leads, oldest assigned first
        needsFollowUp: [],      // CONTACTED / INTERESTED leads, oldest last-contact first
        activity: [],            // flattened statusHistory entries, most recent first
    });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true, error: '' }));
        try {
            const [
                countResults,
                totalRes,
                todayRes,
                newRes,
                contactedRes,
                interestedRes,
            ] = await Promise.all([
                Promise.all(ALL_STATUSES.map((s) => leadsAPI.list({ status: s, limit: 1 }))),
                leadsAPI.list({ limit: 1 }),
                leadsAPI.list({ leadDate: 'TODAY', limit: 1 }),
                leadsAPI.list({ status: 'NEW', limit: 60 }),
                leadsAPI.list({ status: 'CONTACTED', limit: 60 }),
                leadsAPI.list({ status: 'INTERESTED', limit: 60 }),
            ]);

            const counts = {};
            ALL_STATUSES.forEach((s, i) => { counts[s] = countResults[i].data.meta?.total || 0; });

            const newLeads = newRes.data.data || [];
            const followUpPool = [...(contactedRes.data.data || []), ...(interestedRes.data.data || [])];

            const needsFirstContact = [...newLeads]
                .sort((a, b) => new Date(a.assignedAt || a.createdAt) - new Date(b.assignedAt || b.createdAt))
                .slice(0, 8);

            const needsFollowUp = [...followUpPool]
                .sort((a, b) => {
                    const at = a.lastContactedAt ? new Date(a.lastContactedAt) : new Date(a.assignedAt || a.createdAt);
                    const bt = b.lastContactedAt ? new Date(b.lastContactedAt) : new Date(b.assignedAt || b.createdAt);
                    return at - bt; // oldest / most overdue first
                })
                .slice(0, 8);

            // Recent activity — flatten statusHistory across the working set we
            // already fetched (new + contacted + interested leads) and sort by
            // when each change actually happened. Real audit entries only.
            const activity = [...newLeads, ...followUpPool]
                .flatMap((lead) =>
                    (lead.statusHistory || []).map((h) => ({
                        leadId: lead._id,
                        leadName: lead.name,
                        company: lead.company,
                        previousStatus: h.previousStatus,
                        newStatus: h.newStatus,
                        notes: h.notes,
                        changedAt: h.changedAt,
                    }))
                )
                .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
                .slice(0, 10);

            setState({
                loading: false,
                error: '',
                counts,
                totalAssigned: totalRes.data.meta?.total || 0,
                todayAssigned: todayRes.data.meta?.total || 0,
                needsFirstContact,
                needsFollowUp,
                activity,
            });
        } catch (err) {
            setState((s) => ({ ...s, loading: false, error: 'Could not load your workspace insights.' }));
        }
    }, []);

    useEffect(() => { load(); }, [load, refreshKey]);

    return { ...state, reload: load };
}

// ── Welcome header ──────────────────────────────────────────────────────
function WelcomeHeader({ displayName, deptLabel, insights }) {
    const { counts, totalAssigned, todayAssigned, needsFollowUp, loading } = insights;
    const converted = counts.CONVERTED || 0;
    const conversionRate = totalAssigned > 0 ? Math.round((converted / totalAssigned) * 100) : 0;

    return (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-600 via-primary-600 to-indigo-700 p-6 text-white shadow-lg shadow-primary-900/10 sm:p-8">
            {/* soft decorative glow — pure CSS, no external asset */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-primary-100">
                        <Sparkles className="h-4 w-4" /> {deptLabel} Workspace
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                        {greeting()}, {displayName}
                    </h1>
                    <p className="mt-1 text-sm text-primary-100">
                        Here's where your pipeline stands right now.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                        { label: 'Assigned Leads', value: totalAssigned },
                        { label: 'Assigned Today', value: todayAssigned },
                        { label: 'Needs Follow-up', value: needsFollowUp.length },
                        { label: 'Conversion Rate', value: `${conversionRate}%` },
                    ].map((s) => (
                        <div key={s.label} className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/10">
                            <div className="text-xl font-bold">{loading ? '—' : s.value}</div>
                            <div className="mt-0.5 text-xs text-primary-100">{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── KPI grid ─────────────────────────────────────────────────────────────
function KPIGrid({ insights, activeStatus, onSelectStatus }) {
    const { counts, loading } = insights;
    const cards = [
        { status: 'NEW', label: 'New Leads', icon: Sparkles, tone: 'blue' },
        { status: 'CONTACTED', label: 'Contacted', icon: PhoneCall, tone: 'amber' },
        { status: 'INTERESTED', label: 'Interested', icon: Flame, tone: 'purple' },
        { status: 'CONVERTED', label: 'Converted', icon: CheckCircle2, tone: 'green' },
        { status: 'NOT_INTERESTED', label: 'Not Interested', icon: XCircle, tone: 'red' },
        { status: 'LOST', label: 'Lost', icon: PhoneMissed, tone: 'gray' },
    ];

    return (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((c) => (
                <StatCard
                    key={c.status}
                    label={c.label}
                    value={loading ? '—' : (counts[c.status] || 0)}
                    icon={c.icon}
                    tone={c.tone}
                    onClick={() => onSelectStatus(activeStatus === c.status ? '' : c.status)}
                    hint={activeStatus === c.status ? 'Filtering — click again to clear' : 'Click to filter your list'}
                />
            ))}
        </div>
    );
}

// ── Funnel ───────────────────────────────────────────────────────────────
function FunnelCard({ insights }) {
    const { counts, totalAssigned, loading } = insights;
    if (loading) return <div className="card mb-6 p-5"><LoadingBlock label="Loading pipeline…" /></div>;

    const closedCount = CLOSED_STATUSES.reduce((sum, s) => sum + (counts[s] || 0), 0);

    return (
        <div className="card mb-6 p-5">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Target className="h-4 w-4 text-primary-600" /> Your Lead Pipeline
                </h2>
                <span className="text-xs text-gray-400">{totalAssigned} lead{totalAssigned !== 1 ? 's' : ''} total</span>
            </div>

            <div className="space-y-3">
                {FUNNEL_STATUSES.map((status, i) => {
                    const meta = STATUS_META[status];
                    const value = counts[status] || 0;
                    const pct = totalAssigned > 0 ? Math.round((value / totalAssigned) * 100) : 0;
                    const Icon = meta.icon;
                    return (
                        <div key={status}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5 font-medium text-gray-700">
                                    <Icon className="h-3.5 w-3.5" /> {meta.label}
                                </span>
                                <span className="text-gray-500">{value} · {pct}%</span>
                            </div>
                            <ProgressBar value={pct} tone={i === FUNNEL_STATUSES.length - 1 ? 'green' : 'primary'} />
                            {i < FUNNEL_STATUSES.length - 1 && (
                                <div className="flex justify-center py-1">
                                    <ArrowRight className="h-3 w-3 rotate-90 text-gray-300" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {closedCount > 0 && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                    <XCircle className="h-3.5 w-3.5" />
                    {closedCount} lead{closedCount !== 1 ? 's' : ''} closed without converting (Not Interested / Lost)
                </div>
            )}
        </div>
    );
}

// ── Task panels (needs first contact / needs follow-up) ────────────────
// NOTE: Tailwind's JIT scanner only picks up class names it can see as
// literal strings in source — a template-built class like `text-${tone}-600`
// would silently produce NO css at all in the production build. So `tone`
// is resolved through this static, fully-spelled-out map instead of ever
// being interpolated into a class name.
const TASK_PANEL_TONES = {
    blue: { icon: 'text-blue-600', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' },
    amber: { icon: 'text-amber-600', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700' },
};

function TaskPanel({ title, icon: Icon, tone, items, emptyLabel, dateLabel, dateField, onOpen }) {
    const t = TASK_PANEL_TONES[tone] || TASK_PANEL_TONES.blue;
    return (
        <div className="card flex h-full flex-col p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Icon className={`h-4 w-4 ${t.icon}`} /> {title}
                {items.length > 0 && (
                    <span className={`ml-auto rounded-full ${t.badgeBg} px-2 py-0.5 text-xs font-semibold ${t.badgeText}`}>
                        {items.length}
                    </span>
                )}
            </h2>
            {items.length === 0 ? (
                <p className="flex flex-1 items-center justify-center py-6 text-center text-xs text-gray-400">{emptyLabel}</p>
            ) : (
                <div className="-mx-1 space-y-1 overflow-y-auto">
                    {items.map((lead) => (
                        <button
                            key={lead._id}
                            onClick={() => onOpen(lead)}
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50"
                        >
                            <Avatar name={lead.name} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">{lead.name}</p>
                                <p className="truncate text-xs text-gray-500">{lead.company || '—'}</p>
                            </div>
                            <span className="whitespace-nowrap text-right text-[11px] text-gray-400">
                                {dateLabel} {relativeTime(lead[dateField] || lead.createdAt)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Recent activity feed ────────────────────────────────────────────────
function ActivityFeed({ insights }) {
    const { activity, loading } = insights;
    return (
        <div className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <ActivityIcon className="h-4 w-4 text-primary-600" /> Recent Activity
            </h2>
            {loading ? (
                <LoadingBlock label="Loading activity…" />
            ) : activity.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">No recent status changes yet.</p>
            ) : (
                <div className="space-y-3">
                    {activity.map((a, i) => (
                        <div key={i} className="flex gap-3 border-l-2 border-primary-100 pl-3">
                            <div className="flex-1 text-xs">
                                <p className="text-gray-700">
                                    <span className="font-medium text-gray-900">{a.leadName}</span>
                                    {a.company && <span className="text-gray-400"> · {a.company}</span>}
                                </p>
                                <p className="mt-0.5 text-gray-500">
                                    {a.previousStatus && <>{humanise(a.previousStatus)} → </>}
                                    <span className="font-medium">{humanise(a.newStatus)}</span>
                                    {a.notes && <span className="text-gray-400"> — "{a.notes}"</span>}
                                </p>
                            </div>
                            <span className="whitespace-nowrap text-[11px] text-gray-400">{relativeTime(a.changedAt)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Lead detail drawer ──────────────────────────────────────────────────
const CALL_STATUS_OPTIONS = ['', 'Busy', 'Connected', 'Switched Off', 'not answered', 'picked but disconnected', 'out of service', 'call later'];
const SERVICE_INTEREST_OPTIONS = ['', 'Startup India', 'GST', 'MSME', 'Trademark', 'Labour Certificate', 'Website Development', 'Others'];

function LeadDrawer({ leadId, onClose, onUpdated, revealed, onReveal, onClearReveal, onArchive, archiving }) {
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [callStatus, setCallStatus] = useState('');
    const [serviceInterest, setServiceInterest] = useState('');
    const [callNotes, setCallNotes] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        leadsAPI.get(leadId).then((r) => {
            if (cancelled) return;
            const l = r.data.data;
            setLead(l);
            setStatus(l.status);
            setCallStatus(l.callStatus || '');
            setServiceInterest(l.serviceInterest || '');
            setCallNotes(l.callNotes || '');
            setNotes(l.notes || '');
        }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [leadId]);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            const res = await leadsAPI.updateStatus(leadId, { status, callStatus, serviceInterest, callNotes, notes });
            setLead(res.data.data);
            setSaved(true);
            onUpdated();
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const isRevealed = revealed?.leadId === leadId;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={onClose}>
            <div
                className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-200 ease-out"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {loading || !lead ? (
                    <div className="flex flex-1 items-center justify-center"><LoadingBlock label="Loading lead…" /></div>
                ) : (
                    <>
                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5">
                            <div className="flex items-center gap-3 min-w-0">
                                <Avatar name={lead.name} />
                                <div className="min-w-0">
                                    <h2 className="truncate text-base font-semibold text-gray-900">{lead.name}</h2>
                                    {lead.company && (
                                        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                                            <Building2 className="h-3 w-3" /> {lead.company}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button onClick={onClose} className="btn-ghost -mr-1 -mt-1 flex-shrink-0"><X className="h-5 w-5" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {/* Contact */}
                            <section>
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Contact</h3>
                                {isRevealed ? (
                                    <div className="space-y-1.5 rounded-lg bg-gray-50 p-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="h-3.5 w-3.5 text-green-600" /> {revealed.phone || '—'}</div>
                                        <div className="flex items-center gap-2 text-sm text-gray-700"><Mail className="h-3.5 w-3.5 text-blue-600" /> {revealed.email || '—'}</div>
                                        <div className="flex items-center gap-2 pt-1">
                                            <span className="text-xs font-semibold text-orange-500">Hiding in {revealed.countdown}s</span>
                                            <button onClick={onClearReveal} className="text-xs text-gray-400 underline hover:text-gray-600">Hide now</button>
                                        </div>
                                    </div>
                                ) : lead.phone !== undefined && String(lead.phone || '').includes('*') ? (
                                    <button
                                        onClick={() => onReveal(leadId)}
                                        className="flex items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50"
                                    >
                                        <Eye className="h-3.5 w-3.5" /> Reveal contact details (20s)
                                    </button>
                                ) : (
                                    <div className="space-y-1.5 rounded-lg bg-gray-50 p-3">
                                        <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="h-3.5 w-3.5 text-green-600" /> {lead.phone || '—'}</div>
                                        <div className="flex items-center gap-2 text-sm text-gray-700"><Mail className="h-3.5 w-3.5 text-blue-600" /> {lead.email || '—'}</div>
                                    </div>
                                )}
                            </section>

                            {/* Status + call details */}
                            <section>
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Update</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="form-label">Lead Status</label>
                                        <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                                            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Call Outcome</label>
                                        <select className="form-input" value={callStatus} onChange={(e) => setCallStatus(e.target.value)}>
                                            {CALL_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'Not recorded'}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Service Interest</label>
                                        <select className="form-input" value={serviceInterest} onChange={(e) => setServiceInterest(e.target.value)}>
                                            {SERVICE_INTEREST_OPTIONS.map((s) => <option key={s} value={s}>{s || 'Not recorded'}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Call Notes</label>
                                        <textarea className="form-input" rows={2} value={callNotes} onChange={(e) => setCallNotes(e.target.value)} placeholder="What happened on the call…" />
                                    </div>
                                    <div>
                                        <label className="form-label">General Notes</label>
                                        <textarea className="form-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else worth remembering…" />
                                    </div>
                                    {error && <p className="text-sm text-red-600">{error}</p>}
                                    <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
                                        {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : null}
                                        {saved ? 'Saved' : saving ? 'Saving…' : 'Save Update'}
                                    </button>
                                    {onArchive && (
                                        <button
                                            onClick={() => { onArchive(leadId); onClose(); }}
                                            disabled={archiving}
                                            className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-40"
                                        >
                                            <Archive className="h-4 w-4" /> Move to History
                                        </button>
                                    )}
                                </div>
                            </section>

                            {/* Meta */}
                            <section className="grid grid-cols-2 gap-3 text-xs">
                                <div><span className="text-gray-400">Assigned</span><p className="font-medium text-gray-700">{lead.assignedAt ? formatDate(lead.assignedAt) : '—'}</p></div>
                                <div><span className="text-gray-400">Last Contacted</span><p className="font-medium text-gray-700">{lead.lastContactedAt ? formatDate(lead.lastContactedAt) : 'Not yet'}</p></div>
                                <div><span className="text-gray-400">Current Status</span><p className="mt-0.5"><StatusPill status={lead.status} /></p></div>
                                <div><span className="text-gray-400">Days in Pipeline</span><p className="font-medium text-gray-700">{lead.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(lead.createdAt)) / 86400000)) : '—'}</p></div>
                            </section>

                            {/* History */}
                            {lead.statusHistory?.length > 0 && (
                                <section>
                                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                                        <History className="h-3.5 w-3.5" /> Status History
                                    </h3>
                                    <div className="space-y-2">
                                        {[...lead.statusHistory].reverse().map((h, i) => (
                                            <div key={i} className="border-l-2 border-primary-100 pl-3 text-xs">
                                                <p className="text-gray-700">
                                                    {h.previousStatus && <span className="text-gray-400">{humanise(h.previousStatus)} → </span>}
                                                    <span className="font-medium">{humanise(h.newStatus)}</span>
                                                </p>
                                                {h.notes && <p className="mt-0.5 text-gray-500">"{h.notes}"</p>}
                                                <p className="mt-0.5 text-gray-400">{formatDateTime(h.changedAt)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Lead list (table) ───────────────────────────────────────────────────
function LeadRow({ lead, isRevealedRow, revealed, onReveal, onClearReveal, onOpen }) {
    return (
        <tr className="cursor-pointer transition-colors hover:bg-gray-50" onClick={() => onOpen(lead)}>
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar name={lead.name} size="sm" />
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{lead.name}</p>
                        {lead.company && (
                            <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                                <Building2 className="h-3 w-3" /> {lead.company}
                            </p>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                {isRevealedRow ? (
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-700"><Phone className="h-3 w-3 text-green-600" />{revealed.phone || '—'}</div>
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-700"><Mail className="h-3 w-3 text-blue-600" />{revealed.email || '—'}</div>
                        <button onClick={onClearReveal} className="text-[11px] text-gray-400 underline hover:text-gray-600">Hide ({revealed.countdown}s)</button>
                    </div>
                ) : (
                    <button
                        onClick={() => onReveal(lead._id)}
                        className="flex items-center gap-1 rounded border border-primary-200 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                    >
                        <Eye className="h-3 w-3" /> Reveal
                    </button>
                )}
            </td>
            <td className="px-4 py-3"><StatusPill status={lead.status} /></td>
            <td className="px-4 py-3 text-xs text-gray-600">
                {lead.callStatus ? (
                    <StatusBadge label={lead.callStatus} tone={CALL_STATUS_TONE[lead.callStatus] || 'gray'} />
                ) : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-4 py-3 text-xs text-gray-500">{lead.serviceInterest || <span className="text-gray-300">—</span>}</td>
            <td className="px-4 py-3 text-xs text-gray-500">{lead.lastContactedAt ? relativeTime(lead.lastContactedAt) : <span className="text-gray-300">Never</span>}</td>
            <td className="max-w-[16rem] px-4 py-3">
                <p className="truncate text-xs text-gray-500">{lead.notes || '—'}</p>
            </td>
        </tr>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────
// ── Archived Leads (Employee History) ────────────────────────────────────
function ArchivedSection() {
    const [open, setOpen] = useState(false);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        safeCall(leadsAPI.archived, { page: 1, limit: 50 })
            .then(r => { setLeads(r.data.data || []); setTotal(r.data.meta?.total || 0); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [open]);

    // Fetch just the count on mount so we can show a badge
    useEffect(() => {
        safeCall(leadsAPI.archived, { page: 1, limit: 1 })
            .then(r => setTotal(r.data.meta?.total || 0))
            .catch(() => { });
    }, []);

    return (
        <div className="card mt-6 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Archive className="h-4 w-4 text-gray-400" /> History
                    {total > 0 && <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">{total}</span>}
                </span>
                <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
            {open && (
                <div className="border-t border-gray-100">
                    {loading ? (
                        <LoadingBlock />
                    ) : leads.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-gray-400">No archived leads yet</p>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {leads.map(lead => (
                                <div key={lead._id} className="flex items-center justify-between px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                                        {lead.company && <p className="text-xs text-gray-500">{lead.company}</p>}
                                        {lead.archiveReason && <p className="text-xs text-gray-400 italic mt-0.5">{lead.archiveReason}</p>}
                                    </div>
                                    <div className="text-right">
                                        <StatusPill status={lead.status} />
                                        {lead.archivedAt && (
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {new Date(lead.archivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function BDWorkspace({
    displayName, deptLabel,
    leads, total, page, totalPages, loading, listError, LIMIT,
    search, onSearchChange,
    statusFilter, onStatusFilterChange,
    leadDateFilter, onLeadDateFilterChange,
    customDate, onCustomDateChange,
    showCalendar, setShowCalendar, calendarRef,
    onPageChange, onRefresh,
    revealed, onReveal, onClearReveal,
    newLeadsCount,
    onArchive, archiving,
}) {
    const [drawerLeadId, setDrawerLeadId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const insights = useLeadInsights(refreshKey);

    const bumpInsights = () => setRefreshKey((k) => k + 1);

    const openLead = (lead) => setDrawerLeadId(lead._id);
    const closeLead = () => setDrawerLeadId(null);
    const handleDrawerUpdated = () => { onRefresh(); bumpInsights(); };

    return (
        <div>
            <WelcomeHeader displayName={displayName} deptLabel={deptLabel} insights={insights} />
            <KPIGrid insights={insights} activeStatus={statusFilter} onSelectStatus={onStatusFilterChange} />

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <FunnelCard insights={insights} />
                <TaskPanel
                    title="Needs First Contact"
                    icon={UserPlus}
                    tone="blue"
                    items={insights.needsFirstContact}
                    emptyLabel="Nothing waiting — every new lead has been contacted."
                    dateLabel="assigned"
                    dateField="assignedAt"
                    onOpen={openLead}
                />
                <TaskPanel
                    title="Needs Follow-up"
                    icon={Clock}
                    tone="amber"
                    items={insights.needsFollowUp}
                    emptyLabel="You're all caught up on follow-ups."
                    dateLabel="last contact"
                    dateField="lastContactedAt"
                    onOpen={openLead}
                />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    {/* Filters */}
                    <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
                        <div className="relative min-w-48 flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                className="form-input pl-9"
                                placeholder="Search name, phone, email, company…"
                                value={search}
                                onChange={onSearchChange}
                            />
                        </div>
                        <select className="form-input w-40" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)}>
                            <option value="">All Statuses</option>
                            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                            <select
                                aria-label="Lead Date Filter"
                                className="form-input w-36"
                                value={customDate ? 'CUSTOM' : leadDateFilter}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'CUSTOM') setShowCalendar(true);
                                    else { onCustomDateChange(''); onLeadDateFilterChange(val); }
                                }}
                            >
                                <option value="">All Leads</option>
                                <option value="TODAY">Today</option>
                                <option value="PREVIOUS">Previous</option>
                                {customDate && <option value="CUSTOM">{customDate}</option>}
                            </select>
                            <div className="relative" ref={calendarRef}>
                                <button
                                    type="button"
                                    aria-label="Calendar Lead Filter"
                                    onClick={() => setShowCalendar((p) => !p)}
                                    className={`btn-secondary !p-2 ${customDate ? 'border-primary-500 bg-primary-50 text-primary-600' : 'text-gray-600'}`}
                                    title="Filter by date"
                                >
                                    <Calendar className="h-4 w-4" />
                                </button>
                                {showCalendar && (
                                    <MiniCalendar
                                        selectedDate={customDate}
                                        onSelectDate={(d) => { onCustomDateChange(d); if (d) onLeadDateFilterChange(''); }}
                                        onClose={() => setShowCalendar(false)}
                                    />
                                )}
                            </div>
                            {customDate && (
                                <button onClick={() => onCustomDateChange('')} className="p-1 text-gray-400 hover:text-red-500" title="Clear date">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <button onClick={onRefresh} className="btn-secondary flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </button>
                    </div>

                    {/* Table */}
                    <div className="card overflow-hidden">
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                <ListChecks className="h-4 w-4 text-primary-600" /> Your Leads
                            </h2>
                            {newLeadsCount > 0 && (
                                <button
                                    onClick={() => onStatusFilterChange(statusFilter === 'NEW' ? '' : 'NEW')}
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${statusFilter === 'NEW' ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
                                >
                                    {newLeadsCount} new
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <LoadingBlock />
                        ) : listError ? (
                            <EmptyState icon={Inbox} title="Could not load leads" description={listError} />
                        ) : leads.length === 0 ? (
                            <EmptyState title="No leads found" description="Try adjusting your filters." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                            <th className="px-4 py-3 text-left">Lead</th>
                                            <th className="px-4 py-3 text-left">Contact</th>
                                            <th className="px-4 py-3 text-left">Status</th>
                                            <th className="px-4 py-3 text-left">Call Outcome</th>
                                            <th className="px-4 py-3 text-left">Service Interest</th>
                                            <th className="px-4 py-3 text-left">Last Contact</th>
                                            <th className="px-4 py-3 text-left">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {leads.map((lead) => (
                                            <LeadRow
                                                key={lead._id}
                                                lead={lead}
                                                isRevealedRow={revealed?.leadId === lead._id}
                                                revealed={revealed}
                                                onReveal={onReveal}
                                                onClearReveal={onClearReveal}
                                                onOpen={openLead}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                                <p className="text-sm text-gray-500">{total} lead{total !== 1 ? 's' : ''} · Page {page} of {totalPages}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary px-2 py-1"><ChevronLeft className="h-4 w-4" /></button>
                                    <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-secondary px-2 py-1"><ChevronRight className="h-4 w-4" /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <ActivityFeed insights={insights} />
            </div>

            <ArchivedSection onArchive={onArchive} />

            {drawerLeadId && (
                <LeadDrawer
                    leadId={drawerLeadId}
                    onClose={closeLead}
                    onUpdated={handleDrawerUpdated}
                    revealed={revealed}
                    onReveal={onReveal}
                    onClearReveal={onClearReveal}
                    onArchive={onArchive}
                    archiving={archiving}
                />
            )}
        </div>
    );
}