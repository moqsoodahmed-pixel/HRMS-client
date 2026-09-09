import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  CalendarDays, CalendarPlus, Check, X, Ban, Wallet, Clock, CheckCircle2, XCircle, Plus, PartyPopper,
  ChevronLeft, ChevronRight, Edit,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leaveAPI, employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, Tabs, ConfirmDialog, ProgressBar, LoadingBlock, ErrorState,
} from '../components/ui';
import { LEAVE_STATUSES, DEPARTMENTS, HOLIDAY_TYPES } from '../constants';
import { formatDate, daysBetween, errorMessage, fieldErrors, toDateInput } from '../lib/format';

const PAGE_SIZE = 20;

export default function Leave() {
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  // Lets nav links (e.g. the admin sidebar's "Calendar" entry) deep-link straight
  // into a tab, e.g. /leave?tab=holidays — falls back to the default otherwise.
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'requests');

  const tabs = [
    { value: 'requests', label: 'Requests' },
    { value: 'balances', label: 'My balances' },
    { value: 'holidays', label: 'Holidays' },
    ...(can('manageLeaveSettings') ? [{ value: 'types', label: 'Leave types' }] : []),
  ];

  const isHolidays = tab === 'holidays';

  return (
    <div>
      <PageHeader
        title={isHolidays ? 'Holiday Calendar' : 'Leave Management'}
        subtitle={isHolidays ? 'Manage company holidays' : 'Requests, balances, holidays and leave policy setup'}
      />
      {!isHolidays && <LeaveSummary />}
      <div className="mt-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === 'requests' && <LeaveRequests />}
        {tab === 'balances' && <LeaveBalances />}
        {tab === 'holidays' && <Holidays />}
        {tab === 'types' && <LeaveTypes />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LeaveSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['leave', 'stats'],
    queryFn: () => leaveAPI.stats(),
  });
  const stats = data?.data?.data;

  if (isLoading) return <StatCardSkeleton count={5} />;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard label="Available Leave" value={stats?.hasOwnBalance ? `${stats.availableDays} d` : '—'} icon={Wallet} tone="indigo" hint={stats?.hasOwnBalance ? 'Across all leave types' : 'No employee profile linked'} />
      <StatCard label="Used Leave" value={stats?.hasOwnBalance ? `${stats.usedDays} d` : '—'} icon={CalendarDays} tone="purple" />
      <StatCard label="Pending Requests" value={stats?.pending ?? 0} icon={Clock} tone="amber" />
      <StatCard label="Approved" value={stats?.approved ?? 0} icon={CheckCircle2} tone="green" hint={`${stats?.approvedDays ?? 0} day(s)`} />
      <StatCard label="Rejected" value={stats?.rejected ?? 0} icon={XCircle} tone="red" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function LeaveRequests() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ status: '', leaveType: '', startDate: '', endDate: '', department: '', search: '', employeeId: '' });
  const [page, setPage] = useState(1);
  const [applyOpen, setApplyOpen] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters({ status: '', leaveType: '', startDate: '', endDate: '', department: '', search: '', employeeId: '' }); setPage(1); };

  const requests = useQuery({
    queryKey: ['leave', 'requests', filters, page],
    queryFn: () => leaveAPI.requests({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const types = useQuery({ queryKey: ['leave', 'types'], queryFn: () => leaveAPI.types(), staleTime: 5 * 60 * 1000 });

  const rows = requests.data?.data?.data || [];
  const meta = requests.data?.data?.meta;
  const leaveTypes = types.data?.data?.data || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leave'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const approve = useMutation({
    mutationFn: (id) => leaveAPI.approve(id),
    onSuccess: () => { toast.success('Leave approved'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }) => leaveAPI.reject(id, reason),
    onSuccess: () => { toast.success('Leave rejected'); refresh(); setRejecting(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const cancel = useMutation({
    mutationFn: (id) => leaveAPI.cancel(id),
    onSuccess: () => { toast.success('Leave cancelled'); refresh(); setCancelling(null); },
    onError: (err) => { toast.error(errorMessage(err)); setCancelling(null); },
  });

  const columns = useMemo(() => [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.employee?.fullName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-gray-900">{row.employee?.fullName || 'Unknown'}</p>
            <p className="truncate text-xs text-gray-400">{row.employee?.employeeCode} · {row.employee?.department}</p>
          </div>
        </div>
      ),
    },
    { key: 'type', header: 'Leave Type', render: (row) => row.leaveType?.name || '—' },
    { key: 'start', header: 'Start', render: (row) => formatDate(row.startDate) },
    { key: 'end', header: 'End', render: (row) => formatDate(row.endDate) },
    { key: 'days', header: 'Days', render: (row) => <span className="font-medium">{row.totalDays}{row.isHalfDay ? ' (half)' : ''}</span> },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => <span className="block max-w-[18rem] truncate text-gray-600" title={row.reason}>{row.reason}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'applied', header: 'Applied', render: (row) => formatDate(row.createdAt) },
    {
      key: 'approver',
      header: 'Approver',
      render: (row) => {
        const approver = row.approvedBy || row.rejectedBy;
        return approver ? <span className="text-xs text-gray-500">{approver.email}</span> : <span className="text-gray-300">—</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        if (row.status !== 'PENDING') {
          return row.status === 'REJECTED' && row.rejectionReason
            ? <span className="block max-w-[12rem] truncate text-xs text-gray-400" title={row.rejectionReason}>{row.rejectionReason}</span>
            : <span className="text-gray-300">—</span>;
        }
        return (
          <div className="flex items-center gap-1">
            {can('approveLeave') && (
              <>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-green-600 transition hover:bg-green-50 disabled:opacity-40"
                  onClick={() => approve.mutate(row._id)}
                  disabled={approve.isPending}
                  title="Approve"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                  onClick={() => setRejecting(row)}
                  title="Reject"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100"
              onClick={() => setCancelling(row)}
              title="Cancel request"
            >
              <Ban className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ], [can, approve]);

  return (
    <div>
      {can('applyLeave') && (
        <div className="mb-4 flex justify-end">
          <button type="button" className="btn-primary" onClick={() => setApplyOpen(true)}>
            <CalendarPlus className="h-4 w-4" /> Apply for leave
          </button>
        </div>
      )}

      <FilterBar onReset={resetFilters}>
        <SearchInput className="min-w-[13rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search employee…" />
        <div>
          <label className="label">Status</label>
          <Select className="w-36" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={LEAVE_STATUSES} placeholder="All statuses" />
        </div>
        <div>
          <label className="label">Leave type</label>
          <Select
            className="w-40"
            value={filters.leaveType}
            onChange={(e) => setFilter('leaveType', e.target.value)}
            options={leaveTypes.map((t) => ({ value: t._id, label: t.name }))}
            placeholder="All types"
          />
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-40" value={filters.startDate} onChange={(e) => setFilter('startDate', e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-40" value={filters.endDate} onChange={(e) => setFilter('endDate', e.target.value)} />
        </div>
        {can('viewTeamFilters') && (
          <div>
            <label className="label">Department</label>
            <Select className="w-44" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} options={DEPARTMENTS} placeholder="All departments" />
          </div>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={requests.isLoading}
        error={requests.error}
        onRetry={requests.refetch}
        empty={
          <EmptyState
            icon={CalendarDays}
            title="No leave requests"
            description="Nothing matches the current filters."
            action={can('applyLeave') ? <button type="button" className="btn-primary" onClick={() => setApplyOpen(true)}><CalendarPlus className="h-4 w-4" /> Apply for leave</button> : null}
          />
        }
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />

      <ApplyLeaveModal open={applyOpen} onClose={() => setApplyOpen(false)} leaveTypes={leaveTypes} onSaved={refresh} />

      <RejectModal
        request={rejecting}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => reject.mutate({ id: rejecting._id, reason })}
        loading={reject.isPending}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling._id)}
        loading={cancel.isPending}
        title="Cancel leave request"
        message={cancelling ? `Cancel the ${cancelling.leaveType?.name || 'leave'} request from ${formatDate(cancelling.startDate)} to ${formatDate(cancelling.endDate)}? This cannot be undone.` : ''}
        confirmLabel="Cancel request"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ApplyLeaveModal({ open, onClose, leaveTypes, onSaved }) {
  const { can } = useAuth();
  const empty = { leaveType: '', startDate: '', endDate: '', reason: '', isHalfDay: false, halfDayType: 'FIRST_HALF', employee: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const employees = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    enabled: open && can('manageLeaveSettings'),
    staleTime: 5 * 60 * 1000,
  });
  const staff = employees.data?.data?.data?.managers || [];

  const balances = useQuery({
    queryKey: ['leave', 'balances', 'me'],
    queryFn: () => leaveAPI.myBalances(),
    enabled: open,
  });
  const myBalances = balances.data?.data?.data || [];
  const selectedBalance = myBalances.find((b) => b.leaveType?._id === form.leaveType);

  const days = form.isHalfDay ? 0.5 : daysBetween(form.startDate, form.endDate);

  const save = useMutation({
    mutationFn: (data) => leaveAPI.create(data),
    onSuccess: () => { toast.success('Leave request submitted'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.leaveType) next.leaveType = 'Choose a leave type.';
    if (!form.startDate) next.startDate = 'Choose a start date.';
    if (!form.endDate) next.endDate = 'Choose an end date.';
    if (form.startDate && form.endDate && form.endDate < form.startDate) next.endDate = 'End date cannot be before the start date.';
    if (form.isHalfDay && form.startDate !== form.endDate) next.endDate = 'A half day must start and end on the same date.';
    if (!form.reason.trim() || form.reason.trim().length < 3) next.reason = 'Give a reason of at least 3 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = { ...form };
    if (!payload.isHalfDay) delete payload.halfDayType;
    if (!payload.employee) delete payload.employee;
    save.mutate(payload);
  };

  return (
    <Modal open={open} onClose={close} title="Apply for leave" description="Your reporting manager will be notified once the request is submitted.">
      <form onSubmit={submit} className="space-y-4 p-5">
        {can('manageLeaveSettings') && (
          <FormField label="Apply on behalf of" hint="Leave blank to apply for yourself.">
            <Select
              value={form.employee}
              onChange={(e) => setForm({ ...form, employee: e.target.value })}
              options={staff.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
              placeholder="Myself"
            />
          </FormField>
        )}

        <FormField label="Leave type" required error={errors.leaveType}>
          <Select
            value={form.leaveType}
            onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
            options={leaveTypes.map((t) => ({ value: t._id, label: `${t.name} (${t.code})` }))}
            placeholder="Select a leave type"
          />
          {selectedBalance && (
            <p className="mt-1 text-xs text-gray-500">
              {selectedBalance.remainingDays} of {selectedBalance.totalDays} day(s) remaining this year.
            </p>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Start date" required error={errors.startDate}>
            <input
              type="date"
              className="input"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.isHalfDay ? e.target.value : form.endDate })}
            />
          </FormField>
          <FormField label="End date" required error={errors.endDate}>
            <input
              type="date"
              className="input"
              value={form.endDate}
              min={form.startDate || undefined}
              disabled={form.isHalfDay}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </FormField>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={form.isHalfDay}
            onChange={(e) => setForm({ ...form, isHalfDay: e.target.checked, endDate: e.target.checked ? form.startDate : form.endDate })}
          />
          This is a half day
        </label>

        {form.isHalfDay && (
          <FormField label="Half day">
            <Select
              value={form.halfDayType}
              onChange={(e) => setForm({ ...form, halfDayType: e.target.value })}
              options={[{ value: 'FIRST_HALF', label: 'First half' }, { value: 'SECOND_HALF', label: 'Second half' }]}
            />
          </FormField>
        )}

        <div className="rounded-lg bg-primary-50 px-4 py-3">
          <p className="text-sm text-primary-800">
            Total: <span className="font-bold">{days}</span> day{days === 1 ? '' : 's'}
          </p>
        </div>

        <FormField label="Reason" required error={errors.reason}>
          <textarea
            className="input min-h-[80px]"
            value={form.reason}
            maxLength={500}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Briefly explain the reason for this leave"
          />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RejectModal({ request, onClose, onSubmit, loading }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError('A reason is required so the employee knows why.'); return; }
    onSubmit(reason.trim());
  };

  const close = () => { setReason(''); setError(''); onClose(); };

  return (
    <Modal open={Boolean(request)} onClose={close} title="Reject leave request" size="sm"
      description={request ? `${request.employee?.fullName} · ${formatDate(request.startDate)} – ${formatDate(request.endDate)}` : ''}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Reason for rejection" required error={error}>
          <textarea className="input min-h-[90px]" value={reason} maxLength={500} onChange={(e) => { setReason(e.target.value); setError(''); }} />
        </FormField>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={loading}>{loading ? 'Rejecting…' : 'Reject request'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function LeaveBalances() {
  const year = new Date().getFullYear();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leave', 'balances', 'me', year],
    queryFn: () => leaveAPI.myBalances({ year }),
  });
  const balances = data?.data?.data || [];

  if (isLoading) return <LoadingBlock label="Loading balances…" />;
  if (error) return <div className="card"><ErrorState error={error} onRetry={refetch} /></div>;
  if (!balances.length) {
    return (
      <div className="card">
        <EmptyState
          icon={Wallet}
          title="No leave balances"
          description="Balances appear once your account is linked to an employee record with active leave types."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((b) => {
        const used = b.totalDays ? ((b.usedDays + b.pendingDays) / b.totalDays) * 100 : 0;
        return (
          <div key={b._id} className="card p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{b.leaveType?.name}</p>
                <p className="text-xs text-gray-400">{b.leaveType?.code} · {b.leaveType?.isPaid ? 'Paid' : 'Unpaid'} · {b.year}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-600">{b.remainingDays}</p>
                <p className="text-xs text-gray-400">of {b.totalDays} left</p>
              </div>
            </div>
            <ProgressBar value={used} tone={used > 85 ? 'red' : used > 60 ? 'amber' : 'primary'} />
            <div className="mt-3 flex justify-between text-xs text-gray-500">
              <span>Used {b.usedDays}</span>
              <span>Pending {b.pendingDays}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Holidays() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leave', 'holidays', year],
    queryFn: () => leaveAPI.holidays({ year }),
  });
  const allHolidays = data?.data?.data || [];
  const holidays = allHolidays.filter((h) => {
    if (month !== '' && new Date(h.date).getMonth() !== Number(month)) return false;
    if (search && !h.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['leave', 'holidays'] });

  const remove = useMutation({
    mutationFn: (id) => leaveAPI.deleteHoliday(id),
    onSuccess: () => { toast.success('Holiday removed'); refresh(); setRemoving(null); },
    onError: (err) => { toast.error(errorMessage(err)); setRemoving(null); },
  });

  const years = [year - 1, year, year + 1].map(String);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Year</label>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost" onClick={() => setYear((y) => y - 1)} aria-label="Previous year"><ChevronLeft className="h-4 w-4" /></button>
              <Select className="w-28" value={String(year)} onChange={(e) => setYear(Number(e.target.value))} options={years} />
              <button type="button" className="btn-ghost" onClick={() => setYear((y) => y + 1)} aria-label="Next year"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div>
            <label className="label">Month</label>
            <Select className="w-36" value={month} onChange={(e) => setMonth(e.target.value)} options={MONTH_NAMES.map((m, i) => ({ value: String(i), label: m }))} placeholder="All months" />
          </div>
          <SearchInput className="w-56" value={search} onChange={setSearch} placeholder="Search holidays…" />
        </div>
        {can('manageLeaveSettings') && (
          <button type="button" className="btn-primary" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add holiday
          </button>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Holiday', render: (h) => <span className="font-medium text-gray-900">{h.name}</span> },
          { key: 'date', header: 'Date', render: (h) => formatDate(h.date) },
          { key: 'day', header: 'Day', render: (h) => new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long' }) },
          { key: 'type', header: 'Type', render: (h) => <StatusBadge status={h.type} tone={h.type === 'COMPANY' ? 'purple' : h.type === 'OPTIONAL' ? 'amber' : h.type === 'FESTIVAL' ? 'purple' : 'blue'} /> },
          { key: 'description', header: 'Description', render: (h) => <span className="truncate text-xs text-gray-500">{h.description || '—'}</span> },
          ...(can('manageLeaveSettings') ? [{
            key: 'actions',
            header: '',
            render: (h) => (
              <div className="flex items-center gap-1">
                <button type="button" className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100" onClick={() => setEditing(h)} title="Edit holiday">
                  <Edit className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" onClick={() => setRemoving(h)} title="Remove holiday">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ),
          }] : []),
        ]}
        rows={holidays}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={<EmptyState icon={PartyPopper} title={`No holidays for ${year}`} description="Add the company holiday calendar so employees can plan ahead." />}
      />

      <HolidayFormModal open={formOpen || Boolean(editing)} holiday={editing} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={refresh} year={year} />
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing._id)}
        loading={remove.isPending}
        title="Remove holiday"
        message={removing ? `Remove "${removing.name}" from the ${year} holiday calendar?` : ''}
        confirmLabel="Remove"
      />
    </div>
  );
}

function HolidayFormModal({ open, holiday, onClose, onSaved, year }) {
  const isEdit = Boolean(holiday);
  const empty = { name: '', date: '', type: 'NATIONAL', description: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  if (open && isEdit && loadedFor !== holiday._id) {
    setForm({ name: holiday.name, date: holiday.date?.slice(0, 10) || '', type: holiday.type || 'NATIONAL', description: holiday.description || '' });
    setLoadedFor(holiday._id);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? leaveAPI.updateHoliday(holiday._id, data) : leaveAPI.createHoliday(data)),
    onSuccess: () => { toast.success(isEdit ? 'Holiday updated' : 'Holiday added'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setLoadedFor(null); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Give the holiday a name.';
    if (!form.date) next.date = 'Choose a date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit holiday' : 'Add holiday'} size="sm">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Holiday name" required error={errors.name}>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali" />
        </FormField>
        <FormField label="Date" required error={errors.date}>
          <input type="date" className="input" value={form.date} min={`${year}-01-01`} max={`${year}-12-31`} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </FormField>
        <FormField label="Type" required>
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={HOLIDAY_TYPES} />
        </FormField>
        <FormField label="Description" hint="Optional">
          <textarea className="input min-h-[70px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add holiday'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function LeaveTypes() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leave', 'types', 'all'],
    queryFn: () => leaveAPI.types({ includeInactive: true }),
  });
  const types = data?.data?.data || [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['leave', 'types'] });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New leave type
        </button>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name', render: (t) => <span className="font-medium text-gray-900">{t.name}</span> },
          { key: 'code', header: 'Code', render: (t) => <span className="font-mono text-xs">{t.code}</span> },
          { key: 'max', header: 'Days / Year', render: (t) => t.maxDaysPerYear },
          { key: 'paid', header: 'Paid', render: (t) => <StatusBadge status={t.isPaid ? 'APPROVED' : 'CANCELLED'} label={t.isPaid ? 'Paid' : 'Unpaid'} /> },
          { key: 'carry', header: 'Carry Forward', render: (t) => (t.isCarryForward ? `Up to ${t.maxCarryForwardDays || 0} d` : 'No') },
          { key: 'active', header: 'Status', render: (t) => <StatusBadge status={t.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
          {
            key: 'actions',
            header: '',
            render: (t) => (
              <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setEditing(t)}>
                Edit
              </button>
            ),
          },
        ]}
        rows={types}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={<EmptyState icon={CalendarDays} title="No leave types" description="Create the leave types your organisation offers." />}
      />

      <LeaveTypeModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refresh} />
      <LeaveTypeModal open={Boolean(editing)} type={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </div>
  );
}

function LeaveTypeModal({ open, type, onClose, onSaved }) {
  const isEdit = Boolean(type);
  const empty = { name: '', code: '', description: '', maxDaysPerYear: 12, isPaid: true, isCarryForward: false, maxCarryForwardDays: 0, isActive: true };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [initialised, setInitialised] = useState(false);

  // Load the record into the form the first time the edit dialog opens.
  if (open && isEdit && !initialised) {
    setForm({ ...empty, ...type, description: type.description || '', maxCarryForwardDays: type.maxCarryForwardDays || 0 });
    setInitialised(true);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? leaveAPI.updateType(type._id, data) : leaveAPI.createType(data)),
    onSuccess: () => { toast.success(isEdit ? 'Leave type updated' : 'Leave type created'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setInitialised(false); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    if (!form.code.trim()) next.code = 'Code is required.';
    if (form.maxDaysPerYear === '' || Number(form.maxDaysPerYear) < 0) next.maxDaysPerYear = 'Enter zero or more days.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit leave type' : 'New leave type'}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name" required error={errors.name}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Code" required error={errors.code} hint="Short code, up to 6 characters.">
            <input className="input uppercase" maxLength={6} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </FormField>
        </div>
        <FormField label="Description">
          <textarea className="input min-h-[70px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Days per year" required error={errors.maxDaysPerYear}>
            <input type="number" min="0" max="365" className="input" value={form.maxDaysPerYear} onChange={(e) => setForm({ ...form, maxDaysPerYear: e.target.value })} />
          </FormField>
          <FormField label="Carry forward limit" hint="Only used when carry forward is on.">
            <input type="number" min="0" max="365" className="input" value={form.maxCarryForwardDays} disabled={!form.isCarryForward} onChange={(e) => setForm({ ...form, maxCarryForwardDays: e.target.value })} />
          </FormField>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" checked={form.isPaid} onChange={(e) => setForm({ ...form, isPaid: e.target.checked })} />
            Paid leave
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" checked={form.isCarryForward} onChange={(e) => setForm({ ...form, isCarryForward: e.target.checked })} />
            Can be carried forward
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create leave type'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
