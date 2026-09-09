import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, Upload, BarChart2, LogOut, List } from 'lucide-react';

const ROLE_LABELS = {
  ceo: 'CEO / Founder',
  cto: 'CTO',
  project_head: 'Project Head',
  sales_team: 'Sales Team',
  hr: 'HR',
  employee: 'Employee',
};

export default function Layout() {
  const { user, logout, canUploadLeads } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navClass = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
      isActive
        ? 'bg-indigo-100 text-indigo-700 font-semibold'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <p className="font-bold text-indigo-700 text-sm">DutyLaunch HRMS</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full">
            {ROLE_LABELS[user?.role] || user?.role}
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {/* Upload — visible to CEO, CTO, Project Head */}
          {canUploadLeads && (
            <NavLink to="/leads/upload" className={navClass}>
              <Upload size={16} /> Upload Leads
            </NavLink>
          )}

          {/* All leads — visible to CEO, CTO, PH, and sales team */}
          {(canUploadLeads || user?.role === 'sales_team') && (
            <NavLink to="/leads" className={navClass}>
              <List size={16} /> {user?.role === 'sales_team' ? 'My Leads' : 'All Leads'}
            </NavLink>
          )}

          {/* Overview — management only */}
          {canUploadLeads && (
            <>
              <NavLink to="/leads/batches" className={navClass}>
                <BarChart2 size={16} /> Upload History
              </NavLink>
              <NavLink to="/leads/overview" className={navClass}>
                <BarChart2 size={16} /> Team Overview
              </NavLink>
              <NavLink to="/users" className={navClass}>
                <Users size={16} /> Manage Users
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition w-full px-3 py-2 rounded-lg hover:bg-red-50"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
