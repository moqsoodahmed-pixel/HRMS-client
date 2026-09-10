import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Users, UserCheck, UserX, CalendarClock, FileWarning, Cake, Building2,
  Megaphone, Activity, Package, Clock, UserPlus, UserMinus, Wallet, Plus,
  ShieldCheck, ScrollText, BarChart3, FileText, Check, X, Receipt, TrendingUp,
  LogIn, LogOut, CalendarDays, PartyPopper, ClipboardList, ShieldAlert, Lock,
  BadgeCheck, ClipboardCheck, Mail, Briefcase,
} from 'lucide-react';
import {
  dashboardAPI, attendanceAPI, leaveAPI, payrollAPI, documentAPI, announcementAPI,
  policyAPI, onboardingAPI, offboardingAPI, compensationAPI, auditAPI, performanceAPI,
} from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, ErrorState, EmptyState, Avatar, StatusBadge,
  ProgressBar, Modal, FormField,
} from '../components/ui';
import {
  formatCurrency, formatDate, formatNumber, humanise, relativeTime, duration, formatTime,
  errorMessage,
} from '../lib/format';
import { COMPANY_NAME } from '../constants';

export default function Dashboard() {
  const { role } = useAuth();

  if (role === 'EMPLOYEE') return <EmployeeDashboard />;
  if (role === 'AUDITOR') return <AuditorDashboard />;
  if (role === 'FINANCE') return <FinanceDashboard />;
  // IT_HEAD/PROJECT_HEAD get the same team-scoped shell as MANAGER — the
  // stats themselves are already narrowed (department or direct reports) by the backend.
  if (role === 'MANAGER' || role === 'IT_HEAD' || role === 'PROJECT_HEAD') return <ManagerDashboard />;
  if (role === 'HR_ADMIN') return <HRDashboard />;
  // DIRECTOR sees the full administrative dashboard, but strictly read-only.
  if (role === 'DIRECTOR') return <AdminDashboard readOnly />;
  // FOUNDER_CEO, CTO and legacy SUPER_ADMIN share the same full administrative dashboard.
  return <AdminDashboard />;
}

function useDashboardStats() {
  return useQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => dashboardAPI.stats() });
}

function greetingFor() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function DashboardShell({ title, subtitle, actions, children }) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </div>
  );
}

function StatsError({ error, onRetry }) {
  return <div className="card"><ErrorState error={error} onRetry={onRetry} title="Could not load the dashboard" /></div>;
}

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

