import { useQuery } from '@tanstack/react-query';
import {
  Database, RefreshCw, ShieldCheck, Users, Phone, Building2, ClipboardCheck,
} from 'lucide-react';
import { diagnosticsAPI } from '../api/axios';
import { PageHeader, LoadingBlock, EmptyState, StatCard } from '../components/ui';
import { errorMessage, formatDateTime } from '../lib/format';

/**
 * Read-only "does the app match what's in the database" view — the app-side
 * alternative to opening MongoDB Atlas directly. Every number here comes
 * from GET /api/diagnostics/data-health, which reads live counts straight
 * from the same collections the rest of the app uses (see
 * diagnosticsController.js) — nothing here is cached or approximated.
 */
function Breakdown({ title, icon: Icon, rows, labelKey, valueKey = 'count', emptyText = 'No data yet.' }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{row[labelKey]}</span>
              <span className="font-semibold text-gray-900">{row[valueKey]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DataHealth() {
  const query = useQuery({
    queryKey: ['diagnostics', 'data-health'],
    queryFn: () => diagnosticsAPI.dataHealth(),
  });

  const data = query.data?.data?.data;

  return (
    <div>
      <PageHeader
        title="Data Health Check"
        subtitle="Live counts straight from the database — the app-side alternative to checking MongoDB Atlas directly"
        actions={
          <button onClick={() => query.refetch()} className="btn-secondary flex items-center gap-2" disabled={query.isFetching}>
            <RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
        <p className="text-sm text-blue-800">
          This page only reads data — nothing here can be edited or deleted. It exists so a count can be
          double-checked against the database without needing direct MongoDB Atlas access, which would mean
          opening the production database to outside connections just to look something up.
        </p>
      </div>

      {query.isLoading ? (
        <LoadingBlock label="Reading live counts…" />
      ) : query.isError ? (
        <EmptyState
          icon={ShieldCheck}
          title="Could not load data health"
          description={errorMessage(query.error, 'Something went wrong loading these counts.')}
        />
      ) : !data ? (
        <EmptyState icon={Database} title="No data yet" description="Nothing to show." />
      ) : (
        <>
          <p className="mb-4 text-xs text-gray-400">Generated {formatDateTime(data.generatedAt)}</p>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Leads" value={data.leads.total} icon={Phone} tone="indigo" />
            <StatCard label="Unassigned Leads" value={data.leads.unassigned} icon={Phone} tone={data.leads.unassigned > 0 ? 'amber' : 'green'} />
            <StatCard label="Active Employees" value={data.employees.totalActive} icon={Users} tone="blue" />
            <StatCard
              label="Onboarding Not Approved"
              value={data.employees.byOnboardingStatus.filter((r) => r.status !== 'APPROVED').reduce((sum, r) => sum + r.count, 0)}
              icon={ClipboardCheck}
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Breakdown title="Leads by Status" icon={Phone} rows={data.leads.byStatus} labelKey="status" />
            <Breakdown title="Leads by State" icon={Building2} rows={data.leads.byState} labelKey="state" />
            <Breakdown
              title="Leads by Assigned Sales Rep"
              icon={Users}
              rows={data.leads.byAssignee.map((r) => ({
                ...r,
                status: `${r.name}${r.department ? ` · ${r.department}` : ''}${r.isArchived ? ' (archived)' : ''}`,
              }))}
              labelKey="status"
              emptyText="No leads are currently assigned to anyone."
            />
            <Breakdown title="Employees by Department" icon={Building2} rows={data.employees.byDepartment} labelKey="department" />
            <Breakdown title="Employees by Employment Status" icon={Users} rows={data.employees.byEmploymentStatus} labelKey="status" />
            <Breakdown title="Employees by Onboarding Status" icon={ClipboardCheck} rows={data.employees.byOnboardingStatus} labelKey="status" />
            <Breakdown title="Login Accounts by Role" icon={ShieldCheck} rows={data.users.byRole} labelKey="role" />
            <StatCard label="Inactive Login Accounts" value={data.users.inactiveAccounts} icon={Users} tone="gray" />
          </div>
        </>
      )}
    </div>
  );
}
