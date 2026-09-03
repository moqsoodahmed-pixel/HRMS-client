import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Clock, LogIn, LogOut, Users, UserCheck, UserX, CalendarOff, AlarmClock, Pencil, Plus, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceAPI, employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar,
  SearchInput, Select, Modal, FormField, StatusBadge, Avatar, EmptyState,
} from '../components/ui';
import { ATTENDANCE_STATUSES, DEPARTMENTS } from '../constants';
import {
  formatDate, formatTime, toDateInput, toTimeInput, errorMessage, fieldErrors, duration, exportCsv,
} from '../lib/format';

const PAGE_SIZE = 20;
const today = () => toDateInput(new Date());

export default function Attendance() {
  const { can, employee } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ date: today(), status: '', department: '', employeeId: '', search: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [markOpen, setMarkOpen] = useState(false);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters({ date: today(), status: '', department: '', employeeId: '', search: '' }); setPage(1); };

  const listQuery = useQuery({
    queryKey: ['attendance', 'list', filters, page],
    queryFn: () => attendanceAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const statsQuery = useQuery({
    queryKey: ['attendance', 'stats', filters.date],
    queryFn: () => attendanceAPI.stats({ date: filters.date }),
  });

  const todayQuery = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceAPI.today(),
  });

  const employeesQuery = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    enabled: can('viewAllAttendance'),
    staleTime: 5 * 60 * 1000,
  });

  const records = listQuery.data?.data?.data || [];
  const meta = listQuery.data?.data?.meta;
  const stats = statsQuery.data?.data?.data;
  const myToday = todayQuery.data?.data?.data;
  const managers = employeesQuery.data?.data?.data?.managers || [];

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const checkIn = useMutation({
    mutationFn: () => attendanceAPI.checkIn(),
    onSuccess: () => { toast.success('Checked in'); refreshAll(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const checkOut = useMutation({
    mutationFn: () => attendanceAPI.checkOut(),
    onSuccess: () => { toast.success('Checked out'); refreshAll(); },
    onError: (err) => toast.error(errorMessage(err)),
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
            <p className="truncate text-xs text-gray-400">{row.employee?.designation}</p>
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (row) => <span className="font-mono text-xs">{row.employee?.employeeCode || '—'}</span> },
    { key: 'department', header: 'Department', render: (row) => row.employee?.department || '—' },
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'checkIn', header: 'Check In', render: (row) => formatTime(row.checkIn) },
    { key: 'checkOut', header: 'Check Out', render: (row) => formatTime(row.checkOut) },
    {
      key: 'hours',
      header: 'Working Hours',
      render: (row) => (row.workHours ? `${row.workHours.toFixed(2)} h` : row.checkIn && !row.checkOut ? <span className="text-amber-600">In progress</span> : '—'),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => (
        <span className="block max-w-[16rem] truncate text-xs text-gray-500" title={row.notes || ''}>
          {row.notes || '—'}
        </span>
      ),
    },
    ...(can('manageAttendance') ? [{
      key: 'actions',
      header: '',
      render: (row) => (
        <button type="button" onClick={() => setEditing(row)} className="btn-ghost" title="Edit attendance">
          <Pencil className="h-4 w-4" />
        </button>
      ),
    }] : []),
  ], [can]);

  const handleExport = () => {
    exportCsv(`attendance-${filters.date || 'all'}.csv`, [
      { label: 'Employee', value: (r) => r.employee?.fullName },
      { label: 'Code', value: (r) => r.employee?.employeeCode },
      { label: 'Department', value: (r) => r.employee?.department },
      { label: 'Date', value: (r) => formatDate(r.date) },
      { label: 'Check In', value: (r) => formatTime(r.checkIn, '') },
      { label: 'Check Out', value: (r) => formatTime(r.checkOut, '') },
      { label: 'Working Hours', value: (r) => r.workHours ?? '' },
      { label: 'Status', value: (r) => r.status },
      { label: 'Remarks', value: (r) => r.notes ?? '' },
    ], records);
    toast.success('Exported the current page');
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Daily attendance, corrections and check-in activity"
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={handleExport} disabled={!records.length}>
              <Download className="h-4 w-4" /> Export
            </button>
            {can('manageAttendance') && (
              <button type="button" className="btn-primary" onClick={() => setMarkOpen(true)}>
                <Plus className="h-4 w-4" /> Mark attendance
              </button>
            )}
          </>
        }
      />

      {statsQuery.isLoading ? <StatCardSkeleton count={5} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Present Today" value={stats?.present ?? 0} icon={UserCheck} tone="green" />
          <StatCard label="Absent Today" value={stats?.absent ?? 0} icon={UserX} tone="red" />
          <StatCard label="Late" value={stats?.late ?? 0} icon={AlarmClock} tone="amber" />
          <StatCard label="On Leave" value={stats?.onLeave ?? 0} icon={CalendarOff} tone="blue" />
          <StatCard label="Total Employees" value={stats?.totalEmployees ?? 0} icon={Users} tone="indigo" />
        </div>
      )}

      {/* Personal check-in panel */}
      {myToday?.employee && (
        <div className="card mt-6 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">My attendance today</p>
                <p className="text-xs text-gray-500">
                  Shift {myToday.shift?.start} – {myToday.shift?.end} · {formatDate(new Date())}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <MiniStat label="Status" value={myToday.record ? <StatusBadge status={myToday.record.status} /> : <span className="text-sm text-gray-400">Not marked</span>} />
              <MiniStat label="Check in" value={<span className="text-sm font-medium">{formatTime(myToday.record?.checkIn)}</span>} />
              <MiniStat
                label={myToday.record?.checkOut ? 'Check out' : 'Working'}
                value={<span className="text-sm font-medium">
                  {myToday.record?.checkOut
                    ? formatTime(myToday.record.checkOut)
                    : myToday.record?.checkIn ? duration(myToday.record.checkIn) : '—'}
                </span>}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => checkIn.mutate()}
                disabled={checkIn.isPending || Boolean(myToday.record?.checkIn)}
                title={myToday.record?.checkIn ? 'Already checked in today' : 'Check in'}
              >
                <LogIn className="h-4 w-4" /> Check in
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => checkOut.mutate()}
                disabled={checkOut.isPending || !myToday.record?.checkIn || Boolean(myToday.record?.checkOut)}
                title={!myToday.record?.checkIn ? 'Check in first' : myToday.record?.checkOut ? 'Already checked out' : 'Check out'}
              >
                <LogOut className="h-4 w-4" /> Check out
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <FilterBar onReset={resetFilters}>
          <SearchInput
            className="min-w-[14rem] flex-1"
            value={filters.search}
            onChange={(v) => setFilter('search', v)}
            placeholder="Search employee name or code…"
          />
          <div>
            <label className="label">Date</label>
            <input type="date" className="input w-44" value={filters.date} onChange={(e) => setFilter('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <Select
              className="w-40"
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              options={ATTENDANCE_STATUSES}
              placeholder="All statuses"
            />
          </div>
          {can('viewAllAttendance') && (
            <>
              <div>
                <label className="label">Department</label>
                <Select
                  className="w-44"
                  value={filters.department}
                  onChange={(e) => setFilter('department', e.target.value)}
                  options={DEPARTMENTS}
                  placeholder="All departments"
                />
              </div>
              <div>
                <label className="label">Employee</label>
                <Select
                  className="w-52"
                  value={filters.employeeId}
                  onChange={(e) => setFilter('employeeId', e.target.value)}
                  options={managers.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
                  placeholder="All employees"
                />
              </div>
            </>
          )}
        </FilterBar>

        <DataTable
          columns={columns}
          rows={records}
          isLoading={listQuery.isLoading}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          empty={
            <EmptyState
              icon={Clock}
              title="No attendance records"
              description={`Nothing was recorded for ${formatDate(filters.date)} with the current filters.`}
            />
          }
          footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
        />
      </div>

      <EditAttendanceModal record={editing} onClose={() => setEditing(null)} onSaved={refreshAll} />
      <MarkAttendanceModal
        open={markOpen}
        onClose={() => setMarkOpen(false)}
        employees={managers}
        defaultDate={filters.date}
        onSaved={refreshAll}
      />
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function EditAttendanceModal({ record, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  // Reset the form whenever a different record is opened.
  const key = record?._id;
  const initial = useMemo(() => ({
    checkIn: toTimeInput(record?.checkIn),
    checkOut: toTimeInput(record?.checkOut),
    status: record?.status || 'PRESENT',
    notes: record?.notes || '',
    editReason: '',
  }), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const values = { ...initial, ...form };

  const save = useMutation({
    mutationFn: (data) => attendanceAPI.update(record._id, data),
    onSuccess: () => { toast.success('Attendance updated'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm({}); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!values.editReason.trim()) next.editReason = 'Please record why this entry is being changed.';
    if (values.checkIn && values.checkOut && values.checkOut <= values.checkIn) {
      next.checkOut = 'Check-out must be later than check-in.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(values);
  };

  return (
    <Modal
      open={Boolean(record)}
      onClose={close}
      title="Edit attendance"
      description={record ? `${record.employee?.fullName} · ${formatDate(record.date)}` : ''}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Check in" error={errors.checkIn}>
            <input type="time" className="input" value={values.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </FormField>
          <FormField label="Check out" error={errors.checkOut}>
            <input type="time" className="input" value={values.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Status" required error={errors.status}>
          <Select value={values.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={ATTENDANCE_STATUSES} />
        </FormField>
        <FormField label="Remarks" error={errors.notes}>
          <textarea
            className="input min-h-[70px]"
            value={values.notes}
            maxLength={500}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional note shown on the attendance row"
          />
        </FormField>
        <FormField label="Reason for correction" required error={errors.editReason} hint="Recorded in the audit log alongside the change.">
          <input
            className="input"
            value={values.editReason}
            onChange={(e) => setForm({ ...form, editReason: e.target.value })}
            placeholder="e.g. Biometric device failure"
          />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MarkAttendanceModal({ open, onClose, employees, defaultDate, onSaved }) {
  const empty = { employee: '', date: defaultDate || today(), status: 'PRESENT', checkIn: '', checkOut: '', notes: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (data) => attendanceAPI.mark(data),
    onSuccess: () => { toast.success('Attendance recorded'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.employee) next.employee = 'Choose an employee.';
    if (!form.date) next.date = 'Choose a date.';
    if (form.checkIn && form.checkOut && form.checkOut <= form.checkIn) next.checkOut = 'Check-out must be later than check-in.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} title="Mark attendance" description="Create or overwrite an attendance record for one employee.">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Employee" required error={errors.employee}>
          <Select
            value={form.employee}
            onChange={(e) => setForm({ ...form, employee: e.target.value })}
            options={employees.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
            placeholder="Select an employee"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date" required error={errors.date}>
            <input type="date" className="input" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </FormField>
          <FormField label="Status" required>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={ATTENDANCE_STATUSES} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Check in" error={errors.checkIn}>
            <input type="time" className="input" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </FormField>
          <FormField label="Check out" error={errors.checkOut}>
            <input type="time" className="input" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Remarks">
          <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save record'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
