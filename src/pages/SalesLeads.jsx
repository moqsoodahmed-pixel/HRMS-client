import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone, Mail, Building2, Upload, Search, RefreshCw, ChevronLeft, ChevronRight,
  BarChart3, Users, TrendingUp, Eye, Edit2, RotateCcw, AlertCircle, CheckCircle2,
  Filter, X, Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leadsAPI, employeeAPI } from '../api/axios';
import { PageHeader, Spinner, EmptyState, LoadingBlock } from '../components/ui';

const STATUS_COLORS = {
  NEW:            'bg-blue-100 text-blue-700',
  CONTACTED:      'bg-yellow-100 text-yellow-700',
  INTERESTED:     'bg-green-100 text-green-700',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
  CONVERTED:      'bg-emerald-100 text-emerald-700',
  LOST:           'bg-gray-100 text-gray-500',
};

const STATUS_OPTIONS = ['NEW', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'];
const UPLOAD_ROLES = ['FOUNDER_CEO', 'CTO', 'SUPER_ADMIN', 'PROJECT_HEAD'];
const MGMT_ROLES = ['FOUNDER_CEO', 'CTO', 'SUPER_ADMIN', 'PROJECT_HEAD', 'HR_ADMIN', 'MANAGER', 'DIRECTOR'];

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

// ── Upload Section with Preview ──────────────────────────────────────────────
function UploadSection({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('select'); // select | preview | uploading | done
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
    setStep('select');
  };

  const handlePreview = async () => {
    if (!file) return;
    setStep('previewing');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await leadsAPI.preview(form);
      setPreview(res.data.data);
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Preview failed.');
      setStep('select');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStep('uploading');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await leadsAPI.upload(form);
      setResult(res.data.data);
      setFile(null);
      setPreview(null);
      setStep('done');
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Upload failed.');
      setStep('preview');
    }
  };

  return (
    <div className="card mb-6">
      <h2 className="mb-2 text-base font-semibold text-gray-800">Upload Leads File</h2>
      <p className="mb-4 text-sm text-gray-500">
        Upload a <strong>CSV</strong> or <strong>Excel (.xlsx/.xls)</strong> file. Required column: <code className="rounded bg-gray-100 px-1 text-xs">name</code>.{' '}
        Optional: phone, email, company, status, notes. Leads are distributed in <strong>50-lead rounds</strong> across active Sales employees.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer">
          <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={handleFileChange} />
          <span className="btn-secondary flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {file ? file.name : 'Choose File'}
          </span>
        </label>

        {file && step === 'select' && (
          <button onClick={handlePreview} className="btn-secondary flex items-center gap-2">
            <Eye className="h-4 w-4" /> Preview
          </button>
        )}

        {step === 'previewing' && <Spinner size="sm" />}

        {step === 'preview' && preview && (
          <button onClick={handleUpload} className="btn-primary flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import & Distribute {preview.validRows} Leads
          </button>
        )}

        {step === 'uploading' && (
          <button disabled className="btn-primary flex items-center gap-2 opacity-70">
            <RefreshCw className="h-4 w-4 animate-spin" /> Importing…
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm">
          <p className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Info className="h-4 w-4" /> Preview</p>
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div className="rounded bg-white p-3 border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">{preview.totalRows}</div>
              <div className="text-xs text-gray-500 mt-1">Total Rows</div>
            </div>
            <div className="rounded bg-white p-3 border border-green-100">
              <div className="text-2xl font-bold text-green-700">{preview.validRows}</div>
              <div className="text-xs text-gray-500 mt-1">Valid Leads</div>
            </div>
            <div className="rounded bg-white p-3 border border-red-100">
              <div className="text-2xl font-bold text-red-700">{preview.invalidRows}</div>
              <div className="text-xs text-gray-500 mt-1">Invalid / Skipped</div>
            </div>
          </div>
          {preview.sample?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Sample rows:</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {preview.sample.map((r, i) => (
                  <li key={i} className="truncate">• {r.name}{r.company ? ` — ${r.company}` : ''}{r.phone ? ` (${r.phone})` : ''}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          <p className="font-semibold mb-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {result.message}
          </p>
          <p className="text-xs text-green-700">Batch ID: <code className="font-mono">{result.uploadBatch}</code> · Batch size: {result.batchSize} leads/round</p>
          {result.skipped > 0 && <p className="text-green-700 mt-1">{result.skipped} rows skipped.</p>}
          {result.distribution?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-green-700 mb-1">Distribution:</p>
              <div className="space-y-1">
                {result.distribution.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs bg-white/60 rounded px-2 py-1">
                    <span>{d.name}</span><span className="font-medium">{d.assigned} leads</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stats Dashboard ──────────────────────────────────────────────────────────
function StatsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leadsAPI.stats().then(r => setStats(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="mb-6"><Spinner /></div>;
  if (!stats) return null;

  const statCards = [
    { label: 'Total Leads', value: stats.total, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'New', value: stats.byStatus?.NEW || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Contacted', value: stats.byStatus?.CONTACTED || 0, color: 'text-yellow-700', bg: 'bg-yellow-50' },
    { label: 'Interested', value: stats.byStatus?.INTERESTED || 0, color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'Converted', value: stats.byStatus?.CONVERTED || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Lost', value: stats.byStatus?.LOST || 0, color: 'text-gray-500', bg: 'bg-gray-50' },
    { label: 'Unassigned', value: stats.unassigned || 0, color: 'text-orange-700', bg: 'bg-orange-50' },
  ];

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {statCards.map(({ label, value, color, bg }) => (
          <div key={label} className={`card p-4 ${bg}`}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-3 bg-indigo-50">
          <div className="text-lg font-bold text-indigo-700">{stats.conversionRate}</div>
          <div className="text-xs text-gray-500">Conversion Rate</div>
        </div>
        <div className="card p-3 bg-purple-50">
          <div className="text-lg font-bold text-purple-700">{stats.contactRate}</div>
          <div className="text-xs text-gray-500">Contact Rate</div>
        </div>
        <div className="card p-3 bg-teal-50">
          <div className="text-lg font-bold text-teal-700">{stats.byEmployee?.length || 0}</div>
          <div className="text-xs text-gray-500">Sales Reps</div>
        </div>
      </div>

      {stats.byEmployee?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-600" />
            <span className="text-sm font-semibold">Lead Distribution by Sales Rep</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">Rep</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">New</th>
                  <th className="px-4 py-2 text-right">Contacted</th>
                  <th className="px-4 py-2 text-right">Interested</th>
                  <th className="px-4 py-2 text-right">Converted</th>
                  <th className="px-4 py-2 text-right">Lost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.byEmployee.map((emp, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{emp.name || 'Unassigned'}</td>
                    <td className="px-4 py-2 text-right font-semibold">{emp.total}</td>
                    <td className="px-4 py-2 text-right text-blue-600">{emp.new}</td>
                    <td className="px-4 py-2 text-right text-yellow-600">{emp.contacted}</td>
                    <td className="px-4 py-2 text-right text-green-600">{emp.interested}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">{emp.converted}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{emp.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Status Update Modal ──────────────────────────────────────────────────────
function StatusModal({ lead, onClose, onUpdated }) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await leadsAPI.updateStatus(lead._id, { status, notes });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to update.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">Update Lead: {lead.name}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this lead…" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reassign Modal ────────────────────────────────────────────────────────────
function ReassignModal({ lead, onClose, onUpdated }) {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeAPI.list({ department: 'Sales', status: 'ACTIVE', limit: 100 })
      .then(r => setEmployees(r.data.data || []))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!employeeId) { setError('Please select an employee.'); return; }
    setSaving(true);
    setError('');
    try {
      await leadsAPI.reassign(lead._id, { employeeId, reason });
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to reassign.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">Reassign Lead: {lead.name}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Assign to Sales Employee</label>
            <select className="form-input" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>{emp.fullName} ({emp.employeeCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Reason (optional)</label>
            <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for reassignment…" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            Reassign
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lead History Modal ─────────────────────────────────────────────────────
function LeadHistoryModal({ leadId, onClose }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leadsAPI.get(leadId).then(r => setLead(r.data.data)).finally(() => setLoading(false));
  }, [leadId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">Lead History</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">
          {loading ? <LoadingBlock /> : !lead ? <p className="text-sm text-gray-500">Not found.</p> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="font-medium">{lead.name}</span></div>
                <div><span className="text-gray-500">Company:</span> <span className="font-medium">{lead.company || '—'}</span></div>
                <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{lead.phone || '—'}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="font-medium">{lead.email || '—'}</span></div>
                <div><span className="text-gray-500">Assigned to:</span> <span className="font-medium">{lead.assignedTo?.fullName || 'Unassigned'}</span></div>
                <div><span className="text-gray-500">Status:</span> <StatusBadge status={lead.status} /></div>
              </div>

              {lead.statusHistory?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Status History</p>
                  <div className="space-y-2">
                    {lead.statusHistory.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-primary-200 pl-3 py-1">
                        <div className="flex-1">
                          {h.previousStatus && <span className="text-gray-400">{h.previousStatus.replace(/_/g,' ')} → </span>}
                          <span className="font-medium">{h.newStatus.replace(/_/g,' ')}</span>
                          {h.notes && <p className="text-gray-500 mt-0.5">{h.notes}</p>}
                        </div>
                        <div className="text-gray-400 whitespace-nowrap">
                          {h.changedBy?.email && <span>{h.changedBy.email} · </span>}
                          {new Date(h.changedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lead.reassignmentHistory?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Reassignment History</p>
                  <div className="space-y-2">
                    {lead.reassignmentHistory.map((r, i) => (
                      <div key={i} className="text-xs border-l-2 border-orange-200 pl-3 py-1">
                        <span className="font-medium">{r.fromEmployee?.fullName || '?'} → {r.toEmployee?.fullName || '?'}</span>
                        {r.reason && <span className="text-gray-500"> ({r.reason})</span>}
                        <span className="text-gray-400 ml-2">{new Date(r.changedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SalesLeads() {
  const { user, isElevated } = useAuth();
  const role = user?.role;
  const canUpload = UPLOAD_ROLES.includes(role) || isElevated;
  const isMgmt = MGMT_ROLES.includes(role) || isElevated;
  const isEmployee = role === 'EMPLOYEE';

  // Reveal state — only one lead at a time, 10s timer
  const [revealed, setRevealed] = useState(null); // { leadId, email, phone, countdown }
  const revealTimerRef = useRef(null);
  const revealCountRef = useRef(null);

  const clearReveal = useCallback(() => {
    clearInterval(revealTimerRef.current);
    clearInterval(revealCountRef.current);
    setRevealed(null);
  }, []);

  const handleReveal = useCallback(async (leadId) => {
    // Cancel any existing reveal first
    clearReveal();
    try {
      const res = await leadsAPI.reveal(leadId);
      const { email, phone } = res.data.data;
      setRevealed({ leadId, email, phone, countdown: 10 });
      // Countdown ticker
      revealCountRef.current = setInterval(() => {
        setRevealed(prev => {
          if (!prev) return null;
          if (prev.countdown <= 1) { clearReveal(); return null; }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);
    } catch {
      // silently fail
    }
  }, [clearReveal]);

  // Clean up on unmount
  useEffect(() => () => clearReveal(), [clearReveal]);

  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [batches, setBatches] = useState([]);
  const [activeTab, setActiveTab] = useState('leads'); // leads | stats
  const [statusModal, setStatusModal] = useState(null);
  const [reassignModal, setReassignModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);

  const LIMIT = 50;
  const totalPages = Math.ceil(total / LIMIT);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (batchFilter) params.uploadBatch = batchFilter;
      const res = await leadsAPI.list(params);
      setLeads(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, batchFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (canUpload) {
      leadsAPI.batches().then(r => setBatches(r.data.data || [])).catch(() => {});
    }
  }, [canUpload]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  return (
    <div>
      <PageHeader
        title="Sales Leads"
        subtitle={isMgmt ? `Manage and distribute leads across the sales team` : `Your assigned leads`}
        actions={
          <div className="flex gap-2">
            {isMgmt && (
              <>
                <button
                  onClick={() => setActiveTab('leads')}
                  className={`btn-secondary flex items-center gap-2 ${activeTab === 'leads' ? 'bg-primary-50 text-primary-700' : ''}`}
                >
                  <Filter className="h-4 w-4" /> Leads
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`btn-secondary flex items-center gap-2 ${activeTab === 'stats' ? 'bg-primary-50 text-primary-700' : ''}`}
                >
                  <BarChart3 className="h-4 w-4" /> Dashboard
                </button>
              </>
            )}
          </div>
        }
      />

      {canUpload && <UploadSection onUploaded={fetchLeads} />}
      {isMgmt && activeTab === 'stats' && <StatsDashboard />}

      {(activeTab === 'leads' || !isMgmt) && (
        <>
          {/* Filters */}
          <div className="card mb-4 flex flex-wrap gap-3 p-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="form-input pl-9"
                placeholder="Search name, phone, email, company…"
                value={search}
                onChange={handleSearch}
              />
            </div>
            <select className="form-input w-44" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            {canUpload && batches.length > 0 && (
              <select className="form-input w-52" value={batchFilter} onChange={e => { setBatchFilter(e.target.value); setPage(1); }}>
                <option value="">All Batches</option>
                {batches.map(b => (
                  <option key={b.batchId} value={b.batchId}>{b.batchId} ({b.total})</option>
                ))}
              </select>
            )}
            <button onClick={fetchLeads} className="btn-secondary flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <LoadingBlock />
            ) : leads.length === 0 ? (
              <EmptyState title="No leads found" description="Try adjusting your filters or upload a new file." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="px-4 py-3 text-left">Lead</th>
                      <th className="px-4 py-3 text-left">Contact</th>
                      {isMgmt && <th className="px-4 py-3 text-left">Assigned To</th>}
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Notes</th>
                      {isMgmt && <th className="px-4 py-3 text-left">Batch</th>}
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map((lead) => (
                      <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{lead.name}</div>
                          {lead.company && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                              <Building2 className="h-3 w-3" />{lead.company}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEmployee ? (
                            // EMPLOYEE: masked by default, reveal one at a time for 10s
                            revealed?.leadId === lead._id ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-xs text-gray-700 font-medium">
                                  <Phone className="h-3 w-3 text-green-600" />{revealed.phone || '—'}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-700 font-medium">
                                  <Mail className="h-3 w-3 text-blue-600" />{revealed.email || '—'}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs text-orange-500 font-semibold">Hiding in {revealed.countdown}s</span>
                                  <button onClick={clearReveal} className="text-xs text-gray-400 hover:text-gray-600 underline">Hide now</button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleReveal(lead._id)}
                                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium border border-primary-200 rounded px-2 py-1 hover:bg-primary-50 transition-colors"
                              >
                                <Eye className="h-3 w-3" /> Reveal (10s)
                              </button>
                            )
                          ) : (
                            // Management: always visible
                            <>
                              {lead.phone && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Phone className="h-3 w-3" />{lead.phone}
                                </div>
                              )}
                              {lead.email && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Mail className="h-3 w-3" />{lead.email}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        {isMgmt && (
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {lead.assignedTo?.fullName || <span className="text-orange-500">Unassigned</span>}
                            {lead.assignedTo?.employeeCode && <span className="text-gray-400"> · {lead.assignedTo.employeeCode}</span>}
                          </td>
                        )}
                        <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-xs text-gray-500 truncate">{lead.notes || '—'}</p>
                        </td>
                        {isMgmt && (
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{lead.uploadBatch?.slice(-7) || '—'}</td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setStatusModal(lead)}
                              className="text-primary-600 hover:text-primary-800"
                              title="Update Status"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            {isMgmt && (
                              <>
                                <button
                                  onClick={() => setReassignModal(lead)}
                                  className="text-orange-500 hover:text-orange-700"
                                  title="Reassign"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setHistoryModal(lead._id)}
                                  className="text-gray-400 hover:text-gray-600"
                                  title="View History"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <p className="text-sm text-gray-500">
                  {total} lead{total !== 1 ? 's' : ''} · Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary py-1 px-2">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary py-1 px-2">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {statusModal && (
        <StatusModal lead={statusModal} onClose={() => setStatusModal(null)} onUpdated={fetchLeads} />
      )}
      {reassignModal && (
        <ReassignModal lead={reassignModal} onClose={() => setReassignModal(null)} onUpdated={fetchLeads} />
      )}
      {historyModal && (
        <LeadHistoryModal leadId={historyModal} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  );
}