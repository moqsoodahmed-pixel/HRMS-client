import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap, Plus, Upload, Eye, Users, CheckCircle2, Clock, BookOpen,
  Archive, RotateCcw, ExternalLink, PlayCircle, ListChecks,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { trainingAPI, employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, LoadingBlock, FileUpload, ProgressBar,
} from '../components/ui';
import { TRAINING_MATERIAL_TYPES } from '../constants';
import { formatDate, formatDateTime, errorMessage, fieldErrors, viewBlob } from '../lib/format';

export default function Training() {
  const { can } = useAuth();
  return can('manageTraining') ? <TrainingAdminView /> : <MyTrainingView />;
}

/* ------------------------------------------------------------------ */
/* Employee view — assigned trainings only                             */
/* ------------------------------------------------------------------ */

function MyTrainingView() {
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState(null);

  const query = useQuery({ queryKey: ['training', 'my-assignments'], queryFn: () => trainingAPI.myAssignments() });
  const rows = query.data?.data?.data || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['training'] });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => trainingAPI.updateMyAssignment(id, status),
    onSuccess: () => { toast.success('Updated'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'COMPLETED').length;

  return (
    <div>
      <PageHeader title="Training Module" subtitle="Your assigned training materials" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Assigned to Me" value={total} icon={GraduationCap} tone="indigo" />
        <StatCard label="Completed" value={completed} icon={CheckCircle2} tone="green" />
        <StatCard label="Completion Rate" value={total ? `${Math.round((completed / total) * 100)}%` : '—'} icon={ListChecks} tone="purple" />
      </div>

      <div className="mt-6">
        <DataTable
          columns={[
            { key: 'title', header: 'Training', render: (a) => <div className="min-w-0"><p className="truncate font-medium text-gray-900">{a.training.title}</p><p className="truncate text-xs text-gray-400">{a.training.category}</p></div> },
            { key: 'duration', header: 'Duration', render: (a) => (a.training.durationMinutes ? `${a.training.durationMinutes} min` : '—') },
            { key: 'assigned', header: 'Assigned Date', render: (a) => formatDate(a.assignedAt) },
            { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
            {
              key: 'actions',
              header: '',
              render: (a) => (
                <div className="flex justify-end gap-2">
                  <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setViewing(a)}>Open</button>
                  {a.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      className="text-xs font-medium text-green-600 hover:underline"
                      onClick={() => updateStatus.mutate({ id: a._id, status: 'COMPLETED' })}
                      disabled={updateStatus.isPending}
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          empty={<EmptyState icon={GraduationCap} title="No training assigned yet" description="Your HR/Admin will assign training material here." />}
        />
      </div>

      <TrainingViewerModal
        assignment={viewing}
        onClose={() => setViewing(null)}
        onOpened={(id) => {
          const a = rows.find((r) => r._id === id);
          if (a && a.status === 'ASSIGNED') updateStatus.mutate({ id, status: 'IN_PROGRESS' });
        }}
      />
    </div>
  );
}

function TrainingViewerModal({ assignment, onClose, onOpened }) {
  if (!assignment) return <Modal open={false} onClose={onClose} title="" />;
  const t = assignment.training;

  const open = async () => {
    onOpened(assignment._id);
    if (t.materialType === 'FILE') {
      const win = window.open('about:blank', '_blank');
      if (win) {
        win.document.write('<p style="font-family: sans-serif; padding: 20px; color: #4b5563;">Opening material...</p>');
      }
      try {
        const res = await trainingAPI.download(t._id);
        const mimeType = res.headers?.['content-type'] || 'application/pdf';
        const blob = new Blob([res.data], { type: mimeType });
        viewBlob(blob, win);
      } catch (err) {
        if (win) win.close();
        toast.error(errorMessage(err, 'Could not open material.'));
      }
    } else {
      window.open(t.externalUrl, '_blank', 'noreferrer');
    }
  };

  return (
    <Modal open onClose={onClose} title={t.title} description={t.category} size="lg">
      <div className="space-y-4 p-5">
        {t.description && <p className="text-sm text-gray-700">{t.description}</p>}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {t.durationMinutes && <span>Duration: {t.durationMinutes} min</span>}
          <span>Status: <StatusBadge status={assignment.status} /></span>
        </div>
        <button type="button" className="btn-primary" onClick={open}>
          {t.materialType === 'FILE' ? <><BookOpen className="h-4 w-4" /> Open Material</> : <><PlayCircle className="h-4 w-4" /> Watch / Open Link</>}
        </button>
        <p className="text-xs text-gray-400">Opening this training marks it "In Progress". Use "Mark Complete" in the list once you're done.</p>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Admin / HR view — catalog management                                */
/* ------------------------------------------------------------------ */

function TrainingAdminView() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [viewingAssignees, setViewingAssignees] = useState(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');

  const statsQuery = useQuery({ queryKey: ['training', 'stats'], queryFn: () => trainingAPI.stats() });
  const listQuery = useQuery({ queryKey: ['training', 'list', includeInactive], queryFn: () => trainingAPI.list({ includeInactive: includeInactive ? 'true' : undefined }) });
  const stats = statsQuery.data?.data?.data;
  const rows = (listQuery.data?.data?.data || []).filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['training'] });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => (isActive ? trainingAPI.update(id, { isActive: true }) : trainingAPI.deactivate(id)),
    onSuccess: () => { toast.success('Updated'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Training Module"
        subtitle="Upload and manage training materials for your employees"
        actions={<button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Training</button>}
      />

      {statsQuery.isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Trainings" value={stats?.totalTrainings ?? 0} icon={GraduationCap} tone="indigo" />
          <StatCard label="Active Trainings" value={stats?.activeTrainings ?? 0} icon={CheckCircle2} tone="green" />
          <StatCard label="Assigned" value={stats?.totalAssignments ?? 0} icon={Users} tone="blue" hint={`${stats?.completed ?? 0} completed`} />
          <StatCard label="Completion Rate" value={stats?.completionRate != null ? `${stats.completionRate}%` : '—'} icon={ListChecks} tone="purple" />
        </div>
      )}

      <div className="mt-6">
        <FilterBar onReset={() => { setSearch(''); setIncludeInactive(false); }}>
          <SearchInput className="min-w-[14rem] flex-1" value={search} onChange={setSearch} placeholder="Search trainings…" />
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Show inactive
          </label>
        </FilterBar>

        <DataTable
          columns={[
            {
              key: 'title',
              header: 'Training',
              render: (t) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{t.title}</p>
                  <p className="truncate text-xs text-gray-400">{t.description}</p>
                </div>
              ),
            },
            { key: 'category', header: 'Category', render: (t) => t.category },
            { key: 'material', header: 'Material', render: (t) => (t.materialType === 'FILE' ? t.fileName || 'File' : <a href={t.externalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline">Link <ExternalLink className="h-3 w-3" /></a>) },
            { key: 'duration', header: 'Duration', render: (t) => (t.durationMinutes ? `${t.durationMinutes} min` : '—') },
            {
              key: 'assigned',
              header: 'Assigned Employees',
              render: (t) => (
                <button type="button" className="text-primary-600 hover:underline" onClick={() => setViewingAssignees(t)}>
                  {t.assignmentSummary?.total ?? 0} ({t.assignmentSummary?.completed ?? 0} completed)
                </button>
              ),
            },
            { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { key: 'created', header: 'Created', render: (t) => formatDate(t.createdAt) },
            {
              key: 'actions',
              header: '',
              render: (t) => (
                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="text-xs font-medium text-gray-600 hover:underline" onClick={() => setEditing(t)}>Edit</button>
                  <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setAssigning(t)}>Assign</button>
                  {t.isActive ? (
                    <button type="button" className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline" onClick={() => toggleActive.mutate({ id: t._id, isActive: false })}>
                      <Archive className="h-3.5 w-3.5" /> Deactivate
                    </button>
                  ) : (
                    <button type="button" className="flex items-center gap-1 text-xs font-medium text-green-600 hover:underline" onClick={() => toggleActive.mutate({ id: t._id, isActive: true })}>
                      <RotateCcw className="h-3.5 w-3.5" /> Activate
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
          isLoading={listQuery.isLoading}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          empty={<EmptyState icon={GraduationCap} title="No trainings found" description="Create a training to get started." action={<button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Training</button>} />}
        />
      </div>

      <TrainingFormModal open={creating || Boolean(editing)} training={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={refresh} />
      <AssignTrainingModal training={assigning} onClose={() => setAssigning(null)} onSaved={refresh} />
      <AssigneesModal training={viewingAssignees} onClose={() => setViewingAssignees(null)} />
    </div>
  );
}

function TrainingFormModal({ open, training, onClose, onSaved }) {
  const isEdit = Boolean(training);
  const empty = { title: '', description: '', category: '', materialType: 'FILE', externalUrl: '', durationMinutes: '' };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  if (open && isEdit && loadedFor !== training._id) {
    setForm({
      title: training.title, description: training.description || '', category: training.category,
      materialType: training.materialType, externalUrl: training.externalUrl || '',
      durationMinutes: training.durationMinutes || '',
    });
    setLoadedFor(training._id);
  }

  const save = useMutation({
    mutationFn: (data) => {
      if (isEdit) return trainingAPI.update(training._id, data);
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => { if (v !== '' && v !== undefined) fd.append(k, v); });
      if (file) fd.append('file', file);
      return trainingAPI.create(fd);
    },
    onSuccess: () => { toast.success(isEdit ? 'Training updated' : 'Training created'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setFile(null); setErrors({}); setLoadedFor(null); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.title.trim()) next.title = 'Give the training a title.';
    if (!form.category.trim()) next.category = 'Choose a category.';
    if (!isEdit && form.materialType === 'FILE' && !file) next.file = 'Choose a file to upload.';
    if (form.materialType !== 'FILE' && !form.externalUrl.trim()) next.externalUrl = 'A URL is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} title={isEdit ? 'Edit training' : 'New training'} size="lg">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Training title" required error={errors.title}>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </FormField>
        <FormField label="Description">
          <textarea className="input min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Category" required error={errors.category}>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Compliance, Onboarding, Technical" />
          </FormField>
          <FormField label="Duration (minutes)">
            <input type="number" min="0" className="input" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          </FormField>
        </div>
        {!isEdit && (
          <FormField label="Material type" required>
            <Select value={form.materialType} onChange={(e) => setForm({ ...form, materialType: e.target.value })} options={TRAINING_MATERIAL_TYPES} />
          </FormField>
        )}
        {form.materialType === 'FILE' ? (
          <FormField label={isEdit ? 'Replace file (optional)' : 'File'} required={!isEdit} error={errors.file} hint="PDF, image, Word or spreadsheet files up to 10 MB.">
            <FileUpload file={file} onChange={setFile} error={errors.file} />
          </FormField>
        ) : (
          <FormField label={form.materialType === 'VIDEO_URL' ? 'Video URL' : 'External link'} required error={errors.externalUrl}>
            <input className="input" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://…" />
          </FormField>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create training'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AssignTrainingModal({ training, onClose, onSaved }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const employeesQuery = useQuery({
    queryKey: ['employees', 'list', 'training-assign', search],
    queryFn: () => employeeAPI.list({ search, limit: 50 }),
    enabled: Boolean(training),
  });
  const employees = employeesQuery.data?.data?.data || [];

  const assign = useMutation({
    mutationFn: () => trainingAPI.assign(training._id, selected),
    onSuccess: (res) => { toast.success(`Assigned to ${res.data.data.assigned} employee(s)`); onSaved(); close(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function close() { setSelected([]); setSearch(''); onClose(); }
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Modal open={Boolean(training)} onClose={close} title={`Assign: ${training?.title || ''}`} size="md">
      <div className="p-5">
        <SearchInput className="mb-3 w-full" value={search} onChange={setSearch} placeholder="Search employees…" />
        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100">
          {employeesQuery.isLoading ? <LoadingBlock label="Loading employees…" /> : !employees.length ? (
            <EmptyState icon={Users} title="No employees found" description="Try a different search." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {employees.map((e) => (
                <li key={e._id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                    <input type="checkbox" checked={selected.includes(e._id)} onChange={() => toggle(e._id)} />
                    <Avatar name={e.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{e.fullName}</p>
                      <p className="truncate text-xs text-gray-400">{e.employeeCode} · {e.department}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="button" className="btn-primary" onClick={() => assign.mutate()} disabled={!selected.length || assign.isPending}>
            {assign.isPending ? 'Assigning…' : `Assign to ${selected.length || 0}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AssigneesModal({ training, onClose }) {
  const query = useQuery({
    queryKey: ['training', 'assignees', training?._id],
    queryFn: () => trainingAPI.assignees(training._id),
    enabled: Boolean(training),
  });
  const rows = query.data?.data?.data || [];

  return (
    <Modal open={Boolean(training)} onClose={onClose} title={`Assigned employees — ${training?.title || ''}`} size="lg">
      <div className="p-5">
        {query.isLoading ? <LoadingBlock label="Loading…" /> : !rows.length ? (
          <EmptyState icon={Users} title="Not assigned yet" description="Assign this training to employees to track completion here." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((a) => (
              <li key={a._id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={a.employee?.fullName} size="sm" />
                  <div>
                    <p className="font-medium text-gray-900">{a.employee?.fullName}</p>
                    <p className="text-xs text-gray-400">{a.employee?.employeeCode} · {a.employee?.department}</p>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
