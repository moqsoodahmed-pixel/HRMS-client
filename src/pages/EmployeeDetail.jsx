import { useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit, Archive, Plus, Download, Eye, CheckCircle2, Clock, Calendar,
  Wallet, UserPlus, UserMinus, KeyRound, ShieldQuestion, ClipboardCheck, AlertTriangle, FileEdit, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeAPI, documentAPI, editRequestAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  Modal, LoadingBlock, EmptyState, StatusBadge, Avatar, Tabs, InfoRow,
  FormField, Select, FileUpload, ConfirmDialog, DataTable, ProgressBar,
} from '../components/ui';
import { DOCUMENT_CATEGORIES, IDENTITY_TYPES } from '../constants';
import { formatDate, formatFileSize, errorMessage, fieldErrors, downloadBlob, viewBlob } from '../lib/format';

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can, user, employee: ownEmployee } = useAuth();
  const [searchParams] = useSearchParams();
  // Supports being deep-linked straight to a tab, e.g. after creating an
  // employee HR is sent here to start on the required-documents checklist.
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview');
  const [showUpload, setShowUpload] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [rejectingDoc, setRejectingDoc] = useState(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [requestingChanges, setRequestingChanges] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['employee', id], queryFn: () => employeeAPI.get(id) });
  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['employee-docs', id],
    queryFn: () => documentAPI.forEmployee(id),
    enabled: tab === 'documents',
  });
  const { data: checklistData, isLoading: checklistLoading } = useQuery({
    // Always fetched (not gated by tab) — the header badge and Overview
    // summary need it regardless of which tab is open.
    queryKey: ['employee-doc-checklist', id],
    queryFn: () => documentAPI.checklist(id),
  });
  const { data: identityData, isLoading: identityLoading } = useQuery({
    queryKey: ['employee-identity', id],
    queryFn: () => documentAPI.identity.list(id),
    enabled: tab === 'identity',
  });

  const emp = data?.data?.data;
  const docs = docsData?.data?.data || [];
  const checklist = checklistData?.data?.data;
  const identityDocs = identityData?.data?.data || [];

  const archiveMut = useMutation({
    mutationFn: () => employeeAPI.archive(id),
    onSuccess: () => {
      toast.success('Employee archived');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate('/employees');
    },
    onError: (err) => { toast.error(errorMessage(err, 'Could not archive this employee.')); setShowArchive(false); },
  });

  const deleteMut = useMutation({
    mutationFn: () => employeeAPI.delete(id),
    onSuccess: () => {
      toast.success('Employee permanently deleted');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate('/employees');
    },
    onError: (err) => { toast.error(errorMessage(err, 'Could not delete this employee.')); setShowDelete(false); },
  });

  const invalidateDocs = () => {
    queryClient.invalidateQueries({ queryKey: ['employee-docs', id] });
    queryClient.invalidateQueries({ queryKey: ['employee-doc-checklist', id] });
  };

  const verifyMut = useMutation({
    mutationFn: (docId) => documentAPI.verify(docId),
    onSuccess: () => { toast.success('Document verified'); invalidateDocs(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rejectMut = useMutation({
    mutationFn: ({ docId, reason }) => documentAPI.reject(docId, reason),
    onSuccess: () => { toast.success('Document rejected'); invalidateDocs(); setRejectingDoc(null); },
    onError: (err) => { toast.error(errorMessage(err)); setRejectingDoc(null); },
  });

  const [viewingDoc, setViewingDoc] = useState(null);

  const handleDownload = async (doc) => {
    try {
      const res = await documentAPI.download(doc._id);
      downloadBlob(res.data, doc.originalName || doc.name);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not download this document.'));
    }
  };

  const handleView = async (doc) => {
    setViewingDoc(doc._id);
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
      setViewingDoc(null);
    }
  };

  if (isLoading) return <LoadingBlock label="Loading employee…" />;
  if (error) {
    return (
      <div className="card">
        <EmptyState
          title="Could not load this employee"
          description={errorMessage(error)}
          action={<button type="button" className="btn-primary" onClick={() => refetch()}>Try again</button>}
        />
      </div>
    );
  }
  if (!emp) return <div className="card"><EmptyState title="Employee not found" /></div>;

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'employment', label: 'Employment' },
    { value: 'documents', label: 'Documents' },
    { value: 'identity', label: 'Identity' },
  ];

  const quickLinks = [
    { to: '/attendance', label: 'Attendance', icon: Clock },
    { to: '/leave', label: 'Leave', icon: Calendar },
    ...(can('viewPayroll') || user?.role === 'EMPLOYEE' || user?.role === 'IT_HEAD' ? [{ to: '/payroll', label: 'Payroll', icon: Wallet }] : []),
    ...(can('viewLifecycle') ? [{ to: '/onboarding', label: 'Onboarding', icon: UserPlus }] : []),
    ...(can('viewLifecycle') ? [{ to: '/offboarding', label: 'Offboarding', icon: UserMinus }] : []),
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/employees" className="btn-ghost"><ArrowLeft className="h-5 w-5" /></Link>
          <Avatar name={emp.fullName} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{emp.fullName}</h1>
              <StatusBadge status={emp.status} />
              {checklist && (
                <StatusBadge
                  status={checklist.employee?.hasRejectedDocuments ? 'REJECTED' : checklist.summary.isComplete ? 'COMPLETE' : 'PENDING'}
                  label={checklist.employee?.hasRejectedDocuments ? 'Documents Rejected' : checklist.summary.isComplete ? 'Documents Complete' : 'Documents Pending'}
                />
              )}
            </div>
            <p className="text-sm text-gray-500">{emp.designation} &middot; {emp.department}</p>
            <p className="font-mono text-xs text-gray-400">{emp.employeeCode}</p>
          </div>
        </div>
        {can('manageEmployees') && !emp.isArchived && (
          <div className="flex gap-2">
            <Link to={`/employees/${id}/edit`} className="btn-secondary"><Edit className="h-4 w-4" /> Edit</Link>
            <button type="button" className="btn-danger" onClick={() => setShowArchive(true)}><Archive className="h-4 w-4" /> Archive</button>
            {can('deleteEmployee') && (
              <button type="button" className="btn-danger" onClick={() => setShowDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>
            )}
          </div>
        )}
        {can('manageEmployees') && emp.isArchived && can('deleteEmployee') && (
          <div className="flex gap-2">
            <button type="button" className="btn-danger" onClick={() => setShowDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>
          </div>
        )}
        {!can('manageEmployees') && user?.role === 'EMPLOYEE' && ownEmployee?._id === id && (
          <button type="button" className="btn-secondary" onClick={() => setRequestingChanges(true)}>
            <FileEdit className="h-4 w-4" /> Request Changes
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {quickLinks.map((l) => (
          <Link key={l.to} to={l.to} className="btn-secondary text-xs">
            <l.icon className="h-3.5 w-3.5" /> {l.label}
          </Link>
        ))}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-5">
          <EmployeeDocumentationSummary checklist={checklist} isLoading={checklistLoading} onOpenDocuments={() => setTab('documents')} />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Contact Information</h3>
            <InfoRow label="Official Email" value={emp.officialEmail} />
            <InfoRow label="Personal Email" value={emp.personalEmail} />
            <InfoRow label="Personal Mobile" value={emp.personalMobile} />
            <InfoRow label="Date of Birth" value={formatDate(emp.dateOfBirth, undefined)} />
            <InfoRow label="Gender" value={emp.gender} />
            <InfoRow label="Blood Group" value={emp.bloodGroup} />
            <InfoRow label="Nationality" value={emp.nationality} />
          </div>
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Employment Summary</h3>
            <InfoRow label="Employment Type" value={emp.employmentType?.replace('_', ' ')} />
            <InfoRow label="Work Location" value={emp.workLocation} />
            <InfoRow label="Reporting Manager" value={emp.manager?.fullName} />
            <InfoRow label="Date of Joining" value={formatDate(emp.dateOfJoining, undefined)} />
            <InfoRow label="Probation End" value={formatDate(emp.probationEndDate, undefined)} />
            <InfoRow label="Confirmation Date" value={formatDate(emp.confirmationDate, undefined)} />
            {emp.dateOfExit && <InfoRow label="Date of Exit" value={formatDate(emp.dateOfExit)} />}
          </div>
          </div>
        </div>
      )}

      {tab === 'employment' && (
        <div className="card space-y-4 p-5">
          <h3 className="section-title">Employment Details</h3>
          <InfoRow label="Employee Code" value={emp.employeeCode} />
          <InfoRow label="Designation" value={emp.designation} />
          <InfoRow label="Department" value={emp.department} />
          <InfoRow label="Employment Type" value={emp.employmentType?.replace('_', ' ')} />
          <InfoRow label="Status" value={<StatusBadge status={emp.status} />} />
          <InfoRow label="Notice Period" value={emp.noticePeriodDays ? `${emp.noticePeriodDays} days` : undefined} />
          <InfoRow label="Exit Reason" value={emp.exitReason} />
          <InfoRow label="User Account" value={emp.user?.email} />
          <InfoRow label="Account Role" value={emp.user?.role?.replace('_', ' ')} />
          <InfoRow label="Account Status" value={emp.user ? <StatusBadge status={emp.user.isActive ? 'ACTIVE' : 'INACTIVE'} /> : undefined} />
          <InfoRow label="Last Login" value={formatDate(emp.user?.lastLogin, undefined)} />
        </div>
      )}

      {tab === 'documents' && (
        <div className="space-y-4">
          <RequiredDocumentsChecklist
            checklist={checklist}
            isLoading={checklistLoading}
            canManage={can('manageDocuments')}
            onUpload={(category) => { setUploadCategory(category); setShowUpload(true); }}
          />

          <div className="flex items-center justify-between">
            <h3 className="section-title">All uploaded documents</h3>
            {can('manageDocuments') && (
              <button type="button" className="btn-primary" onClick={() => { setUploadCategory(''); setShowUpload(true); }}><Plus className="h-4 w-4" /> Upload document</button>
            )}
          </div>
          <DataTable
            columns={[
              { key: 'name', header: 'Name', render: (d) => <span className="font-medium text-gray-900">{d.name}</span> },
              { key: 'category', header: 'Category', render: (d) => d.category },
              { key: 'size', header: 'Size', render: (d) => <span className="text-xs text-gray-500">{formatFileSize(d.fileSize)}</span> },
              { key: 'uploaded', header: 'Uploaded', render: (d) => formatDate(d.createdAt) },
              { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status || (d.isVerified ? 'VERIFIED' : 'PENDING')} /> },
              {
                key: 'actions',
                header: 'Actions',
                render: (d) => (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleView(d)}
                      disabled={viewingDoc === d._id}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
                    >
                      <Eye className="h-3 w-3" /> {viewingDoc === d._id ? '…' : 'View'}
                    </button>
                    <button type="button" onClick={() => handleDownload(d)} className="flex items-center gap-1 text-xs text-gray-500 hover:underline"><Download className="h-3 w-3" /> Download</button>
                    {can('manageDocuments') && d.status !== 'VERIFIED' && (
                      <button type="button" onClick={() => verifyMut.mutate(d._id)} className="flex items-center gap-1 text-xs text-green-600 hover:underline"><CheckCircle2 className="h-3 w-3" /> Verify</button>
                    )}
                    {can('manageDocuments') && d.status !== 'REJECTED' && (
                      <button type="button" onClick={() => setRejectingDoc(d)} className="text-xs text-red-600 hover:underline">Reject</button>
                    )}
                  </div>
                ),
              },
            ]}
            rows={docs}
            isLoading={docsLoading}
            empty={<EmptyState title="No documents" description="No documents uploaded yet." />}
          />
        </div>
      )}

      {tab === 'identity' && (
        <IdentitySection
          employeeId={id}
          docs={identityDocs}
          isLoading={identityLoading}
          canManage={can('manageEmployees')}
          canReveal={can('revealIdentity')}
        />
      )}

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Document">
        <UploadDocumentForm
          employeeId={id}
          defaultCategory={uploadCategory}
          onDone={() => {
            setShowUpload(false);
            queryClient.invalidateQueries({ queryKey: ['employee-docs', id] });
            queryClient.invalidateQueries({ queryKey: ['employee-doc-checklist', id] });
          }}
          onCancel={() => setShowUpload(false)}
        />
      </Modal>

      <ConfirmDialog
        open={showArchive}
        onClose={() => setShowArchive(false)}
        onConfirm={() => archiveMut.mutate()}
        loading={archiveMut.isPending}
        title="Archive Employee"
        message={`Archive ${emp.fullName}? Their account will be disabled and they will not be able to log in.`}
        confirmLabel="Archive"
      />

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMut.mutate()}
        loading={deleteMut.isPending}
        title="Permanently Delete Employee"
        message={`This will permanently delete ${emp.fullName} and their login account. This cannot be undone. Are you sure?`}
        confirmLabel="Delete Permanently"
      />

      <RejectDocModal doc={rejectingDoc} onClose={() => setRejectingDoc(null)} onSubmit={(reason) => rejectMut.mutate({ docId: rejectingDoc._id, reason })} loading={rejectMut.isPending} />

      <RequestChangesModal
        open={requestingChanges}
        onClose={() => setRequestingChanges(false)}
        employee={emp}
      />
    </div>
  );
}

