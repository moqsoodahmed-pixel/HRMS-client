import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { authAPI } from '../api/axios';
import { getDeviceSignal } from '../lib/geolocation';

const AuthContext = createContext(null);

const ELEVATED_ROLES = ['FOUNDER_CEO', 'CTO', 'SUPER_ADMIN'];
const READ_ONLY_ROLES = ['DIRECTOR'];
const DEPARTMENT_SCOPED_ROLES = ['IT_HEAD'];
const TEAM_SCOPED_ROLES = ['MANAGER', 'PROJECT_HEAD'];

const PERMISSIONS = {
  // Employees
  viewEmployees: ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  manageEmployees: ['HR_ADMIN', 'PROJECT_HEAD'],
  deleteEmployee: ['HR_ADMIN', 'PROJECT_HEAD'],
  revealIdentity: ['HR_ADMIN', 'PROJECT_HEAD'],
  // Attendance
  // FOUNDER_CEO/CTO/SUPER_ADMIN already get every permission via the
  // isElevated bypass below, so they don't need to be listed here — but
  // PROJECT_HEAD does, to match the server's HR_ROLES (utils/roles.js),
  // which already authorizes PROJECT_HEAD on PATCH /attendance/:id and the
  // correction-request approve/reject routes. Without this, a Project Head
  // could not see the Edit-attendance button even though the API would
  // have accepted their request — this is the fix for "HR/CEO/CTO/Project
  // Head can correct an accidental check-out when the employee reports it."
  manageAttendance: ['HR_ADMIN', 'PROJECT_HEAD'],
  viewAllAttendance: ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  // Leave
  approveLeave: ['FOUNDER_CEO', 'SUPER_ADMIN', 'CTO', 'HR_ADMIN', ...TEAM_SCOPED_ROLES],
  manageLeaveSettings: ['HR_ADMIN'],
  applyLeave: ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  viewTeamFilters: ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  // Payroll
  viewPayroll: ['HR_ADMIN', 'FINANCE', 'DIRECTOR'],
  // HR administers day-to-day payroll (salary structures, generating/
  // reissuing payslips) alongside Finance — matches the server's
  // PAYROLL_WRITE_ROLES (utils/roles.js). Changing what someone's pay rate
  // actually IS still goes through the separate compensation request/
  // approval workflow below, which HR still cannot approve on its own.
  managePayroll: ['FINANCE', 'HR_ADMIN'],
  requestCompensationChange: ['HR_ADMIN'],
  viewCompensationRequests: ['HR_ADMIN', 'FINANCE', 'DIRECTOR'],
  approveCompensationChange: [],
  // Documents / content
  manageDocuments: ['HR_ADMIN'],
  managePolicies: ['HR_ADMIN'],
  manageAnnouncements: ['HR_ADMIN'],
  acknowledgePolicies: ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  // Assets & lifecycle
  manageAssets: ['HR_ADMIN'],
  viewLifecycle: ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  manageLifecycle: ['HR_ADMIN'],
  // Reporting
  viewReports: ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'AUDITOR', 'DIRECTOR', 'IT_HEAD'],
  viewPayrollReports: ['HR_ADMIN', 'FINANCE', 'AUDITOR', 'DIRECTOR'],
  viewAudit: ['AUDITOR', 'DIRECTOR'],
  // Training & performance reviews
  manageTraining: ['HR_ADMIN'],
  // MANAGER (a Sales Team Lead) and PROJECT_HEAD can manage reviews for their
  // OWN team — the server hard-scopes them to their direct reports
  // (performanceController resolveReviewableScope), while HR/elevated stay
  // company-wide. This gate only decides admin-view vs my-reviews-view; the
  // real boundary is server-side. Matches server utils/roles.js
  // PERFORMANCE_MANAGE_ROLES.
  managePerformanceReviews: ['HR_ADMIN', 'PROJECT_HEAD', 'MANAGER'],
  // Sales leads — all roles can view; upload is gated server-side to elevated
  viewLeads: ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  uploadLeads: [], // elevated only — isElevated() handles this, so empty here
};

