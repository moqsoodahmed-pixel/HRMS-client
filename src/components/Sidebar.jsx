import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Clock, CalendarDays, Wallet, FileText, ShieldCheck,
  Megaphone, Package, UserPlus, UserMinus, BarChart3, ScrollText, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Employees', to: '/employees', icon: Users },
  { label: 'Attendance', to: '/attendance', icon: Clock },
  { label: 'Leave', to: '/leave', icon: CalendarDays },
  { label: 'Payroll', to: '/payroll', icon: Wallet },
  { label: 'Documents', to: '/documents', icon: FileText },
  { label: 'Policies', to: '/policies', icon: ShieldCheck },
  { label: 'Announcements', to: '/announcements', icon: Megaphone },
  { label: 'Assets', to: '/assets', icon: Package },
  { label: 'Onboarding', to: '/onboarding', icon: UserPlus },
  { label: 'Offboarding', to: '/offboarding', icon: UserMinus },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Audit Logs', to: '/audit', icon: ScrollText },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const { canAccess } = useAuth();
  const items = NAV_ITEMS.filter((item) => canAccess(item.to));

  const nav = (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
        <div>
          <h1 className="text-lg font-bold text-primary-700">DutyLaunch</h1>
          <p className="text-xs text-gray-400">HRMS Portal</p>
        </div>
        <button type="button" className="btn-ghost lg:hidden" onClick={onClose} aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-200 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-gray-400">
          DutyLaunch Solutions
          <br />
          Private Limited
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail — fixed height, own scroll region, so it never moves with page content */}
      <aside className="hidden h-screen w-56 flex-shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white lg:flex">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="relative flex h-full w-64 flex-col bg-white shadow-xl">{nav}</aside>
        </div>
      )}
    </>
  );
}
