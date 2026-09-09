import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Wallet, Download, Plus, FileSpreadsheet, TrendingDown, Users, CircleDollarSign, Receipt, BadgeCheck,
  ArrowRight, Check, X, Ban, ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { payrollAPI, employeeAPI, compensationAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, Tabs, ConfirmDialog, InfoRow,
} from '../components/ui';
import { DEPARTMENTS, MONTHS, PAYSLIP_STATUSES } from '../constants';
import { formatCurrency, formatDate, monthName, humanise, errorMessage, fieldErrors, downloadBlob, exportCsv } from '../lib/format';

const PAGE_SIZE = 20;
const now = new Date();
const YEARS = [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map(String);
const COMPENSATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export default function Payroll() {
  const { can } = useAuth();
  const isPayrollUser = can('viewPayroll');
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'compensation' ? 'compensation' : 'payslips');

  const changeTab = (value) => {
    setTab(value);
    setParams(value === 'compensation' ? { tab: 'compensation' } : {}, { replace: true });
  };

  // Employees and managers only ever see their own payslips.
  if (!isPayrollUser) {
    return (
      <div>
        <PageHeader title="My Payslips" subtitle="Download the payslips issued to you" />
        <Payslips ownOnly />
      </div>
    );
  }

  const tabs = [
    { value: 'payslips', label: 'Payslips' },
    { value: 'structures', label: 'Salary structures' },
    ...(can('viewCompensationRequests') ? [{ value: 'compensation', label: 'Compensation Requests' }] : []),
  ];

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Salary structures, payslips and monthly payroll totals" />
      <PayrollSummary />
      <div className="mt-6">
        <Tabs tabs={tabs} active={tab} onChange={changeTab} />
        {tab === 'payslips' && <Payslips />}
        {tab === 'structures' && <SalaryStructures />}
        {tab === 'compensation' && <CompensationRequests />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function PayrollSummary() {
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const { data, isLoading } = useQuery({
    queryKey: ['payroll', 'summary', period],
    queryFn: () => payrollAPI.summary(period),
  });
  const s = data?.data?.data;
  const noPayrollYet = !isLoading && (s?.payslipCount ?? 0) === 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Month</label>
            <Select
              className="w-40"
              value={String(period.month)}
              onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })}
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
            />
          </div>
          <div>
            <label className="label">Year</label>
            <Select className="w-28" value={String(period.year)} onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })} options={YEARS} />
          </div>
        </div>
        {!isLoading && <StatusBadge status={s?.status || 'NOT_STARTED'} />}
      </div>

      {isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Payroll Status" value={humanise(s?.status || 'NOT_STARTED')} icon={ClipboardList} tone={s?.status === 'COMPLETE' ? 'green' : s?.status === 'IN_PROGRESS' ? 'amber' : 'gray'} hint={`${monthName(period.month)} ${period.year}`} />
          <StatCard label="Employees Included" value={s?.activeStructures ?? 0} icon={Users} tone="indigo" hint={`${s?.activeEmployees ?? 0} active employees total`} />
          <StatCard label="Payslips Issued" value={s?.payslipCount ?? 0} icon={Receipt} tone="blue" hint={`${s?.employeesPaid ?? 0} paid`} />
          <StatCard label="Pending Actions" value={s?.pendingActions ?? 0} icon={TrendingDown} tone={s?.pendingActions ? 'amber' : 'green'} hint="Employees without a payslip yet" />
        </div>
      )}

      {!isLoading && !noPayrollYet && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Total Payroll" value={formatCurrency(s?.grossPayroll, { compact: true })} icon={CircleDollarSign} tone="indigo" />
          <StatCard label="Total Deductions" value={formatCurrency(s?.totalDeductions, { compact: true })} icon={TrendingDown} tone="red" />
          <StatCard label="Net Payroll" value={formatCurrency(s?.netPayroll, { compact: true })} icon={Wallet} tone="purple" />
        </div>
      )}

      {noPayrollYet && (
        <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">No payroll processed yet for {monthName(period.month)} {period.year}.</p>
      )}

      {s?.employeesWithoutStructure > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {s.employeesWithoutStructure} active employee(s) have no salary structure yet — they will be skipped when payslips are generated.
        </p>
      )}

      <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">{s?.integration?.provider || 'XYZ'} Payroll Integration</span>
          <StatusBadge status={s?.integration?.status || 'NOT_CONNECTED'} tone="gray" />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Salary processing is handled by our external payroll partner. This connection isn't set up yet — once it is, sync status and processing details will appear here automatically.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Payslips({ ownOnly }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ month: '', year: String(now.getFullYear()), status: '', search: '', department: '' });
  const [page, setPage] = useState(1);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters({ month: '', year: String(now.getFullYear()), status: '', search: '', department: '' }); setPage(1); };

  const query = useQuery({
    queryKey: ['payroll', 'payslips', filters, page],
    queryFn: () => payrollAPI.payslips({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['payroll'] });

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => payrollAPI.setStatus(id, status),
    onSuccess: () => { toast.success('Payslip updated'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const download = async (payslip) => {
    setDownloadingId(payslip._id);
    try {
      const res = await payrollAPI.download(payslip._id);
      downloadBlob(res.data, `payslip-${payslip.employee?.employeeCode || payslip._id}-${payslip.month}-${payslip.year}.pdf`);
      toast.success('Payslip downloaded');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download the payslip.'));
    } finally {
      setDownloadingId(null);
    }
  };

  const columns = useMemo(() => [
    ...(ownOnly ? [] : [{
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
    }]),
    { key: 'period', header: 'Month', render: (row) => `${monthName(row.month)} ${row.year}` },
    { key: 'basic', header: 'Basic', render: (row) => formatCurrency(row.basic) },
    { key: 'gross', header: 'Gross', render: (row) => formatCurrency(row.grossSalary) },
    { key: 'deductions', header: 'Deductions', render: (row) => <span className="text-red-600">{formatCurrency(row.totalDeductions)}</span> },
    { key: 'net', header: 'Net', render: (row) => <span className="font-semibold text-gray-900">{formatCurrency(row.netSalary)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'generated', header: 'Generated', render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={(e) => { e.stopPropagation(); setViewing(row); }}>
            View
          </button>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline disabled:opacity-50"
            onClick={(e) => { e.stopPropagation(); download(row); }}
            disabled={downloadingId === row._id}
          >
            <Download className="h-3.5 w-3.5" /> {downloadingId === row._id ? 'Preparing…' : 'PDF'}
          </button>
          {can('managePayroll') && row.status !== 'PAID' && (
            <button
              type="button"
              className="text-xs font-medium text-green-600 hover:underline"
              onClick={(e) => { e.stopPropagation(); setStatus.mutate({ id: row._id, status: 'PAID' }); }}
            >
              Mark paid
            </button>
          )}
        </div>
      ),
    },
  ], [ownOnly, can, downloadingId, setStatus]);

  return (
    <div>
      {can('managePayroll') && (
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => setBulkOpen(true)}>
            <FileSpreadsheet className="h-4 w-4" /> Run monthly payroll
          </button>
          <button type="button" className="btn-primary" onClick={() => setGenerateOpen(true)}>
            <Plus className="h-4 w-4" /> Generate payslip
          </button>
        </div>
      )}

      <FilterBar onReset={resetFilters}>
        {!ownOnly && (
          <SearchInput className="min-w-[13rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search employee…" />
        )}
        <div>
          <label className="label">Month</label>
          <Select className="w-40" value={filters.month} onChange={(e) => setFilter('month', e.target.value)} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} placeholder="All months" />
        </div>
        <div>
          <label className="label">Year</label>
          <Select className="w-28" value={filters.year} onChange={(e) => setFilter('year', e.target.value)} options={YEARS} placeholder="All years" />
        </div>
        <div>
          <label className="label">Status</label>
          <Select className="w-36" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={PAYSLIP_STATUSES} placeholder="All statuses" />
        </div>
        {!ownOnly && (
          <div>
            <label className="label">Department</label>
            <Select className="w-44" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} options={DEPARTMENTS} placeholder="All departments" />
          </div>
        )}
        {!ownOnly && (
          <button
            type="button"
            className="btn-secondary"
            disabled={!rows.length}
            onClick={() => {
              exportCsv('payslips.csv', [
                { label: 'Employee', value: (r) => r.employee?.fullName },
                { label: 'Code', value: (r) => r.employee?.employeeCode },
                { label: 'Department', value: (r) => r.employee?.department },
                { label: 'Month', value: (r) => `${monthName(r.month)} ${r.year}` },
                { label: 'Basic', value: (r) => r.basic },
                { label: 'Gross', value: (r) => r.grossSalary },
                { label: 'Deductions', value: (r) => r.totalDeductions },
                { label: 'Net', value: (r) => r.netSalary },
                { label: 'Status', value: (r) => r.status },
              ], rows);
              toast.success('Exported the current page');
            }}
          >
            <Download className="h-4 w-4" /> Export
          </button>
        )}
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={
          <EmptyState
            icon={Receipt}
            title="No payslips found"
            description={ownOnly ? 'No payslips have been issued to you yet.' : 'Generate payslips for this period to see them here.'}
          />
        }
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />

      <PayslipDetailModal payslip={viewing} onClose={() => setViewing(null)} onDownload={download} />
      <GeneratePayslipModal open={generateOpen} onClose={() => setGenerateOpen(false)} onSaved={refresh} />
      <BulkGenerateModal open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={refresh} />
    </div>
  );
}

