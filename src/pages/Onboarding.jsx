import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, ArrowLeft, Plus, CheckCircle2, Clock, ListChecks, AlertTriangle, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { onboardingAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, FilterBar, SearchInput, Select,
  Modal, FormField, StatusBadge, Avatar, EmptyState, ProgressBar, LoadingBlock, ErrorState,
} from '../components/ui';
import { TASK_STATUSES, TASK_CATEGORIES, DEPARTMENTS } from '../constants';
import { formatDate, errorMessage, fieldErrors } from '../lib/format';

// Employee self-service onboarding review/approve/reject lives in Manage
// Employees › Onboarding Submissions now (components/OnboardingApprovals.jsx,
// reused there) — this page stays focused on the HR task checklist only.
export default function Onboarding() {
  const [selected, setSelected] = useState(null);
  return selected
    ? <OnboardingDetail employee={selected} onBack={() => setSelected(null)} />
    : <OnboardingOverview onSelect={setSelected} />;
}

/* ------------------------------------------------------------------ */

function OnboardingOverview({ onSelect }) {
  const [filters, setFilters] = useState({ search: '', department: '', status: '' });
  const query = useQuery({
    queryKey: ['onboarding', 'overview', filters],
    queryFn: () => onboardingAPI.overview(filters),
  });
  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;

  return (
    <div>
      <PageHeader title="Onboarding" subtitle="New joiner checklists and progress" />

      {query.isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total in Onboarding" value={meta?.total ?? 0} icon={UserPlus} tone="indigo" />
          <StatCard label="Not Started" value={meta?.notStarted ?? 0} icon={Clock} tone="gray" />
          <StatCard label="In Progress" value={meta?.inProgress ?? 0} icon={ListChecks} tone="blue" />
          <StatCard label="Completed" value={meta?.completed ?? 0} icon={CheckCircle2} tone="green" />
        </div>
      )}

      <div className="mt-6">
        <FilterBar onReset={() => setFilters({ search: '', department: '', status: '' })}>
          <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Search employee…" />
          <div>
            <label className="label">Department</label>
            <Select className="w-44" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} options={DEPARTMENTS} placeholder="All departments" />
          </div>
          <div>
            <label className="label">Progress</label>
            <Select
              className="w-40"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              options={[{ value: 'NOT_STARTED', label: 'Not started' }, { value: 'IN_PROGRESS', label: 'In progress' }, { value: 'COMPLETED', label: 'Completed' }]}
              placeholder="All"
            />
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
            { key: 'start', header: 'Start Date', render: (row) => formatDate(row.employee?.dateOfJoining) },
            {
              key: 'progress',
              header: 'Progress',
              className: 'min-w-[10rem]',
              render: (row) => <ProgressBar value={row.progress.percent} tone={row.progress.percent === 100 ? 'green' : 'primary'} label={`${row.progress.completed}/${row.progress.total} tasks`} />,
            },
            { key: 'overdue', header: 'Overdue', render: (row) => row.overdue > 0 ? <span className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {row.overdue}</span> : <span className="text-gray-300">—</span> },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.state} /> },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => onSelect(row.employee)}>
                  Open checklist
                </button>
              ),
            },
          ]}
          rows={rows}
          rowKey={(row) => row.employee._id}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(row) => onSelect(row.employee)}
          empty={<EmptyState icon={UserPlus} title="No onboarding in progress" description="Recently joined employees will appear here once a checklist is applied." />}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function OnboardingDetail({ employee, onBack }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const query = useQuery({
    queryKey: ['onboarding', 'employee', employee._id],
    queryFn: () => onboardingAPI.forEmployee(employee._id),
  });
  const tasks = query.data?.data?.data || [];
  const progress = query.data?.data?.meta?.progress;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  };

  const applyTemplate = useMutation({
    mutationFn: () => onboardingAPI.applyTemplate(employee._id),
    onSuccess: (res) => { toast.success(res.data.message || 'Checklist applied'); refresh(); },
    onError: (err) => toast.error(errorMessage(err, 'Could not apply the standard checklist.')),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => onboardingAPI.updateTask(id, data),
    onSuccess: () => { toast.success('Task updated'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const visible = tasks.filter((t) => {
    if (filters.status && t.status !== filters.status) return false;
    if (filters.search && !t.taskName.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const isOverdue = (t) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex items-center gap-3">
          <Avatar name={employee.fullName} />
          <div>
            <h1 className="page-title">{employee.fullName}</h1>
            <p className="page-subtitle">{employee.designation} · {employee.department} · Joined {formatDate(employee.dateOfJoining)}</p>
          </div>
        </div>
      </div>

      {query.isLoading ? <LoadingBlock label="Loading checklist…" /> : query.error ? (
        <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>
      ) : (
        <>
          <div className="card mb-6 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <p className="mb-2 text-sm font-medium text-gray-700">Overall progress</p>
                <ProgressBar value={progress?.percent || 0} tone={progress?.percent === 100 ? 'green' : 'primary'} />
              </div>
              <div className="flex gap-6 text-center">
                <MiniStat label="Completed" value={progress?.completed ?? 0} tone="text-green-600" />
                <MiniStat label="Pending" value={progress?.pending ?? 0} tone="text-amber-600" />
                <MiniStat label="Blocked" value={progress?.blocked ?? 0} tone="text-red-600" />
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <SearchInput className="w-56" value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Search tasks…" />
              <div>
                <label className="label">Status</label>
                <Select className="w-40" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={TASK_STATUSES} placeholder="All statuses" />
              </div>
            </div>
            {can('manageLifecycle') && (
              <div className="flex gap-2">
                {tasks.length === 0 && (
                  <button type="button" className="btn-secondary" onClick={() => applyTemplate.mutate()} disabled={applyTemplate.isPending}>
                    <Sparkles className="h-4 w-4" /> {applyTemplate.isPending ? 'Applying…' : 'Apply standard checklist'}
                  </button>
                )}
                <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Add task
                </button>
              </div>
            )}
          </div>

          <DataTable
            columns={[
              {
                key: 'task',
                header: 'Task',
                render: (t) => (
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{t.taskName}</p>
                    {t.description && <p className="truncate text-xs text-gray-400">{t.description}</p>}
                  </div>
                ),
              },
              { key: 'category', header: 'Category', render: (t) => t.category },
              { key: 'assignedTo', header: 'Assigned To', render: (t) => <span className="text-xs text-gray-500">{t.assignedTo?.email || '—'}</span> },
              {
                key: 'due',
                header: 'Due Date',
                render: (t) => (
                  <span className={isOverdue(t) ? 'font-medium text-red-600' : ''}>
                    {formatDate(t.dueDate)} {isOverdue(t) && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
                  </span>
                ),
              },
              { key: 'completed', header: 'Completed', render: (t) => formatDate(t.completedAt) },
              {
                key: 'status',
                header: 'Status',
                render: (t) => (
                  <Select
                    className="w-36 py-1 text-xs"
                    value={t.status}
                    onChange={(e) => updateTask.mutate({ id: t._id, data: { status: e.target.value } })}
                    options={TASK_STATUSES}
                  />
                ),
              },
              ...(can('manageLifecycle') ? [{
                key: 'actions',
                header: '',
                render: (t) => (
                  <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setEditing(t)}>Edit</button>
                ),
              }] : []),
            ]}
            rows={visible}
            isLoading={false}
            empty={
              <EmptyState
                icon={ListChecks}
                title="No onboarding tasks yet"
                description="Apply the standard checklist or add tasks manually."
                action={can('manageLifecycle') ? (
                  <button type="button" className="btn-primary" onClick={() => applyTemplate.mutate()} disabled={applyTemplate.isPending}>
                    <Sparkles className="h-4 w-4" /> Apply standard checklist
                  </button>
                ) : null}
              />
            }
          />
        </>
      )}

      <TaskFormModal
        open={creating || Boolean(editing)}
        task={editing}
        employeeId={employee._id}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={refresh}
        createFn={onboardingAPI.createTask}
        updateFn={onboardingAPI.updateTask}
      />
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function TaskFormModal({ open, task, employeeId, onClose, onSaved, createFn, updateFn }) {
  const isEdit = Boolean(task);
  const empty = { taskName: '', description: '', category: '', dueDate: '', status: 'TODO', isRequired: true };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  if (open && isEdit && loadedFor !== task._id) {
    setForm({
      taskName: task.taskName, description: task.description || '', category: task.category,
      dueDate: task.dueDate?.slice(0, 10) || '', status: task.status, isRequired: task.isRequired !== false,
    });
    setLoadedFor(task._id);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? updateFn(task._id, data) : createFn({ ...data, employee: employeeId })),
    onSuccess: () => { toast.success(isEdit ? 'Task updated' : 'Task added'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setLoadedFor(null); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (form.taskName.trim().length < 2) next.taskName = 'Give the task a name.';
    if (!form.category) next.category = 'Choose a category.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit task' : 'Add task'}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Task name" required error={errors.taskName}>
          <input className="input" value={form.taskName} onChange={(e) => setForm({ ...form, taskName: e.target.value })} />
        </FormField>
        <FormField label="Description">
          <textarea className="input min-h-[70px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Category" required error={errors.category}>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={TASK_CATEGORIES} placeholder="Select" />
          </FormField>
          <FormField label="Due date">
            <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </FormField>
        </div>
        {isEdit && (
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={TASK_STATUSES} />
          </FormField>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}</button>
        </div>
      </form>
    </Modal>
  );
}