export const ONBOARDING_LOCKED_ROUTES = [
  '/attendance', '/leave', '/payroll', '/documents', '/exit', '/training', '/performance', '/assets',
];

export const ONBOARDING_ROUTE = '/onboarding/me';

/** Which sidebar entries / routes each role may open (null = every signed-in role). */
export const ROUTE_ACCESS = {
  '/dashboard': null,
  '/employees': ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  '/attendance': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  '/leave': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  '/payroll': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  '/documents': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  '/policies': null,
  '/announcements': null,
  '/assets': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  '/onboarding': ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  '/offboarding': ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  '/reports': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'AUDITOR', 'DIRECTOR', 'IT_HEAD'],
  '/audit': ['AUDITOR', 'DIRECTOR'],
  '/settings': [],
  // Elevated only (FOUNDER_CEO/CTO/SUPER_ADMIN) — matches the server's
  // authorize() on GET /diagnostics/data-health.
  '/diagnostics': [],
  '/onboarding/me': null,
  '/training': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  '/performance': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  '/exit': ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  // Sales Leads — only management roles + EMPLOYEE role (dept filter applied in Sidebar/SalesLeads page)
  '/sales-leads': ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD', 'FINANCE', 'EMPLOYEE'],
  '/daily-reports': null,
  '/appointment-letters': ['HR_ADMIN'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authAPI.me()
      .then((r) => {
        if (cancelled) return;
        setUser(r.data.data.user);
        setEmployee(r.data.data.employee);
      })
      .catch(() => { })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // `location` is the optional { latitude, longitude, accuracy } captured by
  // the login form via the browser Geolocation API (see pages/Login.jsx) —
  // only used server-side when an admin has turned geo-fencing on for
  // non-exempt roles (see server/services/accessControlService.js). Passing
  // it through here is the only change; nothing about the existing
  // email/password/rememberMe flow changes for anyone it doesn't apply to.
  const login = useCallback(async (email, password, rememberMe, location) => {
    const r = await authAPI.login(
      { email, password, rememberMe, location: location || undefined },
      { headers: { 'X-Device-Signal': getDeviceSignal() } },
    );
    setUser(r.data.data.user);
    setEmployee(r.data.data.employee);
    return r.data.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } finally {
      setUser(null);
      setEmployee(null);
    }
  }, []);

  const value = useMemo(() => {
    const role = user?.role;
    const isElevated = ELEVATED_ROLES.includes(role);
    const needsOnboarding = role === 'EMPLOYEE' && Boolean(employee) && employee.onboardingStatus !== 'APPROVED';
    return {
      user,
      employee,
      role,
      isElevated,
      needsOnboarding,
      onboardingStatus: employee?.onboardingStatus,
      isRouteLocked: (path) => needsOnboarding && ONBOARDING_LOCKED_ROUTES.includes(path),
      isReadOnly: READ_ONLY_ROLES.includes(role),
      isDepartmentScoped: DEPARTMENT_SCOPED_ROLES.includes(role),
      isTeamScoped: TEAM_SCOPED_ROLES.includes(role),
      loading,
      login,
      logout,
      can: (permission) => Boolean(role) && (isElevated || Boolean(PERMISSIONS[permission]?.includes(role))),
      hasRole: (...roles) => Boolean(role && roles.includes(role)),
      canAccess: (path) => {
        if (!role) return false;
        if (isElevated) return true;
        const allowed = ROUTE_ACCESS[path];
        const hasAccess = allowed === null || allowed === undefined || allowed.includes(role);
        if (!hasAccess) return false;
        // For EMPLOYEE role, Sales Leads is only accessible if they are in the Sales department
        if (path === '/sales-leads' && role === 'EMPLOYEE') {
          const dept = employee?.department?.toLowerCase() || '';
          return dept === 'sales' || dept.includes('sales') || dept.includes('business development');
        }
        return true;
      },
    };
  }, [user, employee, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
};