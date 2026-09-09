import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Megaphone, Plus, Eye, Archive, BellRing, Mail, MailOpen, Users2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { announcementAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, EmptyState, ConfirmDialog, InfoRow,
} from '../components/ui';
import { ANNOUNCEMENT_PRIORITIES, DEPARTMENTS } from '../constants';
import { formatDate, formatDateTime, relativeTime, errorMessage, fieldErrors } from '../lib/format';

const PAGE_SIZE = 20;

export default function Announcements() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ search: '', priority: '', status: '', unreadOnly: false });
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(null);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };

  // The model only tracks isActive (no separate DRAFT state) — "status" here
  // maps directly onto that field, resolved server-side (see contentController.getAnnouncements).
  const query = useQuery({
    queryKey: ['announcements', filters, page],
    queryFn: () => announcementAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['announcements'] });

  const markRead = useMutation({
    mutationFn: (id) => announcementAPI.markRead(id),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id) => announcementAPI.remove(id),
    onSuccess: () => { toast.success('Announcement removed'); refresh(); setRemoving(null); },
    onError: (err) => { toast.error(errorMessage(err)); setRemoving(null); },
  });

  const activate = useMutation({
    mutationFn: (id) => announcementAPI.update(id, { isActive: true }),
    onSuccess: () => { toast.success('Announcement activated'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openAnnouncement = (row) => {
    setViewing(row);
    if (!row.isRead) markRead.mutate(row._id);
  };

  const audienceLabel = (row) => {
    if (row.targetAudience === 'DEPARTMENT') return `Dept: ${(row.targetDepartments || []).join(', ') || '—'}`;
    if (row.targetAudience === 'DESIGNATION') return `Role: ${(row.targetDesignations || []).join(', ') || '—'}`;
    if (row.targetAudience === 'SPECIFIC') return `${(row.targetEmployees || []).length} employee(s)`;
    return 'Everyone';
  };

  const columns = [
    {
      key: 'title',
      header: 'Announcement',
      render: (row) => (
        <div className="flex items-start gap-2">
          {!row.isRead && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-600" title="Unread" />}
          <div className="min-w-0">
            <p className={`truncate ${row.isRead ? 'font-medium text-gray-900' : 'font-semibold text-gray-900'}`}>{row.title}</p>
            <p className="truncate text-xs text-gray-400">{row.description}</p>
          </div>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', render: (row) => <StatusBadge status={row.priority} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    {
      key: 'audience',
      header: 'Audience',
      render: (row) => (
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <Users2 className="h-3.5 w-3.5" /> {audienceLabel(row)}
        </span>
      ),
    },
    { key: 'author', header: 'Author', render: (row) => <span className="text-xs text-gray-500">{row.createdBy?.email || '—'}</span> },
    { key: 'created', header: 'Created', render: (row) => formatDate(row.createdAt) },
    { key: 'published', header: 'Published', render: (row) => (row.publishDate ? formatDate(row.publishDate) : '—') },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline" onClick={(e) => { e.stopPropagation(); openAnnouncement(row); }}>
            <Eye className="h-3.5 w-3.5" /> View
          </button>
          {can('manageAnnouncements') && (
            <>
              <button type="button" className="text-xs font-medium text-gray-600 hover:underline" onClick={(e) => { e.stopPropagation(); setEditing(row); }}>
                Edit
              </button>
              {row.isActive ? (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline" onClick={(e) => { e.stopPropagation(); setRemoving(row); }}>
                  <Archive className="h-3.5 w-3.5" /> Remove
                </button>
              ) : (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-green-600 hover:underline" onClick={(e) => { e.stopPropagation(); activate.mutate(row._id); }} disabled={activate.isPending}>
                  <RotateCcw className="h-3.5 w-3.5" /> Activate
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Manage company-wide announcements"
        actions={can('manageAnnouncements') && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New announcement
          </button>
        )}
      />

      {query.isLoading ? <StatCardSkeleton count={3} /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Announcements" value={meta?.total ?? rows.length} icon={Megaphone} tone="indigo" />
          <StatCard label="Unread" value={meta?.unreadCount ?? rows.filter((r) => !r.isRead).length} icon={BellRing} tone="amber" />
          <StatCard label="Urgent" value={rows.filter((r) => r.priority === 'URGENT').length} icon={Mail} tone="red" />
        </div>
      )}

      <div className="mt-6">
        <FilterBar onReset={() => { setFilters({ search: '', priority: '', status: '', unreadOnly: false }); setPage(1); }}>
          <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search announcements…" />
          {can('manageAnnouncements') && (
            <div>
              <label className="label">Status</label>
              <Select
                className="w-36"
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
                options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
                placeholder="All statuses"
              />
            </div>
          )}
          <div>
            <label className="label">Priority</label>
            <Select className="w-36" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)} options={ANNOUNCEMENT_PRIORITIES} placeholder="All priorities" />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" checked={filters.unreadOnly} onChange={(e) => setFilter('unreadOnly', e.target.checked)} />
            Unread only
          </label>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={rows}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={openAnnouncement}
          empty={
            <EmptyState
              icon={MailOpen}
              title="No announcements"
              description={can('manageAnnouncements') ? 'Create an announcement to communicate with the organisation.' : 'Nothing has been announced yet.'}
              action={can('manageAnnouncements') ? <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New announcement</button> : null}
            />
          }
          footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
        />
      </div>

      <AnnouncementDetailModal announcement={viewing} onClose={() => setViewing(null)} />
      <AnnouncementFormModal open={creating || Boolean(editing)} announcement={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={refresh} />

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing._id)}
        loading={remove.isPending}
        title="Remove announcement"
        message={removing ? `Remove "${removing.title}"? It will no longer be visible to employees.` : ''}
        confirmLabel="Remove"
      />
    </div>
  );
}

function AnnouncementDetailModal({ announcement, onClose }) {
  if (!announcement) return <Modal open={false} onClose={onClose} title="" />;
  return (
    <Modal open onClose={onClose} size="lg" title={announcement.title} description={`Priority: ${announcement.priority}`}>
      <div className="p-5">
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
          <InfoRow label="Author" value={announcement.createdBy?.email} />
          <InfoRow label="Created" value={formatDateTime(announcement.createdAt)} />
          <InfoRow label="Published" value={announcement.publishDate ? formatDateTime(announcement.publishDate) : 'Immediately'} />
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{announcement.description}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

function AnnouncementFormModal({ open, announcement, onClose, onSaved }) {
  const isEdit = Boolean(announcement);
  const empty = { title: '', description: '', priority: 'MEDIUM', targetAudience: 'ALL', targetDepartments: [], expiryDate: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  if (open && isEdit && loadedFor !== announcement._id) {
    setForm({
      title: announcement.title || '', description: announcement.description || '',
      priority: announcement.priority || 'MEDIUM', targetAudience: announcement.targetAudience || 'ALL',
      targetDepartments: announcement.targetDepartments || [], expiryDate: announcement.expiryDate?.slice(0, 10) || '',
    });
    setLoadedFor(announcement._id);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? announcementAPI.update(announcement._id, data) : announcementAPI.create(data)),
    onSuccess: () => { toast.success(isEdit ? 'Announcement updated' : 'Announcement published'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setLoadedFor(null); onClose(); }

  const toggleDept = (dept) => {
    setForm((f) => ({
      ...f,
      targetDepartments: f.targetDepartments.includes(dept)
        ? f.targetDepartments.filter((d) => d !== dept)
        : [...f.targetDepartments, dept],
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (form.title.trim().length < 3) next.title = 'Title must be at least 3 characters.';
    if (form.description.trim().length < 3) next.description = 'Write the announcement body.';
    if (form.targetAudience === 'DEPARTMENT' && form.targetDepartments.length === 0) next.targetDepartments = 'Select at least one department.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = { ...form };
    if (payload.targetAudience !== 'DEPARTMENT') delete payload.targetDepartments;
    if (!payload.expiryDate) delete payload.expiryDate;
    save.mutate(payload);
  };

  return (
    <Modal open={open} onClose={close} size="lg" title={isEdit ? 'Edit announcement' : 'New announcement'}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Title" required error={errors.title}>
          <input className="input" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </FormField>

        <FormField label="Message" required error={errors.description}>
          <textarea className="input min-h-[120px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What do people need to know?" />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Priority" required>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} options={ANNOUNCEMENT_PRIORITIES} />
          </FormField>
          <FormField label="Audience" required>
            <Select
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              options={[{ value: 'ALL', label: 'Everyone' }, { value: 'DEPARTMENT', label: 'Specific departments' }]}
            />
          </FormField>
        </div>

        {form.targetAudience === 'DEPARTMENT' && (
          <FormField label="Departments" required error={errors.targetDepartments}>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDept(d)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    form.targetDepartments.includes(d) ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </FormField>
        )}

        <FormField label="Expires on" hint="Optional — leave blank for no expiry.">
          <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Publish announcement'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
