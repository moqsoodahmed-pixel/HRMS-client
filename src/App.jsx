import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Compass } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner, EmptyState } from './components/ui';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import EmployeeForm from './pages/EmployeeForm';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Payroll from './pages/Payroll';
import Documents from './pages/Documents';
import Policies from './pages/Policies';
import Announcements from './pages/Announcements';
import Assets from './pages/Assets';
import Onboarding from './pages/Onboarding';
import MyOnboarding from './pages/MyOnboarding';
import Offboarding from './pages/Offboarding';
import Training from './pages/Training';
import Performance from './pages/Performance';
import ExitProcess from './pages/ExitProcess';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Spinner size="lg" />
    </div>
  );
}

function Forbidden() {
  return (
    <div className="card">
      <EmptyState
        icon={ShieldAlert}
        title="You do not have access to this page"
        description="Your role does not include this module. If you think that is wrong, ask an administrator to review your permissions."
        action={<Link to="/dashboard" className="btn-primary">Back to dashboard</Link>}
      />
    </div>
  );
}

function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you were looking for does not exist or has moved."
        action={<Link to="/dashboard" className="btn-primary">Back to dashboard</Link>}
      />
    </div>
  );
}

/**
 * Wraps a page in the app shell, redirecting anonymous visitors to the login
 * screen and showing a clear message when a role lacks access.
 */
function Private({ children, access }) {
  const { user, loading, canAccess, isRouteLocked } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // Server-enforced too (see requireOnboardingApproved) — this redirect only
  // keeps the UI from ever rendering a locked module in the first place.
  if (isRouteLocked(location.pathname)) return <Navigate to="/onboarding/me" replace />;
  return <Layout>{access && !canAccess(access) ? <Forbidden /> : children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />

      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />

      <Route path="/employees" element={<Private access="/employees"><Employees /></Private>} />
      <Route path="/employees/new" element={<Private access="/employees"><EmployeeForm /></Private>} />
      <Route path="/employees/:id" element={<Private><EmployeeDetail /></Private>} />
      <Route path="/employees/:id/edit" element={<Private access="/employees"><EmployeeForm /></Private>} />

      <Route path="/attendance" element={<Private access="/attendance"><Attendance /></Private>} />
      <Route path="/leave" element={<Private access="/leave"><Leave /></Private>} />
      <Route path="/payroll" element={<Private access="/payroll"><Payroll /></Private>} />
      <Route path="/documents" element={<Private access="/documents"><Documents /></Private>} />
      <Route path="/policies" element={<Private access="/policies"><Policies /></Private>} />
      <Route path="/announcements" element={<Private access="/announcements"><Announcements /></Private>} />
      <Route path="/assets" element={<Private access="/assets"><Assets /></Private>} />
      <Route path="/onboarding" element={<Private access="/onboarding"><Onboarding /></Private>} />
      <Route path="/onboarding/me" element={<Private access="/onboarding/me"><MyOnboarding /></Private>} />
      <Route path="/offboarding" element={<Private access="/offboarding"><Offboarding /></Private>} />
      <Route path="/training" element={<Private access="/training"><Training /></Private>} />
      <Route path="/performance" element={<Private access="/performance"><Performance /></Private>} />
      <Route path="/exit" element={<Private access="/exit"><ExitProcess /></Private>} />
      <Route path="/reports" element={<Private access="/reports"><Reports /></Private>} />
      <Route path="/audit" element={<Private access="/audit"><AuditLogs /></Private>} />
      <Route path="/settings" element={<Private access="/settings"><Settings /></Private>} />

      <Route path="*" element={user ? <Private><NotFound /></Private> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
