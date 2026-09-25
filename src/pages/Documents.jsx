import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Upload, Download, Eye, CheckCircle2, XCircle, Archive, FileCheck, FileClock, FileX,
  AlertTriangle, Users, Search, Copy, Check, Edit2, Sparkles, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { documentAPI, employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, ConfirmDialog, FileUpload, LoadingBlock, ActionButton,
} from '../components/ui';
import { DOCUMENT_CATEGORIES, documentCategoryGroup } from '../constants';
import { formatDate, formatFileSize, errorMessage, fieldErrors, downloadBlob, viewBlob } from '../lib/format';
import ExtractedDocumentPanels from '../components/ExtractedDocumentPanels';

/**
 * Which register a `?view=` value opens, keyed exactly to the same field
 * `documentAPI.stats()` groups by (EmployeeDocument.status, or the same
 * `expiryDate` window for "expiring") — so the list a stat-tile click lands
 * on is always built from the *same underlying query* as the number that
 * was clicked, and can never come back empty while the tile shows a
 * nonzero count (the bug: clicking "Verified" used to filter the EMPLOYEE
 * list by "is every required doc verified", a stricter, different
 * question than "how many documents are verified", so an employee with
 * just some verified docs correctly counted toward the tile but never
 * matched the employee-level filter).
 */
const DOC_REGISTERS = {
  PENDING: { label: 'Pending Verification', description: 'Documents submitted and awaiting review', params: { status: 'PENDING' } },
  VERIFIED: { label: 'Verified', description: 'Documents that have been verified', params: { status: 'VERIFIED' } },
  REJECTED: { label: 'Rejected', description: 'Documents rejected and needing re-submission', params: { status: 'REJECTED' } },
  EXPIRING: { label: 'Expiring in 30 Days', description: 'Documents due to expire in the next 30 days', params: { expiringSoon: true } },
};

/**
 * Employee list + per-employee document manager by default. The four stat
 * tiles above are clickable for anyone who can browse the employee list
 * (HR_ADMIN/CTO/CEO/etc — same `canManage` gate as the list pane itself)
 * and switch the right-hand pane to a flat, document-level register
 * (DocumentRegisterPane, via documentAPI.list) filtered to match that tile
 * exactly — see DOC_REGISTERS above. Picking a row there jumps back into
 * the normal per-employee manager so HR can act on it (Verify/Reject/
 * Archive) with the same tools as ever.
 */