function QuickActions({ actions }) {
  return (
    <div className="card mb-6 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Quick actions</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Link key={a.to} to={a.to} className="btn-secondary text-sm">
            <a.icon className="h-4 w-4" /> {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function DepartmentOverview({ distribution, isLoading }) {
  return (
    <section className="card p-5 lg:col-span-2">
      <div className="mb-4 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-gray-400" />
        <h2 className="section-title">Department overview</h2>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />)}</div>
      ) : !distribution?.length ? (
        <EmptyState icon={Building2} title="No department data" description="Add employees to see the breakdown here." />
      ) : (
        <div className="space-y-3">
          {distribution.map((d) => {
            const max = distribution[0].count || 1;
            return (
              <div key={d._id || 'unassigned'}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{d._id || 'Unassigned'}</span>
                  <span className="text-gray-500">{d.count}</span>
                </div>
                <ProgressBar value={(d.count / max) * 100} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BirthdaysCard({ birthdays, isLoading }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Cake className="h-4 w-4 text-gray-400" />
        <h2 className="section-title">Upcoming birthdays</h2>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}</div>
      ) : !birthdays?.length ? (
        <p className="py-6 text-center text-sm text-gray-500">No birthdays in the next 30 days.</p>
      ) : (
        <ul className="space-y-3">
          {birthdays.map((b) => (
            <li key={b._id} className="flex items-center gap-3">
              <Avatar name={b.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{b.fullName}</p>
                <p className="truncate text-xs text-gray-400">{b.department}</p>
              </div>
              <span className="flex-shrink-0 text-xs font-medium text-primary-600">
                {b.inDays === 0 ? 'Today' : b.inDays === 1 ? 'Tomorrow' : `in ${b.inDays}d`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AnnouncementsCard({ announcements, isLoading, title = 'Recent announcements' }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-gray-400" />
          <h2 className="section-title">{title}</h2>
        </div>
        <Link to="/announcements" className="text-sm text-primary-600 hover:underline">View all</Link>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />)}</div>
      ) : !announcements?.length ? (
        <p className="py-6 text-center text-sm text-gray-500">Nothing has been announced yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {announcements.map((a) => (
            <li key={a._id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{a.description}</p>
                </div>
                <StatusBadge status={a.priority} />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">{relativeTime(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityFeedCard({ activity, isLoading }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-gray-400" />
        <h2 className="section-title">Recent activity</h2>
      </div>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}</div>
      ) : !activity?.length ? (
        <p className="py-6 text-center text-sm text-gray-500">No recorded activity yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {activity.map((a) => (
            <li key={a._id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-800">
                  <span className="font-medium">{humanise(a.action)}</span>
                  {a.recordLabel ? <span className="text-gray-500"> · {a.recordLabel}</span> : null}
                </p>
                <p className="truncate text-xs text-gray-400">{a.userEmail}</p>
              </div>
              <span className="flex-shrink-0 text-[11px] text-gray-400">{relativeTime(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PayrollFigure({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? 'bg-primary-50' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent ? 'text-primary-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

/**
 * Pending compensation-change requests. `canAct` gates the Approve/Reject
 * buttons — only ever true for SUPER_ADMIN/CTO; HR and Finance see the same
 * queue read-only. The backend re-checks this on every call regardless.
 */
function CompensationQueue({ canAct }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(null);
  const query = useQuery({
    queryKey: ['compensation-requests', { status: 'PENDING' }],
    queryFn: () => compensationAPI.list({ status: 'PENDING', limit: 5 }),
  });
  const rows = query.data?.data?.data || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['compensation-requests'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const approve = useMutation({
    mutationFn: (id) => compensationAPI.approve(id),
    onSuccess: () => { toast.success('Compensation change approved'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: ({ id, comments }) => compensationAPI.reject(id, comments),
    onSuccess: () => { toast.success('Compensation request rejected'); refresh(); setRejecting(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-gray-400" />
          <h2 className="section-title">Pending compensation approvals</h2>
        </div>
        <Link to="/payroll?tab=compensation" className="text-sm text-primary-600 hover:underline">View all</Link>
      </div>
      {query.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />)}</div>
      ) : !rows.length ? (
        <p className="py-6 text-center text-sm text-gray-500">No compensation changes are waiting for approval.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r._id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{r.employee?.fullName}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(r.currentGross)} → {formatCurrency(r.proposedGross)}
                    <span className={r.changeAmount >= 0 ? 'ml-1 text-green-600' : 'ml-1 text-red-600'}>
                      ({r.changeAmount >= 0 ? '+' : ''}{formatCurrency(r.changeAmount)})
                    </span>
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-400">Requested by {r.requestedBy?.email} — {r.reason}</p>
                </div>
                {canAct && (
                  <div className="flex flex-shrink-0 gap-1.5">
                    <button type="button" className="rounded-lg p-1.5 text-green-600 transition hover:bg-green-50" onClick={() => approve.mutate(r._id)} disabled={approve.isPending} title="Approve">
                      <Check className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" onClick={() => setRejecting(r)} title="Reject">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject compensation request" size="sm">
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const comments = new FormData(e.target).get('comments')?.toString().trim();
            if (!comments) { toast.error('A reason is required.'); return; }
            reject.mutate({ id: rejecting._id, comments });
          }}
        >
          <FormField label="Reason" required>
            <textarea name="comments" className="input min-h-[80px]" />
          </FormField>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
            <button type="submit" className="btn-danger" disabled={reject.isPending}>{reject.isPending ? 'Rejecting…' : 'Reject'}</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* SUPER_ADMIN / CTO — full organisation overview                      */
/* ------------------------------------------------------------------ */

/** "312 days" / "4 months" / "2 years" — used only for the workspace-age chip. */
function ageFrom(dateValue) {
  if (!dateValue) return null;
  const days = Math.max(0, Math.floor((Date.now() - new Date(dateValue).getTime()) / 86400000));
  if (days < 60) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 730) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
}

function WorkspaceBar({ workspace }) {
  if (!workspace) return null;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-primary-100 bg-white/70 p-4 text-sm sm:grid-cols-4">
      <div>
        <p className="text-xs text-gray-400">Tenant Code</p>
        <p className="font-semibold text-gray-800">{workspace.tenantCode || '—'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Workspace Age</p>
        <p className="font-semibold text-gray-800">{ageFrom(workspace.createdAt) || '—'}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Subscription</p>
        <p className="font-semibold text-gray-800">{humanise(workspace.subscription?.status)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-400">Expiry Date</p>
        <p className="font-semibold text-gray-800">{formatDate(workspace.subscription?.expiresAt)}</p>
      </div>
    </div>
  );
}

function DashboardHero({ title, subtitle }) {
  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary-700 to-primary-500 p-6 text-white shadow-sm sm:p-8">
      <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-primary-50">{subtitle}</p>
    </div>
  );
}

/**
 * Payroll is treated as a first-class dashboard component here because
 * payroll/salary is processed in collaboration with an external partner
 * ("XYZ") — no calculation logic lives on the frontend; this only renders
 * whatever server/controllers/payrollController.js and dashboardController.js
 * already computed from real Payslip/SalaryStructure records. `integration`
 * is a placeholder shape (honestly reported as not connected) for that future
 * XYZ sync to plug into — see dashboardController.getDashboardStats.
 */
function PayrollDashboardCard({ payroll }) {
  const { can } = useAuth();
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-gray-400" /><h2 className="section-title">Payroll & Salary</h2></div>
        {can('viewPayroll') && <Link to="/payroll" className="btn-secondary">Open payroll</Link>}
      </div>

      {!payroll || payroll.payslips === 0 ? (
        <EmptyState icon={Wallet} title="No Payslips Yet" description="No payslips have been generated for the current period." />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusBadge status={payroll.status} />
            <span className="text-xs text-gray-400">Period: {new Date(payroll.year, payroll.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <PayrollFigure label="Gross payroll" value={formatCurrency(payroll.grossPayroll, { compact: true })} />
            <PayrollFigure label="Deductions" value={formatCurrency(payroll.totalDeductions, { compact: true })} />
            <PayrollFigure label="Net payroll" value={formatCurrency(payroll.netPayroll, { compact: true })} accent />
            <PayrollFigure label="Employees paid" value={`${formatNumber(payroll.employeesPaid)} / ${formatNumber(payroll.payslips)}`} />
          </div>
          {payroll.pendingActions > 0 && (
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              {payroll.pendingActions} active employee(s) still need a payslip generated this period.
            </p>
          )}
        </>
      )}

      <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">{payroll?.integration?.provider || 'XYZ'} Payroll Integration</span>
          <StatusBadge status={payroll?.integration?.status || 'NOT_CONNECTED'} tone="gray" />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Salary processing is handled by our external payroll partner. This connection isn't set up yet — once it is, sync status and processing details will appear here automatically.
        </p>
      </div>
      {payroll?.errors?.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-red-600">
          {payroll.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
    </section>
  );
}

/** Real attendance/employee-derived signal, standing in for org performance until a dedicated review system exists. */
function OrganizationPerformance({ stats, isLoading }) {
  // Denominator matches the numerator's population (status !== INACTIVE) —
  // using `activeEmployees` (status === ACTIVE only) here could push this over 100%.
  const rate = stats?.attendanceEligibleEmployees ? Math.min(100, Math.round((stats.presentToday / stats.attendanceEligibleEmployees) * 100)) : null;
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-gray-400" /><h2 className="section-title">Organization Performance</h2></div>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded bg-gray-100" />
      ) : rate === null ? (
        <EmptyState icon={TrendingUp} title="Not enough data yet" description="Performance signals will appear once employees and attendance are recorded." />
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Attendance rate today</span>
            <span className="text-gray-500">{rate}%</span>
          </div>
          <ProgressBar value={rate} tone={rate >= 80 ? 'green' : rate >= 50 ? 'amber' : 'red'} />
          <div className="mt-4 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
            <div><p className="text-lg font-bold text-gray-900">{formatNumber(stats?.activeEmployees)}</p><p className="text-xs text-gray-400">Active</p></div>
            <div><p className="text-lg font-bold text-amber-600">{formatNumber(stats?.probation)}</p><p className="text-xs text-gray-400">Probation</p></div>
            <div><p className="text-lg font-bold text-orange-600">{formatNumber(stats?.noticePeriod)}</p><p className="text-xs text-gray-400">Notice period</p></div>
          </div>
        </>
      )}
    </section>
  );
}

function AdminDashboard({ readOnly = false }) {
  const { user, employee } = useAuth();
  const { data, isLoading, error, refetch } = useDashboardStats();
  const payload = data?.data?.data;
  const stats = payload?.stats;
  const displayName = employee?.fullName?.split(' ')[0] || user?.email?.split('@')[0];

  if (error) return <StatsError error={error} onRetry={refetch} />;

  // Every pending-request queue in the app, not just leave/docs/onboarding/compensation —
  // attendance corrections/unlocks, profile edit requests and exit requests also count here.
  const pendingRequests = (stats?.pendingLeave || 0) + (stats?.pendingDocs || 0)
    + (stats?.pendingOnboarding || 0) + (payload?.pendingCompensationRequests || 0)
    + (stats?.pendingAttendanceRequests || 0) + (stats?.pendingEditRequests || 0) + (stats?.pendingExitRequests || 0);
  // Clamped defensively — numerator/denominator already share the same employee
  // population (see dashboardController.js), but a percentage must never display over 100 regardless.
  const attendanceRate = stats?.attendanceEligibleEmployees ? Math.min(100, Math.round((stats.presentToday / stats.attendanceEligibleEmployees) * 100)) : 0;

  const cards = [
    { label: 'Total Employees', value: formatNumber(stats?.totalEmployees), icon: Users, tone: 'indigo', hint: `${formatNumber(stats?.activeEmployees)} active` },
    { label: 'Attendance Today', value: `${attendanceRate}%`, icon: UserCheck, tone: 'green', hint: `${formatNumber(stats?.presentToday)} present` },
    { label: 'Pending Requests', value: formatNumber(pendingRequests), icon: CalendarClock, tone: 'amber', hint: `${formatNumber(stats?.pendingOnboarding)} onboarding, ${formatNumber(stats?.pendingLeave)} leave` },
    {
      // payload.payroll is a real object as soon as the caller can view payroll at
      // all (payslips: 0 included) — must check payslips > 0, not just truthiness,
      // or a zero-payslip period would render "₹0" instead of the honest empty
      // state the detailed PayrollDashboardCard below already shows.
      label: 'Monthly Payroll',
      value: payload?.payroll?.payslips > 0 ? formatCurrency(payload.payroll.netPayroll, { compact: true }) : 'No Payslips Yet',
      icon: Wallet,
      tone: 'purple',
      hint: payload?.payroll?.payslips > 0 ? humanise(payload.payroll.status) : 'Not processed',
    },
  ];

  return (
    <div>
      <WorkspaceBar workspace={payload?.workspace} />
      <DashboardHero
        title="Manage Your Entire Workforce Efficiently"
        subtitle="Monitor employees, payroll, attendance, invoices and company operations from one centralized dashboard."
      />
      <DashboardShell title={`${greetingFor()}, ${displayName}`} subtitle={readOnly ? `Full organisation overview (read-only) — ${formatDate(new Date())}.` : `Full organisation overview — ${formatDate(new Date())}.`}>
        <QuickActions actions={[
          ...(readOnly ? [] : [{ to: '/employees/new', label: 'Add Employee', icon: Plus }]),
          { to: '/attendance', label: 'Attendance', icon: Clock },
          { to: '/leave', label: 'Leave', icon: CalendarDays },
          { to: '/payroll', label: 'Payroll', icon: Wallet },
          { to: '/documents', label: 'Documents', icon: FileText },
          { to: '/assets', label: 'Assets', icon: Package },
          { to: '/reports', label: 'Reports', icon: BarChart3 },
          { to: '/audit', label: 'Audit Logs', icon: ScrollText },
        ]} />

        {isLoading ? <StatCardSkeleton count={4} /> : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => <StatCard key={c.label} {...c} />)}
          </div>
        )}

        <div className="mt-6"><PayrollDashboardCard payroll={payload?.payroll} /></div>

        {payload?.pendingCompensationRequests > 0 && (
          <div className="mt-6"><CompensationQueue canAct={!readOnly} /></div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OrganizationPerformance stats={stats} isLoading={isLoading} />
          <BirthdaysCard birthdays={payload?.upcomingBirthdays} isLoading={isLoading} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DepartmentOverview distribution={payload?.departmentDistribution} isLoading={isLoading} />
          <AnnouncementsCard announcements={payload?.announcements} isLoading={isLoading} />
        </div>

        <div className="mt-6"><ActivityFeedCard activity={payload?.recentActivity} isLoading={isLoading} /></div>
      </DashboardShell>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HR_ADMIN — HR operations focused                                     */
/* ------------------------------------------------------------------ */

function HRDashboard() {
  const { user, employee } = useAuth();
  const { data, isLoading, error, refetch } = useDashboardStats();
  const payload = data?.data?.data;
  const stats = payload?.stats;
  const displayName = employee?.fullName?.split(' ')[0] || user?.email?.split('@')[0];

  const onboardingQuery = useQuery({ queryKey: ['onboarding', 'overview', {}], queryFn: () => onboardingAPI.overview() });
  const offboardingQuery = useQuery({ queryKey: ['offboarding', 'overview', {}], queryFn: () => offboardingAPI.overview() });
  const onMeta = onboardingQuery.data?.data?.meta;
  const offMeta = offboardingQuery.data?.data?.meta;

  if (error) return <StatsError error={error} onRetry={refetch} />;

  const cards = [
    { label: 'Total Employees', value: formatNumber(stats?.totalEmployees), icon: Users, tone: 'indigo', hint: `${formatNumber(stats?.activeEmployees)} active` },
    { label: 'Present Today', value: formatNumber(stats?.presentToday), icon: UserCheck, tone: 'green' },
    { label: 'Absent Today', value: formatNumber(stats?.absentToday), icon: UserX, tone: 'red' },
    { label: 'On Leave', value: formatNumber(stats?.onLeaveEmployees), icon: CalendarClock, tone: 'blue', hint: `${formatNumber(stats?.pendingLeave)} pending requests` },
    { label: 'Documents to Verify', value: formatNumber(stats?.pendingDocs), icon: FileWarning, tone: 'amber' },
    { label: 'Probation', value: formatNumber(stats?.probation), icon: Clock, tone: 'amber' },
    { label: 'Notice Period', value: formatNumber(stats?.noticePeriod), icon: UserMinus, tone: 'orange' },
    { label: 'Joined This Month', value: formatNumber(stats?.newJoiners), icon: UserPlus, tone: 'green' },
  ];

  return (
    <DashboardShell title={`${greetingFor()}, ${displayName}`} subtitle={`HR overview — ${formatDate(new Date())}.`}>
      <QuickActions actions={[
        { to: '/employees/new', label: 'Add Employee', icon: Plus },
        { to: '/attendance', label: 'Attendance', icon: Clock },
        { to: '/leave', label: 'Leave', icon: CalendarDays },
        { to: '/documents', label: 'Documents', icon: FileText },
        { to: '/onboarding', label: 'Onboarding', icon: UserPlus },
        { to: '/offboarding', label: 'Offboarding', icon: UserMinus },
        { to: '/announcements', label: 'Announcements', icon: Megaphone },
        { to: '/policies', label: 'Policies', icon: ShieldCheck },
      ]} />

      {isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => <StatCard key={c.label} {...c} />)}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LifecycleProgressCard title="Onboarding progress" icon={UserPlus} meta={onMeta} isLoading={onboardingQuery.isLoading} to="/onboarding" />
        <LifecycleProgressCard title="Offboarding progress" icon={UserMinus} meta={offMeta} isLoading={offboardingQuery.isLoading} to="/offboarding" />
      </div>

      <div className="mt-6"><CompensationQueue canAct={false} /></div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DepartmentOverview distribution={payload?.departmentDistribution} isLoading={isLoading} />
        <BirthdaysCard birthdays={payload?.upcomingBirthdays} isLoading={isLoading} />
      </div>

      <div className="mt-6"><AnnouncementsCard announcements={payload?.announcements} isLoading={isLoading} title="HR announcements" /></div>
    </DashboardShell>
  );
}

function LifecycleProgressCard({ title, icon: Icon, meta, isLoading, to }) {
  const total = meta ? meta.notStarted + meta.inProgress + meta.completed : 0;
  const pct = total ? Math.round((meta.completed / total) * 100) : 0;
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-gray-400" /><h2 className="section-title">{title}</h2></div>
        <Link to={to} className="text-sm text-primary-600 hover:underline">Open</Link>
      </div>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded bg-gray-100" />
      ) : !total ? (
        <p className="py-4 text-center text-sm text-gray-500">Nobody is currently in this journey.</p>
      ) : (
        <>
          <ProgressBar value={pct} tone={pct === 100 ? 'green' : 'primary'} label={`${meta.completed} of ${total} complete`} />
          <div className="mt-4 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
            <div><p className="text-lg font-bold text-gray-500">{meta.notStarted}</p><p className="text-xs text-gray-400">Not started</p></div>
            <div><p className="text-lg font-bold text-amber-600">{meta.inProgress}</p><p className="text-xs text-gray-400">In progress</p></div>
            <div><p className="text-lg font-bold text-green-600">{meta.completed}</p><p className="text-xs text-gray-400">Completed</p></div>
          </div>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FINANCE — payroll focused                                           */
/* ------------------------------------------------------------------ */

function FinanceDashboard() {
  const { user, employee } = useAuth();
  const now = new Date();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payroll', 'summary', { month: now.getMonth() + 1, year: now.getFullYear() }],
    queryFn: () => payrollAPI.summary({ month: now.getMonth() + 1, year: now.getFullYear() }),
  });
  const s = data?.data?.data;
  const displayName = employee?.fullName?.split(' ')[0] || user?.email?.split('@')[0];

  if (error) return <StatsError error={error} onRetry={refetch} />;

  return (
    <DashboardShell title={`${greetingFor()}, ${displayName}`} subtitle={`Payroll overview — ${formatDate(new Date())}.`}>
      <QuickActions actions={[
        { to: '/payroll', label: 'Payroll', icon: Wallet },
        { to: '/reports', label: 'Reports', icon: BarChart3 },
      ]} />

      {isLoading ? <StatCardSkeleton count={5} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Gross Payroll" value={formatCurrency(s?.grossPayroll, { compact: true })} icon={TrendingUp} tone="indigo" hint={`${s?.payslipCount ?? 0} payslip(s)`} />
          <StatCard label="Total Deductions" value={formatCurrency(s?.totalDeductions, { compact: true })} icon={Receipt} tone="red" />
          <StatCard label="Net Payroll" value={formatCurrency(s?.netPayroll, { compact: true })} icon={Wallet} tone="green" />
          <StatCard label="Employees Paid" value={formatNumber(s?.employeesPaid)} icon={UserCheck} tone="blue" hint={formatCurrency(s?.paidAmount, { compact: true })} />
          <StatCard label="Pending Payroll" value={formatNumber(s?.pendingPayslips)} icon={Clock} tone="amber" hint={`${s?.activeStructures ?? 0} active structures`} />
        </div>
      )}

      {s?.employeesWithoutStructure > 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {s.employeesWithoutStructure} active employee(s) have no salary structure yet.
        </p>
      )}

      <div className="mt-6"><CompensationQueue canAct={false} /></div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */
/* MANAGER — team focused                                              */
/* ------------------------------------------------------------------ */

function ManagerDashboard() {
  const { user, employee } = useAuth();
  const { data, isLoading, error, refetch } = useDashboardStats();
  const payload = data?.data?.data;
  const stats = payload?.stats;
  const displayName = employee?.fullName?.split(' ')[0] || user?.email?.split('@')[0];

  if (error) return <StatsError error={error} onRetry={refetch} />;

  const cards = [
    { label: 'Team Size', value: formatNumber(stats?.totalEmployees), icon: Users, tone: 'indigo' },
    { label: 'Present Today', value: formatNumber(stats?.presentToday), icon: UserCheck, tone: 'green' },
    { label: 'Absent Today', value: formatNumber(stats?.absentToday), icon: UserX, tone: 'red' },
    { label: 'On Leave', value: formatNumber(stats?.onLeaveEmployees), icon: CalendarClock, tone: 'blue', hint: `${formatNumber(stats?.pendingLeave)} pending approval` },
  ];

  return (
    <DashboardShell title={`${greetingFor()}, ${displayName}`} subtitle={`Your team's overview — ${formatDate(new Date())}.`}>
      <QuickActions actions={[
        { to: '/attendance', label: 'Team Attendance', icon: Clock },
        { to: '/leave', label: 'Team Leave', icon: CalendarDays },
        { to: '/employees', label: 'My Team', icon: Users },
      ]} />

      {isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => <StatCard key={c.label} {...c} />)}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" /><h2 className="section-title">Today's attendance breakdown</h2></div>
          {isLoading ? <div className="h-24 animate-pulse rounded bg-gray-100" /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {['PRESENT', 'LATE', 'WORK_FROM_HOME', 'HALF_DAY', 'ON_LEAVE', 'ABSENT'].map((s) => (
                <div key={s} className="rounded-lg bg-gray-50 p-3 text-center">
                  <p className="text-lg font-bold text-gray-900">{payload?.attendanceByStatus?.[s] || 0}</p>
                  <p className="text-xs text-gray-400">{humanise(s)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <AnnouncementsCard announcements={payload?.announcements} isLoading={isLoading} title="Team announcements" />
      </div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */
/* AUDITOR — read-only, audit focused                                   */
/* ------------------------------------------------------------------ */

function AuditorDashboard() {
  const { user, employee } = useAuth();
  const displayName = employee?.fullName?.split(' ')[0] || user?.email?.split('@')[0];
  const auditQuery = useQuery({ queryKey: ['audit', 'list', { limit: 10 }], queryFn: () => auditAPI.list({ limit: 10 }) });
  const filtersQuery = useQuery({ queryKey: ['audit', 'filters'], queryFn: () => auditAPI.filters() });
  const rows = auditQuery.data?.data?.data || [];
  const meta = auditQuery.data?.data?.meta;
  const filters = filtersQuery.data?.data?.data;

  if (auditQuery.error) return <StatsError error={auditQuery.error} onRetry={auditQuery.refetch} />;

  return (
    <DashboardShell title={`${greetingFor()}, ${displayName}`} subtitle="Read-only audit and security overview.">
      <QuickActions actions={[
        { to: '/audit', label: 'Audit Logs', icon: ScrollText },
        { to: '/reports', label: 'Reports', icon: BarChart3 },
      ]} />

      {auditQuery.isLoading ? <StatCardSkeleton count={3} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Audit Entries" value={formatNumber(meta?.total)} icon={ScrollText} tone="indigo" />
          <StatCard label="Modules Tracked" value={formatNumber(filters?.modules?.length)} icon={ShieldAlert} tone="blue" />
          <StatCard label="Action Types" value={formatNumber(filters?.actions?.length)} icon={ClipboardList} tone="purple" />
        </div>
      )}

      <div className="card mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-gray-400" /><h2 className="section-title">Recent activity</h2></div>
          <Link to="/audit" className="text-sm text-primary-600 hover:underline">Open full log</Link>
        </div>
        {auditQuery.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}</div>
        ) : !rows.length ? (
          <p className="py-6 text-center text-sm text-gray-500">No audit entries recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((a) => (
              <li key={a._id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-800">
                    <span className="font-medium">{humanise(a.action)}</span>
                    <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{a.module}</span>
                    {a.recordLabel ? <span className="text-gray-500"> · {a.recordLabel}</span> : null}
                  </p>
                  <p className="truncate text-xs text-gray-400">{a.userEmail || 'System'}</p>
                </div>
                <span className="flex-shrink-0 text-[11px] text-gray-400">{relativeTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}

/* ------------------------------------------------------------------ */
/* EMPLOYEE — self-service only                                        */
/* ------------------------------------------------------------------ */

/**
 * Shown instead of the full self-service dashboard while
 * Employee.onboardingStatus !== APPROVED. Deliberately exposes nothing from
 * the locked modules (no attendance/leave/payroll/document data) — only
 * identity, onboarding status, and progress toward completing the wizard.
 */
function OnboardingRequiredDashboard({ displayName }) {
  const { employee } = useAuth();
  const status = employee?.onboardingStatus || 'NOT_STARTED';
  const step = employee?.onboardingStep || 0;
  const pct = Math.round((Math.min(step, 6) / 6) * 100);

  const statusCopy = {
    NOT_STARTED: { label: 'Not started', tone: 'text-gray-600 bg-gray-100', message: "Let's get you set up — complete your onboarding to unlock your workspace." },
    IN_PROGRESS: { label: 'In progress', tone: 'text-amber-700 bg-amber-100', message: 'Pick up where you left off and finish the remaining steps.' },
    SUBMITTED: { label: 'Submitted — awaiting approval', tone: 'text-blue-700 bg-blue-100', message: 'Onboarding submitted successfully. Waiting for HR/Admin approval.' },
    REJECTED: { label: 'Changes requested', tone: 'text-red-700 bg-red-100', message: 'HR/Admin asked for a correction. Review the note below and resubmit.' },
  }[status] || { label: status, tone: 'text-gray-600 bg-gray-100', message: '' };

  return (
    <DashboardShell title={`Welcome back, ${displayName}`} subtitle="Complete your onboarding to unlock your workspace.">
      <div className="card p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <BadgeCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Employee ID</p>
              <p className="text-base font-semibold text-gray-900">{employee?.employeeCode || '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Account status</p>
            <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusCopy.tone}`}>{statusCopy.label}</span>
          </div>
          <Link to="/onboarding/me" className="btn-primary">
            <ClipboardCheck className="h-4 w-4" /> Complete Onboarding
          </Link>
        </div>

        {statusCopy.message && <p className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">{statusCopy.message}</p>}

        {status === 'REJECTED' && employee?.onboardingRejectionReason && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-semibold">HR/Admin note: </span>{employee.onboardingRejectionReason}
          </p>
        )}

        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Profile completion</span>
            <span className="text-gray-500">{status === 'SUBMITTED' ? 100 : pct}%</span>
          </div>
          <ProgressBar value={status === 'SUBMITTED' ? 100 : pct} tone={status === 'SUBMITTED' ? 'green' : 'primary'} />
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
          <Lock className="h-3.5 w-3.5" />
          Attendance, leave, documents, payroll and other modules stay locked until HR/Admin approves your onboarding.
        </div>
      </div>
    </DashboardShell>
  );
}

function EmployeeProfileCard({ employee }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-gray-400" /><h2 className="section-title">My Profile</h2></div>
      <div className="flex items-center gap-4">
        <Avatar name={employee?.fullName} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900">{employee?.fullName || '—'}</p>
          <p className="truncate text-xs text-gray-400">{employee?.employeeCode}</p>
        </div>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5 text-gray-500"><Mail className="h-3.5 w-3.5" /> Email</dt>
          <dd className="truncate font-medium text-gray-900">{employee?.officialEmail || '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5 text-gray-500"><Building2 className="h-3.5 w-3.5" /> Department</dt>
          <dd className="font-medium text-gray-900">{employee?.department || '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="flex items-center gap-1.5 text-gray-500"><Briefcase className="h-3.5 w-3.5" /> Designation</dt>
          <dd className="font-medium text-gray-900">{employee?.designation || '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-500">Company</dt>
          <dd className="text-right font-medium text-gray-900">{COMPANY_NAME}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-gray-500">Employment Type</dt>
          <dd className="font-medium text-gray-900">{employee?.employmentType ? humanise(employee.employmentType) : '—'}</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * There is no per-employee "my own activity" API in this codebase — the audit
 * trail (see server/controllers/notificationController.js getAuditLogs) is
 * intentionally restricted to AUDIT_ROLES only, and that restriction is
 * correct to keep. Rather than build a new endpoint/permission for this, the
 * card is honest about there being nothing to show yet.
 */
function RecentActivitiesCard() {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-gray-400" /><h2 className="section-title">Recent Activities</h2></div>
      <p className="py-6 text-center text-sm text-gray-500">No recent activities</p>
    </section>
  );
}

function EmployeeDashboard() {
  const { user, employee, needsOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const displayName = employee?.fullName || user?.email?.split('@')[0];

  // While onboarding is not APPROVED, none of the operational modules below
  // are reachable server-side either (see requireOnboardingApproved) — skip
  // firing these requests entirely rather than let them 403.
  const todayQuery = useQuery({ queryKey: ['attendance', 'today'], queryFn: () => attendanceAPI.today(), enabled: !needsOnboarding });
  const balancesQuery = useQuery({ queryKey: ['leave', 'balances', 'me'], queryFn: () => leaveAPI.myBalances(), enabled: !needsOnboarding });
  const leaveQuery = useQuery({ queryKey: ['leave', 'requests', { limit: 5, mine: true }], queryFn: () => leaveAPI.requests({ limit: 5 }), enabled: !needsOnboarding });
  const approvedLeaveQuery = useQuery({ queryKey: ['leave', 'requests', { status: 'APPROVED', mine: true }], queryFn: () => leaveAPI.requests({ status: 'APPROVED', limit: 1 }), enabled: !needsOnboarding });
  const holidaysQuery = useQuery({ queryKey: ['leave', 'holidays', {}], queryFn: () => leaveAPI.holidays(), enabled: !needsOnboarding });
  const payslipsQuery = useQuery({ queryKey: ['payroll', 'payslips', { limit: 3, mine: true }], queryFn: () => payrollAPI.payslips({ limit: 3 }), enabled: !needsOnboarding });
  const checklistQuery = useQuery({
    queryKey: ['documents', 'checklist', employee?._id],
    queryFn: () => documentAPI.checklist(employee._id),
    enabled: Boolean(employee?._id) && !needsOnboarding,
  });
  const announcementsQuery = useQuery({ queryKey: ['announcements', { limit: 5 }], queryFn: () => announcementAPI.list({ limit: 5 }) });
  const policiesQuery = useQuery({ queryKey: ['policies'], queryFn: () => policyAPI.list() });
  const performanceQuery = useQuery({ queryKey: ['performance', 'my-reviews'], queryFn: () => performanceAPI.myReviews(), enabled: !needsOnboarding });

  if (needsOnboarding) return <OnboardingRequiredDashboard displayName={displayName} />;

  const myToday = todayQuery.data?.data?.data;
  const balances = balancesQuery.data?.data?.data || [];
  const recentLeave = leaveQuery.data?.data?.data || [];
  const approvedLeaveCount = approvedLeaveQuery.data?.data?.meta?.total ?? 0;
  const allHolidays = holidaysQuery.data?.data?.data || [];
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const sortedHolidays = [...allHolidays].sort((a, b) => new Date(a.date) - new Date(b.date));
  const pastHolidays = sortedHolidays.filter((h) => new Date(h.date) < todayStart).slice(-2);
  const futureHolidays = sortedHolidays.filter((h) => new Date(h.date) >= todayStart).slice(0, 4);
  // A short window around today — a couple of recent (Completed) plus the next few (Upcoming) —
  // rather than the full-year calendar, so the dashboard card stays scannable.
  const holidayWindow = [...pastHolidays, ...futureHolidays].map((h) => ({ ...h, isPast: new Date(h.date) < todayStart }));
  const payslips = payslipsQuery.data?.data?.data || [];
  const latestPayslip = payslips[0] || null;
  const myReviews = performanceQuery.data?.data?.data || [];
  // myReviews is already sorted newest-first by the server (createdAt: -1).
  const latestReview = myReviews[0] || null;
  const checklist = checklistQuery.data?.data?.data;
  const announcements = announcementsQuery.data?.data?.data || [];
  const pendingPolicies = (policiesQuery.data?.data?.data || []).filter((p) => p.isAcknowledgementRequired && !p.isAcknowledged);

  const refreshAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const checkIn = useMutation({
    mutationFn: () => attendanceAPI.checkIn(),
    onSuccess: () => { toast.success('Checked in'); refreshAttendance(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const checkOut = useMutation({
    mutationFn: () => attendanceAPI.checkOut(),
    onSuccess: () => { toast.success('Checked out'); refreshAttendance(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const totalAvailable = balances.reduce((sum, b) => sum + (b.remainingDays || 0), 0);
  const totalUsed = balances.reduce((sum, b) => sum + (b.usedDays || 0), 0);
  const pendingLeaveCount = recentLeave.filter((r) => r.status === 'PENDING').length;

  return (
    <DashboardShell
      title={`Welcome Back, ${displayName}`}
      subtitle="Manage your work, attendance, payroll, leave requests, and company updates from one unified dashboard."
    >
      <div className="card mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
        <div><span className="text-gray-400">Employee ID </span><span className="font-semibold text-gray-800">{employee?.employeeCode || '—'}</span></div>
        <div><span className="text-gray-400">Status </span><StatusBadge status={employee?.status} /></div>
      </div>

      {/* Check-in / check-out */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><Clock className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">My attendance today</p>
              <p className="text-xs text-gray-500">{myToday?.shift ? `Shift ${myToday.shift.start} – ${myToday.shift.end}` : ''} · {formatDate(new Date())}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            <div><p className="text-xs uppercase tracking-wide text-gray-400">Status</p><div className="mt-1">{myToday?.record ? <StatusBadge status={myToday.record.status} /> : <span className="text-sm text-gray-400">Not marked</span>}</div></div>
            <div><p className="text-xs uppercase tracking-wide text-gray-400">Check in</p><p className="mt-1 text-sm font-medium">{formatTime(myToday?.record?.checkIn)}</p></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">{myToday?.record?.checkOut ? 'Check out' : 'Working'}</p>
              <p className="mt-1 text-sm font-medium">{myToday?.record?.checkOut ? formatTime(myToday.record.checkOut) : myToday?.record?.checkIn ? duration(myToday.record.checkIn) : '—'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => checkIn.mutate()} disabled={checkIn.isPending || Boolean(myToday?.record?.checkIn)}>
              <LogIn className="h-4 w-4" /> Check in
            </button>
            <button type="button" className="btn-secondary" onClick={() => checkOut.mutate()} disabled={checkOut.isPending || !myToday?.record?.checkIn || Boolean(myToday?.record?.checkOut)}>
              <LogOut className="h-4 w-4" /> Check out
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Attendance Today"
          value={myToday?.record ? humanise(myToday.record.status) : 'Not marked'}
          icon={Clock}
          tone={myToday?.record ? 'green' : 'gray'}
        />
        <StatCard label="Approved Leaves" value={approvedLeaveQuery.isLoading ? '—' : formatNumber(approvedLeaveCount)} icon={CalendarDays} tone="indigo" />
        <StatCard
          label="Latest Payslip"
          value={latestPayslip ? new Date(latestPayslip.year, latestPayslip.month - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'No Payslip'}
          icon={Receipt}
          tone={latestPayslip ? 'green' : 'gray'}
          hint={latestPayslip ? humanise(latestPayslip.status) : ''}
        />
        <StatCard
          label="Performance"
          value={latestReview?.overallRating != null ? `${latestReview.overallRating.toFixed(1)} / 5` : 'No Reviews Yet'}
          icon={TrendingUp}
          tone={latestReview?.overallRating != null ? 'purple' : 'gray'}
          hint={latestReview ? `${latestReview.reviewPeriod} · ${humanise(latestReview.status)}` : ''}
        />
      </div>

      {checklist && !checklist.summary.isComplete && employee?._id && (
        <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <FileWarning className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">Action required: Complete your employee documentation.</p>
          </div>
          <Link to={`/employees/${employee._id}?tab=documents`} className="btn-primary flex-shrink-0">
            Complete Documents
          </Link>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EmployeeProfileCard employee={employee} />
        <RecentActivitiesCard />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Leave balances */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-gray-400" /><h2 className="section-title">Leave balances</h2></div>
            <Link to="/leave" className="text-sm text-primary-600 hover:underline">Apply for leave</Link>
          </div>
          {balancesQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}</div>
          ) : !balances.length ? (
            <p className="py-6 text-center text-sm text-gray-500">No leave balances yet.</p>
          ) : (
            <div className="space-y-3">
              {balances.map((b) => (
                <div key={b._id}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-gray-700">{b.leaveType?.name}</span><span className="text-gray-500">{b.remainingDays} / {b.totalDays} d</span></div>
                  <ProgressBar value={b.totalDays ? ((b.usedDays + b.pendingDays) / b.totalDays) * 100 : 0} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Required documents */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-gray-400" /><h2 className="section-title">Required documents</h2></div>
            {employee?._id && <Link to={`/employees/${employee._id}`} className="text-sm text-primary-600 hover:underline">Manage</Link>}
          </div>
          {checklistQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />)}</div>
          ) : !checklist ? (
            <p className="py-6 text-center text-sm text-gray-500">No employee profile is linked to your account.</p>
          ) : (
            <ul className="space-y-2">
              {checklist.items.filter((i) => i.required).map((item) => (
                <li key={item.category} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.label}</span>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent payslips */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-gray-400" /><h2 className="section-title">My recent payslips</h2></div>
            <Link to="/payroll" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          {payslipsQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />)}</div>
          ) : !payslips.length ? (
            <p className="py-6 text-center text-sm text-gray-500">No payslips have been issued to you yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {payslips.map((p) => (
                <li key={p._id} className="flex items-center justify-between py-2.5 text-sm first:pt-0">
                  <span className="text-gray-700">{new Date(p.year, p.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(p.netSalary)}</span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Holidays — company calendar, status derived from the real date */}
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2"><PartyPopper className="h-4 w-4 text-gray-400" /><h2 className="section-title">Holidays</h2></div>
          {holidaysQuery.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />)}</div>
          ) : !holidayWindow.length ? (
            <p className="py-6 text-center text-sm text-gray-500">No holidays on the calendar.</p>
          ) : (
            <ul className="space-y-2">
              {holidayWindow.map((h) => (
                <li key={h._id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{h.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{formatDate(h.date)}</span>
                    <StatusBadge status={h.isPast ? 'COMPLETED' : 'UPCOMING'} tone={h.isPast ? 'gray' : 'blue'} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {pendingPolicies.length > 0 && (
        <div className="card mt-6 p-5">
          <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gray-400" /><h2 className="section-title">Policies awaiting your acknowledgement</h2></div>
          <ul className="space-y-2">
            {pendingPolicies.map((p) => (
              <li key={p._id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.title} <span className="text-gray-400">(v{p.version})</span></span>
                <Link to="/policies" className="text-primary-600 hover:underline">Review</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6"><AnnouncementsCard announcements={announcements} isLoading={announcementsQuery.isLoading} /></div>
    </DashboardShell>
  );
}