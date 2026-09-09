import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, Building2, Upload, Search, RefreshCw, ChevronLeft, ChevronRight, Filter, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const STATUS_COLORS = {
  NEW:            'bg-blue-100 text-blue-700',
  CONTACTED:      'bg-yellow-100 text-yellow-700',
  INTERESTED:     'bg-green-100 text-green-700',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
  CONVERTED:      'bg-emerald-100 text-emerald-700',
  LOST:           'bg-gray-100 text-gray-500',
};

const STATUS_OPTIONS = ['NEW', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED', 'LOST'];

/** Roles that may upload leads (mirrors the server-side canUpload check) */
const UPLOAD_ROLES = ['FOUNDER_CEO', 'CTO', 'SUPER_ADMIN', 'PROJECT_HEAD'];

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

function UploadSection({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/leads/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card mb-6">
      <h2 className="mb-4 text-base font-semibold text-gray-800">Upload Leads File</h2>
      <p className="mb-3 text-sm text-gray-500">
        Upload a <strong>CSV</strong> or <strong>Excel (.xlsx)</strong> file. Required column: <code className="rounded bg-gray-100 px-1">name</code>.{' '}
        Optional: <code className="rounded bg-gray-100 px-1">phone</code>, <code className="rounded bg-gray-100 px-1">email</code>,{' '}
        <code className="rounded bg-gray-100 px-1">company</code>, <code className="rounded bg-gray-100 px-1">status</code>,{' '}
        <code className="rounded bg-gray-100 px-1">notes</code>.
        Leads will be <strong>distributed equally</strong> among the Sales team.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(''); }}
          />
          <span className="btn-secondary flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {file ? file.name : 'Choose File'}
          </span>
        </label>

        {file && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary flex items-center gap-2"
          >
            {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Import & Distribute'}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          <p className="font-semibold mb-1">✅ {result.message}</p>
          {result.skipped > 0 && <p className="text-green-700">{result.skipped} rows skipped.</p>}
          {result.distribution && result.distribution.length > 0 && (
            <div className="mt-3">
              <p className="font-medium text-green-700 mb-2">Distribution ({result.distributionNote}):</p>
              <div className="flex flex-wrap gap-2">
                {result.distribution.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    <User className="h-3 w-3" /> {d.name} — {d.assigned} lead{d.assigned !== 1 ? 's' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.salesTeamCount === 0 && (
            <p className="mt-2 text-yellow-700 bg-yellow-50 rounded p-2">
              ⚠️ No active Sales department employees found. Leads imported but not assigned. Add employees with department "Sales" to enable auto-distribution.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LeadRow({ lead, canSeeAssignment, onStatusChange }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/leads/${lead._id}/status`, { status, notes });
      onStatusChange();
      setEditing(false);
    } catch {
      // keep editing open on error
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{lead.name}</p>
        {lead.company && <p className="text-xs text-gray-400">{lead.company}</p>}
      </td>
      <td className="px-4 py-3">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
            <Phone className="h-3.5 w-3.5" /> {lead.phone}
          </a>
        ) : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3">
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-sm text-primary-600 hover:underline">
            <Mail className="h-3.5 w-3.5" /> {lead.email}
          </a>
        ) : <span className="text-xs text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3">
        {lead.company ? (
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <Building2 className="h-3.5 w-3.5 text-gray-400" /> {lead.company}
          </span>
        ) : <span className="text-xs text-gray-400">—</span>}
      </td>
      {canSeeAssignment && (
        <td className="px-4 py-3 text-sm text-gray-600">
          {lead.assignedTo?.fullName
            ? <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-gray-400" />{lead.assignedTo.fullName}</span>
            : <span className="text-xs text-gray-400">Unassigned</span>}
        </td>
      )}
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-sm text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        ) : (
          <StatusBadge status={lead.status} />
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{lead.notes || '—'}</td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes…"
              className="input-sm text-xs w-28"
            />
            <button onClick={save} disabled={saving} className="btn-primary btn-xs">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost btn-xs">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="btn-ghost btn-xs text-xs">
            Update
          </button>
        )}
      </td>
    </tr>
  );
}

export default function SalesLeads() {
  const { role, isElevated } = useAuth();
  const canUpload = UPLOAD_ROLES.includes(role);
  // Elevated users and upload-permitted roles can see who leads are assigned to
  const canSeeAssignment = isElevated || canUpload;

  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/leads?${params}`);
      setLeads(res.data.data);
      setMeta(res.data.meta);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.total} lead{meta.total !== 1 ? 's' : ''} total
            {!canSeeAssignment && ' — showing your assigned leads'}
          </p>
        </div>
      </div>

      {/* Upload section — FOUNDER_CEO, CTO, PROJECT_HEAD */}
      {canUpload && <UploadSection onUploaded={fetchLeads} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, phone, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <button onClick={fetchLeads} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Phone className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">No leads found</p>
            {canUpload && <p className="text-sm mt-1">Upload a CSV or Excel file above to get started.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
                  {canSeeAssignment && (
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Assigned To</th>
                  )}
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Notes</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadRow
                    key={lead._id}
                    lead={lead}
                    canSeeAssignment={canSeeAssignment}
                    onStatusChange={fetchLeads}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500">
              Page {meta.page} of {meta.totalPages} — {meta.total} leads
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost btn-xs"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="btn-ghost btn-xs"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
