import { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, ChevronLeft, ChevronRight, Eye, Send, CheckCircle2,
  AlertCircle, Clock, Filter, X, FileText, Edit2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dailyReportAPI } from '../api/axios';
import { PageHeader, Spinner, EmptyState, LoadingBlock } from '../components/ui';

const STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  REVIEWED: 'bg-green-100 text-green-700',
  NEEDS_REVISION: 'bg-orange-100 text-orange-700',
};

const MGMT_ROLES = ['FOUNDER_CEO', 'CTO', 'SUPER_ADMIN', 'PROJECT_HEAD', 'HR_ADMIN', 'MANAGER', 'DIRECTOR'];

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
}

// ── Report Form ───────────────────────────────────────────────────────────────
function ReportForm({ existing, onSaved, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: existing?.date ? new Date(existing.date).toISOString().slice(0, 10) : today,
    workSummary: existing?.workSummary || '',
    tasksCompleted: existing?.tasksCompleted || '',
    tasksInProgress: existing?.tasksInProgress || '',
    blockers: existing?.blockers || '',
    nextDayPlan: existing?.nextDayPlan || '',
    additionalNotes: existing?.additionalNotes || '',
    hoursWorked: existing?.hoursWorked || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async (andSubmit = false) => {
    if (!form.workSummary.trim()) { setError('Work summary is required.'); return; }
    setSaving(true);
    setError('');
    try {
      let report;
      if (existing) {
        const r = await dailyReportAPI.update(existing._id, form);
        report = r.data.data;
      } else {
        const r = await dailyReportAPI.create(form);
        report = r.data.data;
      }
      if (andSubmit) {
        await dailyReportAPI.submit(report._id);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save report.');
      setSaving(false);
    }
  };

  const fields = [
    { key: 'workSummary', label: 'Work Summary *', placeholder: 'What did you work on today?', rows: 3 },
    { key: 'tasksCompleted', label: 'Tasks Completed', placeholder: 'List tasks you completed today…', rows: 2 },
    { key: 'tasksInProgress', label: 'Tasks In Progress', placeholder: 'Ongoing tasks…', rows: 2 },
    { key: 'blockers', label: 'Problems / Blockers', placeholder: 'Any blockers or issues?', rows: 2 },
    { key: 'nextDayPlan', label: 'Next Day Plan', placeholder: 'What will you work on tomorrow?', rows: 2 },
    { key: 'additionalNotes', label: 'Additional Notes', placeholder: 'Anything else to note…', rows: 2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">{existing ? 'Edit' : 'Create'} Daily Report</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Date</label>
              <input type="date" className="form-input" value={form.date} onChange={set('date')} max={today} disabled={!!existing} />
            </div>
            <div>
              <label className="form-label">Hours Worked</label>
              <input type="number" className="form-input" value={form.hoursWorked} onChange={set('hoursWorked')} placeholder="e.g. 8" min="0" max="24" step="0.5" />
            </div>
          </div>

          {fields.map(({ key, label, placeholder, rows }) => (
            <div key={key}>
              <label className="form-label">{label}</label>
              <textarea
                className="form-input"
                rows={rows}
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
              />
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary flex items-center gap-2">
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4" /> Save & Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Report Detail Modal ───────────────────────────────────────────────────────
function ReportDetailModal({ reportId, canReview, onClose, onUpdated }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState('REVIEWED');
  const [reviewerComments, setReviewerComments] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    dailyReportAPI.get(reportId).then(r => setReport(r.data.data)).finally(() => setLoading(false));
  }, [reportId]);

  const handleReview = async () => {
    setReviewing(true);
    try {
      await dailyReportAPI.review(reportId, { status: reviewStatus, reviewerComments });
      onUpdated();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Review failed.');
      setReviewing(false);
    }
  };

  const fmt = (date) => date ? new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">Daily Report Detail</h2>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {loading ? <LoadingBlock /> : !report ? <p className="text-sm text-gray-500">Not found.</p> : (
            <>
              <div className="flex flex-wrap gap-4 text-sm border-b border-gray-100 pb-4">
                <div>
                  <span className="text-gray-500">Employee:</span>{' '}
                  <span className="font-medium">{report.employee?.fullName}</span>{' '}
                  <span className="text-gray-400">({report.employee?.employeeCode})</span>
                </div>
                <div>
                  <span className="text-gray-500">Dept:</span>{' '}
                  <span className="font-medium">{report.employee?.department}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date:</span>{' '}
                  <span className="font-medium">{new Date(report.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
                <div><StatusBadge status={report.status} /></div>
                {report.hoursWorked && <div><span className="text-gray-500">Hours:</span> <span className="font-medium">{report.hoursWorked}h</span></div>}
                {report.submittedAt && <div><span className="text-gray-500">Submitted:</span> <span className="font-medium">{fmt(report.submittedAt)}</span></div>}
              </div>

              {[
                { label: 'Work Summary', value: report.workSummary },
                { label: 'Tasks Completed', value: report.tasksCompleted },
                { label: 'Tasks In Progress', value: report.tasksInProgress },
                { label: 'Blockers', value: report.blockers },
                { label: 'Next Day Plan', value: report.nextDayPlan },
                { label: 'Additional Notes', value: report.additionalNotes },
              ].filter(f => f.value).map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                </div>
              ))}

              {report.reviewerComments && (
                <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                  <p className="text-xs font-semibold text-green-700 mb-1">Reviewer Comments</p>
                  <p className="text-sm text-green-800">{report.reviewerComments}</p>
                  <p className="text-xs text-gray-400 mt-1">Reviewed by {report.reviewedBy?.email} · {fmt(report.reviewedAt)}</p>
                </div>
              )}

              {canReview && report.status === 'SUBMITTED' && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-semibold">Mark as Reviewed</p>
                  <div className="flex gap-3">
                    <select className="form-input flex-1" value={reviewStatus} onChange={e => setReviewStatus(e.target.value)}>
                      <option value="REVIEWED">Reviewed</option>
                      <option value="NEEDS_REVISION">Needs Revision</option>
                    </select>
                  </div>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={reviewerComments}
                    onChange={e => setReviewerComments(e.target.value)}
                    placeholder="Optional comments for the employee…"
                  />
                  <button onClick={handleReview} disabled={reviewing} className="btn-primary flex items-center gap-2">
                    {reviewing && <RefreshCw className="h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4" /> Submit Review
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DailyReports() {
  const { user, isElevated } = useAuth();
  const role = user?.role;
  const isMgmt = MGMT_ROLES.includes(role) || isElevated;
  const isEmployee = role === 'EMPLOYEE';

  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editReport, setEditReport] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) { params.startDate = dateFilter; params.endDate = dateFilter; }
      const res = isMgmt
        ? await dailyReportAPI.list(params)
        : await dailyReportAPI.mine(params);
      setReports(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateFilter, isMgmt]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    if (isMgmt) {
      dailyReportAPI.stats().then(r => setStats(r.data.data)).catch(() => {});
    }
  }, [isMgmt]);

  const handleSubmitExisting = async (report) => {
    try {
      await dailyReportAPI.submit(report._id);
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Submit failed.');
    }
  };

  const fmt = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      <PageHeader
        title="Daily Reports"
        subtitle={isMgmt ? 'Review team daily work reports' : 'Log your daily work progress'}
        actions={
          !isMgmt && (
            <button onClick={() => { setEditReport(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> New Report
            </button>
          )
        }
      />

      {isMgmt && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {[
            { label: "Today's Reports", value: stats.todayCount, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Pending Review', value: stats.pendingReview, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Total Submitted', value: stats.byStatus?.SUBMITTED || 0, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Reviewed', value: stats.byStatus?.REVIEWED || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`card p-4 ${bg}`}>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap gap-3 p-3">
        <select className="form-input w-48" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {['DRAFT', 'SUBMITTED', 'REVIEWED', 'NEEDS_REVISION'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="date"
          className="form-input w-44"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1); }}
        />
        <button onClick={fetchReports} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <LoadingBlock />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports found"
            description={isEmployee ? "Submit your first daily report using the button above." : "No reports match the current filters."}
            action={!isMgmt && (
              <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Report
              </button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  {isMgmt && <th className="px-4 py-3 text-left">Employee</th>}
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Summary</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Submitted</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((report) => (
                  <tr key={report._id} className="hover:bg-gray-50 transition-colors">
                    {isMgmt && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{report.employee?.fullName}</div>
                        <div className="text-xs text-gray-400">{report.employee?.department} · {report.employee?.employeeCode}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium">{fmt(report.date)}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-xs text-gray-600 truncate">{report.workSummary || '—'}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {report.submittedAt ? new Date(report.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setDetailId(report._id)} className="text-gray-400 hover:text-primary-600" title="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        {!isMgmt && report.status === 'DRAFT' && (
                          <>
                            <button onClick={() => { setEditReport(report); setShowForm(true); }} className="text-primary-600 hover:text-primary-800" title="Edit">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleSubmitExisting(report)} className="text-green-600 hover:text-green-800" title="Submit">
                              <Send className="h-4 w-4" />
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
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
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

      {showForm && (
        <ReportForm
          existing={editReport}
          onSaved={fetchReports}
          onClose={() => { setShowForm(false); setEditReport(null); }}
        />
      )}

      {detailId && (
        <ReportDetailModal
          reportId={detailId}
          canReview={isMgmt}
          onClose={() => setDetailId(null)}
          onUpdated={fetchReports}
        />
      )}
    </div>
  );
}