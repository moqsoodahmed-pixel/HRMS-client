import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, FileText, Info, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { FormField, Select, LoadingBlock, StatusBadge, InfoRow, EmptyState } from '../components/ui';
import {
  DEPARTMENTS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, GENDERS, BLOOD_GROUPS, REQUIRED_DOCUMENT_TYPES,
} from '../constants';
import { errorMessage, fieldErrors, humanise, formatDate } from '../lib/format';

const EMPTY_FORM = {
  employeeCode: '', firstName: '', lastName: '', officialEmail: '', personalEmail: '', personalMobile: '', officialMobile: '',
  designation: '', department: '', employmentType: 'FULL_TIME', status: 'ACTIVE', dateOfJoining: '',
  probationEndDate: '', confirmationDate: '', dateOfExit: '', exitReason: '', noticePeriodDays: '',
  workLocation: '', dateOfBirth: '', gender: '', bloodGroup: '', nationality: 'Indian', manager: '',
};

const WIZARD_STEPS = [
  { id: 1, label: 'Employee Information' },
  { id: 2, label: 'Employment Information' },
  { id: 3, label: 'Required Documents' },
  { id: 4, label: 'Review & Create' },
];

export default function EmployeeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const { data, isLoading } = useQuery({ queryKey: ['employee', id], queryFn: () => employeeAPI.get(id), enabled: isEdit });
  const managersQuery = useQuery({ queryKey: ['employees', 'options'], queryFn: () => employeeAPI.options(), staleTime: 5 * 60 * 1000 });
  const managers = (managersQuery.data?.data?.data?.managers || []).filter((m) => m._id !== id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  // The step wizard only applies to creating a new employee — editing an
  // existing record is a single flat form, not an onboarding walkthrough.
  const [step, setStep] = useState(1);

  useEffect(() => {
    const emp = data?.data?.data;
    if (!emp) return;
    setForm({
      ...EMPTY_FORM,
      ...emp,
      manager: emp.manager?._id || emp.manager || '',
      dateOfJoining: emp.dateOfJoining?.slice(0, 10) || '',
      probationEndDate: emp.probationEndDate?.slice(0, 10) || '',
      confirmationDate: emp.confirmationDate?.slice(0, 10) || '',
      dateOfExit: emp.dateOfExit?.slice(0, 10) || '',
      dateOfBirth: emp.dateOfBirth?.slice(0, 10) || '',
      noticePeriodDays: emp.noticePeriodDays ?? '',
    });
  }, [data]);

  const createMut = useMutation({
    mutationFn: (payload) => employeeAPI.create(payload),
    onSuccess: (res) => {
      toast.success('Employee created — continue to the documents checklist');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      // Real document upload needs an employee id, so the wizard's document
      // step is a preview; HR is sent straight to the real checklist next.
      navigate(`/employees/${res.data.data._id}?tab=documents`);
    },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err, 'Could not create the employee.')); setStep(1); },
  });

  const updateMut = useMutation({
    mutationFn: (payload) => employeeAPI.update(id, payload),
    onSuccess: () => {
      toast.success('Employee updated');
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate(`/employees/${id}`);
    },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err, 'Could not update the employee.')); },
  });

  const saving = createMut.isPending || updateMut.isPending;
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validateStep1 = () => {
    const next = {};
    if (!form.employeeCode.trim()) next.employeeCode = 'Employee code is required.';
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.officialEmail)) next.officialEmail = 'Enter a valid official email.';
    if (form.personalEmail && !/^\S+@\S+\.\S+$/.test(form.personalEmail)) next.personalEmail = 'Enter a valid email or leave it blank.';
    return next;
  };

  const validateStep2 = () => {
    const next = {};
    if (!form.designation.trim()) next.designation = 'Designation is required.';
    if (!form.department) next.department = 'Choose a department.';
    if (!form.dateOfJoining) next.dateOfJoining = 'Date of joining is required.';
    if (form.dateOfExit && form.dateOfJoining && form.dateOfExit < form.dateOfJoining) {
      next.dateOfExit = 'Exit date cannot be before the date of joining.';
    }
    if (form.noticePeriodDays !== '' && Number(form.noticePeriodDays) < 0) next.noticePeriodDays = 'Cannot be negative.';
    return next;
  };

  const validateAll = () => ({ ...validateStep1(), ...validateStep2() });

  const goNext = () => {
    const next = step === 1 ? validateStep1() : step === 2 ? validateStep2() : {};
    setErrors(next);
    if (Object.keys(next).length) { toast.error('Please fix the highlighted fields.'); return; }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length));
  };
  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = validateAll();
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error('Please fix the highlighted fields.');
      setStep(next.employeeCode || next.firstName || next.officialEmail || next.personalEmail ? 1 : 2);
      return;
    }
    const payload = { ...form, fullName: `${form.firstName} ${form.lastName}`.trim() };
    if (isEdit) updateMut.mutate(payload);
    else createMut.mutate(payload);
  };

  if (isEdit && isLoading) return <LoadingBlock label="Loading employee…" />;
  if (!can('manageEmployees')) {
    return (
      <div className="card">
        <EmptyState
          icon={ShieldAlert}
          title="You do not have access to this page"
          description="Your role does not include employee management."
          action={<Link to="/employees" className="btn-primary">Back to employees</Link>}
        />
      </div>
    );
  }

  const requiredCount = REQUIRED_DOCUMENT_TYPES.filter((d) => d.required).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Link to={isEdit ? `/employees/${id}` : '/employees'} className="btn-ghost"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Employee' : 'Add Employee'}</h1>
          <p className="page-subtitle">{isEdit ? 'Update employee information' : 'Add a new employee to the system'}</p>
        </div>
      </div>

      {!isEdit && (
        <ol className="mb-6 flex flex-wrap items-center gap-2">
          {WIZARD_STEPS.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                step === s.id ? 'bg-primary-600 text-white' : step > s.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id}
                {s.label}
              </span>
              {i < WIZARD_STEPS.length - 1 && <span className="h-px w-4 bg-gray-300" />}
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {(isEdit || step === 1) && (
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Employee Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Employee Code" required error={errors.employeeCode}>
                <input className="input" value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} disabled={isEdit} placeholder="DL010" />
              </FormField>
              <FormField label="Status" required>
                <Select value={form.status} onChange={(e) => set('status', e.target.value)} options={EMPLOYEE_STATUSES} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="First Name" required error={errors.firstName}>
                <input className="input" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              </FormField>
              <FormField label="Last Name">
                <input className="input" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Official Email" required error={errors.officialEmail}>
              <input type="email" className="input" value={form.officialEmail} onChange={(e) => set('officialEmail', e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Personal Email" error={errors.personalEmail}>
                <input type="email" className="input" value={form.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} />
              </FormField>
              <FormField label="Personal Mobile">
                <input className="input" value={form.personalMobile} onChange={(e) => set('personalMobile', e.target.value)} placeholder="+91 9876543210" />
              </FormField>
            </div>
            {!isEdit && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Date of Birth">
                  <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                </FormField>
                <FormField label="Gender">
                  <Select value={form.gender} onChange={(e) => set('gender', e.target.value)} options={GENDERS} placeholder="Select" />
                </FormField>
              </div>
            )}
          </div>
        )}

        {(isEdit || step === 2) && (
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Employment Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Designation" required error={errors.designation}>
                <input className="input" value={form.designation} onChange={(e) => set('designation', e.target.value)} />
              </FormField>
              <FormField label="Department" required error={errors.department}>
                <Select value={form.department} onChange={(e) => set('department', e.target.value)} options={DEPARTMENTS} placeholder="Select department" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Employment Type">
                <Select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} options={EMPLOYMENT_TYPES} />
              </FormField>
              <FormField label="Work Location">
                <input className="input" value={form.workLocation} onChange={(e) => set('workLocation', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Reporting Manager">
              <Select
                value={form.manager}
                onChange={(e) => set('manager', e.target.value)}
                options={managers.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
                placeholder="No manager"
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Date of Joining" required error={errors.dateOfJoining}>
                <input type="date" className="input" value={form.dateOfJoining} onChange={(e) => set('dateOfJoining', e.target.value)} />
              </FormField>
              <FormField label="Confirmation Date">
                <input type="date" className="input" value={form.confirmationDate} onChange={(e) => set('confirmationDate', e.target.value)} />
              </FormField>
            </div>
            {form.status === 'PROBATION' && (
              <FormField label="Probation End Date">
                <input type="date" className="input" value={form.probationEndDate} onChange={(e) => set('probationEndDate', e.target.value)} />
              </FormField>
            )}
            {(form.status === 'NOTICE_PERIOD' || form.dateOfExit) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Date of Exit" error={errors.dateOfExit}>
                  <input type="date" className="input" value={form.dateOfExit} onChange={(e) => set('dateOfExit', e.target.value)} />
                </FormField>
                <FormField label="Notice Period (days)" error={errors.noticePeriodDays}>
                  <input type="number" min="0" max="365" className="input" value={form.noticePeriodDays} onChange={(e) => set('noticePeriodDays', e.target.value)} />
                </FormField>
              </div>
            )}
            {form.dateOfExit && (
              <FormField label="Exit Reason">
                <input className="input" value={form.exitReason} onChange={(e) => set('exitReason', e.target.value)} />
              </FormField>
            )}
          </div>
        )}

        {isEdit && (
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Personal Details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Date of Birth">
                <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </FormField>
              <FormField label="Gender">
                <Select value={form.gender} onChange={(e) => set('gender', e.target.value)} options={GENDERS} placeholder="Select" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Blood Group">
                <Select value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} options={BLOOD_GROUPS} placeholder="Select" />
              </FormField>
              <FormField label="Nationality">
                <input className="input" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
              </FormField>
            </div>
          </div>
        )}

        {!isEdit && step === 3 && (
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Required Documents</h3>
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                Documents can only be uploaded once this employee's record exists. After you create the employee,
                you'll be taken straight to their documents checklist to start uploading. This preview shows what
                will be required — <span className="font-medium">required documents remaining: {requiredCount}</span>.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {REQUIRED_DOCUMENT_TYPES.map((doc) => (
                <div key={doc.category} className="flex items-center justify-between rounded-xl border border-gray-100 p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{doc.label}</span>
                  </div>
                  <StatusBadge status="MISSING" label={doc.required ? 'Required' : 'Optional'} tone={doc.required ? 'red' : 'gray'} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!isEdit && step === 4 && (
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Review & Create</h3>
            <p className="text-sm text-gray-500">Confirm the details below before creating this employee.</p>
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
              <InfoRow label="Name" value={`${form.firstName} ${form.lastName}`.trim()} />
              <InfoRow label="Employee Code" value={form.employeeCode} />
              <InfoRow label="Official Email" value={form.officialEmail} />
              <InfoRow label="Designation" value={form.designation} />
              <InfoRow label="Department" value={form.department} />
              <InfoRow label="Employment Type" value={humanise(form.employmentType)} />
              <InfoRow label="Date of Joining" value={formatDate(form.dateOfJoining)} />
              <InfoRow label="Status" value={humanise(form.status)} />
              <InfoRow label="Reporting Manager" value={managers.find((m) => m._id === form.manager)?.fullName} />
            </div>
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Employee documentation: 0/{requiredCount} complete — required documents remaining: {requiredCount}.
              You will upload these right after creating the employee.
            </div>
          </div>
        )}

        <div className="flex justify-between gap-3">
          <div>
            {!isEdit && step > 1 && (
              <button type="button" className="btn-secondary" onClick={goBack}>Back</button>
            )}
          </div>
          <div className="flex gap-3">
            <Link to={isEdit ? `/employees/${id}` : '/employees'} className="btn-secondary">Cancel</Link>
            {!isEdit && step < WIZARD_STEPS.length && (
              <button type="button" className="btn-primary" onClick={goNext}>Continue</button>
            )}
            {(isEdit || step === WIZARD_STEPS.length) && (
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Update Employee' : 'Create Employee'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
