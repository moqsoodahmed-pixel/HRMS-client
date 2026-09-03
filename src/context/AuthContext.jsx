import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { authAPI } from '../api/axios';

const AuthContext = createContext(null);

/**
 * Platform-administrator tier. SUPER_ADMIN and any role granted the same
 * effective power (currently just CTO, per the "Bhojraj has SUPER_ADMIN
 * equivalent access" business rule) bypass every permission and route check
 * below. This mirrors server/utils/roles.js exactly — it is the ONLY place
 * on the frontend that ever names an elevated role, so nothing else needs a
 * scattered `|| role === 'CTO'` check.
 */
const ELEVATED_ROLES = ['SUPER_ADMIN', 'CTO'];

/**
 * UI-level permission map. The backend is always the authority — these flags only
 * decide what is worth rendering, never what is actually allowed.
 */
const PERMISSIONS = {
  // Employees
  viewEmployees: ['HR_ADMIN', 'MANAGER'],
  manageEmployees: ['HR_ADMIN'],
  revealIdentity: ['HR_ADMIN'],
  // Attendance
  manageAttendance: ['HR_ADMIN'],
  viewAllAttendance: ['HR_ADMIN', 'MANAGER'],
  // Leave
  approveLeave: ['HR_ADMIN', 'MANAGER'],
  manageLeaveSettings: ['HR_ADMIN'],
  applyLeave: ['HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  viewTeamFilters: ['HR_ADMIN', 'MANAGER'],
  // Payroll
  viewPayroll: ['HR_ADMIN', 'FINANCE'],
  managePayroll: ['FINANCE'],
  // Compensation change requests — HR requests, only the elevated tier approves.
  requestCompensationChange: ['HR_ADMIN'],
  viewCompensationRequests: ['HR_ADMIN', 'FINANCE'],
  approveCompensationChange: [],
  // Documents / content
  manageDocuments: ['HR_ADMIN'],
  managePolicies: ['HR_ADMIN'],
  manageAnnouncements: ['HR_ADMIN'],
  acknowledgePolicies: ['HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  // Assets & lifecycle
  manageAssets: ['HR_ADMIN'],
  viewLifecycle: ['HR_ADMIN', 'MANAGER'],
  manageLifecycle: ['HR_ADMIN'],
  // Reporting
  viewReports: ['HR_ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR'],
  viewPayrollReports: ['HR_ADMIN', 'FINANCE', 'AUDITOR'],
  viewAudit: ['AUDITOR'],
};

/** Which sidebar entries / routes each role may open (null = every signed-in role). */
export const ROUTE_ACCESS = {
  '/dashboard': null,
  '/employees': ['HR_ADMIN', 'MANAGER'],
  '/attendance': ['HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  '/leave': ['HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  '/payroll': ['HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  '/documents': ['HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  '/policies': null,
  '/announcements': null,
  '/assets': ['HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE'],
  '/onboarding': ['HR_ADMIN', 'MANAGER'],
  '/offboarding': ['HR_ADMIN', 'MANAGER'],
  '/reports': ['HR_ADMIN', 'FINANCE', 'MANAGER', 'AUDITOR'],
  '/audit': ['AUDITOR'],
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
      loading,
      login,
      logout,
      /** `can('managePayroll')` — elevated roles (SUPER_ADMIN/CTO) always pass. */
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
