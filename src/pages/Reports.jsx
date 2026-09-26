import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Clock, CalendarDays, Wallet, Package, UserPlus, UserMinus, Printer, Download,
} from 'lucide-react';
import { reportAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, Tabs, FilterBar, Select, ProgressBar,
  ErrorState, EmptyState, DataTable, StatusBadge,
} from '../components/ui';
import { DEPARTMENTS, MONTHS } from '../constants';
import { formatCurrency, formatDate, formatNumber, humanise, monthName, exportCsv } from '../lib/format';

const now = new Date();
const YEARS = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(String);
const currentYearStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
const today = now.toISOString().slice(0, 10);

const TABS = [
  { value: 'employees', label: 'Employees' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'leave', label: 'Leave' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'assets', label: 'Assets' },
  { value: 'lifecycle', label: 'Onboarding / Offboarding' },
];

export default function Reports() {
  const { can } = useAuth();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const t = params.get('tab');
    return TABS.some((x) => x.value === t) ? t : 'employees';
  });
  const [department, setDepartment] = useState('');

  useEffect(() => {
    const t = params.get('tab');
    if (t && TABS.some((x) => x.value === t)) setTab(t);
  }, [params]);

  const visibleTabs = TABS.filter((t) => t.value !== 'payroll' || can('viewPayrollReports'));

  return (
    <div className="print:p-0">
      <PageHeader
        title="Reports"
        subtitle="Organisation-wide reporting across every module"
        actions={
          <button type="button" className="btn-secondary print:hidden" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </button>
        }
      />

      <div className="print:hidden">
        <Tabs tabs={visibleTabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'employees' && <EmployeeReport department={department} setDepartment={setDepartment} />}
      {tab === 'attendance' && <AttendanceReport department={department} setDepartment={setDepartment} />}
      {tab === 'leave' && <LeaveReport department={department} setDepartment={setDepartment} />}
      {tab === 'payroll' && can('viewPayrollReports') && <PayrollReport department={department} setDepartment={setDepartment} />}
      {tab === 'assets' && <AssetReport />}
      {tab === 'lifecycle' && <LifecycleReport department={department} setDepartment={setDepartment} />}
    </div>
  );
}

function ReportToolbar({ department, setDepartment, extra, onExport }) {
  return (
    <FilterBar>
      <div>
        <label className="label">Department</label>
        <Select className="w-48" value={department} onChange={(e) => setDepartment(e.target.value)} options={DEPARTMENTS} placeholder="All departments" />
      </div>
      {extra}
      {onExport && (
        <button type="button" className="btn-secondary" onClick={onExport}>
          <Download className="h-4 w-4" /> Export CSV
        </button>
      )}
    </FilterBar>
  );
}

/* ------------------------------------------------------------------ */