/**
 * Minimal new self-service flow: an employee proposes a change to a small
 * set of fields; nothing is written to Employee until HR/Admin approves it
 * (see employeeEditRequestController.js / Manage Employees › Edit Requests).
 */
function RequestChangesModal({ open, onClose, employee }) {
  const empty = { personalEmail: '', personalMobile: '', workLocation: '' };
  const [form, setForm] = useState(empty);

  const submit = useMutation({
    mutationFn: (data) => editRequestAPI.create(data),
    onSuccess: () => { toast.success('Change request submitted for HR/Admin review'); close(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function close() { setForm(empty); onClose(); }

  const handleSubmit = (e) => {
    e.preventDefault();
    const changes = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''));
    if (Object.keys(changes).length === 0) { toast.error('Change at least one field.'); return; }
    submit.mutate(changes);
  };

  return (
    <Modal open={open} onClose={close} title="Request Profile Changes" size="sm" description="Submitted changes need HR/Admin approval before they take effect.">
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <FormField label="Personal Email" hint={`Current: ${employee?.personalEmail || '—'}`}>
          <input type="email" className="input" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} />
        </FormField>
        <FormField label="Personal Mobile" hint={`Current: ${employee?.personalMobile || '—'}`}>
          <input className="input" value={form.personalMobile} onChange={(e) => setForm({ ...form, personalMobile: e.target.value })} />
        </FormField>
        <FormField label="Work Location" hint={`Current: ${employee?.workLocation || '—'}`}>
          <input className="input" value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={submit.isPending}>{submit.isPending ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </form>
    </Modal>
  );
}

function UploadDocumentForm({ employeeId, defaultCategory, onDone, onCancel }) {
  const [form, setForm] = useState({ name: '', category: defaultCategory || '', issueDate: '' });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [progress, setProgress] = useState(0);

  const upload = useMutation({
    mutationFn: (fd) => documentAPI.upload(fd, (e) => { if (e.total) setProgress(Math.round((e.loaded * 100) / e.total)); }),
    onSuccess: () => { toast.success('Document uploaded'); onDone(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err, 'Upload failed.')); },
  });

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!file) next.file = 'Choose a file to upload.';
    if (!form.name.trim()) next.name = 'Give the document a name.';
    if (!form.category) next.category = 'Choose a category.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('employeeId', employeeId);
    fd.append('name', form.name);
    fd.append('category', form.category);
    if (form.issueDate) fd.append('issueDate', form.issueDate);
    upload.mutate(fd);
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-6">
      <FormField label="File" required>
        <FileUpload file={file} onChange={setFile} error={errors.file} progress={progress} />
      </FormField>
      <FormField label="Document Name" required error={errors.name}>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </FormField>
      <FormField label="Category" required error={errors.category}>
        <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={DOCUMENT_CATEGORIES} placeholder="Select category" />
      </FormField>
      <FormField label="Issue Date">
        <input type="date" className="input" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={upload.isPending}>{upload.isPending ? 'Uploading…' : 'Upload Document'}</button>
      </div>
    </form>
  );
}

