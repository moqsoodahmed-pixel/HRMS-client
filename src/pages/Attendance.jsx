import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Clock, LogIn, LogOut, Users, UserCheck, UserX, CalendarOff, AlarmClock, Pencil, Plus, Download,
  ClipboardList, Unlock, CalendarRange, Wallet, Timer, TrendingUp, FileEdit, Coffee, RotateCcw, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceAPI, employeeAPI, attendanceRequestAPI, shiftAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { LeaveRequests } from './Leave';
import { PayrollSummary } from './Payroll';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar,
  SearchInput, Select, Modal, FormField, StatusBadge, Avatar, EmptyState, Tabs,
} from '../components/ui';
import { ATTENDANCE_STATUSES, DEPARTMENTS } from '../constants';
import {
  formatDate, formatTime, toDateInput, toTimeInput, errorMessage, fieldErrors, duration, exportCsv,
  expectedCheckOutTime, formatBreakDuration, breakMinutesTaken, effectiveBreakMinutes, PAID_BREAK_HOURS,
} from '../lib/format';

const PAGE_SIZE = 20;
const today = () => toDateInput(new Date());

// Mirrors UNDO_CHECKOUT_GRACE_MINUTES on the server (attendanceController.js) —
// only used here to show/hide the "Undo check-out" button and its countdown;
// the server is the source of truth and will reject an undo past its own window.
const UNDO_CHECKOUT_GRACE_MINUTES = 1;

/** Monday..Sunday ISO range containing `dateStr`, as {startDate, endDate} YYYY-MM-DD strings. */
function weekRangeOf(dateStr) {
  const d = new Date(dateStr || today());
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  const start = new Date(d); start.setDate(d.getDate() - day);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { startDate: toDateInput(start), endDate: toDateInput(end) };
}

export default function Attendance() {
  const { can } = useAuth();
  if (!can('viewAllAttendance')) return <MyAttendanceView />;
  return <AttendanceManagementView />;
}

/* ------------------------------------------------------------------ */
/* Self-service check-in/out/break widget — shared by the plain        */
/* employee "My Attendance" view AND, further below, surfaced to HR    */
/* Admin too. HR previously never saw this at all: the top-level       */
/* Attendance() router sends anyone with the "viewAllAttendance"       */
/* permission (which includes HR_ADMIN) straight to                    */
/* AttendanceManagementView instead, on the assumption that anyone who */
/* manages everyone else's attendance doesn't need their own — but HR  */
/* is still an employee who checks in/out and takes a break like       */
/* anyone else. Extracted into its own component so both views render */
/* the exact same check-in/out/break behaviour rather than keeping two */
/* copies in sync by hand.                                             */
/* ------------------------------------------------------------------ */

