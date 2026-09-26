import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, Plus, Star, CheckCircle2, FileText, ClipboardList, Trash2, Send, Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { performanceAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, LoadingBlock, ConfirmDialog,
} from '../components/ui';
import { PERFORMANCE_REVIEW_STATUSES, RATING_LABELS, DEPARTMENTS } from '../constants';
import { formatDate, errorMessage } from '../lib/format';

/**
 * A management-tier role (HR_ADMIN, PROJECT_HEAD, MANAGER/"Sales Team Lead",
 * plus elevated) has `managePerformanceReviews` and therefore used to see
 * ONLY the admin/review-others view here — with no way to see their OWN
 * performance, even though HR's/a manager's own performance is judged by
 * the CEO/CTO/Project Head just like anyone else's (getMyReviews on the
 * server already supports any authenticated user with a linked Employee
 * record — GET /performance-reviews/me has no extra role gate — so this is
 * purely a client-side visibility gap). Anyone who can manage reviews now
 * gets both views behind a tab switcher; everyone else (plain EMPLOYEE,
 * FINANCE, DIRECTOR, IT_HEAD, AUDITOR) keeps seeing just their own reviews.
 */
export default function Performance() {
  const { can } = useAuth();
  const canManage = can('managePerformanceReviews');
  const [tab, setTab] = useState('team');

  if (!canManage) return <MyReviewsView />;

  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        <button
          type="button"
          onClick={() => setTab('team')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'team' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Team Reviews
        </button>
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'mine' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          My Performance
        </button>
      </div>
      {tab === 'team' ? <PerformanceAdminView /> : <MyReviewsView embedded />}
    </div>
  );
}