export default function Documents() {
  const { can, employee: ownEmployee } = useAuth();
  const canManage = can('manageDocuments');
  const [selected, setSelected] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Read once on mount so a stat-tile click (which sets the param and
  // navigates here) seeds the view; same deep-link pattern used on
  // Attendance/Employees/SalesLeads elsewhere in this app.
  const [view, setView] = useState(() => {
    const v = (searchParams.get('view') || '').toUpperCase();
    return DOC_REGISTERS[v] ? v : '';
  });

  const statsQuery = useQuery({ queryKey: ['documents', 'stats'], queryFn: () => documentAPI.stats() });
  const stats = statsQuery.data?.data?.data;

  const goToView = (v) => {
    setView(v);
    setSelected(null);
    setSearchParams({ view: v.toLowerCase() });
  };
  const clearView = () => {
    setView('');
    setSearchParams({});
  };

  const activeEmployee = canManage ? selected : ownEmployee;
  // Anyone may upload documents to their OWN record — the backend already
  // allows this for every role (see documentController's assertCanAccessEmployee,
  // which always permits self-access regardless of role). Only the
  // review actions (Verify/Reject/Archive) stay restricted to canManage
  // (HR_ADMIN), further down in EmployeeDocumentPane.
  const isOwnRecord = Boolean(activeEmployee?._id) && activeEmployee._id === ownEmployee?._id;
  const canUpload = canManage || isOwnRecord;

  return (
    <div>
      <PageHeader title="Documents" subtitle="Upload and manage employee documents" />

      {statsQuery.isLoading ? <StatCardSkeleton count={4} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Pending Verification"
            value={stats?.pending ?? 0}
            icon={FileClock}
            tone="amber"
            onClick={canManage ? () => goToView('PENDING') : undefined}
          />
          <StatCard
            label="Verified"
            value={stats?.verified ?? 0}
            icon={FileCheck}
            tone="green"
            onClick={canManage ? () => goToView('VERIFIED') : undefined}
          />
          <StatCard
            label="Rejected"
            value={stats?.rejected ?? 0}
            icon={FileX}
            tone="red"
            onClick={canManage ? () => goToView('REJECTED') : undefined}
          />
          <StatCard
            label="Expiring in 30 Days"
            value={stats?.expiringSoon ?? 0}
            icon={AlertTriangle}
            tone="purple"
            hint={`${stats?.archived ?? 0} archived`}
            onClick={canManage ? () => goToView('EXPIRING') : undefined}
          />
        </div>
      )}

      {canManage && view && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm text-primary-800">
          <span>
            Showing: <strong>{DOC_REGISTERS[view].label}</strong> — {DOC_REGISTERS[view].description}
          </span>
          <button type="button" onClick={clearView} className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {canManage && view ? (
        <div className="mt-6">
          <DocumentRegisterPane
            registerKey={view}
            onSelectEmployee={(emp) => { clearView(); setSelected(emp); }}
          />
        </div>
      ) : (
        <div className={`mt-6 grid grid-cols-1 gap-6 ${canManage ? 'lg:grid-cols-[20rem_1fr]' : ''}`}>
          {canManage && (
            <EmployeeListPane selected={selected} onSelect={setSelected} />
          )}
          <div className="min-w-0">
            {!activeEmployee ? (
              <div className="card"><EmptyState icon={Users} title="Select an employee" description="Choose an employee on the left to manage their documents." /></div>
            ) : (
              <EmployeeDocumentPane employee={activeEmployee} canManage={canManage} canUpload={canUpload} isOwnRecord={isOwnRecord} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat-tile drill-down — flat, document-level register                */
/* ------------------------------------------------------------------ */

function DocumentRegisterPane({ registerKey, onSelectEmployee }) {
  const config = DOC_REGISTERS[registerKey];
  const query = useQuery({
    queryKey: ['documents', 'list', registerKey],
    queryFn: () => documentAPI.list({ ...config.params, limit: 100 }),
  });
  const rows = query.data?.data?.data || [];

  return (
    <div className="card overflow-hidden">
      <DataTable
        columns={[
          {
            key: 'employee',
            header: 'Employee',
            render: (row) => (
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{row.employee?.fullName || '—'}</p>
                <p className="truncate text-xs text-gray-400">{row.employee?.employeeCode}</p>
              </div>
            ),
          },
          { key: 'name', header: 'Document', render: (row) => <span className="text-sm">{row.name}<span className="ml-1 text-[11px] text-gray-400">({row.category})</span></span> },
          { key: 'uploaded', header: 'Uploaded', render: (row) => formatDate(row.createdAt) },
          { key: 'expiry', header: 'Expires', render: (row) => <span className={registerKey === 'EXPIRING' ? 'text-sm text-amber-700' : 'text-sm'}>{row.expiryDate ? formatDate(row.expiryDate) : '—'}</span> },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status || (row.isVerified ? 'VERIFIED' : 'PENDING')} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <ActionButton icon={Eye} tone="indigo" onClick={() => onSelectEmployee(row.employee)} disabled={!row.employee?._id}>
                Manage documents
              </ActionButton>
            ),
          },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={<EmptyState icon={AlertTriangle} title="Nothing here" description={`No documents match "${config.label}" right now.`} />}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Left pane — employee search/select                                  */
/* ------------------------------------------------------------------ */

function EmployeeListPane({ selected, onSelect }) {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['employees', 'list', 'documents', search],
    queryFn: () => employeeAPI.list({ search, limit: 50 }),
  });
  const rows = query.data?.data?.data || [];

  return (
    <div className="card flex max-h-[42rem] flex-col overflow-hidden">
      <div className="border-b border-gray-100 p-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search employees…" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {query.isLoading ? (
          <div className="space-y-2 p-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}</div>
        ) : !rows.length ? (
          <EmptyState icon={Search} title="No employees found" description="Try a different search." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((emp) => (
              <li key={emp._id}>
                <button
                  type="button"
                  onClick={() => onSelect(emp)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${selected?._id === emp._id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                >
                  <Avatar name={emp.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{emp.fullName}</p>
                    <p className="truncate text-xs text-gray-400">{emp.employeeCode}</p>
                  </div>
                  <StatusBadge
                    status={emp.hasRejectedDocuments ? 'REJECTED' : emp.documentStatus}
                    label={emp.hasRejectedDocuments ? 'Rejected' : emp.documentStatus === 'COMPLETE' ? 'Complete' : 'Pending'}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Right pane — document management for one employee                   */
/* ------------------------------------------------------------------ */

function EmployeeDocumentPane({ employee, canManage, canUpload, isOwnRecord: propIsOwnRecord }) {
  const { employee: ownEmployee } = useAuth();
  const isOwnRecord = propIsOwnRecord ?? (Boolean(employee?._id) && employee._id === ownEmployee?._id);
  const queryClient = useQueryClient();
  const [uploadFor, setUploadFor] = useState(null); // checklist item being uploaded for, or null
  const [rejecting, setRejecting] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const docsQuery = useQuery({
    queryKey: ['employee-docs', employee._id],
    queryFn: () => documentAPI.forEmployee(employee._id),
    enabled: Boolean(employee?._id),
  });
  const checklistQuery = useQuery({
    queryKey: ['employee-doc-checklist', employee._id],
    queryFn: () => documentAPI.checklist(employee._id),
    enabled: Boolean(employee?._id),
  });
  const docs = docsQuery.data?.data?.data || [];
  const checklist = checklistQuery.data?.data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['employee-docs', employee._id] });
    queryClient.invalidateQueries({ queryKey: ['employee-doc-checklist', employee._id] });
    queryClient.invalidateQueries({ queryKey: ['documents', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['documents', 'list'] });
    queryClient.invalidateQueries({ queryKey: ['employees', 'list', 'documents'] });
  };

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

  const view = async (doc) => {
    setViewingId(doc._id);
    const win = window.open('about:blank', '_blank');
    if (win) {
      win.document.write('<p style="font-family: sans-serif; padding: 20px; color: #4b5563;">Opening document...</p>');
    }
    try {
      const res = await documentAPI.view(doc._id);
      const mimeType = res.headers?.['content-type'] || doc.fileType || 'application/pdf';
      const blob = new Blob([res.data], { type: mimeType });
      viewBlob(blob, win);
    } catch (err) {
      if (win) win.close();
      toast.error(errorMessage(err, 'Could not view this document.'));
    } finally {
      setViewingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={employee.fullName} />
          <div>
            <p className="font-semibold text-gray-900">{employee.fullName}</p>
            <p className="text-xs text-gray-400">{employee.employeeCode} · {employee.department}</p>
          </div>
        </div>
      </div>

      {checklistQuery.isLoading ? <LoadingBlock label="Loading checklist…" /> : checklist && (
        <div className="card p-5">
          <h3 className="section-title mb-3">Required documents</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {checklist.items.map((item) => {
              const needsUpload = item.status === 'MISSING' || item.status === 'REJECTED';
              return (
                <li key={item.category} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-gray-700">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{documentCategoryGroup(item.category)}{item.required ? '' : ' · Optional'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={item.status} />
                    {canUpload && needsUpload && (
                      <button
                        type="button"
                        onClick={() => setUploadFor(item)}
                        className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary-600 hover:underline"
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card overflow-hidden">
        <DataTable
          columns={[
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
            { key: 'category', header: 'Type', render: (row) => <span className="text-sm">{row.category}<span className="ml-1 text-[11px] text-gray-400">({documentCategoryGroup(row.category)})</span></span> },
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
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap items-center gap-1.5">
                  <ActionButton icon={Eye} tone="indigo" onClick={() => view(row)} disabled={viewingId === row._id}>
                    {viewingId === row._id ? 'Opening…' : 'View'}
                  </ActionButton>
                  <ActionButton icon={Download} tone="gray" onClick={() => download(row)} disabled={downloadingId === row._id}>
                    {downloadingId === row._id ? '…' : 'Download'}
                  </ActionButton>
                  {(!row.isArchived && (
                    (row.extractedData && Object.keys(row.extractedData).length > 0) ||
                    ['Aadhaar Card', 'PAN Card', 'Bank Account Details', 'Cancelled Cheque', 'Educational Certificates', 'Experience Certificate', 'Address Proof'].includes(row.category)
                  )) && (
                      <ActionButton
                        icon={Sparkles}
                        tone="purple"
                        title="View extracted OCR details"
                        onClick={() => {
                          const el = document.getElementById(`extracted-panel-${row._id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      >
                        Details
                      </ActionButton>
                    )}
                  {canManage && row.status !== 'ARCHIVED' && (
                    <>
                      {row.status !== 'VERIFIED' && (
                        <ActionButton icon={CheckCircle2} tone="green" onClick={() => verify.mutate(row._id)}>Verify</ActionButton>
                      )}
                      {row.status !== 'REJECTED' && (
                        <ActionButton icon={XCircle} tone="red" onClick={() => setRejecting(row)}>Reject</ActionButton>
                      )}
                      <ActionButton icon={Archive} tone="gray" onClick={() => setArchiving(row)}>Archive</ActionButton>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          rows={docs}
          isLoading={docsQuery.isLoading}
          error={docsQuery.error}
          onRetry={docsQuery.refetch}
          empty={
            <EmptyState
              icon={FileText}
              title="No documents found"
              description={canUpload ? 'Use the Upload button on any missing item above to get started.' : 'No documents have been filed against your profile yet.'}
            />
          }
        />
      </div>

      <ExtractedDocumentPanels
        docs={docs}
        isOwnRecord={isOwnRecord}
        canManage={canManage}
        onUpdated={refresh}
      />

      <UploadModal open={Boolean(uploadFor)} onClose={() => setUploadFor(null)} employee={employee} initialItem={uploadFor} onSaved={refresh} />

      <RejectDocumentModal doc={rejecting} onClose={() => setRejecting(null)} loading={reject.isPending} onSubmit={(reason) => reject.mutate({ id: rejecting._id, reason })} />

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

function UploadModal({ open, onClose, employee, initialItem, onSaved }) {
  const empty = { name: '', category: '', issueDate: '', expiryDate: '', notes: '' };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(0);

  // Pre-fill (and lock) name + type when opened from a specific missing/rejected
  // checklist item, so uploading "PAN Card" always lands in the right slot.
  useEffect(() => {
    if (open && initialItem) {
      setForm({ ...empty, name: initialItem.label, category: initialItem.category });
    } else if (open) {
      setForm(empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItem]);

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
    if (!form.name.trim()) next.name = 'Give the document a name.';
    if (!form.category) next.category = 'Choose a document type.';
    if (form.issueDate && form.expiryDate && form.expiryDate < form.issueDate) {
      next.expiryDate = 'Expiry date cannot be before the issue date.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('employeeId', employee._id);
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    upload.mutate(fd);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={initialItem ? `Upload ${initialItem.label}` : 'Upload document'}
      description={`For ${employee?.fullName || ''} — PDF, image, Word or spreadsheet files up to 10 MB.`}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="File" required>
          <FileUpload file={file} onChange={setFile} error={errors.file} progress={progress} />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Document name" required error={errors.name}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. PAN Card" readOnly={Boolean(initialItem)} />
          </FormField>
          <FormField label="Document type" required error={errors.category}>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={DOCUMENT_CATEGORIES} placeholder="Select a type" disabled={Boolean(initialItem)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <button type="submit" className="btn-primary" disabled={upload.isPending}>{upload.isPending ? 'Uploading…' : 'Upload document'}</button>
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
    <Modal open={Boolean(doc)} onClose={close} size="sm" title="Reject document" description={doc ? doc.name : ''}>
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