import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone, Mail, Building2, Upload, Search, RefreshCw, ChevronLeft, ChevronRight,
  BarChart3, Users, TrendingUp, Eye, Edit2, RotateCcw, AlertCircle, CheckCircle2,
  Filter, X, Info, Calendar, Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { leadsAPI, employeeAPI } from '../api/axios';
import { PageHeader, Spinner, EmptyState, LoadingBlock } from '../components/ui';
import { errorMessage } from '../lib/format';

const STATUS_COLORS = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-yellow-100 text-yellow-700',
  INTERESTED: 'bg-green-100 text-green-700',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-emerald-100 text-emerald-700',
  LOST: 'bg-gray-100 text-gray-500',
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
  const [selectedState, setSelectedState] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Manual "who gets this batch" override, shown right after Preview.
  // Empty selection (default) = unchanged behaviour: auto-split across the
  // whole active Sales/Business Development team. Picking one person = solo
  // (everything in this batch goes to them). Picking a few = the round-robin
  // is scoped to just that hand-picked group instead of the whole team.
  const [assignees, setAssignees] = useState([]); // active Sales/BD employees, fetched once Preview succeeds
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);

  const toggleAssignee = (id) => {
    setSelectedAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setPreview(null);
    setSelectedState('');
    setSelectedAssigneeIds([]);
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
      const data = res.data.data;
      setPreview(data);
      // Pre-pick the state with the most rows so the common case (a file
      // for one state) is a single click away — the admin can still change it.
      setSelectedState(data.states?.[0]?.state || '');
      setStep('preview');

      // Fetch who this batch COULD be assigned to, right away, so the
      // "assign to" picker is ready the instant Preview finishes — no
      // separate click needed to load the employee list.
      setAssigneesLoading(true);
      Promise.all([
        employeeAPI.list({ department: 'Sales', status: 'ACTIVE', limit: 100 }),
        employeeAPI.list({ department: 'Business Development', status: 'ACTIVE', limit: 100 }),
      ])
        .then(([salesRes, bizDevRes]) => {
          setAssignees([...(salesRes.data.data || []), ...(bizDevRes.data.data || [])]);
        })
        .catch(() => { })
        .finally(() => setAssigneesLoading(false));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Preview failed.');
      setStep('select');
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedState) return;
    setStep('uploading');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('state', selectedState);
      // Only send an override when the admin actually picked someone —
      // an empty selection means "leave it to the normal auto-split",
      // which is exactly what omitting the field does server-side.
      if (selectedAssigneeIds.length > 0) {
        form.append('employeeIds', JSON.stringify(selectedAssigneeIds));
      }
      const res = await leadsAPI.upload(form);
      setResult(res.data.data);
      setFile(null);
      setPreview(null);
      setSelectedState('');
      setSelectedAssigneeIds([]);
      setAssignees([]);
      setStep('done');
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Upload failed.');
      setStep('preview');
    }
  };

  const selectedStateCount = preview?.states?.find((s) => s.state === selectedState)?.count || 0;
  const selectedAssigneeNames = assignees
    .filter((a) => selectedAssigneeIds.includes(a._id))
    .map((a) => a.fullName);

  return (
    <div className="card mb-6">
      <h2 className="mb-2 text-base font-semibold text-gray-800">Upload Leads File</h2>
      <p className="mb-4 text-sm text-gray-500">
        Upload a <strong>CSV</strong> or <strong>Excel (.xlsx/.xls)</strong> file — even a raw, uncleaned export. Required column:{' '}
        <code className="rounded bg-gray-100 px-1 text-xs">name</code> (a <code className="rounded bg-gray-100 px-1 text-xs">directorName</code>/
        <code className="rounded bg-gray-100 px-1 text-xs">directorEmail</code> pair works too, and a row with no name at all but an email
        gets a name derived from it). Optional: phone, email, company, state, status, notes.{' '}
        Rows with a duplicate phone or email — within the file, or already imported earlier — are dropped automatically, and you'll pick
        which state to import before anything is saved. Leads are distributed in <strong>{preview?.states ? '' : '50-lead '}rounds</strong> across active Sales employees.
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
          <>
            <button onClick={handleUpload} disabled={!selectedState} className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">
              <Upload className="h-4 w-4" />
              {!selectedState
                ? 'Choose a state below to import'
                : selectedAssigneeIds.length > 0
                  ? `Import & Assign ${selectedStateCount} "${selectedState}" Lead${selectedStateCount !== 1 ? 's' : ''} to ${selectedAssigneeIds.length} Chosen Employee${selectedAssigneeIds.length !== 1 ? 's' : ''}`
                  : `Import & Distribute ${selectedStateCount} "${selectedState}" Lead${selectedStateCount !== 1 ? 's' : ''}`}
            </button>
            {/* Re-parses the same file from scratch and re-runs dedup/state-grouping
                against whatever's in the database right now — use this if you're not
                sure the numbers above reflect the current file/DB state (e.g. you
                deleted a batch, or changed the file on disk and want a fresh read). */}
            <button onClick={handlePreview} className="btn-secondary flex items-center gap-2" title="Re-parse the file and recompute these numbers from scratch">
              <RefreshCw className="h-4 w-4" /> Re-scan File
            </button>
          </>
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
          <p className="font-semibold text-blue-800 mb-2 flex items-center gap-2"><Info className="h-4 w-4" /> Preview — cleaned data</p>
          <div className="grid grid-cols-2 gap-2 text-center mb-3 sm:grid-cols-5 sm:gap-3">
            <div className="rounded bg-white p-3 border border-blue-100">
              <div className="text-2xl font-bold text-blue-700">{preview.totalRows}</div>
              <div className="text-xs text-gray-500 mt-1">Total Rows</div>
            </div>
            <div className="rounded bg-white p-3 border border-green-100">
              <div className="text-2xl font-bold text-green-700">{preview.validRows}</div>
              <div className="text-xs text-gray-500 mt-1">Clean Leads</div>
            </div>
            <div className="rounded bg-white p-3 border border-red-100">
              <div className="text-2xl font-bold text-red-700">{preview.invalidRows}</div>
              <div className="text-xs text-gray-500 mt-1">Invalid / No Name</div>
            </div>
            <div className="rounded bg-white p-3 border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{preview.duplicateRows}</div>
              <div className="text-xs text-gray-500 mt-1">Duplicates in File</div>
            </div>
            <div className="rounded bg-white p-3 border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{preview.alreadyImportedRows}</div>
              <div className="text-xs text-gray-500 mt-1">Already Imported</div>
            </div>
          </div>

          {preview.states?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-blue-800 mb-1.5">Choose a state to import:</p>
              <div className="flex flex-wrap gap-2">
                {preview.states.map((s) => (
                  <button
                    key={s.state}
                    type="button"
                    onClick={() => setSelectedState(s.state)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selectedState === s.state
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                  >
                    {s.state} <span className={selectedState === s.state ? 'text-primary-100' : 'text-gray-400'}>({s.count})</span>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">Only leads from the state you pick are imported — every other state's rows are left out.</p>
            </div>
          )}

          {/*
            Manual "assign to" override — shown as soon as Preview succeeds,
            right next to the state picker. Leaving it empty keeps the old
            behaviour (auto-split across the whole active Sales/Business
            Development team). Checking one person sends the whole batch to
            them solo; checking a few scopes the round-robin to just that
            hand-picked group instead of everyone.
          */}
          <div className="mb-3 border-t border-blue-100 pt-3">
            <p className="text-xs font-semibold text-blue-800 mb-1.5">
              Assign to (optional — leave empty to auto-split across the whole team):
            </p>
            {assigneesLoading ? (
              <p className="text-xs text-gray-500 flex items-center gap-1.5"><Spinner size="sm" /> Loading sales team…</p>
            ) : assignees.length === 0 ? (
              <p className="text-xs text-gray-500">No active Sales/Business Development employees found.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {assignees.map((emp) => {
                    const checked = selectedAssigneeIds.includes(emp._id);
                    return (
                      <label
                        key={emp._id}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${checked
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:bg-primary-50'
                          }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleAssignee(emp._id)}
                        />
                        {emp.fullName} <span className={checked ? 'text-primary-100' : 'text-gray-400'}>({emp.employeeCode})</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {selectedAssigneeIds.length === 0
                    ? 'Nobody selected — this batch will auto-split across all active Sales/Business Development employees, as usual.'
                    : selectedAssigneeIds.length === 1
                      ? `Solo assignment — every imported lead goes to ${selectedAssigneeNames[0]}.`
                      : `Scoped round-robin — imported leads will be split only between: ${selectedAssigneeNames.join(', ')}.`}
                </p>
              </>
            )}
          </div>

          {preview.sample?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Sample cleaned rows (name, phone, company, state):</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {preview.sample.map((r, i) => (
                  <li key={i} className="truncate">
                    • {r.name}{r.company ? ` — ${r.company}` : ''}{r.phone ? ` · ${r.phone}` : ''}{r.state ? ` · ${r.state}` : ''}
                  </li>
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
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-green-700">
            {result.skipped > 0 && <span>{result.skipped} row(s) had no usable name and were skipped.</span>}
            {result.duplicatesRemoved > 0 && <span>{result.duplicatesRemoved} duplicate row(s) in the file were skipped.</span>}
            {result.alreadyImportedExcluded > 0 && <span>{result.alreadyImportedExcluded} row(s) were already in the system.</span>}
            {result.otherStateExcluded > 0 && <span>{result.otherStateExcluded} row(s) from other states were excluded.</span>}
          </div>
          {result.distribution?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-green-700 mb-1">
                {result.manuallyAssigned ? 'Manually assigned to:' : 'Distribution:'}
              </p>
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
    leadsAPI.stats().then(r => setStats(r.data.data)).catch(() => { }).finally(() => setLoading(false));
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
    // GET /employees only matches department by exact string, so Sales and
    // Business Development (see constants.js DEPARTMENTS, and the matching
    // pool in leadController.js distributeLeads()) are fetched separately
    // and merged — otherwise a Business Development employee could never
    // be picked as a reassignment target even though they can receive
    // leads through the normal round-robin import.
    Promise.all([
      employeeAPI.list({ department: 'Sales', status: 'ACTIVE', limit: 100 }),
      employeeAPI.list({ department: 'Business Development', status: 'ACTIVE', limit: 100 }),
    ])
      .then(([salesRes, bizDevRes]) => {
        setEmployees([...(salesRes.data.data || []), ...(bizDevRes.data.data || [])]);
      })
      .catch(() => { });
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

// ── Bulk Assign Modal ─────────────────────────────────────────────────────
// Lets CEO/Admin hand-pick which sales employee a SET of selected leads
// goes to, instead of the automatic round-robin split ("Rebalance across
// team" does the auto-split; this is the manual-choice alternative).
function BulkAssignModal({ leadIds, onClose, onUpdated }) {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Same Sales + Business Development merge as ReassignModal — GET
    // /employees only matches department by exact string.
    Promise.all([
      employeeAPI.list({ department: 'Sales', status: 'ACTIVE', limit: 100 }),
      employeeAPI.list({ department: 'Business Development', status: 'ACTIVE', limit: 100 }),
    ])
      .then(([salesRes, bizDevRes]) => {
        setEmployees([...(salesRes.data.data || []), ...(bizDevRes.data.data || [])]);
      })
      .catch(() => { });
  }, []);

  const handleSave = async () => {
    if (!employeeId) { setError('Please select an employee.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await leadsAPI.bulkAssign({ leadIds, employeeId, reason });
      window.alert(res.data.data?.message || `Assigned ${leadIds.length} lead(s).`);
      onUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to assign leads.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">Assign {leadIds.length} Lead{leadIds.length !== 1 ? 's' : ''}</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Choose exactly who these {leadIds.length} selected lead{leadIds.length !== 1 ? 's' : ''} should go to.
            Existing status, notes and history on each lead are kept — only who it's assigned to changes.
          </p>
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
            <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for this assignment…" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            Assign {leadIds.length} Lead{leadIds.length !== 1 ? 's' : ''}
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
                          {h.previousStatus && <span className="text-gray-400">{h.previousStatus.replace(/_/g, ' ')} → </span>}
                          <span className="font-medium">{h.newStatus.replace(/_/g, ' ')}</span>
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

// ── Mini Calendar Component ──────────────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelectDate, onClose }) {
  const [viewDate, setViewDate] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    }
    return new Date();
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  // Calendar math
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const days = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ day: d, dateStr: dStr });
  }

  return (
    <div
      className="absolute top-full left-0 sm:right-0 sm:left-auto mt-2 z-50 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl ring-1 ring-black/5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-gray-800">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
          <span key={w} className="text-[11px] font-medium text-gray-400">
            {w}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {days.map((item, idx) => {
          if (!item) {
            return <div key={`empty-${idx}`} className="h-7 w-7" />;
          }
          const isSelected = selectedDate === item.dateStr;
          const isToday = todayStr === item.dateStr;

          return (
            <button
              key={item.dateStr}
              type="button"
              onClick={() => {
                onSelectDate(item.dateStr);
                onClose();
              }}
              className={`h-7 w-7 rounded-full text-xs font-medium flex items-center justify-center transition-all ${isSelected
                ? 'bg-primary-600 text-white font-semibold shadow-sm'
                : isToday
                  ? 'border border-primary-500 text-primary-600 hover:bg-primary-50'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {item.day}
            </button>
          );
        })}
      </div>

      {/* Footer / Quick actions */}
      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            onSelectDate(todayStr);
            onClose();
          }}
          className="text-primary-600 font-medium hover:underline"
        >
          Today
        </button>
        {selectedDate && (
          <button
            type="button"
            onClick={() => {
              onSelectDate('');
              onClose();
            }}
            className="text-gray-500 hover:text-red-600 hover:underline"
          >
            Clear Date
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SalesLeads() {
  const { user, employee, isElevated } = useAuth();
  const role = user?.role;
  const canUpload = UPLOAD_ROLES.includes(role) || isElevated;
  const isMgmt = MGMT_ROLES.includes(role) || isElevated;
  const isEmployee = role === 'EMPLOYEE';

  // Row-number ("No.") column — restricted to CEO (and CTO, same tier),
  // HR, Project Head, and Sales-team employees only. Other roles that can
  // still open this page (Manager, Director, IT Head, Finance) do not get it.
  const salesDept = (employee?.department || '').toLowerCase();
  const isSalesEmployee = role === 'EMPLOYEE' && (salesDept === 'sales' || salesDept.includes('sales') || salesDept.includes('business development'));
  const canSeeRowNumber = isElevated || role === 'HR_ADMIN' || role === 'PROJECT_HEAD' || isSalesEmployee;

  // Reveal state — only one lead at a time, 20s timer.
  //
  // BUGFIX: this used to decrement `countdown` by 1 on every 1000ms
  // setInterval tick. That looks right, but a plain tick-counter drifts
  // badly the moment the browser throttles background-tab timers (Chrome
  // clamps setInterval to ~1/sec — or much slower — the instant the tab
  // loses focus, is minimized, or the OS deprioritizes it) or simply
  // misses a beat under load: when the tab regains focus the browser can
  // fire several queued ticks back-to-back, so the displayed number jumps
  // ("skips") several seconds at once and the reveal disappears far
  // sooner than 20 real seconds. Anchoring the countdown to a fixed
  // wall-clock end time (`revealUntilRef`) and computing the remaining
  // seconds from `Date.now()` on every tick makes it self-correcting: no
  // matter how ticks are delayed, bunched, or dropped, the displayed
  // number is always the true remaining time, and it can never show a
  // stale/incorrect countdown or hide early.
  const [revealed, setRevealed] = useState(null); // { leadId, email, phone, countdown }
  const revealCountRef = useRef(null);
  const revealUntilRef = useRef(null);
  const REVEAL_SECONDS = 20;

  const clearReveal = useCallback(() => {
    clearInterval(revealCountRef.current);
    revealCountRef.current = null;
    revealUntilRef.current = null;
    setRevealed(null);
  }, []);

  const handleReveal = useCallback(async (leadId) => {
    // Cancel any existing reveal first (only one lead revealed at a time).
    clearReveal();
    try {
      const res = await leadsAPI.reveal(leadId);
      const { email, phone } = res.data.data;
      revealUntilRef.current = Date.now() + REVEAL_SECONDS * 1000;
      setRevealed({ leadId, email, phone, countdown: REVEAL_SECONDS });
      // Ticks every 250ms so the on-screen number updates smoothly, but the
      // value shown is always derived from the fixed end time above, never
      // from counting ticks — see the note above for why that matters.
      revealCountRef.current = setInterval(() => {
        const remainingMs = revealUntilRef.current - Date.now();
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        if (remainingSeconds <= 0) {
          clearReveal();
          return;
        }
        setRevealed((prev) => (prev ? { ...prev, countdown: remainingSeconds } : prev));
      }, 250);
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
  // Surfaced when GET /leads itself fails (403/500/network) — previously
  // this was only console.error()'d and the list silently stayed empty, so
  // a real failure (e.g. the onboarding-approval gate that used to sit on
  // this route) rendered as an indistinguishable "No leads found", making a
  // genuine access problem look like "there's just nothing here."
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [leadDateFilter, setLeadDateFilter] = useState(''); // '' (All Leads) | 'TODAY' | 'PREVIOUS'
  const [customDate, setCustomDate] = useState(''); // YYYY-MM-DD
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef(null);
  const [batchFilter, setBatchFilter] = useState('');
  const [batches, setBatches] = useState([]);
  const [deletingBatch, setDeletingBatch] = useState(false);
  // Optional deep-link from the Sales Team Lead dashboard's "View leads"
  // action (/sales-leads?assignedTo=<repId>) — pre-filters the list to one
  // team member. Read once from the URL; the server still enforces that a
  // MANAGER can only ever see their own team's leads regardless of this value.
  const [assignedToFilter] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('assignedTo') || ''; }
    catch { return ''; }
  });
  const [activeTab, setActiveTab] = useState('leads'); // leads | stats
  const [statusModal, setStatusModal] = useState(null);
  const [reassignModal, setReassignModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  // Manual bulk-assign — checkbox selection of leads on the CURRENT page,
  // cleared whenever the underlying list changes (page/filters/refresh) so
  // a stale selection can never be applied to a different set of leads.
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const toggleSelected = (leadId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      return next;
    });
  };
  const toggleSelectAllOnPage = () => {
    setSelectedIds(prev => {
      const allSelected = leads.length > 0 && leads.every(l => prev.has(l._id));
      if (allSelected) return new Set();
      return new Set(leads.map(l => l._id));
    });
  };

  // Close calendar popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    }
    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  const LIMIT = 50;
  const totalPages = Math.ceil(total / LIMIT);

  // Badge count for the self-service "New Leads" tab below — kept accurate
  // regardless of whatever status filter is currently applied to the main
  // list, so the tab can show "you have 4 unworked leads" even while
  // they're looking at, say, everything they've already CONTACTED.
  const [newLeadsCount, setNewLeadsCount] = useState(0);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (customDate) {
        params.leadDate = customDate;
      } else if (leadDateFilter) {
        params.leadDate = leadDateFilter;
      }
      if (batchFilter) params.uploadBatch = batchFilter;
      if (assignedToFilter) params.assignedTo = assignedToFilter;
      const res = await leadsAPI.list(params);
      setLeads(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
      if (!isMgmt) {
        if (statusFilter === 'NEW') {
          // Already fetched exactly this above — no need for a second call.
          setNewLeadsCount(res.data.meta?.total || 0);
        } else {
          leadsAPI.list({ status: 'NEW', limit: 1 })
            .then((r) => setNewLeadsCount(r.data.meta?.total || 0))
            .catch(() => { });
        }
      }
    } catch (err) {
      console.error(err);
      setLeads([]);
      setTotal(0);
      setListError(errorMessage(err, 'Could not load leads.'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, leadDateFilter, customDate, batchFilter, assignedToFilter, isMgmt]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  // A stale selection pointing at leads from a different page/filter would
  // silently reassign the wrong leads, so drop it any time the list itself
  // is about to change underneath it.
  useEffect(() => { setSelectedIds(new Set()); }, [page, search, statusFilter, leadDateFilter, customDate, batchFilter]);

  const fetchBatches = useCallback(() => {
    if (canUpload) {
      leadsAPI.batches().then(r => setBatches(r.data.data || [])).catch(() => { });
    }
  }, [canUpload]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  // Permanently removes every lead imported in one batch — the way to
  // clear out test/accidental uploads (e.g. leads imported while testing,
  // or before duplicate/state filtering was fixed) so a re-upload of the
  // same file isn't silently excluded as "already imported". Requires
  // picking a batch from the dropdown first; asks for a typed confirmation
  // since this cannot be undone.
  const handleDeleteBatch = async () => {
    if (!batchFilter) return;
    const batchMeta = batches.find(b => b.batchId === batchFilter);
    const count = batchMeta?.total ?? 'these';
    const typed = window.prompt(
      `This permanently deletes all ${count} lead(s) in batch "${batchFilter}" — including any status/notes sales has already added. This cannot be undone.\n\nType DELETE to confirm.`
    );
    if (typed !== 'DELETE') return;

    setDeletingBatch(true);
    try {
      await leadsAPI.deleteBatch(batchFilter);
      setBatchFilter('');
      setPage(1);
      await Promise.all([fetchLeads(), fetchBatches()]);
    } catch (err) {
      window.alert(err.response?.data?.error?.message || 'Failed to delete batch.');
    } finally {
      setDeletingBatch(false);
    }
  };

  // Leads only ever get handed out at the moment a file is imported, split
  // across whoever was an active Sales/Business Development employee AT
  // THAT MOMENT — someone who joined afterward is never retroactively
  // included and stays at zero leads (with every filter cleared) until
  // either a new file is imported or this runs. This re-splits every
  // existing lead evenly across the CURRENT active team.
  const [rebalancing, setRebalancing] = useState(false);
  const handleRebalance = async () => {
    const confirmed = window.confirm(
      'This re-splits every lead evenly across the current active Sales/Business Development team. ' +
      'Leads currently assigned to other reps may move to someone new (e.g. a recent hire who never got any). ' +
      'Existing status, notes and history on each lead are kept — only who it\'s assigned to changes.\n\n' +
      'Continue?'
    );
    if (!confirmed) return;

    setRebalancing(true);
    try {
      const res = await leadsAPI.rebalance();
      window.alert(res.data.data?.message || 'Leads rebalanced.');
      await Promise.all([fetchLeads(), fetchBatches()]);
    } catch (err) {
      window.alert(err.response?.data?.error?.message || 'Failed to rebalance leads.');
    } finally {
      setRebalancing(false);
    }
  };

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
            {/*
              Self-service "New Leads" tab — a highlighted shortcut to just-
              assigned, unworked leads (status NEW), separate from the
              default view so nothing already in progress (CONTACTED,
              INTERESTED, etc.) gets hidden by default. Clicking either
              button just sets the existing status filter, so it stays in
              sync with the dropdown below (picking "New" there highlights
              this tab too, and vice versa).
            */}
            {!isMgmt && (
              <>
                <button
                  onClick={() => { setStatusFilter(''); setPage(1); }}
                  className={`btn-secondary flex items-center gap-2 ${statusFilter === '' ? 'bg-primary-50 text-primary-700' : ''}`}
                >
                  All Leads
                </button>
                <button
                  onClick={() => { setStatusFilter('NEW'); setPage(1); }}
                  className={`btn-secondary flex items-center gap-2 ${statusFilter === 'NEW' ? 'bg-primary-50 text-primary-700' : ''}`}
                >
                  New Leads
                  {newLeadsCount > 0 && (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                      {newLeadsCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        }
      />

      {canUpload && <UploadSection onUploaded={() => { fetchLeads(); fetchBatches(); }} />}
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
            <div className="flex items-center gap-1">
              <select
                aria-label="Lead Date Filter"
                className="form-input w-40"
                value={customDate ? 'CUSTOM' : leadDateFilter}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'CUSTOM') {
                    setShowCalendar(true);
                  } else {
                    setCustomDate('');
                    setLeadDateFilter(val);
                    setPage(1);
                  }
                }}
              >
                <option value="">All Leads</option>
                <option value="TODAY">Today's Leads</option>
                <option value="PREVIOUS">Previous Leads</option>
                {customDate && (
                  <option value="CUSTOM">{customDate}</option>
                )}
              </select>

              {/* Calendar Trigger */}
              <div className="relative" ref={calendarRef}>
                <button
                  type="button"
                  aria-label="Calendar Lead Filter"
                  onClick={() => setShowCalendar(prev => !prev)}
                  className={`btn-secondary !p-2 transition-colors ${customDate ? 'border-primary-500 text-primary-600 bg-primary-50' : 'text-gray-600'
                    }`}
                  title={customDate ? `Filtered by ${customDate} (click to change)` : "Select date from calendar"}
                >
                  <Calendar className="h-4 w-4" />
                </button>

                {showCalendar && (
                  <MiniCalendar
                    selectedDate={customDate}
                    onSelectDate={(d) => {
                      setCustomDate(d);
                      if (d) setLeadDateFilter('');
                      setPage(1);
                    }}
                    onClose={() => setShowCalendar(false)}
                  />
                )}
              </div>

              {customDate && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomDate('');
                    setPage(1);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear date filter"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {canUpload && batches.length > 0 && (
              <div className="flex items-center gap-1">
                <select className="form-input w-52" value={batchFilter} onChange={e => { setBatchFilter(e.target.value); setPage(1); }}>
                  <option value="">All Batches</option>
                  {batches.map(b => (
                    <option key={b.batchId} value={b.batchId}>{b.batchId} ({b.total})</option>
                  ))}
                </select>
                {/* Clears out a batch entirely — e.g. leads imported for a test/
                    demo, or before this fix, that you want gone before re-testing
                    the same file (otherwise they're excluded as "already imported"). */}
                <button
                  type="button"
                  onClick={handleDeleteBatch}
                  disabled={!batchFilter || deletingBatch}
                  className="btn-secondary !p-2 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                  title={batchFilter ? `Permanently delete all leads in batch "${batchFilter}"` : 'Select a batch first'}
                >
                  {deletingBatch ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            )}
            {isMgmt && (
              <button
                type="button"
                onClick={handleRebalance}
                disabled={rebalancing}
                className="btn-secondary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                title="Re-split every lead evenly across the current active Sales/Business Development team — use this after hiring someone new to the sales team so they get leads without waiting for the next import."
              >
                {rebalancing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Rebalance across team
              </button>
            )}
            {isMgmt && (
              <button
                type="button"
                onClick={() => setBulkAssignModal(true)}
                disabled={selectedIds.size === 0}
                className="btn-secondary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
                title={selectedIds.size === 0 ? 'Select leads below using the checkboxes first' : `Manually choose who gets these ${selectedIds.size} lead(s), instead of auto-splitting`}
              >
                <RotateCcw className="h-4 w-4" />
                Assign selected{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
              </button>
            )}
            <button onClick={fetchLeads} className="btn-secondary flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <LoadingBlock />
            ) : listError ? (
              <EmptyState
                icon={AlertCircle}
                title="Could not load leads"
                description={listError}
              />
            ) : leads.length === 0 ? (
              <EmptyState title="No leads found" description="Try adjusting your filters or upload a new file." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      {isMgmt && (
                        <th className="px-4 py-3 text-left w-8">
                          <input
                            type="checkbox"
                            checked={leads.length > 0 && leads.every(l => selectedIds.has(l._id))}
                            onChange={toggleSelectAllOnPage}
                            title="Select all on this page"
                          />
                        </th>
                      )}
                      {canSeeRowNumber && <th className="px-4 py-3 text-left">No.</th>}
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
                    {leads.map((lead, idx) => (
                      <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                        {isMgmt && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(lead._id)}
                              onChange={() => toggleSelected(lead._id)}
                            />
                          </td>
                        )}
                        {canSeeRowNumber && (
                          <td className="px-4 py-3 text-xs text-gray-500 font-medium">{(page - 1) * LIMIT + idx + 1}</td>
                        )}
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
                            // EMPLOYEE: masked by default, reveal one at a time for 20s
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
                                <Eye className="h-3 w-3" /> Reveal (20s)
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
      {bulkAssignModal && (
        <BulkAssignModal
          leadIds={Array.from(selectedIds)}
          onClose={() => setBulkAssignModal(false)}
          onUpdated={() => { setSelectedIds(new Set()); fetchLeads(); }}
        />
      )}
      {historyModal && (
        <LeadHistoryModal leadId={historyModal} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  );
}