function RatingStars({ value }) {
  if (!value) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1" title={RATING_LABELS[Math.round(value)]}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
      <span className="text-sm font-medium text-gray-800">{value.toFixed(1)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Employee view — own submitted/completed reviews only                */
/* ------------------------------------------------------------------ */

function MyReviewsView({ embedded = false }) {
  const [viewing, setViewing] = useState(null);
  const query = useQuery({ queryKey: ['performance', 'my-reviews'], queryFn: () => performanceAPI.myReviews() });
  const rows = query.data?.data?.data || [];

  return (
    <div>
      <PageHeader
        title="My Performance"
        subtitle={embedded ? 'Reviews written about you by the CEO, CTO, or your Project Head' : 'Your performance reviews and feedback'}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Reviews Received" value={rows.length} icon={ClipboardList} tone="indigo" onClick={() => document.getElementById('my-reviews-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <StatCard
          label="Average Rating"
          value={rows.length ? (rows.reduce((s, r) => s + (r.overallRating || 0), 0) / rows.filter((r) => r.overallRating).length || 0).toFixed(1) : '—'}
          icon={Award}
          tone="purple"
          onClick={() => document.getElementById('my-reviews-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      </div>

      <div className="mt-6" id="my-reviews-table">
        <DataTable
          columns={[
            { key: 'period', header: 'Review Period', render: (r) => r.reviewPeriod },
            { key: 'reviewer', header: 'Reviewer', render: (r) => r.reviewer?.email || '—' },
            { key: 'rating', header: 'Overall Rating', render: (r) => <RatingStars value={r.overallRating} /> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'actions', header: '', render: (r) => <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setViewing(r)}>View</button> },
          ]}
          rows={rows}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          empty={<EmptyState icon={TrendingUp} title="No reviews yet" description="Your performance reviews will appear here once HR/Admin submits one." />}
        />
      </div>

      <ReviewDetailModal review={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function ReviewDetailModal({ review, onClose }) {
  if (!review) return <Modal open={false} onClose={onClose} title="" />;
  return (
    <Modal open onClose={onClose} title={`Performance Review — ${review.reviewPeriod}`} size="lg">
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-4">
          <div>
            <p className="text-xs text-gray-400">Overall Rating</p>
            <div className="mt-1"><RatingStars value={review.overallRating} /></div>
          </div>
          <StatusBadge status={review.status} />
        </div>
        {review.criteria?.length > 0 && (
          <div className="space-y-3">
            <h3 className="section-title">Criteria</h3>
            {review.criteria.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{c.category}</p>
                  <RatingStars value={c.rating} />
                </div>
                {c.comments && <p className="mt-1 text-sm text-gray-600">{c.comments}</p>}
              </div>
            ))}
          </div>
        )}
        {review.overallComments && (
          <div>
            <h3 className="section-title mb-2">Overall Comments</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{review.overallComments}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Admin / HR view                                                      */
/* ------------------------------------------------------------------ */

function PerformanceAdminView() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', reviewPeriod: '', status: '', department: '' });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const statsQuery = useQuery({ queryKey: ['performance', 'stats'], queryFn: () => performanceAPI.stats() });
  const listQuery = useQuery({ queryKey: ['performance', 'list', filters], queryFn: () => performanceAPI.list(filters) });
  const stats = statsQuery.data?.data?.data;
  const rows = listQuery.data?.data?.data || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['performance'] });

  return (
    <div>
      <PageHeader
        title="Performance Reviews"
        subtitle="Create, review, and track employee performance"
        actions={<button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Review</button>}
      />

      {statsQuery.isLoading ? <StatCardSkeleton count={3} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Reviews" value={stats?.total ?? 0} icon={ClipboardList} tone="indigo" onClick={() => setFilter('status', '')} />
          <StatCard label="Active Reviews" value={(stats?.draft ?? 0) + (stats?.submitted ?? 0)} icon={FileText} tone="amber" hint={`${stats?.draft ?? 0} draft, ${stats?.submitted ?? 0} submitted`} onClick={() => setFilter('status', 'SUBMITTED')} />
          <StatCard label="Completed" value={stats?.completed ?? 0} icon={CheckCircle2} tone="green" onClick={() => setFilter('status', 'COMPLETED')} />
        </div>
      )}

      <div className="mt-6">
        <FilterBar onReset={() => setFilters({ search: '', reviewPeriod: '', status: '', department: '' })}>
          <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search employee…" />
          <div>
            <label className="label">Review Period</label>
            <input className="input w-40" value={filters.reviewPeriod} onChange={(e) => setFilter('reviewPeriod', e.target.value)} placeholder="e.g. Q1 2025" />
          </div>
          <div>
            <label className="label">Status</label>
            <Select className="w-40" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={PERFORMANCE_REVIEW_STATUSES} placeholder="All statuses" />
          </div>
          <div>
            <label className="label">Department</label>
            <Select className="w-44" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} options={DEPARTMENTS} placeholder="All departments" />
          </div>
        </FilterBar>

        <DataTable
          columns={[
            {
              key: 'employee',
              header: 'Employee',
              render: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.employee?.fullName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{r.employee?.fullName}</p>
                    <p className="truncate text-xs text-gray-400">{r.employee?.employeeCode}</p>
                  </div>
                </div>
              ),
            },
            { key: 'department', header: 'Department', render: (r) => r.department },
            { key: 'period', header: 'Review Period', render: (r) => r.reviewPeriod },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'rating', header: 'Overall Rating', render: (r) => <RatingStars value={r.overallRating} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => (
                <div className="flex justify-end gap-2">
                  <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setViewing(r)}>View</button>
                  {r.status === 'DRAFT' && (
                    <button type="button" className="text-xs font-medium text-gray-600 hover:underline" onClick={() => setEditing(r)}>Edit</button>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
          isLoading={listQuery.isLoading}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          empty={<EmptyState icon={TrendingUp} title="No employees found" description="Create a performance review to get started." action={<button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Review</button>} />}
        />
      </div>

      <ReviewFormModal open={creating || Boolean(editing)} review={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={refresh} />
      <ReviewManageModal review={viewing} onClose={() => setViewing(null)} onSaved={refresh} onEdit={(r) => { setViewing(null); setEditing(r); }} />
    </div>
  );
}

function ReviewFormModal({ open, review, onClose, onSaved }) {
  const isEdit = Boolean(review);
  const empty = { employeeId: '', reviewPeriod: '', criteria: [{ category: '', rating: 3, comments: '' }], overallComments: '' };
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState('');
  const [loadedFor, setLoadedFor] = useState(null);

  // Reviewable employees only: for a Sales Team Lead (MANAGER) this returns
  // just their own reports, so the picker can never offer someone the server
  // would reject; for HR/elevated it returns everyone. The search box filters
  // this list client-side so the options always match what the server accepts.
  const employeesQuery = useQuery({
    queryKey: ['performance', 'reviewable-employees'],
    queryFn: () => performanceAPI.reviewableEmployees(),
    enabled: open && !isEdit,
  });
  const allReviewable = employeesQuery.data?.data?.data || [];
  const employees = search.trim()
    ? allReviewable.filter((e) => {
      const q = search.trim().toLowerCase();
      return (e.fullName || '').toLowerCase().includes(q) || (e.employeeCode || '').toLowerCase().includes(q);
    })
    : allReviewable;

  if (open && isEdit && loadedFor !== review._id) {
    setForm({
      employeeId: review.employee?._id, reviewPeriod: review.reviewPeriod,
      criteria: review.criteria?.length ? review.criteria : [{ category: '', rating: 3, comments: '' }],
      overallComments: review.overallComments || '',
    });
    setLoadedFor(review._id);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? performanceAPI.update(review._id, data) : performanceAPI.create(data)),
    onSuccess: () => { toast.success(isEdit ? 'Draft saved' : 'Review created as draft'); onSaved(); close(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function close() { setForm(empty); setSearch(''); setLoadedFor(null); onClose(); }

  const updateCriterion = (i, patch) => setForm((f) => ({ ...f, criteria: f.criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  const addCriterion = () => setForm((f) => ({ ...f, criteria: [...f.criteria, { category: '', rating: 3, comments: '' }] }));
  const removeCriterion = (i) => setForm((f) => ({ ...f, criteria: f.criteria.filter((_, idx) => idx !== i) }));

  const submit = (e) => {
    e.preventDefault();
    if (!isEdit && !form.employeeId) { toast.error('Select an employee.'); return; }
    if (!form.reviewPeriod.trim()) { toast.error('Enter a review period.'); return; }
    const criteria = form.criteria.filter((c) => c.category.trim());
    save.mutate({ ...form, criteria });
  };

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit draft review' : 'New performance review'} size="lg">
      <form onSubmit={submit} className="space-y-4 p-5">
        {!isEdit && (
          <FormField label="Employee" required>
            <Select
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              options={employees.map((e) => ({ value: e._id, label: `${e.fullName} (${e.employeeCode})` }))}
              placeholder="Select an employee"
            />
          </FormField>
        )}
        <FormField label="Review Period" required>
          <input className="input" value={form.reviewPeriod} onChange={(e) => setForm({ ...form, reviewPeriod: e.target.value })} placeholder="e.g. Q1 2025, Annual 2025" />
        </FormField>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Criteria & Ratings</label>
            <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={addCriterion}>+ Add criterion</button>
          </div>
          <div className="space-y-3">
            {form.criteria.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_auto]">
                  <input className="input" placeholder="e.g. Communication, Quality of Work" value={c.category} onChange={(e) => updateCriterion(i, { category: e.target.value })} />
                  <Select value={String(c.rating)} onChange={(e) => updateCriterion(i, { rating: Number(e.target.value) })} options={Object.entries(RATING_LABELS).map(([v, l]) => ({ value: v, label: `${v} — ${l}` }))} />
                  <button type="button" className="btn-ghost text-red-500" onClick={() => removeCriterion(i)} disabled={form.criteria.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea className="input mt-2 min-h-[60px]" placeholder="Comments (optional)" value={c.comments} onChange={(e) => updateCriterion(i, { comments: e.target.value })} />
              </div>
            ))}
          </div>
        </div>

        <FormField label="Overall Comments">
          <textarea className="input min-h-[80px]" value={form.overallComments} onChange={(e) => setForm({ ...form, overallComments: e.target.value })} />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save Draft'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewManageModal({ review, onClose, onSaved, onEdit }) {
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submit = useMutation({
    mutationFn: () => performanceAPI.submit(review._id),
    onSuccess: () => { toast.success('Review submitted'); onSaved(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const complete = useMutation({
    mutationFn: () => performanceAPI.complete(review._id),
    onSuccess: () => { toast.success('Review marked complete'); onSaved(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const remove = useMutation({
    mutationFn: () => performanceAPI.remove(review._id),
    onSuccess: () => { toast.success('Draft deleted'); onSaved(); onClose(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!review) return <Modal open={false} onClose={onClose} title="" />;

  return (
    <Modal open onClose={onClose} title={`${review.employee?.fullName} — ${review.reviewPeriod}`} size="lg">
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-4">
          <div>
            <p className="text-xs text-gray-400">Overall Rating</p>
            <div className="mt-1"><RatingStars value={review.overallRating} /></div>
          </div>
          <StatusBadge status={review.status} />
        </div>
        {review.criteria?.length > 0 && (
          <div className="space-y-3">
            <h3 className="section-title">Criteria</h3>
            {review.criteria.map((c, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{c.category}</p>
                  <RatingStars value={c.rating} />
                </div>
                {c.comments && <p className="mt-1 text-sm text-gray-600">{c.comments}</p>}
              </div>
            ))}
          </div>
        )}
        {review.overallComments && (
          <div>
            <h3 className="section-title mb-2">Overall Comments</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{review.overallComments}</p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
        {review.status === 'DRAFT' && (
          <>
            <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>
            <button type="button" className="btn-secondary" onClick={() => onEdit(review)}>Edit</button>
            <button type="button" className="btn-primary" onClick={() => setConfirmingSubmit(true)}><Send className="h-4 w-4" /> Submit</button>
          </>
        )}
        {review.status === 'SUBMITTED' && (
          <button type="button" className="btn-primary" onClick={() => setConfirmingComplete(true)}><CheckCircle2 className="h-4 w-4" /> Mark Complete</button>
        )}
      </div>

      <ConfirmDialog open={confirmingSubmit} onClose={() => setConfirmingSubmit(false)} onConfirm={() => submit.mutate()} loading={submit.isPending} tone="primary" title="Submit review" message="Once submitted, the employee will be able to see this review and it can no longer be edited. Continue?" confirmLabel="Submit" />
      <ConfirmDialog open={confirmingComplete} onClose={() => setConfirmingComplete(false)} onConfirm={() => complete.mutate()} loading={complete.isPending} tone="primary" title="Mark review complete" message="This finalises the review cycle for this employee. Continue?" confirmLabel="Mark Complete" />
      <ConfirmDialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} title="Delete draft" message="This draft review will be permanently deleted. Continue?" confirmLabel="Delete" />
    </Modal>
  );
}