import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Clock, CalendarDays, Wallet, FileText, ShieldCheck,
  Megaphone, Package, UserPlus, UserMinus, BarChart3, ScrollText, X,
  ClipboardCheck, GraduationCap, TrendingUp, LogOut as ExitIcon, Lock,
  Building2, Settings as SettingsIcon, PhoneCall, ClipboardList, FileSignature,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { COMPANY_NAME } from '../constants';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  // Only meaningful (and only shown) for EMPLOYEE — see `employeeOnly` below.
  { label: 'Complete Onboarding', to: '/onboarding/me', icon: ClipboardCheck, employeeOnly: true },
  { label: 'Employees', to: '/employees', icon: Users },
  { label: 'Attendance', to: '/attendance', icon: Clock },
  { label: 'Leave Requests', to: '/leave', icon: CalendarDays },
  { label: 'Payroll', to: '/payroll', icon: Wallet },
  { label: 'Documents', to: '/documents', icon: FileText },
  { label: 'Training Module', to: '/training', icon: GraduationCap },
  { label: 'My Performance', to: '/performance', icon: TrendingUp },
  { label: 'Exit Process', to: '/exit', icon: ExitIcon },
  { label: 'Policies', to: '/policies', icon: ShieldCheck },
  { label: 'Announcements', to: '/announcements', icon: Megaphone },
  { label: 'Assets', to: '/assets', icon: Package },
  { label: 'Onboarding', to: '/onboarding', icon: UserPlus },
  { label: 'Offboarding', to: '/offboarding', icon: UserMinus },
  { label: 'Sales Leads', to: '/sales-leads', icon: PhoneCall },
  { label: 'Daily Reports', to: '/daily-reports', icon: ClipboardList },
  { label: 'Appointment Letters', to: '/appointment-letters', icon: FileSignature },
  { label: 'Reports', to: '/reports', icon: BarChart3 },
  { label: 'Audit Logs', to: '/audit', icon: ScrollText },
];

/**
 * Super Admin (elevated-role) navigation, reorganised per the reference IA.
 */
const ADMIN_NAV_GROUPS = [
  { type: 'item', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  {
    type: 'group',
    label: 'Organization',
    icon: Building2,
    items: [
      { label: 'Announcements', to: '/announcements', icon: Megaphone },
      { label: 'Calendar', to: '/leave?tab=holidays', icon: CalendarDays },
    ],
  },
  { type: 'item', label: 'Manage Employees', to: '/employees', icon: Users },
  { type: 'item', label: 'Employee Attendance', to: '/attendance', icon: Clock },
  { type: 'item', label: 'Documents', to: '/documents', icon: FileText },
  { type: 'item', label: 'Training Module', to: '/training', icon: GraduationCap },
  { type: 'item', label: 'Performance Reviews', to: '/performance', icon: TrendingUp },
  { type: 'item', label: 'Manage Employee Exits', to: '/offboarding', icon: ExitIcon },
  { type: 'item', label: 'Sales Leads', to: '/sales-leads', icon: PhoneCall },
  { type: 'item', label: 'Daily Reports', to: '/daily-reports', icon: ClipboardList },
  { type: 'item', label: 'Appointment Letters', to: '/appointment-letters', icon: FileSignature },
  {
    type: 'group',
    label: 'Other modules',
    icon: Package,
    items: [
      { label: 'Leave Requests', to: '/leave', icon: CalendarDays },
      { label: 'Payroll', to: '/payroll', icon: Wallet },
      { label: 'Policies', to: '/policies', icon: ShieldCheck },
      { label: 'Assets', to: '/assets', icon: Package },
      { label: 'Onboarding Submissions', to: '/employees?tab=onboarding', icon: UserPlus },
      { label: 'Onboarding Checklist', to: '/onboarding', icon: UserPlus },
      { label: 'Reports', to: '/reports', icon: BarChart3 },
      { label: 'Audit Logs', to: '/audit', icon: ScrollText },
      // Read-only DB counts — the app-side alternative to opening MongoDB
      // Atlas directly. See DataHealth.jsx / diagnosticsController.js.
      { label: 'Data Health Check', to: '/diagnostics', icon: Database },
    ],
  },
  { type: 'item', label: 'Settings', to: '/settings', icon: SettingsIcon },
];

function NavItemLink({ item, locked, onClose, indent }) {
  return (
    <NavLink
      to={locked ? '/onboarding/me' : item.to}
      onClick={onClose}
      title={locked ? 'Complete onboarding to unlock this module' : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition ${indent ? 'pl-9 pr-3' : 'px-3'} ${locked
          ? 'cursor-not-allowed text-gray-400 hover:bg-transparent'
          : isActive
            ? 'bg-primary-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      <item.icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {locked && <Lock className="h-3.5 w-3.5 flex-shrink-0" />}
    </NavLink>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { canAccess, role, isElevated, isRouteLocked } = useAuth();

  const nav = isElevated
    ? <AdminNav onClose={onClose} />
    : <StandardNav onClose={onClose} role={role} canAccess={canAccess} isRouteLocked={isRouteLocked} />;

  return (
    <>
      {/* Desktop rail */}
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

function SidebarShell({ onClose, children }) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex flex-col gap-1">
          <img
            src="/dutylaunch-logo.webp"
            alt="DutyLaunch"
            className="h-8 w-auto object-contain"
          />
          <p className="text-xs text-gray-400">HRMS Portal</p>
        </div>
        <button type="button" className="btn-ghost lg:hidden" onClick={onClose} aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">{children}</nav>
      <div className="border-t border-gray-200 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-gray-400">{COMPANY_NAME}</p>
      </div>
    </>
  );
}

function StandardNav({ onClose, role, canAccess, isRouteLocked }) {
  const items = NAV_ITEMS
    .filter((item) => !item.employeeOnly || role === 'EMPLOYEE')
    .filter((item) => canAccess(item.to));

  return (
    <SidebarShell onClose={onClose}>
      {items.map((item) => (
        <NavItemLink key={item.to} item={item} locked={isRouteLocked(item.to)} onClose={onClose} />
      ))}
    </SidebarShell>
  );
}

function AdminNav({ onClose }) {
  return (
    <SidebarShell onClose={onClose}>
      {ADMIN_NAV_GROUPS.map((entry) => {
        if (entry.type === 'item') {
          return <NavItemLink key={entry.to} item={entry} locked={false} onClose={onClose} />;
        }
        return (
          <div key={entry.label} className="pt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <entry.icon className="h-3.5 w-3.5" /> {entry.label}
            </div>
            {entry.items.map((item) => (
              <NavItemLink key={item.to + item.label} item={item} locked={false} onClose={onClose} indent />
            ))}
          </div>
        );
      })}
    </SidebarShell>
  );
}