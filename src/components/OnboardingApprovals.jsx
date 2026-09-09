import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { onboardingProfileAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  DataTable, FilterBar, Select, Modal, FormField, StatusBadge, Avatar, EmptyState, LoadingBlock,
} from './ui';
import { formatDate, errorMessage } from '../lib/format';

/**
 * Employee self-service onboarding review/approve/reject — the STEP 1
 * backend workflow (server/controllers/onboardingProfileController.js), the
 * only mechanism that ever sets Employee.onboardingStatus. Shared between the
 * HR "Onboarding" task-checklist page and the "Manage Employees" ›
 * Onboarding Submissions tab so there is exactly one approval UI, not two.
 */

const APPROVAL_STATUS_OPTIONS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function OnboardingApprovals({ defaultStatus = 'SUBMITTED' }) {
  const { can } = useAuth();
  const canDecide = can('manageLifecycle');
  const [status, setStatus] = useState(defaultStatus);
  const [reviewing, setReviewing] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['onboarding-profile', 'list', status],
    queryFn: () => onboardingProfileAPI.list(status ? { status } : {}),
  });
  const rows = query.data?.data?.data || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['onboarding-profile'] });

  const approve = useMutation({
    mutationFn: (employeeId) => onboardingProfileAPI.approve(employeeId),
    onSuccess: () => { toast.success('Onboarding approved — employee is now fully active.'); refresh(); setReviewing(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const reject = useMutation({
    mutationFn: ({ employeeId, reason }) => onboardingProfileAPI.reject(employeeId, reason),
    onSuccess: () => { toast.success('Onboarding rejected — employee can correct and resubmit.'); refresh(); setRejecting(null); setReviewing(null); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div>
      <FilterBar onReset={() => setStatus('')}>
        <div>
          <label className="label">Status</label>
          <Select className="w-48" value={status} onChange={(e) => setStatus(e.target.value)} options={APPROVAL_STATUS_OPTIONS} placeholder="All statuses" />
        </div>
      </FilterBar>

      <DataTable
        columns={[
          {
            key: 'employee',
            header: 'Employee',
            render: (row) => (
              <div className="flex items-center gap-3">
                <Avatar name={row.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{row.fullName}</p>
                  <p className="truncate text-xs text-gray-400">{row.employeeCode} · {row.department}</p>
                </div>
              </div>
            ),
          },
          { key: 'status', header: 'Onboarding Status', render: (row) => <StatusBadge status={row.onboardingStatus} /> },
          { key: 'submitted', header: 'Submission Date', render: (row) => formatDate(row.onboardingSubmittedAt) },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="flex justify-end gap-2">
                <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setReviewing(row)}>Review</button>
                {canDecide && row.onboardingStatus === 'SUBMITTED' && (
                  <>
                    <button type="button" className="text-xs font-medium text-green-600 hover:underline" onClick={() => approve.mutate(row._id)} disabled={approve.isPending}>Approve</button>
                    <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setRejecting(row)}>Reject</button>
                  </>
                )}
              </div>
            ),
          },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        empty={<EmptyState icon={ClipboardCheck} title="Nothing here" description="No employees match this onboarding status." />}
      />

      <ReviewModal
        employeeId={reviewing?._id}
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        onApprove={(id) => approve.mutate(id)}
        onReject={(row) => setRejecting(row)}
        approving={approve.isPending}
        canDecide={canDecide}
      />

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject onboarding" size="sm">
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = new FormData(e.target).get('reason')?.toString().trim();
            if (!reason) { toast.error('A reason is required.'); return; }
            reject.mutate({ employeeId: rejecting._id, reason });
          }}
        >
          <p className="text-sm text-gray-600">The employee will see this note and can correct and resubmit.</p>
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

function ReviewModal({ employeeId, open, onClose, onApprove, onReject, approving, canDecide }) {
  const query = useQuery({
    queryKey: ['onboarding-profile', 'detail', employeeId],
    queryFn: () => onboardingProfileAPI.get(employeeId),
    enabled: open && Boolean(employeeId),
  });
  const employee = query.data?.data?.data;
  const d = employee?.onboardingData || {};

  return (
    <Modal open={open} onClose={onClose} title={employee?.fullName || 'Onboarding submission'} size="lg">
      <div className="p-5">
        {query.isLoading ? <LoadingBlock label="Loading submission…" /> : !employee ? null : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <StatusBadge status={employee.onboardingStatus} />
              <span className="text-xs text-gray-400">Submitted {formatDate(employee.onboardingSubmittedAt)}</span>
            </div>
            <ReviewBlock title="Personal" data={d.personal} fields={['fullName', 'phone', 'dateOfBirth', 'gender', 'address']} />
            <ReviewBlock title="Bank" data={d.bank} fields={['accountHolderName', 'accountNumber', 'bankName', 'ifscCode']} />
            <ReviewBlock title="Emergency Contact" data={d.emergency} fields={['contactName', 'relationship', 'contactPhone']} />
            {d.education?.records?.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Education</h3>
                <ul className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {d.education.records.map((r, i) => <li key={i}>{r.institution} — {r.qualification} {r.yearOfCompletion ? `(${r.yearOfCompletion})` : ''}</li>)}
                </ul>
              </div>
            )}
            {d.experience?.hasPriorExperience && d.experience.records?.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">Experience</h3>
                <ul className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  {d.experience.records.map((r, i) => <li key={i}>{r.company} — {r.designation}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      {canDecide && employee?.onboardingStatus === 'SUBMITTED' && (
        <div className="flex justify-end gap-3 border-t border-gray-200 p-4">
          <button type="button" className="btn-danger" onClick={() => onReject(employee)}><X className="h-4 w-4" /> Reject</button>
          <button type="button" className="btn-primary" onClick={() => onApprove(employee._id)} disabled={approving}>
            <ShieldCheck className="h-4 w-4" /> {approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      )}
    </Modal>
  );
}

function ReviewBlock({ title, data, fields }) {
  if (!data) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
        {fields.map((f) => (
          <div key={f} className="flex justify-between gap-4">
            <span className="text-gray-500">{f}</span>
            <span className="text-gray-800">{data[f] || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
