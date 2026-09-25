import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, FileText, Info, ShieldAlert, Eye, EyeOff } from 'lucide-react';
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
  designation: '', department: '', employmentType: 'FULL_TIME', status: 'ACTIVE', dateOfJoining: '', role: 'EMPLOYEE',
  probationEndDate: '', confirmationDate: '', dateOfExit: '', exitReason: '', noticePeriodDays: '',
  workLocation: '', dateOfBirth: '', gender: '', bloodGroup: '', nationality: 'Indian', manager: '',
  password: '', confirmPassword: '',
};

// ── Auto-detect the right Account Role from what's actually typed ─────────
// "She's in HR, why does the system treat her as a plain Employee" (and the
// follow-up: "when Admin/CEO/CTO/HR pick a title like Business Development
// or Sales Lead, give that person access matching their role") both come
// down to the same gap: nothing on this form ever looked at Designation or
// Department to work out what access someone should actually have — the
// Account Role dropdown just sat at its default until a human remembered to
// change it by hand.
//
// This is only ever a SUGGESTED starting value for that dropdown, computed
// fresh from Designation + Department (never silently saved on its own —
// see recomputeRoleSuggestion below): it pre-fills the picker so whoever is
// saving the form can see and confirm it, but a role someone has
// deliberately chosen — on this form or on an earlier save — is never
// overwritten.
//
// Designation is checked first (it's the specific job title — "Sales Lead",
// "Business Development Head", "Finance Manager" — so it wins over the
// broader department default). Rules are ordered most-specific-first; the
// first one that matches wins.
const DESIGNATION_ROLE_RULES = [
  // Elevated roles are only ever suggested to a caller who could actually
  // grant them — the server caps a non-elevated caller's request straight
  // back to EMPLOYEE anyway (see employeeController.js resolveAssignableRole),
  // and suggesting a role that will silently revert on save is worse than
  // not suggesting one.
  { test: /founder|chief executive|\bceo\b/i, role: 'FOUNDER_CEO', elevatedCallerOnly: true },
  { test: /\bcto\b|chief technology/i, role: 'CTO', elevatedCallerOnly: true },
  { test: /\bdirector\b/i, role: 'DIRECTOR' },
  { test: /\bauditor\b/i, role: 'AUDITOR' },
  { test: /human resources|\bhr\b/i, role: 'HR_ADMIN' },
  { test: /\bit\b.*\bhead\b|\bhead\b.*\bit\b/i, role: 'IT_HEAD' },
  { test: /\bmanager\b/i, role: 'MANAGER' },
  // Catch-all for any team/department lead title — "Sales Lead", "Business
  // Development Head", "Project Head", "Team Lead", etc. PROJECT_HEAD is
  // the app's generic team-scoped lead role (see utils/roles.js
  // TEAM_SCOPED_ROLES) and isn't limited to literal "project" work.
  { test: /\bhead\b|\blead\b/i, role: 'PROJECT_HEAD' },
];

// Fallback when nothing in the Designation matched anything above — keyed
// by Department. Deliberately short: HR is the department where "still
// stuck on plain Employee" was reported, so it gets a same-as-designation
// default. Finance/IT are NOT defaulted here even though they have roles,
// because FINANCE and IT_HEAD grant sensitive, department-wide write access
// (payroll, compensation) that shouldn't be handed to every employee in
// that department just for being in it — those still need an explicit
// Designation match (e.g. "Finance Manager") or a manual pick.
const DEPARTMENT_SUGGESTED_ROLE = {
  HR: 'HR_ADMIN',
};

