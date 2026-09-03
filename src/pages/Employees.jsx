import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, DataTable, Pagination, FilterBar, SearchInput, Select,
  StatusBadge, Avatar, EmptyState,
} from '../components/ui';
import { DEPARTMENTS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from '../constants';
import { humanise } from '../lib/format';

const PAGE_SIZE = 20;

export default function Employees() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({ search: '', department: '', status: '', employmentType: '', documentStatus: '' });
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
      <PageHeader
        title="Employees"
        subtitle={meta ? `${meta.total} employee${meta.total === 1 ? '' : 's'} in the system` : 'Manage your workforce'}
        actions={can('manageEmployees') && (
          <Link to="/employees/new" className="btn-primary"><Plus className="h-4 w-4" /> Add employee</Link>
        )}
      />

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
            action={can('manageEmployees') ? <Link to="/employees/new" className="btn-primary"><Plus className="h-4 w-4" /> Add employee</Link> : null}
          />
        }
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />
    </div>
  );
}
