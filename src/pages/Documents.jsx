import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  FileText, Upload, Download, Eye, CheckCircle2, XCircle, Archive, FileCheck, FileClock, FileX, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { documentAPI, employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, ConfirmDialog, FileUpload,
} from '../components/ui';
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, DEPARTMENTS } from '../constants';
import { formatDate, formatFileSize, errorMessage, fieldErrors, downloadBlob } from '../lib/format';

const PAGE_SIZE = 20;

export default function Documents() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ status: '', category: '', department: '', search: '', employeeId: '' });
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters({ status: '', category: '', department: '', search: '', employeeId: '' }); setPage(1); };

  const query = useQuery({
    queryKey: ['documents', 'list', filters, page],
    queryFn: () => documentAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({ queryKey: ['documents', 'stats'], queryFn: () => documentAPI.stats() });

  const employeesQuery = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    enabled: can('manageDocuments'),
    staleTime: 5 * 60 * 1000,
  });
  const staff = employeesQuery.data?.data?.data?.managers || [];

  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;
  const stats = statsQuery.data?.data?.data;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['documents'] });

  const verify = useMutation({
    mutationFn: (id) => documentAPI.verify(id),
    onSuccess: () => { toast.success('Document verified'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }) => documentAPI.reject(id, reason),
    onSuccess: () => { toast.success('Document rejected'); refresh(); setRejecting(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const archive = useMutation({
    mutationFn: (id) => documentAPI.archive(id),
    onSuccess: () => { toast.success('Document archived'); refresh(); setArchiving(null); },
    onError: (err) => { toast.error(errorMessage(err)); setArchiving(null); },
  });

  const download = async (doc) => {
    setDownloadingId(doc._id);
    try {
      const res = await documentAPI.download(doc._id);
      downloadBlob(res.data, doc.originalName || `${doc.name}.pdf`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download this document.'));
    } finally {
      setDownloadingId(null);
    }
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
            <p className="truncate text-xs text-gray-400">{row.employee?.employeeCode} · {row.employee?.department}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Document',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{row.name}</p>
          <p className="truncate text-xs text-gray-400">{row.originalName}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Type', render: (row) => row.category },
    { key: 'size', header: 'Size', render: (row) => <span className="text-xs text-gray-500">{formatFileSize(row.fileSize)}</span> },
    { key: 'uploaded', header: 'Uploaded', render: (row) => formatDate(row.createdAt) },
    { key: 'expiry', header: 'Expires', render: (row) => (row.expiryDate ? formatDate(row.expiryDate) : '—') },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={row.status || (row.isVerified ? 'VERIFIED' : 'PENDING')} />
          {row.status === 'REJECTED' && row.rejectionReason && (
            <p className="mt-1 max-w-[12rem] truncate text-[11px] text-gray-400" title={row.rejectionReason}>{row.rejectionReason}</p>
          )}
        </div>
      ),
    },
    { key: 'verifiedBy', header: 'Verified By', render: (row) => <span className="text-xs text-gray-500">{row.verifiedBy?.email || '—'}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <a
            href={documentAPI.viewUrl(row._id)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </a>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline disabled:opacity-50"
            onClick={() => download(row)}
            disabled={downloadingId === row._id}
          >
            <Download className="h-3.5 w-3.5" /> {downloadingId === row._id ? '…' : 'Download'}
          </button>
          {can('manageDocuments') && row.status !== 'ARCHIVED' && (
            <>
              {row.status !== 'VERIFIED' && (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-green-600 hover:underline" onClick={() => verify.mutate(row._id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                </button>
              )}
              {row.status !== 'REJECTED' && (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline" onClick={() => setRejecting(row)}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              )}
              <button type="button" className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:underline" onClick={() => setArchiving(row)}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </button>
            </>
          )}
        </div>
      ),
    },
  ], [can, downloadingId, verify]);

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Employee document register, verification and archive"
        actions={can('manageDocuments') && (
          <button type="button" className="btn-primary" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Upload document
          </button>
        )}
      />

      {statsQuery.isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Pending Verification" value={stats?.pending ?? 0} icon={FileClock} tone="amber" />
          <StatCard label="Verified" value={stats?.verified ?? 0} icon={FileCheck} tone="green" />
          <StatCard label="Rejected" value={stats?.rejected ?? 0} icon={FileX} tone="red" />
          <StatCard label="Expiring in 30 Days" value={stats?.expiringSoon ?? 0} icon={AlertTriangle} tone="purple" hint={`${stats?.archived ?? 0} archived`} />
        </div>
      )}

      <div className="mt-6">
        <FilterBar onReset={resetFilters}>
          <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search document or employee…" />
          <div>
            <label className="label">Status</label>
            <Select className="w-40" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={DOCUMENT_STATUSES} placeholder="All statuses" />
          </div>
          <div>
            <label className="label">Type</label>
            <Select className="w-52" value={filters.category} onChange={(e) => setFilter('category', e.target.value)} options={DOCUMENT_CATEGORIES} placeholder="All types" />
          </div>
          {can('manageDocuments') && (
            <>
              <div>
                <label className="label">Department</label>
                <Select className="w-44" value={filters.department} onChange={(e) => setFilter('department', e.target.value)} options={DEPARTMENTS} placeholder="All departments" />
              </div>
              <div>
                <label className="label">Employee</label>
                <Select
                  className="w-52"
                  value={filters.employeeId}
                  onChange={(e) => setFilter('employeeId', e.target.value)}
                  options={staff.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
                  placeholder="All employees"
                />
              </div>
            </>
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
              icon={FileText}
              title="No documents found"
              description={can('manageDocuments') ? 'Upload an employee document to get started.' : 'No documents have been filed against your profile yet.'}
              action={can('manageDocuments') ? <button type="button" className="btn-primary" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4" /> Upload document</button> : null}
            />
          }
          footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
        />
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} employees={staff} onSaved={refresh} />

      <RejectDocumentModal
        doc={rejecting}
        onClose={() => setRejecting(null)}
        loading={reject.isPending}
        onSubmit={(reason) => reject.mutate({ id: rejecting._id, reason })}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => archive.mutate(archiving._id)}
        loading={archive.isPending}
        title="Archive document"
        message={archiving ? `Archive "${archiving.name}"? It will be hidden from the active register but kept on file.` : ''}
        confirmLabel="Archive"
      />
    </div>
  );
}

function UploadModal({ open, onClose, employees, onSaved }) {
  const empty = { employeeId: '', name: '', category: '', issueDate: '', expiryDate: '', notes: '' };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(0);

  const upload = useMutation({
    mutationFn: (formData) => documentAPI.upload(formData, (e) => {
      if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
    }),
    onSuccess: () => { toast.success('Document uploaded'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); setProgress(0); toast.error(errorMessage(err, 'Upload failed.')); },
  });

  function close() { setForm(empty); setFile(null); setErrors({}); setProgress(0); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!file) next.file = 'Choose a file to upload.';
    if (!form.employeeId) next.employeeId = 'Choose an employee.';
    if (!form.name.trim()) next.name = 'Give the document a name.';
    if (!form.category) next.category = 'Choose a document type.';
    if (form.issueDate && form.expiryDate && form.expiryDate < form.issueDate) {
      next.expiryDate = 'Expiry date cannot be before the issue date.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const fd = new FormData();
    fd.append('file', file);
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    upload.mutate(fd);
  };

  return (
    <Modal open={open} onClose={close} title="Upload document" description="PDF, image, Word or spreadsheet files up to 10 MB.">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="File" required>
          <FileUpload file={file} onChange={setFile} error={errors.file} progress={progress} />
        </FormField>

        <FormField label="Employee" required error={errors.employeeId}>
          <Select
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            options={employees.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
            placeholder="Select an employee"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Document name" required error={errors.name}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. PAN Card" />
          </FormField>
          <FormField label="Document type" required error={errors.category}>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={DOCUMENT_CATEGORIES} placeholder="Select a type" />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Issue date">
            <input type="date" className="input" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          </FormField>
          <FormField label="Expiry date" error={errors.expiryDate}>
            <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </FormField>
        </div>

        <FormField label="Notes">
          <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close} disabled={upload.isPending}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RejectDocumentModal({ doc, onClose, onSubmit, loading }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Explain what is wrong so the document can be re-submitted.'); return; }
    onSubmit(reason.trim());
  };

  const close = () => { setReason(''); setError(''); onClose(); };

  return (
    <Modal open={Boolean(doc)} onClose={close} size="sm" title="Reject document" description={doc ? `${doc.name} · ${doc.employee?.fullName}` : ''}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Reason for rejection" required error={error}>
          <textarea className="input min-h-[90px]" maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} />
        </FormField>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={loading}>{loading ? 'Rejecting…' : 'Reject document'}</button>
        </div>
      </form>
    </Modal>
  );
}