/** Returns a role string to suggest, or null if nothing matched (stay EMPLOYEE). */
function computeSuggestedRole(department, designation, isElevatedCaller) {
  const title = (designation || '').trim();
  const isSalesDept = /sales|business development/i.test(department || '');
  if (title) {
    for (const rule of DESIGNATION_ROLE_RULES) {
      if (!rule.test.test(title)) continue;
      if (rule.elevatedCallerOnly && !isElevatedCaller) continue;
      // Sales Team Lead: in Sales / Business Development, a generic "lead"/
      // "head" title is the team-lead-of-a-sales-team case, which the chosen
      // design models as the MANAGER role (team dashboard + sees their team's
      // leads/reports/performance, and — unlike Project Head — still checks in
      // and stays mobile/geo-restricted). So redirect only that generic
      // catch-all (PROJECT_HEAD) to MANAGER when the department is Sales/BD;
      // every more specific rule above (Director/CTO/HR/IT/Manager) is left
      // exactly as matched.
      if (rule.role === 'PROJECT_HEAD' && isSalesDept) return 'MANAGER';
      return rule.role;
    }
  }
  return DEPARTMENT_SUGGESTED_ROLE[department] || null;
}

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
  const { can, user, isElevated } = useAuth();

  const { data, isLoading } = useQuery({ queryKey: ['employee', id], queryFn: () => employeeAPI.get(id), enabled: isEdit });
  const managersQuery = useQuery({ queryKey: ['employees', 'options'], queryFn: () => employeeAPI.options(), staleTime: 5 * 60 * 1000 });
  const managers = (managersQuery.data?.data?.data?.managers || []).filter((m) => m._id !== id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword2, setShowConfirmPassword2] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirmPassword, setShowNewConfirmPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmNewPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // The step wizard only applies to creating a new employee — editing an
  // existing record is a single flat form, not an onboarding walkthrough.
  const [step, setStep] = useState(1);
  // Once the CEO/HR deliberately picks a role from the dropdown, auto-detect
  // must never silently overwrite it again for the rest of this form session.
  const roleManuallySetRef = useRef(false);
  // Whether this account's role is still at its untouched EMPLOYEE default —
  // true for every new hire being created, and for an existing employee
  // whose saved role is EMPLOYEE. False once an account genuinely has a
  // real role (HR_ADMIN, MANAGER, …) that a human set on purpose — auto-
  // detect never touches those, even if the designation is edited later.
  const roleWasDefaultRef = useRef(true);
  // Drives the "Auto-detected" note under the role picker — true only when
  // WE changed the selection, not when the account already had a role.
  const [roleAutoSuggested, setRoleAutoSuggested] = useState(false);

  // Re-runs the Designation/Department → Account Role detection. Called
  // whenever either field changes, and once when an existing employee's
  // data loads. Never touches a role the account already carries for real,
  // or one the person filling out this form already picked by hand.
  const recomputeRoleSuggestion = (department, designation) => {
    if (roleManuallySetRef.current || !roleWasDefaultRef.current) return;
    const suggested = computeSuggestedRole(department, designation, isElevated);
    setRoleAutoSuggested(Boolean(suggested));
    setForm((f) => ({ ...f, role: suggested || 'EMPLOYEE' }));
  };

  useEffect(() => {
    const emp = data?.data?.data;
    if (!emp) return;
    const currentRole = emp.user?.role || 'EMPLOYEE';
    // This is the fix for "she's in the HR department but the system still
    // treats her as a plain Employee" (and its follow-up — a Designation
    // like "Sales Lead" or "Business Development Head" should get that
    // person the matching access too): the account role never had anything
    // driving it off Designation/Department, so someone added to HR (or
    // given a lead/manager title) stayed capped at EMPLOYEE — and, for an
    // EMPLOYEE role specifically, locked behind the onboarding-approval
    // gate (see AuthContext.jsx `needsOnboarding`) — until a human noticed
    // and picked the right role by hand. Opening this employee's edit page
    // now surfaces that mismatch immediately: the Account Role field is
    // pre-set to what their title/department implies instead of silently
    // staying wrong.
    roleWasDefaultRef.current = currentRole === 'EMPLOYEE';
    const suggested = roleWasDefaultRef.current
      ? computeSuggestedRole(emp.department, emp.designation, isElevated)
      : null;
    roleManuallySetRef.current = false;
    setRoleAutoSuggested(Boolean(suggested));
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
      // The employee record itself has no `role` field — it lives on the
      // linked login account (`emp.user.role`, populated by GET /employees/:id).
      // Without this, the Account Role selector always fell back to the
      // EMPTY_FORM default of 'EMPLOYEE' while editing, even for someone
      // who was already HR_ADMIN.
      role: suggested || currentRole,
      // Never pre-fill password boxes from a save — there is nothing to
      // show, and leaving these blank until the user actually types a new
      // password is what lets handleSubmit tell "no change" apart from
      // "change to this".
      password: '',
      confirmPassword: '',
    });
  }, [data]);

  // Live auto-suggest while creating/editing: changing Department or typing
  // a Designation (checked when you leave the field) re-runs the detection
  // above, same "never touched by hand, never was a real role" guard.
  const handleDepartmentChange = (value) => {
    set('department', value);
    recomputeRoleSuggestion(value, form.designation);
  };
  const handleDesignationBlur = () => {
    recomputeRoleSuggestion(form.department, form.designation);
  };

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

  const canChangePassword = isElevated || user?.role === 'HR_ADMIN' || user?.role === 'PROJECT_HEAD';

  const changePasswordMut = useMutation({
    mutationFn: (payload) => employeeAPI.changePassword(id, payload),
    onSuccess: () => {
      toast.success('Password updated successfully');
      setPwForm({ newPassword: '', confirmNewPassword: '' });
      setPwErrors({});
    },
    onError: (err) => { toast.error(errorMessage(err, 'Could not update password.')); },
  });

  const handlePasswordChange = (e) => {
    e.preventDefault();
    const next = {};
    if (!pwForm.newPassword) next.newPassword = 'New password is required.';
    else if (pwForm.newPassword.length < 8) next.newPassword = 'Password must be at least 8 characters.';
    if (!pwForm.confirmNewPassword) next.confirmNewPassword = 'Please confirm the password.';
    else if (pwForm.newPassword !== pwForm.confirmNewPassword) next.confirmNewPassword = 'Passwords do not match.';
    setPwErrors(next);
    if (Object.keys(next).length) return;
    changePasswordMut.mutate({ newPassword: pwForm.newPassword });
  };

  const saving = createMut.isPending || updateMut.isPending;
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const validateStep1 = () => {
    const next = {};
    if (!isEdit && !form.employeeCode.trim()) next.employeeCode = 'Employee code is required.';
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.officialEmail)) next.officialEmail = 'Enter a valid official email.';
    if (form.personalEmail && !/^\S+@\S+\.\S+$/.test(form.personalEmail)) next.personalEmail = 'Enter a valid email or leave it blank.';
    if (!isEdit) {
      if (!form.password) next.password = 'Password is required.';
      else if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
      if (!form.confirmPassword) next.confirmPassword = 'Please confirm the password.';
      else if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    }
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
    const { confirmPassword, password, ...rest } = form;
    const payload = { ...rest, fullName: `${form.firstName} ${form.lastName}`.trim() };
    // On create, the password the user typed is required — send it.
    // On edit, the password box is always blank (see the effect above) and
    // is NEVER part of this save; changing a password goes through the
    // separate "Change Password" form/endpoint below. Previously this form
    // sent `password: ''` on every single edit, which the server rejected
    // with "Password must be at least 8 characters" — so editing ANY
    // employee field (including the official email) failed with that error.
    if (!isEdit) payload.password = password;
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
              <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${step === s.id ? 'bg-primary-600 text-white' : step > s.id ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
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
            {!isEdit && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Password" required error={errors.password}>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
                <FormField label="Confirm Password" required error={errors.confirmPassword}>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={form.confirmPassword}
                      onChange={(e) => set('confirmPassword', e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
              </div>
            )}
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
                <input
                  className="input"
                  value={form.designation}
                  onChange={(e) => set('designation', e.target.value)}
                  onBlur={handleDesignationBlur}
                />
              </FormField>
              <FormField label="Department" required error={errors.department}>
                <Select value={form.department} onChange={(e) => handleDepartmentChange(e.target.value)} options={DEPARTMENTS} placeholder="Select department" />
              </FormField>
            </div>
            {/*
              Account role — shown on create, and also on edit so an
              employee's permissions can actually be corrected later (e.g.
              promoting an intern to HR_ADMIN once they're confirmed).
              Previously this was hidden on edit AND the server had no
              `role` field on this endpoint at all, so a role picked here
              was silently dropped and the account stayed EMPLOYEE forever.
              Only people who could already change an employee's login
              (canChangePassword's role set) may touch this on edit.
            */}
            {(!isEdit || canChangePassword) && (
              <FormField label="Account Role">
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => { roleManuallySetRef.current = true; setRoleAutoSuggested(false); set('role', e.target.value); }}
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="HR_ADMIN">HR Admin</option>
                  <option value="PROJECT_HEAD">Project Head</option>
                  <option value="FINANCE">Finance</option>
                  <option value="IT_HEAD">IT Head</option>
                  <option value="AUDITOR">Auditor</option>
                  <option value="DIRECTOR">Director</option>
                  {/* Only elevated roles (FOUNDER_CEO / CTO) can assign elevated roles */}
                  {isElevated && (
                    <>
                      <option value="CTO">CTO</option>
                      <option value="FOUNDER_CEO">Founder / CEO</option>
                    </>
                  )}
                </select>
                <p className="mt-1 text-xs text-gray-400">Sets the login permissions for this employee.</p>
                {roleAutoSuggested && (
                  <p className="mt-1 text-xs font-medium text-amber-600">
                    Auto-detected from the Designation/Department — this account was still capped at
                    Employee access. Review and save to apply.
                  </p>
                )}
              </FormField>
            )}
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

        {isEdit && canChangePassword && (
          <div className="card space-y-4 p-5">
            <h3 className="section-title">Change Password</h3>
            <p className="text-sm text-gray-500">Set a new login password for this employee.</p>
            <form onSubmit={handlePasswordChange} noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="New Password" required error={pwErrors.newPassword}>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    <button type="button" className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600" onClick={() => setShowNewPassword((v) => !v)} tabIndex={-1}>
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
                <FormField label="Confirm New Password" required error={pwErrors.confirmNewPassword}>
                  <div className="relative">
                    <input
                      type={showNewConfirmPassword ? 'text' : 'password'}
                      className="input pr-10"
                      value={pwForm.confirmNewPassword}
                      onChange={(e) => setPwForm((p) => ({ ...p, confirmNewPassword: e.target.value }))}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                    />
                    <button type="button" className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600" onClick={() => setShowNewConfirmPassword((v) => !v)} tabIndex={-1}>
                      {showNewConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormField>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="btn-primary" disabled={changePasswordMut.isPending}>
                  {changePasswordMut.isPending ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
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