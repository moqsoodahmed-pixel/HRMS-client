import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Send, Ban, ClipboardCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { offboardingAPI, exitRequestAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, LoadingBlock, ErrorState, EmptyState, StatusBadge, ProgressBar,
  Modal, FormField, ConfirmDialog, InfoRow,
} from '../components/ui';
import { formatDate, errorMessage } from '../lib/format';

/**
 * Employee's own exit experience: submit a request to leave (new, minimal —
 * see server/controllers/exitRequestController.js), track its status, and
 * once approved, view the same offboarding checklist HR manages (reused,
 * see server/controllers/taskController.js) — no second exit/checklist system.
 */
export default function ExitProcess() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(null);

  const requestsQuery = useQuery({ queryKey: ['exit-requests', 'me'], queryFn: () => exitRequestAPI.mine() });
  const tasksQuery = useQuery({
    queryKey: ['offboarding', 'me', employee?._id],
    queryFn: () => offboardingAPI.forEmployee(employee._id),
    enabled: Boolean(employee?._id),
  });

  const requests = requestsQuery.data?.data?.data || [];
  const activeRequest = requests.find((r) => ['PENDING', 'APPROVED'].includes(r.status));
  const tasks = tasksQuery.data?.data?.data || [];
  const progress = tasksQuery.data?.data?.meta?.progress;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['exit-requests'] });

  const cancel = useMutation({
    mutationFn: (id) => exitRequestAPI.cancel(id),
    onSuccess: () => { toast.success('Exit request cancelled'); refresh(); setCancelling(null); },
    onError: (err) => { toast.error(errorMessage(err)); setCancelling(null); },
  });

  return (
    <div>
      <PageHeader
        title="Exit Process"
        subtitle="Request to leave, track your status, and view your offboarding checklist."
        actions={!activeRequest && (
          <button type="button" className="btn-primary" onClick={() => setRequesting(true)}>
            <Send className="h-4 w-4" /> Request Exit
          </button>
        )}
      />

      {requestsQuery.isLoading ? <LoadingBlock label="Loading…" /> : requestsQuery.error ? (
        <div className="card"><ErrorState error={requestsQuery.error} onRetry={requestsQuery.refetch} /></div>
      ) : !requests.length ? (
        <div className="card"><EmptyState icon={LogOut} title="No exit request yet" description="If you'd like to resign or need to leave the organization, submit a request here for HR/Admin review." /></div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r._id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <p className="text-sm text-gray-500">Submitted {formatDate(r.createdAt)}</p>
                </div>
                {r.status === 'PENDING' && (
                  <button type="button" className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline" onClick={() => setCancelling(r)}>
                    <Ban className="h-3.5 w-3.5" /> Cancel request
                  </button>
                )}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InfoRow label="Requested Last Working Date" value={formatDate(r.requestedLastWorkingDate)} />
                <InfoRow label="Notice Period" value={r.noticePeriodDays != null ? `${r.noticePeriodDays} days` : 'Not set'} />
                <InfoRow label="Reason" value={r.reason} />
              </div>
              {r.status === 'REJECTED' && r.rejectionReason && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <span className="font-semibold">HR/Admin note: </span>{r.rejectionReason}
                </p>
              )}
              {r.status === 'APPROVED' && (
                <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Your exit has been approved. See your offboarding checklist below.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-gray-400" />
          <h2 className="section-title">Offboarding Checklist</h2>
        </div>
        {tasksQuery.isLoading ? <LoadingBlock /> : !tasks.length ? (
          <div className="card"><EmptyState icon={LogOut} title="No checklist yet" description="Your offboarding checklist will appear here once HR/Admin approves your exit." /></div>
        ) : (
          <div className="card p-5">
            {progress && (
              <div className="mb-5">
                <ProgressBar value={progress.total ? (progress.completed / progress.total) * 100 : 0} label={`${progress.completed} of ${progress.total} complete`} />
              </div>
            )}
            <ul className="divide-y divide-gray-100">
              {tasks.map((t) => (
                <li key={t._id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{t.taskName}</p>
                    <p className="text-xs text-gray-400">{t.category}{t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ''}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <RequestExitModal open={requesting} onClose={() => setRequesting(false)} onSaved={refresh} />
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancel.mutate(cancelling._id)}
        loading={cancel.isPending}
        title="Cancel exit request"
        message="This will withdraw your pending exit request. You can submit a new one later if needed."
        confirmLabel="Cancel Request"
      />
    </div>
  );
}

function RequestExitModal({ open, onClose, onSaved }) {
  const { employee } = useAuth();
  const empty = { reason: '', requestedLastWorkingDate: '', comments: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (data) => exitRequestAPI.create(data),
    onSuccess: () => { toast.success('Exit request submitted for HR/Admin review'); onSaved(); close(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.reason.trim()) next.reason = 'Please provide a reason.';
    if (!form.requestedLastWorkingDate) next.requestedLastWorkingDate = 'Choose your intended last working date.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} title="Request Exit" size="sm" description="HR/Admin will review before this affects your account.">
      <form onSubmit={submit} className="space-y-4 p-5">
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Your configured notice period: <span className="font-medium text-gray-700">{employee?.noticePeriodDays != null ? `${employee.noticePeriodDays} days` : 'Not set — check with HR'}</span>
        </p>
        <FormField label="Requested Last Working Date" required error={errors.requestedLastWorkingDate}>
          <input type="date" className="input" value={form.requestedLastWorkingDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, requestedLastWorkingDate: e.target.value })} />
        </FormField>
        <FormField label="Reason" required error={errors.reason}>
          <textarea className="input min-h-[80px]" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Resigning for a new opportunity" />
        </FormField>
        <FormField label="Comments (optional)">
          <textarea className="input min-h-[60px]" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </form>
    </Modal>
  );
}
