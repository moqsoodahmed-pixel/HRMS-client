import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Plus, Users, UserCheck, Clock, UserX, FileEdit } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeAPI, onboardingProfileAPI, editRequestAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import OnboardingApprovals from '../components/OnboardingApprovals';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar, SearchInput, Select,
  StatusBadge, Avatar, EmptyState, Tabs, Modal, FormField,
} from '../components/ui';
import { DEPARTMENTS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from '../constants';
import { humanise, formatDate, errorMessage } from '../lib/format';

const PAGE_SIZE = 20;

export default function Employees() {
  const { can } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'list');
  // Which onboarding status the "Onboarding Submissions" tab opens to when a
  // stat tile is clicked (see the tiles below); '' means "all statuses",
  // matching OnboardingApprovals' own default-status prop. Read once on
  // mount too, so a deep link like ?tab=onboarding&onboardingStatus=REJECTED
  // works the same way a click does.
  const [onboardingStatus, setOnboardingStatus] = useState(() => searchParams.get('onboardingStatus') || 'SUBMITTED');

  // HR view vs. team-lead view. Only roles that actually administer employees
  // (HR_ADMIN / PROJECT_HEAD / elevated — see AuthContext `manageEmployees`)
  // get the company-wide onboarding summary and the Onboarding-Submissions /
  // Edit-Requests approval tabs. A MANAGER (Sales Team Lead) gets a plain
  // "My Team" list instead — no company totals, no approval queues — and the
  // list itself is already scoped to their own reports by the server
  // (employeeController getEmployees). This is what stops a Sales Team Lead
  // from seeing all 21 employees / the CEO / other departments.
  const isHrView = can('manageEmployees');

  // Company onboarding summary — HR view only. Skipped entirely for a team
  // lead so no company-wide counts are fetched or shown to them.
  const summaryQuery = useQuery({
    queryKey: ['onboarding-profile', 'list', ''],
    queryFn: () => onboardingProfileAPI.list(),
    enabled: isHrView,
  });
  const summaryRows = summaryQuery.data?.data?.data || [];
  const counts = {
    total: summaryRows.length,
    approved: summaryRows.filter((r) => r.onboardingStatus === 'APPROVED').length,
    pending: summaryRows.filter((r) => r.onboardingStatus === 'SUBMITTED').length,
    rejected: summaryRows.filter((r) => r.onboardingStatus === 'REJECTED').length,
  };

  const tabs = [
    { value: 'list', label: 'Employee List' },
    { value: 'onboarding', label: 'Onboarding Submissions', count: counts.pending || undefined },
    { value: 'edit-requests', label: 'Edit Requests' },
  ];

  // Every stat tile below is a shortcut into the "Onboarding Submissions"
  // tab, pre-filtered to the onboarding status that tile is counting —
  // "Total Employees" clears the filter (every status), the other three
  // match it exactly, so the list a click lands on always agrees with the
  // number that was clicked (same onboardingProfileAPI.list() data both
  // count from).
  const goToOnboarding = (status) => {
    setOnboardingStatus(status);
    setTab('onboarding');
  };

  // ── Team-lead (non-HR) view: just their own team, no admin surface. ──
  if (!isHrView) {
    return (
      <div>
        <PageHeader
          title="My Team"
          subtitle="The people who report to you and their details."
        />
        <EmployeeListPanel />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Manage Employees"
        subtitle="Review, approve, and manage employee onboarding requests for your organization."
        actions={tab === 'list' && can('manageEmployees') && (
          <Link to="/employees/new" className="btn-primary"><Plus className="h-4 w-4" /> Add employee</Link>
        )}
      />

      {summaryQuery.isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Employees" value={counts.total} icon={Users} tone="indigo" onClick={() => goToOnboarding('')} />
          <StatCard label="Approved" value={counts.approved} icon={UserCheck} tone="green" onClick={() => goToOnboarding('APPROVED')} />
          <StatCard label="Pending" value={counts.pending} icon={Clock} tone="amber" onClick={() => goToOnboarding('SUBMITTED')} />
          <StatCard label="Rejected" value={counts.rejected} icon={UserX} tone="red" onClick={() => goToOnboarding('REJECTED')} />
        </div>
      )}

      <div className="mt-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        {tab === 'list' && <EmployeeListPanel />}
        {tab === 'onboarding' && <OnboardingApprovals key={onboardingStatus} defaultStatus={onboardingStatus} />}
        {tab === 'edit-requests' && <EditRequestsPanel />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Employee List                                                       */
/* ------------------------------------------------------------------ */

function EmployeeListPanel() {
  const navigate = useNavigate();
  // Deep-link support: the dashboard's "Probation"/"Notice Period" stat
  // tiles (see pages/Dashboard.jsx) link here with ?status=PROBATION etc.
  // so the tile is provably not just a static number — it opens this list
  // pre-filtered to the same employees it counted. Only read once on
  // mount, same as every other filter here (typing in the filter afterward
  // works exactly as before).
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    search: '', department: '', status: searchParams.get('status') || '', employmentType: '', documentStatus: '',
  });
  const [page, setPage] = useState(1);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters({ search: '', department: '', status: '', employmentType: '', documentStatus: '' }); setPage(1); };

  const query = useQuery({
    queryKey: ['employees', filters, page],
    queryFn: () => employeeAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;

  return (
    <div>
      <FilterBar onReset={resetFilters}>
        <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search name, code, email…" />
        <div>
          <label className="label">Department</label>
          <Select className="w-44" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} options={DEPARTMENTS} placeholder="All departments" />
        </div>
        <div>
          <label className="label">Status</label>
          <Select className="w-40" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={EMPLOYEE_STATUSES} placeholder="All statuses" />
        </div>
        <div>
          <label className="label">Employment type</label>
          <Select className="w-44" value={filters.employmentType} onChange={(e) => setFilter('employmentType', e.target.value)} options={EMPLOYMENT_TYPES} placeholder="All types" />
        </div>
        <div>
          <label className="label">Documentation</label>
          <Select
            className="w-44"
            value={filters.documentStatus}
            onChange={(e) => setFilter('documentStatus', e.target.value)}
            options={[
              { value: 'COMPLETE', label: 'Complete' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            placeholder="All"
          />
        </div>
      </FilterBar>

      <DataTable
        columns={[
          {
            key: 'employee',
            header: 'Employee',
            render: (emp) => (
              <div className="flex items-center gap-3">
                <Avatar name={emp.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{emp.fullName}</p>
                  <p className="truncate text-xs text-gray-400">{emp.officialEmail}</p>
                </div>
              </div>
            ),
          },
          { key: 'code', header: 'Code', render: (emp) => <span className="font-mono text-xs">{emp.employeeCode}</span> },
          { key: 'department', header: 'Department', render: (emp) => emp.department },
          { key: 'designation', header: 'Designation', render: (emp) => emp.designation },
          { key: 'type', header: 'Type', render: (emp) => humanise(emp.employmentType) },
          { key: 'manager', header: 'Manager', render: (emp) => emp.manager?.fullName || '—' },
          { key: 'status', header: 'Status', render: (emp) => <StatusBadge status={emp.status} /> },
          {
            key: 'documentation',
            header: 'Documentation',
            render: (emp) => (
              <StatusBadge
                status={emp.hasRejectedDocuments ? 'REJECTED' : emp.documentStatus}
                label={emp.hasRejectedDocuments ? 'Documents Rejected' : emp.documentStatus === 'COMPLETE' ? 'Documents Complete' : 'Documents Pending'}
              />
            ),
          },
          { key: 'onboarding', header: 'Onboarding', render: (emp) => <StatusBadge status={emp.onboardingStatus} /> },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        onRowClick={(emp) => navigate(`/employees/${emp._id}`)}
        empty={
          <EmptyState
            icon={Users}
            title="No employees found"
            description="Try adjusting your filters, or add the first employee."
          />
        }
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit Requests — new, minimal flow (see employeeEditRequestController.js) */
/* ------------------------------------------------------------------ */

const EDIT_REQUEST_FIELD_LABELS = {
  personalEmail: 'Personal Email',
  personalMobile: 'Personal Mobile',
  workLocation: 'Work Location',
};

function EditRequestsPanel() {
  const { can } = useAuth();
  const canDecide = can('manageEmployees');
  const [status, setStatus] = useState('PENDING');
  const [rejecting, setRejecting] = useState(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['edit-requests', status],
    queryFn: () => editRequestAPI.list(status ? { status } : {}),
  });
  const rows = query.data?.data?.data || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['edit-requests'] });

  const approve = useMutation({
    mutationFn: (id) => editRequestAPI.approve(id),
    onSuccess: () => { toast.success('Edit request approved and applied'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }) => editRequestAPI.reject(id, reason),
    onSuccess: () => { toast.success('Edit request rejected'); refresh(); setRejecting(null); },
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
                  <p className="truncate text-xs text-gray-400">{r.employee?.employeeCode}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'changes',
            header: 'Requested changes',
            render: (r) => (
              <ul className="space-y-0.5 text-xs text-gray-600">
                {Object.entries(r.changes || {}).map(([field, value]) => (
                  <li key={field}>
                    <span className="text-gray-400">{EDIT_REQUEST_FIELD_LABELS[field] || field}:</span>{' '}
                    <span className="text-gray-400 line-through">{r.employee?.[field] || '—'}</span>{' '}→{' '}
                    <span className="font-medium text-gray-900">{value || '—'}</span>
                  </li>
                ))}
              </ul>
            ),
          },
          { key: 'submitted', header: 'Submitted', render: (r) => formatDate(r.createdAt) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ...(canDecide ? [{
            key: 'actions',
            header: '',
            render: (r) => r.status === 'PENDING' && (
              <div className="flex justify-end gap-2">
                <button type="button" className="text-xs font-medium text-green-600 hover:underline" onClick={() => approve.mutate(r._id)} disabled={approve.isPending}>Approve</button>
                <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setRejecting(r)}>Reject</button>
              </div>
            ),
          }] : []),
        ]}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={<EmptyState icon={FileEdit} title="No edit requests" description="Employee-submitted profile change requests will appear here." />}
      />

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject edit request" size="sm">
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