function EmployeeReport({ department, setDepartment }) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['reports', 'employees', department],
    queryFn: () => reportAPI.employees({ department }),
  });
  const data = query.data?.data?.data;

  if (query.isLoading) return <StatCardSkeleton count={4} />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;
  if (!data) return null;

  const maxDept = data.byDepartment[0]?.count || 1;

  return (
    <div>
      <ReportToolbar
        department={department}
        setDepartment={setDepartment}
        onExport={() => exportCsv('employee-report.csv', [
          { label: 'Name', value: (e) => e.fullName }, { label: 'Code', value: (e) => e.employeeCode },
          { label: 'Department', value: (e) => e.department }, { label: 'Designation', value: (e) => e.designation },
          { label: 'Status', value: (e) => e.status }, { label: 'Type', value: (e) => e.employmentType },
          { label: 'Date of Joining', value: (e) => formatDate(e.dateOfJoining, '') },
        ], data.employees)}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Employees" value={formatNumber(data.summary.total)} icon={Users} tone="indigo" onClick={() => navigate('/employees')} />
        <StatCard label="Active" value={formatNumber(data.summary.active)} icon={Users} tone="green" onClick={() => navigate('/employees?status=ACTIVE')} />
        <StatCard label="On Notice / Probation" value={formatNumber(data.summary.noticePeriod + data.summary.probation)} icon={Users} tone="amber" onClick={() => navigate('/employees?status=PROBATION')} />
        <StatCard label="Joined / Exited This Month" value={`${data.summary.joinedThisMonth} / ${data.summary.exitedThisMonth}`} icon={Users} tone="blue" onClick={() => navigate('/employees')} />
      </div>

      <div className="card mt-6 p-5">
        <h2 className="section-title mb-4">Department distribution</h2>
        {data.byDepartment.length === 0 ? <EmptyState title="No data" /> : (
          <div className="space-y-3">
            {data.byDepartment.map((d) => (
              <div key={d._id || 'unassigned'}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-gray-700">{d._id || 'Unassigned'}</span><span className="text-gray-500">{d.count}</span></div>
                <ProgressBar value={(d.count / maxDept) * 100} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <DataTable
          columns={[
            { key: 'name', header: 'Employee', render: (e) => <div><p className="font-medium text-gray-900">{e.fullName}</p><p className="text-xs text-gray-400">{e.employeeCode}</p></div> },
            { key: 'dept', header: 'Department', render: (e) => e.department },
            { key: 'designation', header: 'Designation', render: (e) => e.designation },
            { key: 'type', header: 'Type', render: (e) => humanise(e.employmentType) },
            { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
            { key: 'joined', header: 'Joined', render: (e) => formatDate(e.dateOfJoining) },
            { key: 'manager', header: 'Manager', render: (e) => e.manager?.fullName || '—' },
          ]}
          rows={data.employees}
          empty={<EmptyState title="No employees match this filter" />}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AttendanceReport({ department, setDepartment }) {
  const navigate = useNavigate();
  const [range, setRange] = useState({ startDate: currentYearStart, endDate: today });
  const query = useQuery({
    queryKey: ['reports', 'attendance', department, range],
    queryFn: () => reportAPI.attendance({ department, ...range }),
  });
  const data = query.data?.data?.data;

  if (query.isLoading) return <StatCardSkeleton count={4} />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;
  if (!data) return null;

  return (
    <div>
      <ReportToolbar
        department={department}
        setDepartment={setDepartment}
        extra={<DateRange range={range} setRange={setRange} />}
        onExport={() => exportCsv('attendance-report.csv', [
          { label: 'Employee', value: (r) => r.employee?.fullName }, { label: 'Code', value: (r) => r.employee?.employeeCode },
          { label: 'Present', value: (r) => r.present }, { label: 'Absent', value: (r) => r.absent },
          { label: 'Late', value: (r) => r.late }, { label: 'On Leave', value: (r) => r.onLeave },
          { label: 'Work Hours', value: (r) => r.workHours },
        ], data.perEmployee)}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Present" value={formatNumber(data.summary.present)} icon={Clock} tone="green" onClick={() => navigate('/attendance?tab=history&status=PRESENT')} />
        <StatCard label="Absent" value={formatNumber(data.summary.absent)} icon={Clock} tone="red" onClick={() => navigate('/attendance?tab=history&status=ABSENT')} />
        <StatCard label="Late" value={formatNumber(data.summary.late)} icon={Clock} tone="amber" onClick={() => navigate('/attendance?tab=history&status=LATE')} />
        <StatCard label="On Leave" value={formatNumber(data.summary.onLeave)} icon={Clock} tone="blue" onClick={() => navigate('/leave?tab=requests')} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Half Day" value={formatNumber(data.summary.halfDay)} icon={Clock} tone="purple" onClick={() => navigate('/attendance?tab=history&status=HALF_DAY')} />
        <StatCard label="Work From Home" value={formatNumber(data.summary.workFromHome)} icon={Clock} tone="indigo" onClick={() => navigate('/attendance?tab=history&status=WORK_FROM_HOME')} />
        <StatCard label="Total Work Hours" value={`${data.summary.totalWorkHours}h`} icon={Clock} tone="gray" onClick={() => navigate('/attendance?tab=history')} />
      </div>

      <div className="mt-6">
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => <div><p className="font-medium text-gray-900">{r.employee?.fullName}</p><p className="text-xs text-gray-400">{r.employee?.department}</p></div> },
            { key: 'present', header: 'Present', render: (r) => r.present },
            { key: 'absent', header: 'Absent', render: (r) => r.absent },
            { key: 'late', header: 'Late', render: (r) => r.late },
            { key: 'halfDay', header: 'Half Day', render: (r) => r.halfDay },
            { key: 'onLeave', header: 'On Leave', render: (r) => r.onLeave },
            { key: 'hours', header: 'Work Hours', render: (r) => (r.workHours || 0).toFixed(1) },
          ]}
          rows={data.perEmployee}
          empty={<EmptyState title="No attendance in this period" />}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LeaveReport({ department, setDepartment }) {
  const navigate = useNavigate();
  const [range, setRange] = useState({ startDate: currentYearStart, endDate: today });
  const query = useQuery({
    queryKey: ['reports', 'leave', department, range],
    queryFn: () => reportAPI.leave({ department, ...range }),
  });
  const data = query.data?.data?.data;

  if (query.isLoading) return <StatCardSkeleton count={4} />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;
  if (!data) return null;

  return (
    <div>
      <ReportToolbar department={department} setDepartment={setDepartment} extra={<DateRange range={range} setRange={setRange} />} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending" value={formatNumber(data.summary.pending)} icon={CalendarDays} tone="amber" onClick={() => navigate('/leave?tab=requests&status=PENDING')} />
        <StatCard label="Approved" value={formatNumber(data.summary.approved)} icon={CalendarDays} tone="green" hint={`${data.summary.approvedDays} day(s)`} onClick={() => navigate('/leave?tab=requests&status=APPROVED')} />
        <StatCard label="Rejected" value={formatNumber(data.summary.rejected)} icon={CalendarDays} tone="red" onClick={() => navigate('/leave?tab=requests&status=REJECTED')} />
        <StatCard label="Cancelled" value={formatNumber(data.summary.cancelled)} icon={CalendarDays} tone="gray" onClick={() => navigate('/leave?tab=requests&status=CANCELLED')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="section-title mb-4">By leave type</h2>
          {data.byType.length === 0 ? <EmptyState title="No approved leave in this period" /> : (
            <div className="space-y-3">
              {data.byType.map((t) => (
                <div key={t._id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{t.name || 'Unknown'}</span>
                  <span className="text-gray-500">{t.days} day(s) · {t.count} request(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5">
          <h2 className="section-title mb-4">By department</h2>
          {data.byDepartment.length === 0 ? <EmptyState title="No approved leave in this period" /> : (
            <div className="space-y-3">
              {data.byDepartment.map((d) => (
                <div key={d._id || 'unassigned'} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{d._id || 'Unassigned'}</span>
                  <span className="text-gray-500">{d.days} day(s) · {d.count} request(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="section-title mb-3">Top leave takers</h2>
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => <div><p className="font-medium text-gray-900">{r.employee?.fullName}</p><p className="text-xs text-gray-400">{r.employee?.department}</p></div> },
            { key: 'days', header: 'Days Taken', render: (r) => r.days },
            { key: 'count', header: 'Requests', render: (r) => r.count },
          ]}
          rows={data.topUsers}
          empty={<EmptyState title="No approved leave in this period" />}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PayrollReport({ department, setDepartment }) {
  const navigate = useNavigate();
  const [period, setPeriod] = useState({ month: String(now.getMonth() + 1), year: String(now.getFullYear()) });
  const query = useQuery({
    queryKey: ['reports', 'payroll', department, period],
    queryFn: () => reportAPI.payroll({ department, month: Number(period.month), year: Number(period.year) }),
  });
  const data = query.data?.data?.data;

  if (query.isLoading) return <StatCardSkeleton count={4} />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;
  if (!data) return null;

  return (
    <div>
      <ReportToolbar
        department={department}
        setDepartment={setDepartment}
        extra={
          <>
            <div>
              <label className="label">Month</label>
              <Select className="w-40" value={period.month} onChange={(e) => setPeriod({ ...period, month: e.target.value })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
            </div>
            <div>
              <label className="label">Year</label>
              <Select className="w-28" value={period.year} onChange={(e) => setPeriod({ ...period, year: e.target.value })} options={YEARS} />
            </div>
          </>
        }
        onExport={() => exportCsv(`payroll-report-${period.month}-${period.year}.csv`, [
          { label: 'Employee', value: (p) => p.employee?.fullName }, { label: 'Department', value: (p) => p.employee?.department },
          { label: 'Gross', value: (p) => p.grossSalary }, { label: 'Deductions', value: (p) => p.totalDeductions },
          { label: 'Net', value: (p) => p.netSalary }, { label: 'Status', value: (p) => p.status },
        ], data.payslips)}
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gross Payroll" value={formatCurrency(data.summary.grossPayroll, { compact: true })} icon={Wallet} tone="indigo" onClick={() => navigate('/payroll?tab=payslips')} />
        <StatCard label="Total Deductions" value={formatCurrency(data.summary.totalDeductions, { compact: true })} icon={Wallet} tone="red" onClick={() => navigate('/payroll?tab=payslips')} />
        <StatCard label="Net Payroll" value={formatCurrency(data.summary.netPayroll, { compact: true })} icon={Wallet} tone="green" onClick={() => navigate('/payroll?tab=payslips')} />
        <StatCard label="Payslips" value={formatNumber(data.summary.payslips)} icon={Users} tone="blue" hint={`Avg. ${formatCurrency(data.summary.averageNet, { compact: true })}`} onClick={() => navigate('/payroll?tab=payslips')} />
      </div>

      <div className="card mt-6 p-5">
        <h2 className="section-title mb-4">By department</h2>
        {data.byDepartment.length === 0 ? <EmptyState title="No payroll data for this period" /> : (
          <div className="space-y-3">
            {data.byDepartment.map((d) => (
              <div key={d._id || 'unassigned'} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{d._id || 'Unassigned'}</span>
                <span className="text-gray-500">{formatCurrency(d.net)} net · {d.count} employee(s)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (p) => <div><p className="font-medium text-gray-900">{p.employee?.fullName}</p><p className="text-xs text-gray-400">{p.employee?.department}</p></div> },
            { key: 'gross', header: 'Gross', render: (p) => formatCurrency(p.grossSalary) },
            { key: 'deductions', header: 'Deductions', render: (p) => formatCurrency(p.totalDeductions) },
            { key: 'net', header: 'Net', render: (p) => <span className="font-semibold">{formatCurrency(p.netSalary)}</span> },
            { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
          ]}
          rows={data.payslips}
          empty={<EmptyState title="No payslips for this period" />}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AssetReport() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['reports', 'assets'], queryFn: () => reportAPI.assets() });
  const data = query.data?.data?.data;

  if (query.isLoading) return <StatCardSkeleton count={5} />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Assets" value={formatNumber(data.summary.total)} icon={Package} tone="indigo" hint={formatCurrency(data.summary.totalValue, { compact: true })} onClick={() => navigate('/assets')} />
        <StatCard label="Assigned" value={formatNumber(data.summary.assigned)} icon={Package} tone="blue" onClick={() => navigate('/assets?status=ASSIGNED')} />
        <StatCard label="Available" value={formatNumber(data.summary.available)} icon={Package} tone="green" onClick={() => navigate('/assets?status=AVAILABLE')} />
        <StatCard label="Maintenance" value={formatNumber(data.summary.maintenance)} icon={Package} tone="amber" onClick={() => navigate('/assets?status=MAINTENANCE')} />
        <StatCard label="Retired" value={formatNumber(data.summary.retired)} icon={Package} tone="red" hint={`${data.summary.returned} returned`} onClick={() => navigate('/assets?status=RETIRED')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="section-title mb-4">By category</h2>
          <div className="space-y-3">
            {data.byType.map((t) => (
              <div key={t._id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{t._id}</span>
                <span className="text-gray-500">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="section-title mb-4">Value by category</h2>
          <div className="space-y-3">
            {data.valueByType.map((v) => (
              <div key={v._id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{v._id}</span>
                <span className="text-gray-500">{formatCurrency(v.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="section-title mb-3">Currently assigned</h2>
        <DataTable
          columns={[
            { key: 'tag', header: 'Asset', render: (a) => <div><p className="font-medium text-gray-900">{a.name}</p><p className="font-mono text-xs text-gray-400">{a.assetCode}</p></div> },
            { key: 'employee', header: 'Assigned To', render: (a) => a.assignedTo?.fullName },
            { key: 'department', header: 'Department', render: (a) => a.assignedTo?.department },
            { key: 'value', header: 'Value', render: (a) => formatCurrency(a.purchaseValue) },
            { key: 'assignedAt', header: 'Assigned', render: (a) => formatDate(a.assignedAt) },
          ]}
          rows={data.assigned}
          empty={<EmptyState title="No assets are currently assigned" />}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LifecycleReport({ department, setDepartment }) {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['reports', 'lifecycle', department], queryFn: () => reportAPI.lifecycle({ department }) });
  const data = query.data?.data?.data;

  if (query.isLoading) return <StatCardSkeleton count={4} />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;
  if (!data) return null;

  const Section = ({ title, icon: Icon, block, to }) => (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="card w-full p-5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary-300/70 hover:shadow-lg active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
    >
      <div className="mb-4 flex items-center gap-2"><Icon className="h-4 w-4 text-gray-400" /><h2 className="section-title">{title}</h2></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Employees" value={block.employees} />
        <MiniStat label="Completed" value={block.completed} tone="text-green-600" />
        <MiniStat label="In progress" value={block.inProgress} tone="text-amber-600" />
        <MiniStat label="Not started" value={block.notStarted} tone="text-gray-500" />
      </div>
      <p className="mt-3 text-xs text-gray-500">{block.completedTasks} of {block.totalTasks} total tasks completed</p>
      {block.rows.length > 0 && (
        <div className="mt-4 space-y-2">
          {block.rows.slice(0, 8).map((r) => (
            <div key={r.employee._id}>
              <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-gray-700">{r.employee.fullName}</span><span className="text-gray-500">{r.percent}%</span></div>
              <ProgressBar value={r.percent} tone={r.percent === 100 ? 'green' : 'primary'} />
            </div>
          ))}
        </div>
      )}
    </button>
  );

  return (
    <div>
      <ReportToolbar department={department} setDepartment={setDepartment} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="Onboarding" icon={UserPlus} block={data.onboarding} to="/onboarding" />
        <Section title="Offboarding" icon={UserMinus} block={data.offboarding} to="/offboarding" />
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = 'text-gray-900' }) {
  return (
    <div>
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function DateRange({ range, setRange }) {
  return (
    <>
      <div>
        <label className="label">From</label>
        <input type="date" className="input w-40" value={range.startDate} onChange={(e) => setRange({ ...range, startDate: e.target.value })} />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" className="input w-40" value={range.endDate} onChange={(e) => setRange({ ...range, endDate: e.target.value })} />
      </div>
    </>
  );
}