function RejectDocModal({ doc, onClose, onSubmit, loading }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Explain what is wrong with this document.'); return; }
    onSubmit(reason.trim());
  };
  const close = () => { setReason(''); setError(''); onClose(); };
  return (
    <Modal open={Boolean(doc)} onClose={close} title="Reject document" size="sm">
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Reason" required error={error}>
          <textarea className="input min-h-[80px]" value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }} />
        </FormField>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-danger" disabled={loading}>{loading ? 'Rejecting…' : 'Reject'}</button>
        </div>
      </form>
    </Modal>
  );
}

function IdentitySection({ employeeId, docs, isLoading, canManage, canReveal }) {
  const queryClient = useQueryClient();
  const [editingType, setEditingType] = useState(null);
  const [revealed, setRevealed] = useState({});

  const byType = Object.fromEntries(docs.map((d) => [d.documentType, d]));

  const reveal = useMutation({
    mutationFn: (docType) => documentAPI.identity.reveal(employeeId, docType),
    onSuccess: (res, docType) => setRevealed((r) => ({ ...r, [docType]: res.data.data.number })),
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (isLoading) return <LoadingBlock label="Loading identity documents…" />;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="section-title flex items-center gap-2"><KeyRound className="h-4 w-4 text-gray-400" /> Identity Documents</h3>
      </div>
      <p className="mb-4 flex items-center gap-1 text-xs text-gray-400">
        <ShieldQuestion className="h-3.5 w-3.5" /> Numbers are encrypted at rest and shown masked. Revealing a number is recorded in the audit log.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {IDENTITY_TYPES.map((type) => {
          const doc = byType[type];
          return (
            <div key={type} className="rounded-xl border border-gray-100 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{type.replace('_', ' ')}</span>
                {doc && <StatusBadge status={doc.isVerified ? 'VERIFIED' : 'PENDING'} />}
              </div>
              {doc ? (
                <>
                  <p className="font-mono text-sm text-gray-900">{revealed[type] || doc.maskedNumber}</p>
                  <div className="mt-2 flex gap-3">
                    {canReveal && !revealed[type] && (
                      <button type="button" className="text-xs text-primary-600 hover:underline" onClick={() => reveal.mutate(type)} disabled={reveal.isPending}>
                        Reveal
                      </button>
                    )}
                    {canManage && (
                      <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setEditingType(type)}>Update</button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-400">Not on file</p>
                  {canManage && (
                    <button type="button" className="mt-2 text-xs text-primary-600 hover:underline" onClick={() => setEditingType(type)}>Add</button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <IdentityFormModal
        employeeId={employeeId}
        docType={editingType}
        existing={editingType ? byType[editingType] : null}
        onClose={() => setEditingType(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['employee-identity', employeeId] })}
      />
    </div>
  );
}

function IdentityFormModal({ employeeId, docType, existing, onClose, onSaved }) {
  const [form, setForm] = useState({ number: '', issueDate: '', expiryDate: '', notes: '' });
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: (data) => documentAPI.identity.save(employeeId, { documentType: docType, ...data }),
    onSuccess: () => { toast.success('Identity document saved'); onSaved(); close(); },
    onError: (err) => { setError(errorMessage(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm({ number: '', issueDate: '', expiryDate: '', notes: '' }); setError(''); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    if (form.number.trim().length < 4) { setError('Enter a valid document number.'); return; }
    save.mutate(form);
  };

  return (
    <Modal open={Boolean(docType)} onClose={close} size="sm" title={`${existing ? 'Update' : 'Add'} ${docType?.replace('_', ' ')}`}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Document number" required error={error}>
          <input className="input" value={form.number} onChange={(e) => { setForm({ ...form, number: e.target.value }); setError(''); }} placeholder="Enter the full number" />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Issue date">
            <input type="date" className="input" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          </FormField>
          <FormField label="Expiry date">
            <input type="date" className="input" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </FormField>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The mandatory-document checklist — defined once on the backend
 * (server/utils/documentRequirements.js) and shown here as a progress
 * summary plus a per-document status card, with a one-click upload for
 * anything still missing.
 */
function RequiredDocumentsChecklist({ checklist, isLoading, canManage, onUpload }) {
  if (isLoading) {
    return (
      <div className="card p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      </div>
    );
  }
  if (!checklist) return null;

  const { summary, items } = checklist;
  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          <h3 className="section-title">Required documents checklist</h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-gray-700">
            Employee documentation: {summary.uploaded}/{summary.totalRequired} complete
          </span>
          {summary.missing > 0 ? (
            <span className="flex items-center gap-1 font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> {summary.missing} required document{summary.missing === 1 ? '' : 's'} remaining
            </span>
          ) : (
            <span className="font-medium text-green-600">All required documents provided</span>
          )}
        </div>
      </div>
      <ProgressBar value={summary.totalRequired ? (summary.uploaded / summary.totalRequired) * 100 : 100} tone={summary.isComplete ? 'green' : 'amber'} />

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.category} className="rounded-xl border border-gray-100 p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400">{item.required ? 'Required' : 'Optional'}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
            {item.status === 'REJECTED' && item.document?.rejectionReason && (
              <p className="mb-2 text-xs text-red-600">{item.document.rejectionReason}</p>
            )}
            {item.document ? (
              <p className="truncate text-xs text-gray-500">{item.document.originalName}</p>
            ) : canManage ? (
              <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => onUpload(item.category)}>
                Upload now
              </button>
            ) : (
              <p className="text-xs text-gray-400">Not yet uploaded</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The highly-visible documentation summary shown at the top of the Overview
 * tab. `verified`/`totalRequired` (not merely "uploaded") drives both the
 * progress bar and the DOCUMENTS COMPLETE / DOCUMENTS PENDING pill — an
 * uploaded-but-unverified or rejected document never counts as complete.
 */
function EmployeeDocumentationSummary({ checklist, isLoading, onOpenDocuments }) {
  if (isLoading) return <div className="card h-28 animate-pulse p-5" />;
  if (!checklist) return null;

  const { summary } = checklist;
  const percent = summary.totalRequired ? Math.round((summary.verified / summary.totalRequired) * 100) : 100;
  const missingLabels = checklist.items.filter((i) => i.required && i.status === 'MISSING').map((i) => i.label);
  const rejectedLabels = checklist.items.filter((i) => i.required && i.status === 'REJECTED').map((i) => i.label);

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          <h3 className="section-title">Employee Documentation</h3>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge
            status={summary.isComplete ? 'COMPLETE' : 'PENDING'}
            label={summary.isComplete ? 'Documents Complete' : 'Documents Pending'}
          />
          <button type="button" className="text-sm text-primary-600 hover:underline" onClick={onOpenDocuments}>
            Manage documents
          </button>
        </div>
      </div>
      <ProgressBar value={percent} tone={summary.isComplete ? 'green' : 'amber'} />
      <p className="mt-2 text-sm text-gray-600">
        {summary.verified} of {summary.totalRequired} required documents verified
      </p>
      {(missingLabels.length > 0 || rejectedLabels.length > 0) && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {missingLabels.length > 0 && (
            <div className="rounded-lg bg-red-50 px-3 py-2">
              <p className="text-xs font-semibold text-red-700">Missing ({missingLabels.length})</p>
              <p className="mt-0.5 text-xs text-red-600">{missingLabels.join(', ')}</p>
            </div>
          )}
          {rejectedLabels.length > 0 && (
            <div className="rounded-lg bg-orange-50 px-3 py-2">
              <p className="text-xs font-semibold text-orange-700">Rejected ({rejectedLabels.length})</p>
              <p className="mt-0.5 text-xs text-orange-600">{rejectedLabels.join(', ')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}