function SelfAttendanceWidget({ title = 'Today' }) {
  const queryClient = useQueryClient();
  const [confirmingCheckOut, setConfirmingCheckOut] = useState(false);
  // Ticks every second so the live "worked so far" duration below, and the
  // "Undo check-out" countdown, stay in sync with the actual clock without
  // needing a page refresh.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayQuery = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => attendanceAPI.today() });
  const myToday = todayQuery.data?.data?.data;

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
    onSuccess: () => {
      toast.success('Checked out');
      setConfirmingCheckOut(false);
      refreshAll();
    },
    onError: (err) => { toast.error(errorMessage(err)); setConfirmingCheckOut(false); },
  });
  const undoCheckOut = useMutation({
    mutationFn: () => attendanceAPI.undoCheckOut(),
    onSuccess: () => { toast.success('Check-out undone — you\'re back to working'); refreshAll(); },
    onError: (err) => { toast.error(errorMessage(err)); refreshAll(); },
  });

  // Self-service undo window: only offered for UNDO_CHECKOUT_GRACE_MINUTES
  // after the check-out timestamp the server recorded.
  const checkOutAt = myToday?.record?.checkOut ? new Date(myToday.record.checkOut).getTime() : null;
  const undoCheckOutDeadline = checkOutAt ? checkOutAt + UNDO_CHECKOUT_GRACE_MINUTES * 60000 : null;
  const canUndoCheckOut = Boolean(undoCheckOutDeadline) && nowTick < undoCheckOutDeadline;
  const undoCheckOutSecondsLeft = canUndoCheckOut ? Math.max(1, Math.ceil((undoCheckOutDeadline - nowTick) / 1000)) : 0;

  const breakStart = useMutation({
    mutationFn: () => attendanceAPI.breakStart(),
    onSuccess: () => { toast.success('Break started — enjoy your hour!'); refreshAll(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const breakEnd = useMutation({
    mutationFn: () => attendanceAPI.breakEnd(),
    onSuccess: () => { toast.success('Break ended — welcome back!'); refreshAll(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (!myToday?.employee) return null;

  // Dynamic expected check-out clock time, computed from the REAL check-in
  // timestamp the moment it happens (8 work hours + the paid break = 9
  // hours on site by default) — not a fixed/generic string. It also reacts
  // live to the ACTUAL break taken, symmetrically: break out early and this
  // pulls earlier by the time saved (they're free to check out that much
  // sooner — check-out was never gated on net hours), break long and it
  // pushes later by the overage instead. Recomputes every second via
  // nowTick, and stops being shown once the actual check-out is recorded.
  const expectedOut = !myToday.record?.checkOut
    ? expectedCheckOutTime(myToday.record?.checkIn, myToday.record?.breakStart, myToday.record?.breakEnd, nowTick)
    : null;
  // Live break duration actually taken so far (from real breakStart/
  // breakEnd timestamps) — replaces the old fixed "1 hr deducted" label,
  // which never changed no matter how long the break actually ran.
  const breakTakenLabel = formatBreakDuration(myToday.record?.breakStart, myToday.record?.breakEnd, nowTick);
  // How the actual break compares to the standard 1 hr — positive means
  // running long (checkout pushed later), negative means back early
  // (checkout pulled earlier by the same amount), 0 means right on the mark.
  const breakDeltaMinutes = myToday.record?.breakStart
    ? breakMinutesTaken(myToday.record.breakStart, myToday.record.breakEnd, nowTick) - PAID_BREAK_HOURS * 60
    : 0;

  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Clock className="h-6 w-6" /></div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">Shift {myToday.shift?.start} – {myToday.shift?.end} · {formatDate(new Date())}</p>
            {expectedOut ? (
              <p className="text-xs font-medium text-primary-700 mt-0.5">
                Expected check-out: {expectedOut} <span className="font-normal text-gray-400">(8h work + 1h paid break, from your {formatTime(myToday.record?.checkIn)} check-in)</span>
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Includes 1 hr paid break · 8 hrs counted = 9 hrs on site</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          <MiniStat label="Status" value={myToday.record ? <StatusBadge status={myToday.record.status} /> : <span className="text-sm text-gray-400">Not marked</span>} />
          <MiniStat label="Check in" value={<span className="text-sm font-medium">{formatTime(myToday.record?.checkIn)}</span>} />
          <MiniStat
            label={myToday.record?.checkOut ? 'Check out' : 'Working'}
            value={<span className="text-sm font-medium">{myToday.record?.checkOut ? formatTime(myToday.record.checkOut) : myToday.record?.checkIn ? duration(myToday.record.checkIn) : '—'}</span>}
          />
          <MiniStat
            label="Break"
            value={
              myToday.record?.breakStart && myToday.record?.breakEnd
                ? <span className="text-sm font-medium text-green-600">{formatTime(myToday.record.breakStart)} – {formatTime(myToday.record.breakEnd)}</span>
                : myToday.record?.breakStart && !myToday.record?.breakEnd
                  ? <span className="text-sm font-medium text-amber-600 animate-pulse">On break…</span>
                  : <span className="text-sm text-gray-400">Not started</span>
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => checkIn.mutate()} disabled={checkIn.isPending || Boolean(myToday.record?.checkIn)}>
            <LogIn className="h-4 w-4" /> Check in
          </button>
          {/* Break start — only after check-in, before check-out, and break not yet taken */}
          {!myToday.record?.breakStart && myToday.record?.checkIn && !myToday.record?.checkOut && (
            <button type="button" className="btn-secondary" onClick={() => breakStart.mutate()} disabled={breakStart.isPending}>
              <Coffee className="h-4 w-4" /> Start break
            </button>
          )}
          {/* Break end — only while on break */}
          {myToday.record?.breakStart && !myToday.record?.breakEnd && (
            <button type="button" className="btn-secondary" onClick={() => breakEnd.mutate()} disabled={breakEnd.isPending}>
              <Coffee className="h-4 w-4" /> End break
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => setConfirmingCheckOut(true)} disabled={checkOut.isPending || !myToday.record?.checkIn || Boolean(myToday.record?.checkOut)}>
            <LogOut className="h-4 w-4" /> Check out
          </button>
          {canUndoCheckOut && (
            <button type="button" className="btn-secondary" onClick={() => undoCheckOut.mutate()} disabled={undoCheckOut.isPending}>
              <RotateCcw className="h-4 w-4" /> {undoCheckOut.isPending ? 'Undoing…' : `Undo check-out (${undoCheckOutSecondsLeft}s left)`}
            </button>
          )}
        </div>
      </div>

      {/* Net hours info bar */}
      {myToday.record?.checkIn && (
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2 text-xs text-amber-800 flex flex-wrap gap-x-6 gap-y-1">
          <span>⏱ <strong>Gross time:</strong> {myToday.record?.checkOut ? `${myToday.record.workHours?.toFixed(2) ?? '—'} h` : duration(myToday.record.checkIn)}</span>
          {/* Shows the break actually taken (live while on break), not a fixed
              "1 hr" label — matches the server's rule: the real break
              duration is what's deducted, in both directions. */}
          <span>
            ☕ <strong>Break:</strong>{' '}
            {breakTakenLabel
              ? <>{breakTakenLabel} taken{!myToday.record?.breakEnd ? ' (on break…)' : ''} · {effectiveBreakMinutes(myToday.record?.breakStart, myToday.record?.breakEnd, nowTick)} min deducted</>
              : `${PAID_BREAK_HOURS} hr deducted (standard, until you start a break)`}
          </span>
          {breakDeltaMinutes > 0 && (
            <span className="text-amber-700">
              ⏳ <strong>{breakDeltaMinutes} min longer</strong> than the {PAID_BREAK_HOURS} hr break — check-out pushed {breakDeltaMinutes} min later
            </span>
          )}
          {breakDeltaMinutes < 0 && (
            <span className="text-green-700">
              ⚡ <strong>{-breakDeltaMinutes} min shorter</strong> than the {PAID_BREAK_HOURS} hr break — free to check out {-breakDeltaMinutes} min earlier
            </span>
          )}
          {myToday.record?.netWorkHours != null && (
            <span>✅ <strong>Net working hours:</strong> {myToday.record.netWorkHours.toFixed(2)} h (target: 8.00 h)</span>
          )}
        </div>
      )}

      <Modal open={confirmingCheckOut} onClose={() => setConfirmingCheckOut(false)} title="Confirm check-out" size="sm">
        <div className="space-y-4 p-5">
          <div className="flex gap-3 rounded-lg bg-amber-50 border border-amber-100 p-3 text-sm text-amber-800">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p>This records your check-out time as <strong>{formatTime(new Date())}</strong>. Make sure you're actually done for the day — an early check-out affects today's work-hours calculation.</p>
          </div>
          <p className="text-xs text-gray-500">
            Clicked by mistake? You'll have {UNDO_CHECKOUT_GRACE_MINUTES} minute{UNDO_CHECKOUT_GRACE_MINUTES === 1 ? '' : 's'} after checking out to undo it yourself from this page. After that, you'll need to submit an attendance correction request.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setConfirmingCheckOut(false)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={checkOut.isPending} onClick={() => checkOut.mutate()}>
              {checkOut.isPending ? 'Checking out…' : 'Yes, check out'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Employee self-service view (unchanged behaviour, reused check-in)   */
/* ------------------------------------------------------------------ */

function MyAttendanceView() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ date: today(), status: '' });
  const [page, setPage] = useState(1);
  const [requesting, setRequesting] = useState(false);

  const listQuery = useQuery({
    queryKey: ['attendance', 'list', filters, page],
    queryFn: () => attendanceAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const records = listQuery.data?.data?.data || [];
  const meta = listQuery.data?.data?.meta;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Your own check-in history — visible only to you"
        actions={
          <button type="button" className="btn-secondary" onClick={() => setRequesting(true)}>
            <FileEdit className="h-4 w-4" /> Request Correction / Unlock
          </button>
        }
      />

      <SelfAttendanceWidget />

      <div className="mt-6">
        <FilterBar onReset={() => { setFilters({ date: today(), status: '' }); setPage(1); }}>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input w-44" value={filters.date} onChange={(e) => { setFilters({ ...filters, date: e.target.value }); setPage(1); }} />
          </div>
          <div>
            <label className="label">Status</label>
            <Select className="w-40" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }} options={ATTENDANCE_STATUSES} placeholder="All statuses" />
          </div>
        </FilterBar>

        <DataTable
          columns={[
            { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
            { key: 'checkIn', header: 'Check In', render: (r) => formatTime(r.checkIn) },
            { key: 'checkOut', header: 'Check Out', render: (r) => formatTime(r.checkOut) },
            { key: 'hours', header: 'Net Hours (excl. break)', render: (r) => (r.netWorkHours != null ? `${r.netWorkHours.toFixed(2)} h` : r.workHours ? `${r.workHours.toFixed(2)} h` : '—') },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={records}
          isLoading={listQuery.isLoading}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          empty={<EmptyState icon={Clock} title="No Requests Found" description="No attendance was recorded for this filter." />}
          footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
        />
      </div>

      <RequestModal open={requesting} onClose={() => setRequesting(false)} onSaved={refreshAll} />
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

function RequestModal({ open, onClose, onSaved }) {
  const empty = { type: 'CORRECTION', date: today(), reason: '', requestedCheckIn: '', requestedCheckOut: '', requestedStatus: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (data) => attendanceRequestAPI.create(data),
    onSuccess: () => { toast.success('Request submitted for HR/Admin review'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.date) next.date = 'Choose a date.';
    if (!form.reason.trim()) next.reason = 'Explain what needs to change.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const payload = { ...form };
    if (!payload.requestedCheckIn) delete payload.requestedCheckIn;
    if (!payload.requestedCheckOut) delete payload.requestedCheckOut;
    if (!payload.requestedStatus) delete payload.requestedStatus;
    save.mutate(payload);
  };

  return (
    <Modal open={open} onClose={close} title="Request Correction / Unlock" size="sm" description="HR/Admin will review before anything changes.">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Request Type" required>
          <Select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[{ value: 'CORRECTION', label: 'Correction (fix check-in/out or status)' }, { value: 'UNLOCK', label: 'Unlock (reopen a finalised day)' }]}
          />
        </FormField>
        <FormField label="Date" required error={errors.date}>
          <input type="date" className="input" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </FormField>
        {form.type === 'CORRECTION' && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Requested check in">
                <input type="time" className="input" value={form.requestedCheckIn} onChange={(e) => setForm({ ...form, requestedCheckIn: e.target.value })} />
              </FormField>
              <FormField label="Requested check out">
                <input type="time" className="input" value={form.requestedCheckOut} onChange={(e) => setForm({ ...form, requestedCheckOut: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Requested status">
              <Select value={form.requestedStatus} onChange={(e) => setForm({ ...form, requestedStatus: e.target.value })} options={ATTENDANCE_STATUSES.filter((s) => !['HOLIDAY', 'WEEKEND'].includes(s))} placeholder="Leave unchanged" />
            </FormField>
          </>
        )}
        <FormField label="Reason" required error={errors.reason}>
          <textarea className="input min-h-[80px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Forgot to check out on this day" />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* HR / Admin management dashboard                                     */
/* ------------------------------------------------------------------ */

function AttendanceManagementView() {
  const { role } = useAuth();
  // Deep-link support: the dashboard's Present/Absent/Attendance stat tiles
  // (pages/Dashboard.jsx) link here as e.g. /attendance?tab=history&date=...
  // so clicking one actually lands on the attendance list for that day
  // instead of the default "Attendance Submissions" tab, which had nothing
  // to do with what the tile showed. Read once on mount, same as every
  // other tab switch here — clicking tabs afterward works exactly as before.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'submissions');
  const [week, setWeek] = useState(() => toDateInput(new Date()));
  const range = weekRangeOf(week);

  const statsQuery = useQuery({
    queryKey: ['attendance', 'stats', 'week', range.startDate, range.endDate],
    queryFn: () => attendanceAPI.stats(range),
  });
  const requestStatsQuery = useQuery({
    queryKey: ['attendance', 'requests', 'all'],
    queryFn: () => attendanceRequestAPI.list(),
  });
  const stats = statsQuery.data?.data?.data;
  const allRequests = requestStatsQuery.data?.data?.data || [];
  const pending = allRequests.filter((r) => r.status === 'PENDING').length;
  const approved = allRequests.filter((r) => r.status === 'APPROVED').length;
  const rejected = allRequests.filter((r) => r.status === 'REJECTED').length;

  const tabs = [
    { value: 'submissions', label: 'Attendance Submissions', count: allRequests.filter((r) => r.type === 'CORRECTION' && r.status === 'PENDING').length || undefined },
    { value: 'unlock', label: 'Unlock Requests', count: allRequests.filter((r) => r.type === 'UNLOCK' && r.status === 'PENDING').length || undefined },
    { value: 'shifts', label: 'Shift Assignment' },
    { value: 'history', label: 'Attendance History' },
    { value: 'leave', label: 'Leave Requests' },
    { value: 'payroll', label: 'Payroll Summary' },
  ];

  return (
    <div>
      <PageHeader title="Employee Attendance" subtitle="Dashboard / Attendance / Employee records" />

      {/* HR is also an employee with their own shift to work — this view used
          to only manage OTHER people's attendance and had no way for HR
          themselves to check in/out or take a break. Reuses the same
          self-service widget every other employee gets on this page. */}
      {role === 'HR_ADMIN' && <SelfAttendanceWidget title="My attendance today" />}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Select Week</label>
          <input type="date" className="input w-44" value={week} onChange={(e) => setWeek(e.target.value)} />
        </div>
        <p className="pb-2 text-xs text-gray-400">{formatDate(range.startDate)} – {formatDate(range.endDate)}</p>
      </div>

      {statsQuery.isLoading ? <StatCardSkeleton count={5} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Pending Requests" value={pending} icon={ClipboardList} tone="amber" />
          <StatCard label="Approved Requests" value={approved} icon={UserCheck} tone="green" />
          <StatCard label="Rejected Requests" value={rejected} icon={UserX} tone="red" />
          <StatCard label="Avg Hours" value={stats?.avgHours != null ? `${stats.avgHours}h` : '—'} icon={Timer} tone="indigo" />
          <StatCard label="Attendance %" value={stats?.attendancePercent != null ? `${stats.attendancePercent}%` : '—'} icon={TrendingUp} tone="purple" />
        </div>
      )}

      <div className="mt-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === 'submissions' && <AttendanceRequestsPanel type="CORRECTION" />}
        {tab === 'unlock' && <AttendanceRequestsPanel type="UNLOCK" />}
        {tab === 'shifts' && <ShiftAssignmentPanel />}
        {tab === 'history' && <AttendanceHistoryPanel />}
        {tab === 'leave' && <LeaveRequests />}
        {tab === 'payroll' && <PayrollSummary />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance Submissions / Unlock Requests                            */
/* ------------------------------------------------------------------ */

const REQUEST_TYPE_META = {
  CORRECTION: { label: 'Attendance Submissions', icon: ClipboardList, empty: 'No Requests Found' },
  UNLOCK: { label: 'Unlock Requests', icon: Unlock, empty: 'No Requests Found' },
};

function AttendanceRequestsPanel({ type }) {
  const { can } = useAuth();
  const canDecide = can('manageAttendance');
  const [status, setStatus] = useState('PENDING');
  const [rejecting, setRejecting] = useState(null);
  const queryClient = useQueryClient();
  const meta = REQUEST_TYPE_META[type];

  const query = useQuery({
    queryKey: ['attendance', 'requests', type, status],
    queryFn: () => attendanceRequestAPI.list({ type, status: status || undefined }),
  });
  const rows = query.data?.data?.data || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['attendance', 'requests'] });

  const approve = useMutation({
    mutationFn: (id) => attendanceRequestAPI.approve(id),
    onSuccess: () => { toast.success('Request approved'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }) => attendanceRequestAPI.reject(id, reason),
    onSuccess: () => { toast.success('Request rejected'); refresh(); setRejecting(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div>
      <FilterBar onReset={() => setStatus('')}>
        <div>
          <label className="label">Status</label>
          <Select
            className="w-44"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[{ value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]}
            placeholder="All statuses"
          />
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
                  <p className="truncate text-xs text-gray-400">{r.employee?.employeeCode} · {r.employee?.department}</p>
                </div>
              </div>
            ),
          },
          { key: 'type', header: 'Request Type', render: (r) => <StatusBadge status={r.type} tone={r.type === 'UNLOCK' ? 'purple' : 'blue'} /> },
          { key: 'week', header: 'Week', render: (r) => formatDate(r.date) },
          {
            key: 'hours',
            header: 'Hours',
            render: (r) => (r.requestedCheckIn || r.requestedCheckOut ? `${r.requestedCheckIn || '—'} → ${r.requestedCheckOut || '—'}` : '—'),
          },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (r) => r.status === 'PENDING' && canDecide && (
              <div className="flex justify-end gap-2">
                <button type="button" className="text-xs font-medium text-green-600 hover:underline" onClick={() => approve.mutate(r._id)} disabled={approve.isPending}>Approve</button>
                <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setRejecting(r)}>Reject</button>
              </div>
            ),
          },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={<EmptyState icon={meta.icon} title={meta.empty} description="Employee-submitted requests will appear here." />}
      />

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject request" size="sm">
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = new FormData(e.target).get('reason')?.toString().trim();
            if (!reason) { toast.error('A reason is required.'); return; }
            reject.mutate({ id: rejecting._id, reason });
          }}
        >
          <FormField label="Reason" required>
            <textarea name="reason" className="input min-h-[80px]" />
          </FormField>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
            <button type="submit" className="btn-danger" disabled={reject.isPending}>{reject.isPending ? 'Rejecting…' : 'Reject'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shift Assignment                                                     */
/* ------------------------------------------------------------------ */

function ShiftAssignmentPanel() {
  const { can } = useAuth();
  const canManage = can('manageAttendance');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const shiftsQuery = useQuery({ queryKey: ['shifts'], queryFn: () => shiftAPI.list() });
  const employeesQuery = useQuery({
    queryKey: ['employees', 'list', 'shift-assignment', search],
    queryFn: () => employeeAPI.list({ search, limit: 50 }),
  });
  const shifts = shiftsQuery.data?.data?.data || [];
  const employees = employeesQuery.data?.data?.data || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['employees', 'list', 'shift-assignment'] });
    queryClient.invalidateQueries({ queryKey: ['shifts'] });
  };

  const assign = useMutation({
    mutationFn: ({ employeeId, shiftId }) => shiftAPI.assign(employeeId, shiftId || null),
    onSuccess: () => { toast.success('Shift assigned'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <SearchInput className="w-64" value={search} onChange={setSearch} placeholder="Search employees…" />
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New shift
          </button>
        )}
      </div>

      <DataTable
        columns={[
          {
            key: 'employee',
            header: 'Employee',
            render: (e) => (
              <div className="flex items-center gap-3">
                <Avatar name={e.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{e.fullName}</p>
                  <p className="truncate text-xs text-gray-400">{e.employeeCode} · {e.department}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'current',
            header: 'Current Shift',
            render: (e) => e.shift ? <span className="text-sm text-gray-700">{e.shift.name} ({e.shift.startTime}–{e.shift.endTime})</span> : <span className="text-xs text-gray-400">Default work hours</span>,
          },
          ...(canManage ? [{
            key: 'assign',
            header: 'Assign Shift',
            render: (e) => (
              <Select
                className="w-56"
                value={e.shift?._id || ''}
                onChange={(ev) => assign.mutate({ employeeId: e._id, shiftId: ev.target.value })}
                options={shifts.map((s) => ({ value: s._id, label: `${s.name} (${s.startTime}–${s.endTime})` }))}
                placeholder="Default work hours"
              />
            ),
          }] : []),
        ]}
        rows={employees}
        isLoading={employeesQuery.isLoading}
        error={employeesQuery.error}
        onRetry={employeesQuery.refetch}
        empty={<EmptyState icon={CalendarRange} title="No employees found" description="Try a different search." />}
      />

      <ShiftFormModal open={creating} onClose={() => setCreating(false)} onSaved={refresh} />
    </div>
  );
}

function ShiftFormModal({ open, onClose, onSaved }) {
  const empty = { name: '', startTime: '09:30', endTime: '18:30' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (data) => shiftAPI.create(data),
    onSuccess: () => { toast.success('Shift created'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErrors({ name: 'Give the shift a name.' }); return; }
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} title="New shift" size="sm">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Shift name" required error={errors.name}>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Night Shift" />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Start time" required>
            <input type="time" className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          </FormField>
          <FormField label="End time" required>
            <input type="time" className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Create shift'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance History (the original table + filters + mark/edit)       */
/* ------------------------------------------------------------------ */

// Sentinel filter value for "everyone the dashboard's Absent Today tile
// counted" — NOT a real Attendance.status value (never sent to the
// mark/edit endpoints), so it's kept local to this panel's Status dropdown
// rather than added to the shared ATTENDANCE_STATUSES constant. Selecting
// it switches this panel to attendanceAPI.absentees() (a walk of eligible
// EMPLOYEES with no/absent record for the day) instead of the normal
// attendanceAPI.list() (a walk of attendance RECORDS) — see
// server/controllers/attendanceController.js getAbsentees for why a plain
// status=ABSENT filter can't show these people: most of them have no
// attendance record at all, so they don't exist as rows in that list.
export const NOT_ACCOUNTED_FOR = 'NOT_ACCOUNTED_FOR';

function AttendanceHistoryPanel() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  // Same deep-link support as the tab above — a dashboard tile can pass
  // ?date=YYYY-MM-DD (always "today" from the dashboard, but honoured
  // generally) so the list opens already showing the day the tile counted,
  // not whatever day was last selected.
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    date: searchParams.get('date') || today(),
    status: searchParams.get('status') || '',
    department: '', designation: '', employeeId: '', search: '',
  });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [markOpen, setMarkOpen] = useState(false);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters({ date: today(), status: '', department: '', designation: '', employeeId: '', search: '' }); setPage(1); };

  const isAbsenteeView = filters.status === NOT_ACCOUNTED_FOR;

  const listQuery = useQuery({
    queryKey: ['attendance', 'list', filters, page],
    queryFn: () => attendanceAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: !isAbsenteeView,
  });
  // Walks eligible EMPLOYEES with no/absent record for the day, instead of
  // attendance RECORDS — see the NOT_ACCOUNTED_FOR comment above.
  const absenteesQuery = useQuery({
    queryKey: ['attendance', 'absentees', filters, page],
    queryFn: () => attendanceAPI.absentees({
      date: filters.date, department: filters.department, designation: filters.designation, search: filters.search,
      page, limit: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
    enabled: isAbsenteeView,
  });
  const employeesQuery = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    staleTime: 5 * 60 * 1000,
  });

  const activeQuery = isAbsenteeView ? absenteesQuery : listQuery;
  const records = activeQuery.data?.data?.data || [];
  const meta = activeQuery.data?.data?.meta;
  const managers = employeesQuery.data?.data?.data?.managers || [];
  const designations = employeesQuery.data?.data?.data?.designations || [];

  const ABSENT_REASON_LABELS = {
    NOT_CHECKED_IN: 'Not checked in',
    ABSENT: 'Marked absent',
    ON_LEAVE: 'On leave',
    HOLIDAY: 'Holiday',
    WEEKEND: 'Weekend',
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

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
      header: 'Net Hours (excl. 1 hr break)',
      render: (row) => {
        if (row.checkIn && !row.checkOut) return <span className="text-amber-600">In progress</span>;
        const net = row.netWorkHours ?? (row.workHours ? Math.max(0, row.workHours - 1) : null);
        return net != null ? `${net.toFixed(2)} h` : '—';
      },
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(can('manageAttendance') ? [{
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {/* Employee walked up and reported an accidental check-out — one click
              clears it and reopens the edit form (with a reason still required)
              instead of making HR fiddle with the time-picker to blank it out. */}
          {row.checkIn && row.checkOut && (
            <button type="button" onClick={() => setEditing({ ...row, __undoCheckOut: true })} className="btn-ghost" title="Undo check-out (employee reported it was accidental)">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={() => setEditing(row)} className="btn-ghost" title="Edit attendance">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ),
    }] : []),
  ], [can]);

  // The absentee view (see NOT_ACCOUNTED_FOR above) shows EMPLOYEES, not
  // attendance records — most rows have no check-in/check-out/hours to show
  // at all, so reusing the normal columns would render a wall of dashes.
  // A distinct, honest column set instead: who, and why they're not
  // counted as present (no record vs. an explicit Absent/On Leave/Holiday/
  // Weekend record for the day).
  const absenteeColumns = useMemo(() => [
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
    {
      key: 'reason',
      header: 'Why they\'re not counted as present',
      render: (row) => <StatusBadge status={row.reason} tone={row.reason === 'NOT_CHECKED_IN' ? 'red' : 'gray'} label={ABSENT_REASON_LABELS[row.reason] || humanise(row.reason)} />,
    },
  ], []);

  const handleExport = () => {
    if (isAbsenteeView) {
      exportCsv(`attendance-absent-${filters.date || 'all'}.csv`, [
        { label: 'Employee', value: (r) => r.employee?.fullName },
        { label: 'Code', value: (r) => r.employee?.employeeCode },
        { label: 'Department', value: (r) => r.employee?.department },
        { label: 'Date', value: (r) => formatDate(r.date) },
        { label: 'Reason', value: (r) => ABSENT_REASON_LABELS[r.reason] || r.reason },
      ], records);
      toast.success('Exported the current page');
      return;
    }
    exportCsv(`attendance-${filters.date || 'all'}.csv`, [
      { label: 'Employee', value: (r) => r.employee?.fullName },
      { label: 'Code', value: (r) => r.employee?.employeeCode },
      { label: 'Department', value: (r) => r.employee?.department },
      { label: 'Date', value: (r) => formatDate(r.date) },
      { label: 'Check In', value: (r) => formatTime(r.checkIn, '') },
      { label: 'Check Out', value: (r) => formatTime(r.checkOut, '') },
      { label: 'Break Start', value: (r) => formatTime(r.breakStart, '') },
      { label: 'Break End', value: (r) => formatTime(r.breakEnd, '') },
      { label: 'Break (mins)', value: (r) => r.breakDurationMinutes ?? '' },
      { label: 'Gross Hours', value: (r) => r.workHours ?? '' },
      { label: 'Net Working Hours', value: (r) => r.netWorkHours ?? '' },
      { label: 'Status', value: (r) => r.status },
    ], records);
    toast.success('Exported the current page');
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={handleExport} disabled={!records.length}>
          <Download className="h-4 w-4" /> Export
        </button>
        {can('manageAttendance') && (
          <button type="button" className="btn-primary" onClick={() => setMarkOpen(true)}>
            <Plus className="h-4 w-4" /> Mark attendance
          </button>
        )}
      </div>

      <FilterBar onReset={resetFilters}>
        <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search employee name or code…" />
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
            options={[...ATTENDANCE_STATUSES, { value: NOT_ACCOUNTED_FOR, label: 'Absent (not counted as present)' }]}
            placeholder="All statuses"
          />
        </div>
        <div>
          <label className="label">Department</label>
          <Select className="w-44" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} options={DEPARTMENTS} placeholder="All departments" />
        </div>
        <div>
          <label className="label">Designation</label>
          <Select className="w-44" value={filters.designation} onChange={(e) => setFilter('designation', e.target.value)} options={designations} placeholder="All designations" />
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
      </FilterBar>

      <DataTable
        columns={isAbsenteeView ? absenteeColumns : columns}
        rows={records}
        isLoading={activeQuery.isLoading}
        error={activeQuery.error}
        onRetry={activeQuery.refetch}
        empty={isAbsenteeView
          ? <EmptyState icon={UserCheck} title="Everyone is accounted for" description={`No one is missing from attendance on ${formatDate(filters.date)} with the current filters.`} />
          : <EmptyState icon={Clock} title="No Requests Found" description={`Nothing was recorded for ${formatDate(filters.date)} with the current filters.`} />}
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />

      <EditAttendanceModal record={editing} onClose={() => setEditing(null)} onSaved={refreshAll} />
      <MarkAttendanceModal open={markOpen} onClose={() => setMarkOpen(false)} employees={managers} defaultDate={filters.date} onSaved={refreshAll} />
    </div>
  );
}

function EditAttendanceModal({ record, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});

  const key = record?._id;
  const isUndoCheckOut = Boolean(record?.__undoCheckOut);
  const initial = useMemo(() => ({
    checkIn: toTimeInput(record?.checkIn),
    // "Undo check-out" opens this same form with check-out already cleared —
    // HR still has to pick a status and give a reason (kept in the audit
    // log), they just don't have to fight the native time input to blank it.
    checkOut: isUndoCheckOut ? '' : toTimeInput(record?.checkOut),
    status: record?.status || 'PRESENT',
    notes: record?.notes || '',
    editReason: isUndoCheckOut ? 'Employee reported an accidental check-out; reverted to checked-in.' : '',
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
    <Modal open={Boolean(record)} onClose={close} title="Edit attendance" description={record ? `${record.employee?.fullName} · ${formatDate(record.date)}` : ''}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <textarea className="input min-h-[70px]" value={values.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional note shown on the attendance row" />
        </FormField>
        <FormField label="Reason for correction" required error={errors.editReason} hint="Recorded in the audit log alongside the change.">
          <input className="input" value={values.editReason} onChange={(e) => setForm({ ...form, editReason: e.target.value })} placeholder="e.g. Biometric device failure" />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Date" required error={errors.date}>
            <input type="date" className="input" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </FormField>
          <FormField label="Status" required>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={ATTENDANCE_STATUSES} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save record'}</button>
        </div>
      </form>
    </Modal>
  );
}