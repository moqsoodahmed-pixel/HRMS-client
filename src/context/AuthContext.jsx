import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { authAPI } from '../api/axios';

const AuthContext = createContext(null);

/**
 * Platform-administrator tier. FOUNDER_CEO and CTO have identical, full
 * effective power and bypass every permission and route check below.
 * SUPER_ADMIN is kept only for backward compatibility with pre-migration
 * accounts/tokens. This mirrors server/utils/roles.js ELEVATED_ROLES exactly
 * — it is the ONLY place on the frontend that ever names an elevated role,
 * so nothing else needs a scattered `|| role === 'CTO'` check.
 */
const ELEVATED_ROLES = ['FOUNDER_CEO', 'CTO', 'SUPER_ADMIN'];

/**
 * DIRECTOR is a company-wide, READ-ONLY role: it is added to every view*
 * permission below but to NO write/manage/approve permission, so `can()`
 * already returns false for every write action without any per-page change.
 * IT_HEAD is scoped server-side to its own department (see
 * server/utils/roles.js DEPARTMENT_SCOPED_ROLES). PROJECT_HEAD is scoped
 * server-side to itself plus its direct reports, exactly like MANAGER (see
 * server/utils/roles.js TEAM_SCOPED_ROLES) — it is added everywhere MANAGER
 * is, and nowhere MANAGER isn't, so it can never reach unrestricted company
 * administration, payroll administration, or global audit access.
 */
const READ_ONLY_ROLES = ['DIRECTOR'];
const DEPARTMENT_SCOPED_ROLES = ['IT_HEAD'];
const TEAM_SCOPED_ROLES = ['MANAGER', 'PROJECT_HEAD'];

/**
 * UI-level permission map. The backend is always the authority — these flags only
 * decide what is worth rendering, never what is actually allowed.
 */
const PERMISSIONS = {
  // Employees
  viewEmployees: ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  manageEmployees: ['HR_ADMIN'],
  revealIdentity: ['HR_ADMIN'],
  // Attendance
  manageAttendance: ['HR_ADMIN'],
  viewAllAttendance: ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  // Leave
  approveLeave: ['HR_ADMIN', ...TEAM_SCOPED_ROLES],
  manageLeaveSettings: ['HR_ADMIN'],
  applyLeave: ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'EMPLOYEE', 'DIRECTOR', 'IT_HEAD'],
  viewTeamFilters: ['HR_ADMIN', ...TEAM_SCOPED_ROLES, 'DIRECTOR', 'IT_HEAD'],
  // Payroll — IT_HEAD/PROJECT_HEAD/MANAGER are deliberately excluded from every payroll permission.
  viewPayroll: ['HR_ADMIN', 'FINANCE', 'DIRECTOR'],
  managePayroll: ['FINANCE'],
  // Compensation change requests — HR requests, only the elevated tier approves.
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
  // Reporting — payroll reports stay out of IT_HEAD's/PROJECT_HEAD's reach.
  viewReports: ['HR_ADMIN', 'FINANCE', ...TEAM_SCOPED_ROLES, 'AUDITOR', 'DIRECTOR', 'IT_HEAD'],
  viewPayrollReports: ['HR_ADMIN', 'FINANCE', 'AUDITOR', 'DIRECTOR'],
  viewAudit: ['AUDITOR', 'DIRECTOR'],
};

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
      // A 401 here simply means nobody is signed in yet.
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password, rememberMe) => {
    const r = await authAPI.login({ email, password, rememberMe });
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
    return {
      user,
      employee,
      role,
      isElevated,
      /** True for the company-wide, view-only DIRECTOR role — never true for an elevated role. */
      isReadOnly: READ_ONLY_ROLES.includes(role),
      /** True for a role restricted to its own department (e.g. IT_HEAD). */
      isDepartmentScoped: DEPARTMENT_SCOPED_ROLES.includes(role),
      /** True for a role restricted to itself plus its direct reports (MANAGER, PROJECT_HEAD). */
      isTeamScoped: TEAM_SCOPED_ROLES.includes(role),
      loading,
      login,
      logout,
      /** `can('managePayroll')` — elevated roles (FOUNDER_CEO/CTO) always pass. */
      can: (permission) => Boolean(role) && (isElevated || Boolean(PERMISSIONS[permission]?.includes(role))),
      hasRole: (...roles) => Boolean(role && roles.includes(role)),
      canAccess: (path) => {
        if (!role) return false;
        if (isElevated) return true;
        const allowed = ROUTE_ACCESS[path];
        return allowed === null || allowed === undefined || allowed.includes(role);
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