function PayslipDetailModal({ payslip, onClose, onDownload }) {
  if (!payslip) return <Modal open={false} onClose={onClose} title="" />;
  const earnings = [
    ['Basic', payslip.basic], ['HRA', payslip.hra], ['DA', payslip.da],
    ['Special allowance', payslip.specialAllowance], ['Other allowances', payslip.otherAllowances],
  ];
  const deductions = [
    ['Provident Fund', payslip.pf], ['ESI', payslip.esi], ['TDS', payslip.tds], ['Other deductions', payslip.otherDeductions],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Payslip — ${monthName(payslip.month)} ${payslip.year}`}
      description={payslip.employee ? `${payslip.employee.fullName} · ${payslip.employee.employeeCode}` : ''}
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn-primary" onClick={() => onDownload(payslip)}>
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-4">
          <InfoRow label="Working days" value={payslip.workingDays} />
          <InfoRow label="Paid days" value={payslip.paidDays} />
          <InfoRow label="Loss of pay" value={payslip.lop} />
          <InfoRow label="Status" value={<StatusBadge status={payslip.status} />} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Earnings</h3>
            <div className="space-y-2">
              {earnings.map(([label, value]) => <InfoRow key={label} label={label} value={formatCurrency(value)} />)}
              <div className="border-t border-gray-200 pt-2">
                <InfoRow label="Total earnings" value={<span className="font-bold">{formatCurrency(payslip.totalEarnings)}</span>} />
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Deductions</h3>
            <div className="space-y-2">
              {deductions.map(([label, value]) => <InfoRow key={label} label={label} value={formatCurrency(value)} />)}
              <div className="border-t border-gray-200 pt-2">
                <InfoRow label="Total deductions" value={<span className="font-bold text-red-600">{formatCurrency(payslip.totalDeductions)}</span>} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-primary-50 px-5 py-4">
          <span className="text-sm font-medium text-primary-900">Net salary</span>
          <span className="text-2xl font-bold text-primary-700">{formatCurrency(payslip.netSalary)}</span>
        </div>
      </div>
    </Modal>
  );
}

function GeneratePayslipModal({ open, onClose, onSaved }) {
  const empty = { employeeId: '', month: String(now.getMonth() + 1), year: String(now.getFullYear()) };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const employees = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const staff = employees.data?.data?.data?.managers || [];

  const save = useMutation({
    mutationFn: (data) => payrollAPI.generate(data),
    onSuccess: () => { toast.success('Payslip generated'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    if (!form.employeeId) { setErrors({ employeeId: 'Choose an employee.' }); return; }
    save.mutate({ employeeId: form.employeeId, month: Number(form.month), year: Number(form.year) });
  };

  return (
    <Modal open={open} onClose={close} title="Generate payslip" description="Uses the employee's active salary structure.">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Employee" required error={errors.employeeId}>
          <Select
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            options={staff.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
            placeholder="Select an employee"
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Month" required>
            <Select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          </FormField>
          <FormField label="Year" required>
            <Select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} options={YEARS} />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Generating…' : 'Generate'}</button>
        </div>
      </form>
    </Modal>
  );
}

function BulkGenerateModal({ open, onClose, onSaved }) {
  const [period, setPeriod] = useState({ month: String(now.getMonth() + 1), year: String(now.getFullYear()) });

  const run = useMutation({
    mutationFn: () => payrollAPI.generateBulk({ month: Number(period.month), year: Number(period.year) }),
    onSuccess: (res) => {
      const { generated, skipped } = res.data.data;
      toast.success(`${generated} payslip(s) generated${skipped ? `, ${skipped} skipped` : ''}`);
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Run monthly payroll" size="sm"
      description="Generates a payslip for every employee with an active salary structure. Employees who already have one for this period are skipped.">
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Month" required>
            <Select value={period.month} onChange={(e) => setPeriod({ ...period, month: e.target.value })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
          </FormField>
          <FormField label="Year" required>
            <Select value={period.year} onChange={(e) => setPeriod({ ...period, year: e.target.value })} options={YEARS} />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={run.isPending}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? 'Running…' : 'Run payroll'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function SalaryStructures() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', department: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };

  const query = useQuery({
    queryKey: ['payroll', 'structures', filters, page],
    queryFn: () => payrollAPI.salaryStructures({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['payroll'] });

  return (
    <div>
      {can('managePayroll') && (
        <div className="mb-4 flex justify-end">
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New salary structure
          </button>
        </div>
      )}

      <FilterBar onReset={() => { setFilters({ search: '', department: '' }); setPage(1); }}>
        <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search employee…" />
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
            render: (row) => (
              <div className="flex items-center gap-3">
                <Avatar name={row.employee?.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{row.employee?.fullName}</p>
                  <p className="truncate text-xs text-gray-400">{row.employee?.employeeCode} · {row.employee?.department}</p>
                </div>
              </div>
            ),
          },
          { key: 'basic', header: 'Basic', render: (r) => formatCurrency(r.basic) },
          { key: 'allowances', header: 'Allowances', render: (r) => formatCurrency(r.hra + r.da + r.specialAllowance + r.otherAllowances) },
          { key: 'deductions', header: 'Deductions', render: (r) => <span className="text-red-600">{formatCurrency(r.pf + r.esi + r.tds + r.otherDeductions)}</span> },
          { key: 'gross', header: 'Gross', render: (r) => formatCurrency(r.grossSalary) },
          { key: 'net', header: 'Net', render: (r) => <span className="font-semibold">{formatCurrency(r.netSalary)}</span> },
          { key: 'from', header: 'Effective From', render: (r) => formatDate(r.effectiveFrom) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
          ...(can('managePayroll') ? [{
            key: 'actions',
            header: '',
            render: (r) => (
              <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setEditing(r)}>
                Revise
              </button>
            ),
          }] : []),
        ]}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={<EmptyState icon={Users} title="No salary structures" description="Create a salary structure so payslips can be generated." />}
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />

      <SalaryStructureModal
        open={creating || Boolean(editing)}
        existing={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={refresh}
      />
    </div>
  );
}

function SalaryStructureModal({ open, existing, onClose, onSaved }) {
  const empty = {
    employeeId: '', effectiveFrom: new Date().toISOString().slice(0, 10),
    basic: '', hra: '', da: '', specialAllowance: '', otherAllowances: '',
    pf: '', esi: '', tds: '', otherDeductions: '',
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  // Pre-fill from the structure being revised so the figures are a starting point.
  if (open && existing && loadedFor !== existing._id) {
    setForm({
      employeeId: existing.employee?._id || '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      basic: existing.basic ?? '', hra: existing.hra ?? '', da: existing.da ?? '',
      specialAllowance: existing.specialAllowance ?? '', otherAllowances: existing.otherAllowances ?? '',
      pf: existing.pf ?? '', esi: existing.esi ?? '', tds: existing.tds ?? '', otherDeductions: existing.otherDeductions ?? '',
    });
    setLoadedFor(existing._id);
  }

  const employees = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    enabled: open && !existing,
    staleTime: 5 * 60 * 1000,
  });
  const staff = employees.data?.data?.data?.managers || [];

  const num = (v) => Number(v || 0);
  const gross = num(form.basic) + num(form.hra) + num(form.da) + num(form.specialAllowance) + num(form.otherAllowances);
  const totalDeductions = num(form.pf) + num(form.esi) + num(form.tds) + num(form.otherDeductions);

  const save = useMutation({
    mutationFn: (data) => payrollAPI.createSalary(form.employeeId, data),
    onSuccess: () => { toast.success('Salary structure saved'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setLoadedFor(null); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.employeeId) next.employeeId = 'Choose an employee.';
    if (!form.effectiveFrom) next.effectiveFrom = 'Choose an effective date.';
    if (form.basic === '' || num(form.basic) <= 0) next.basic = 'Basic salary must be greater than zero.';
    if (totalDeductions > gross) next.pf = 'Deductions cannot exceed gross salary.';
    setErrors(next);
    if (Object.keys(next).length) return;

    save.mutate({
      effectiveFrom: form.effectiveFrom,
      basic: num(form.basic), hra: num(form.hra), da: num(form.da),
      specialAllowance: num(form.specialAllowance), otherAllowances: num(form.otherAllowances),
      pf: num(form.pf), esi: num(form.esi), tds: num(form.tds), otherDeductions: num(form.otherDeductions),
    });
  };

  const moneyField = (key, label) => (
    <FormField key={key} label={label} error={errors[key]}>
      <input
        type="number"
        min="0"
        step="1"
        className="input"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder="0"
      />
    </FormField>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={existing ? 'Revise salary structure' : 'New salary structure'}
      description={existing ? `${existing.employee?.fullName} — the previous structure is closed automatically.` : 'The previous active structure for this employee is closed automatically.'}
    >
      <form onSubmit={submit} className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Employee" required error={errors.employeeId}>
            {existing ? (
              <input className="input bg-gray-50" value={`${existing.employee?.fullName} (${existing.employee?.employeeCode})`} disabled />
            ) : (
              <Select
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                options={staff.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
                placeholder="Select an employee"
              />
            )}
          </FormField>
          <FormField label="Effective from" required error={errors.effectiveFrom}>
            <input type="date" className="input" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </FormField>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Earnings</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {moneyField('basic', 'Basic *')}
            {moneyField('hra', 'HRA')}
            {moneyField('da', 'DA')}
            {moneyField('specialAllowance', 'Special allowance')}
            {moneyField('otherAllowances', 'Other allowances')}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Deductions</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {moneyField('pf', 'Provident Fund')}
            {moneyField('esi', 'ESI')}
            {moneyField('tds', 'TDS')}
            {moneyField('otherDeductions', 'Other')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
          <div><p className="text-xs text-gray-500">Gross</p><p className="text-lg font-bold text-gray-900">{formatCurrency(gross)}</p></div>
          <div><p className="text-xs text-gray-500">Deductions</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalDeductions)}</p></div>
          <div><p className="text-xs text-gray-500">Net</p><p className="text-lg font-bold text-primary-700">{formatCurrency(gross - totalDeductions)}</p></div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save structure'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Compensation change requests — HR requests, only SUPER_ADMIN/CTO   */
/* can approve. See server/controllers/compensationController.js.     */
/* ------------------------------------------------------------------ */

function CompensationRequests() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const query = useQuery({
    queryKey: ['compensation-requests', { status, page }],
    queryFn: () => compensationAPI.list({ status: status || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['compensation-requests'] });
    queryClient.invalidateQueries({ queryKey: ['payroll'] });
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
  const cancel = useMutation({
    mutationFn: (id) => compensationAPI.cancel(id),
    onSuccess: () => { toast.success('Request cancelled'); refresh(); setCancelling(null); },
    onError: (err) => { toast.error(errorMessage(err)); setCancelling(null); },
  });

  const canApprove = can('approveCompensationChange');

  const columns = useMemo(() => [
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
    {
      key: 'change',
      header: 'Current → Proposed',
      render: (r) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm">
          {formatCurrency(r.currentGross)} <ArrowRight className="h-3.5 w-3.5 text-gray-400" /> {formatCurrency(r.proposedGross)}
        </span>
      ),
    },
    {
      key: 'delta',
      header: 'Change',
      render: (r) => (
        <span className={r.changeAmount >= 0 ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
          {r.changeAmount >= 0 ? '+' : ''}{formatCurrency(r.changeAmount)} ({r.changePercent >= 0 ? '+' : ''}{r.changePercent}%)
        </span>
      ),
    },
    { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-[14rem] truncate text-gray-600" title={r.reason}>{r.reason}</span> },
    { key: 'requestedBy', header: 'Requested By', render: (r) => <span className="text-xs text-gray-500">{r.requestedBy?.email}</span> },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.createdAt) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => {
        if (r.status !== 'PENDING') {
          return r.reviewComments ? <span className="block max-w-[10rem] truncate text-xs text-gray-400" title={r.reviewComments}>{r.reviewComments}</span> : <span className="text-gray-300">—</span>;
        }
        return (
          <div className="flex items-center gap-1">
            {canApprove && (
              <>
                <button type="button" className="rounded-lg p-1.5 text-green-600 transition hover:bg-green-50" onClick={() => approve.mutate(r._id)} disabled={approve.isPending} title="Approve">
                  <Check className="h-4 w-4" />
                </button>
                <button type="button" className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" onClick={() => setRejecting(r)} title="Reject">
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
            <button type="button" className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100" onClick={() => setCancelling(r)} title="Cancel">
              <Ban className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ], [canApprove, approve]);

  return (
    <div>
      {!canApprove && (
        <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          {can('requestCompensationChange')
            ? 'Requests you submit here need Super Admin or CTO approval before the salary structure changes.'
            : 'This is a read-only view of compensation requests awaiting Super Admin/CTO approval.'}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="label">Status</label>
          <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={COMPENSATION_STATUSES} placeholder="All statuses" />
        </div>
        {can('requestCompensationChange') && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Request compensation change
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No compensation requests"
            description={can('requestCompensationChange') ? 'Request a salary or allowance change for an employee.' : 'Nothing is currently pending approval.'}
          />
        }
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />

      <CompensationRequestModal open={creating} onClose={() => setCreating(false)} onSaved={refresh} />

      <RejectCompensationModal request={rejecting} onClose={() => setRejecting(null)} onSubmit={(comments) => reject.mutate({ id: rejecting._id, comments })} loading={reject.isPending} />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling._id)}
        loading={cancel.isPending}
        title="Cancel compensation request"
        message={cancelling ? `Cancel the pending compensation request for ${cancelling.employee?.fullName}?` : ''}
        confirmLabel="Cancel request"
      />
    </div>
  );
}

function CompensationRequestModal({ open, onClose, onSaved }) {
  const empty = { employeeId: '', proposedBasic: '', proposedHra: '', proposedDa: '', proposedSpecialAllowance: '', proposedOtherAllowances: '', reason: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const employees = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const staff = employees.data?.data?.data?.managers || [];

  const currentQuery = useQuery({
    queryKey: ['payroll', 'salary-for', form.employeeId],
    queryFn: () => payrollAPI.salaryFor(form.employeeId),
    enabled: Boolean(form.employeeId),
  });
  const current = (currentQuery.data?.data?.data || []).find((s) => s.isActive);

  // Prefill the proposed figures from the current active structure the first time it loads.
  const [prefilledFor, setPrefilledFor] = useState(null);
  if (current && prefilledFor !== form.employeeId) {
    setForm((f) => ({
      ...f,
      proposedBasic: current.basic, proposedHra: current.hra, proposedDa: current.da,
      proposedSpecialAllowance: current.specialAllowance, proposedOtherAllowances: current.otherAllowances,
    }));
    setPrefilledFor(form.employeeId);
  }

  const num = (v) => Number(v || 0);
  const currentGross = current ? current.basic + current.hra + current.da + current.specialAllowance + current.otherAllowances : 0;
  const proposedGross = num(form.proposedBasic) + num(form.proposedHra) + num(form.proposedDa) + num(form.proposedSpecialAllowance) + num(form.proposedOtherAllowances);
  const change = proposedGross - currentGross;
  const changePercent = currentGross > 0 ? Math.round((change / currentGross) * 10000) / 100 : 0;

  const save = useMutation({
    mutationFn: (data) => compensationAPI.create(data),
    onSuccess: () => { toast.success('Compensation request submitted — pending Super Admin approval'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setPrefilledFor(null); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.employeeId) next.employeeId = 'Choose an employee.';
    if (form.proposedBasic === '' || num(form.proposedBasic) <= 0) next.proposedBasic = 'Basic salary must be greater than zero.';
    if (!form.reason.trim() || form.reason.trim().length < 5) next.reason = 'Explain the reason for this change (at least 5 characters).';
    if (change === 0) next.proposedBasic = next.proposedBasic || 'The proposed compensation is identical to the current structure.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({
      employeeId: form.employeeId,
      proposedBasic: num(form.proposedBasic), proposedHra: num(form.proposedHra), proposedDa: num(form.proposedDa),
      proposedSpecialAllowance: num(form.proposedSpecialAllowance), proposedOtherAllowances: num(form.proposedOtherAllowances),
      reason: form.reason,
    });
  };

  const moneyField = (key, label) => (
    <FormField key={key} label={label} error={errors[key]}>
      <input type="number" min="0" step="1" className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder="0" />
    </FormField>
  );

  return (
    <Modal open={open} onClose={close} size="lg" title="Request compensation change" description="The live salary structure is not changed until a Super Admin or CTO approves this request.">
      <form onSubmit={submit} className="space-y-5 p-5">
        <FormField label="Employee" required error={errors.employeeId}>
          <Select
            value={form.employeeId}
            onChange={(e) => { setForm({ ...form, employeeId: e.target.value }); setPrefilledFor(null); }}
            options={staff.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
            placeholder="Select an employee"
          />
        </FormField>

        {form.employeeId && !current && !currentQuery.isLoading && (
          <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-800">This employee has no active salary structure yet — the proposed figures below will become their first one.</p>
        )}

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Proposed compensation</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {moneyField('proposedBasic', 'Basic *')}
            {moneyField('proposedHra', 'HRA')}
            {moneyField('proposedDa', 'DA')}
            {moneyField('proposedSpecialAllowance', 'Special allowance')}
            {moneyField('proposedOtherAllowances', 'Other allowances')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
          <div><p className="text-xs text-gray-500">Current gross</p><p className="text-lg font-bold text-gray-900">{formatCurrency(currentGross)}</p></div>
          <div><p className="text-xs text-gray-500">Proposed gross</p><p className="text-lg font-bold text-primary-700">{formatCurrency(proposedGross)}</p></div>
          <div>
            <p className="text-xs text-gray-500">Change</p>
            <p className={`text-lg font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{formatCurrency(change)} ({changePercent >= 0 ? '+' : ''}{changePercent}%)
            </p>
          </div>
        </div>

        <FormField label="Reason" required error={errors.reason}>
          <textarea className="input min-h-[80px]" value={form.reason} maxLength={500} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Annual performance increment" />
        </FormField>

        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Submitting…' : 'Submit for approval'}</button>
        </div>
      </form>
    </Modal>
  );
}

function RejectCompensationModal({ request, onClose, onSubmit, loading }) {
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!comments.trim()) { setError('Explain why this request is being rejected.'); return; }
    onSubmit(comments.trim());
  };
  const close = () => { setComments(''); setError(''); onClose(); };

  return (
    <Modal open={Boolean(request)} onClose={close} size="sm" title="Reject compensation request" description={request ? `${request.employee?.fullName} — ${formatCurrency(request.currentGross)} → ${formatCurrency(request.proposedGross)}` : ''}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Reason for rejection" required error={error}>
          <textarea className="input min-h-[90px]" value={comments} maxLength={500} onChange={(e) => { setComments(e.target.value); setError(''); }} />
        </FormField>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={loading}>{loading ? 'Rejecting…' : 'Reject request'}</button>
        </div>
      </form>
    </Modal>
  );
}
