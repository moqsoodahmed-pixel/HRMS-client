import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  User, GraduationCap, Briefcase, Landmark, Siren, FileCheck2, ClipboardList,
  Check, Plus, Trash2, Clock, ShieldAlert,
} from 'lucide-react';
import { onboardingProfileAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { PageHeader, LoadingBlock, ErrorState, FormField, ProgressBar, EmptyState } from '../components/ui';
import { errorMessage, formatDate } from '../lib/format';

/**
 * Employee self-service 7-step onboarding wizard. Talks to
 * /onboarding-profile/* (see server/controllers/onboardingProfileController.js) —
 * NOT the HR "Onboarding" task-checklist module at /onboarding.
 */

const STEPS = [
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'experience', label: 'Experience', icon: Briefcase },
  { key: 'bank', label: 'Bank', icon: Landmark },
  { key: 'emergency', label: 'Emergency', icon: Siren },
  { key: 'documents', label: 'Documents', icon: FileCheck2 },
  { key: 'review', label: 'Review', icon: ClipboardList },
];

function emptyEducationRecord() { return { institution: '', qualification: '', fieldOfStudy: '', yearOfCompletion: '' }; }
function emptyExperienceRecord() { return { company: '', designation: '', fromDate: '', toDate: '' }; }

export default function MyOnboarding() {
  const navigate = useNavigate();
  const { employee, needsOnboarding } = useAuth();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState({
    personal: { fullName: '', phone: '', dateOfBirth: '', gender: '', address: '' },
    education: { records: [emptyEducationRecord()] },
    experience: { hasPriorExperience: false, records: [] },
    bank: { accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '' },
    emergency: { contactName: '', relationship: '', contactPhone: '' },
    documents: { acknowledged: false, notes: '' },
  });

  const query = useQuery({ queryKey: ['onboarding-profile', 'me'], queryFn: () => onboardingProfileAPI.me() });
  const data = query.data?.data?.data;
  const status = data?.onboardingStatus || 'NOT_STARTED';
  const isLocked = status === 'SUBMITTED' || status === 'APPROVED';

  useEffect(() => {
    if (!data) return;
    setForm((prev) => {
      const next = { ...prev };
      STEPS.filter((s) => s.key !== 'review').forEach((s) => {
        if (data.onboardingData?.[s.key]) next[s.key] = data.onboardingData[s.key];
      });
      return next;
    });
    setStepIndex(Math.min(data.onboardingStep || 0, STEPS.length - 1));
  }, [data]);

  const saveStep = useMutation({
    mutationFn: ({ stepKey, payload }) => onboardingProfileAPI.saveStep(stepKey, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-profile'] }),
    onError: (err) => toast.error(errorMessage(err)),
  });
  const submit = useMutation({
    mutationFn: () => onboardingProfileAPI.submit(),
    onSuccess: () => {
      toast.success('Onboarding submitted. Waiting for HR/Admin approval.');
      queryClient.invalidateQueries({ queryKey: ['onboarding-profile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isLoading) return <LoadingBlock label="Loading your onboarding…" />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;

  if (status === 'APPROVED') {
    return (
      <div>
        <PageHeader title="Onboarding" subtitle="Your onboarding is complete." />
        <div className="card p-6">
          <EmptyState
            icon={Check}
            title="Onboarding approved"
            description="Your account is fully active. All modules in the sidebar are unlocked."
            action={<button type="button" className="btn-primary" onClick={() => navigate('/dashboard')}>Go to dashboard</button>}
          />
        </div>
      </div>
    );
  }

  const current = STEPS[stepIndex];
  const pct = Math.round((stepIndex / (STEPS.length - 1)) * 100);

  function updateStep(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleNext() {
    if (current.key === 'review') return;
    if (isLocked) { setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)); return; }
    const clientError = validateStep(current.key, form[current.key]);
    if (clientError) { toast.error(clientError); return; }
    await saveStep.mutateAsync({ stepKey: current.key, payload: form[current.key] });
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  return (
    <div>
      <PageHeader title="Complete Onboarding" subtitle="Finish all 7 steps, then submit for HR/Admin approval." />

      {status === 'REJECTED' && data?.onboardingRejectionReason && (
        <div className="card mb-4 flex items-start gap-3 border border-red-200 bg-red-50 p-4">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">HR/Admin requested corrections</p>
            <p className="mt-0.5 text-sm text-red-700">{data.onboardingRejectionReason}</p>
          </div>
        </div>
      )}

      {status === 'SUBMITTED' && (
        <div className="card mb-4 flex items-start gap-3 border border-blue-200 bg-blue-50 p-4">
          <Clock className="h-5 w-5 flex-shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Onboarding submitted successfully</p>
            <p className="mt-0.5 text-sm text-blue-700">
              Waiting for HR/Admin approval{data?.onboardingSubmittedAt ? ` (submitted ${formatDate(data.onboardingSubmittedAt)})` : ''}. You can review what you submitted below.
            </p>
          </div>
        </div>
      )}

      <div className="card mb-4 p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Profile Completion</span>
          <span className="text-gray-500">{pct}%</span>
        </div>
        <ProgressBar value={pct} tone={pct === 100 ? 'green' : 'primary'} />
        <div className="mt-4 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStepIndex(i)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                i === stepIndex
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : i < stepIndex
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500'
              }`}
            >
              <s.icon className="h-3.5 w-3.5" /> {i + 1}. {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <StepBody
          stepKey={current.key}
          value={form[current.key]}
          onChange={(v) => updateStep(current.key, v)}
          disabled={isLocked}
          allData={form}
        />

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <button type="button" className="btn-secondary" onClick={handleBack} disabled={stepIndex === 0}>
            Back
          </button>
          {current.key === 'review' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || isLocked}
            >
              {isLocked ? 'Already submitted' : submit.isPending ? 'Submitting…' : 'Submit for Approval'}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleNext} disabled={saveStep.isPending}>
              {saveStep.isPending ? 'Saving…' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function validateStep(key, value) {
  if (key === 'personal') {
    if (!value.fullName?.trim()) return 'Full name is required';
    if (!value.phone?.trim()) return 'Phone number is required';
    if (!value.dateOfBirth) return 'Date of birth is required';
    if (!value.gender?.trim()) return 'Gender is required';
    if (!value.address?.trim()) return 'Address is required';
  }
  if (key === 'education') {
    if (!value.records?.length || value.records.some((r) => !r.institution?.trim() || !r.qualification?.trim())) {
      return 'Add at least one education record with institution and qualification';
    }
  }
  if (key === 'experience' && value.hasPriorExperience) {
    if (!value.records?.length || value.records.some((r) => !r.company?.trim() || !r.designation?.trim())) {
      return 'Add your company and designation, or mark "no prior experience"';
    }
  }
  if (key === 'bank') {
    if (!value.accountHolderName?.trim() || !value.accountNumber?.trim() || !value.bankName?.trim() || !value.ifscCode?.trim()) {
      return 'All bank details are required';
    }
  }
  if (key === 'emergency') {
    if (!value.contactName?.trim() || !value.relationship?.trim() || !value.contactPhone?.trim()) {
      return 'All emergency contact fields are required';
    }
  }
  if (key === 'documents' && !value.acknowledged) {
    return 'Please confirm your documents are ready/uploaded';
  }
  return null;
}

function StepBody({ stepKey, value, onChange, disabled, allData }) {
  if (stepKey === 'personal') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Full Name" required><input className="input" disabled={disabled} value={value.fullName} onChange={(e) => onChange({ ...value, fullName: e.target.value })} /></FormField>
        <FormField label="Phone Number" required><input className="input" disabled={disabled} value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} /></FormField>
        <FormField label="Date of Birth" required><input type="date" className="input" disabled={disabled} value={value.dateOfBirth?.slice(0, 10) || ''} onChange={(e) => onChange({ ...value, dateOfBirth: e.target.value })} /></FormField>
        <FormField label="Gender" required>
          <select className="input" disabled={disabled} value={value.gender} onChange={(e) => onChange({ ...value, gender: e.target.value })}>
            <option value="">Select…</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </FormField>
        <FormField label="Address" required className="sm:col-span-2">
          <textarea className="input min-h-[80px]" disabled={disabled} value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })} />
        </FormField>
      </div>
    );
  }

  if (stepKey === 'education') {
    return (
      <RecordList
        records={value.records}
        disabled={disabled}
        emptyRecord={emptyEducationRecord}
        onChange={(records) => onChange({ ...value, records })}
        fields={[
          { key: 'institution', label: 'Institution', required: true },
          { key: 'qualification', label: 'Qualification', required: true },
          { key: 'fieldOfStudy', label: 'Field of Study' },
          { key: 'yearOfCompletion', label: 'Year of Completion' },
        ]}
        addLabel="Add education record"
      />
    );
  }

  if (stepKey === 'experience') {
    return (
      <div>
        <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            disabled={disabled}
            checked={value.hasPriorExperience}
            onChange={(e) => onChange({ ...value, hasPriorExperience: e.target.checked, records: e.target.checked ? (value.records?.length ? value.records : [emptyExperienceRecord()]) : [] })}
          />
          I have prior work experience
        </label>
        {value.hasPriorExperience && (
          <RecordList
            records={value.records}
            disabled={disabled}
            emptyRecord={emptyExperienceRecord}
            onChange={(records) => onChange({ ...value, records })}
            fields={[
              { key: 'company', label: 'Company', required: true },
              { key: 'designation', label: 'Designation', required: true },
              { key: 'fromDate', label: 'From', type: 'date' },
              { key: 'toDate', label: 'To', type: 'date' },
            ]}
            addLabel="Add experience record"
          />
        )}
      </div>
    );
  }

  if (stepKey === 'bank') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Account Holder Name" required><input className="input" disabled={disabled} value={value.accountHolderName} onChange={(e) => onChange({ ...value, accountHolderName: e.target.value })} /></FormField>
        <FormField label="Account Number" required><input className="input" disabled={disabled} value={value.accountNumber} onChange={(e) => onChange({ ...value, accountNumber: e.target.value })} /></FormField>
        <FormField label="Bank Name" required><input className="input" disabled={disabled} value={value.bankName} onChange={(e) => onChange({ ...value, bankName: e.target.value })} /></FormField>
        <FormField label="IFSC Code" required><input className="input" disabled={disabled} value={value.ifscCode} onChange={(e) => onChange({ ...value, ifscCode: e.target.value })} /></FormField>
      </div>
    );
  }

  if (stepKey === 'emergency') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Contact Name" required><input className="input" disabled={disabled} value={value.contactName} onChange={(e) => onChange({ ...value, contactName: e.target.value })} /></FormField>
        <FormField label="Relationship" required><input className="input" disabled={disabled} value={value.relationship} onChange={(e) => onChange({ ...value, relationship: e.target.value })} /></FormField>
        <FormField label="Contact Phone" required><input className="input" disabled={disabled} value={value.contactPhone} onChange={(e) => onChange({ ...value, contactPhone: e.target.value })} /></FormField>
      </div>
    );
  }

  if (stepKey === 'documents') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Make sure your required identity and employment documents are uploaded in the Documents module once your
          account is approved. For now, confirm you have them ready.
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" disabled={disabled} checked={value.acknowledged} onChange={(e) => onChange({ ...value, acknowledged: e.target.checked })} />
          My documents are ready / uploaded
        </label>
        <FormField label="Notes (optional)">
          <textarea className="input min-h-[70px]" disabled={disabled} value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} />
        </FormField>
      </div>
    );
  }

  // Review
  return (
    <div className="space-y-5">
      <ReviewSection title="Personal" rows={[
        ['Full Name', allData.personal.fullName],
        ['Phone', allData.personal.phone],
        ['Date of Birth', allData.personal.dateOfBirth],
        ['Gender', allData.personal.gender],
        ['Address', allData.personal.address],
      ]} />
      <ReviewSection title="Education" rows={
        (allData.education.records || []).map((r, i) => [`Record ${i + 1}`, `${r.institution} — ${r.qualification}${r.yearOfCompletion ? ` (${r.yearOfCompletion})` : ''}`])
      } />
      <ReviewSection title="Experience" rows={
        allData.experience.hasPriorExperience
          ? (allData.experience.records || []).map((r, i) => [`Record ${i + 1}`, `${r.company} — ${r.designation}`])
          : [['Prior experience', 'None']]
      } />
      <ReviewSection title="Bank" rows={[
        ['Account Holder', allData.bank.accountHolderName],
        ['Account Number', allData.bank.accountNumber],
        ['Bank Name', allData.bank.bankName],
        ['IFSC Code', allData.bank.ifscCode],
      ]} />
      <ReviewSection title="Emergency Contact" rows={[
        ['Name', allData.emergency.contactName],
        ['Relationship', allData.emergency.relationship],
        ['Phone', allData.emergency.contactPhone],
      ]} />
      <ReviewSection title="Documents" rows={[
        ['Ready / uploaded', allData.documents.acknowledged ? 'Yes' : 'No'],
        ['Notes', allData.documents.notes || '—'],
      ]} />
    </div>
  );
}

function ReviewSection({ title, rows }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      <div className="space-y-1 rounded-lg bg-gray-50 p-3">
        {rows.map(([label, val]) => (
          <div key={label} className="flex justify-between gap-4 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="text-right text-gray-800">{val || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordList({ records, fields, onChange, addLabel, disabled, emptyRecord }) {
  return (
    <div className="space-y-4">
      {(records || []).map((record, idx) => (
        <div key={idx} className="rounded-lg border border-gray-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Record {idx + 1}</p>
            {!disabled && records.length > 1 && (
              <button type="button" className="text-red-500 hover:text-red-700" onClick={() => onChange(records.filter((_, i) => i !== idx))}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <FormField key={f.key} label={f.label} required={f.required}>
                <input
                  type={f.type || 'text'}
                  className="input"
                  disabled={disabled}
                  value={record[f.key] || ''}
                  onChange={(e) => onChange(records.map((r, i) => (i === idx ? { ...r, [f.key]: e.target.value } : r)))}
                />
              </FormField>
            ))}
          </div>
        </div>
      ))}
      {!disabled && (
        <button type="button" className="btn-secondary" onClick={() => onChange([...(records || []), emptyRecord()])}>
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}
