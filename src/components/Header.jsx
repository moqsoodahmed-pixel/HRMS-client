import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Menu, LogOut, CheckCheck, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { notificationAPI } from '../api/axios';
import { Avatar, Dropdown, Spinner } from './ui';
import { relativeTime, errorMessage } from '../lib/format';
import { roleDisplayLabel } from '../constants';

/** Where a notification should take the reader when it is opened. */
const LINK_BY_MODEL = {
  LeaveRequest: '/leave',
  Payslip: '/payroll',
  Announcement: '/announcements',
  Policy: '/policies',
  Asset: '/assets',
  Employee: '/employees',
};

export default function Header({ onMenuClick }) {
  const { user, employee, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { limit: 8 }],
    queryFn: () => notificationAPI.list({ limit: 8 }),
    // Keeps the bell reasonably fresh without hammering the API.
    refetchInterval: 60_000,
  });
  const notifications = data?.data?.data || [];
  const unread = data?.data?.meta?.unreadCount || 0;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id) => notificationAPI.markRead(id),
    onSuccess: invalidate,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const markAll = useMutation({
    mutationFn: () => notificationAPI.markAllRead(),
    onSuccess: () => { invalidate(); toast.success('All notifications marked as read'); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const openNotification = (notification, close) => {
    if (!notification.isRead) markRead.mutate(notification._id);
    const target = LINK_BY_MODEL[notification.relatedModel];
    close();
    if (target) navigate(target);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      <button type="button" className="btn-ghost lg:hidden" onClick={onMenuClick} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-2 sm:gap-4">
        <Dropdown
          className="w-80 max-w-[calc(100vw-2rem)]"
          trigger={
            <button type="button" className="btn-ghost relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
          }
        >
          {(close) => (
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
                {unread > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
                    onClick={() => markAll.mutate()}
                    disabled={markAll.isPending}
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">You are all caught up.</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n._id}
                      type="button"
                      onClick={() => openNotification(n, close)}
                      className={`flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition hover:bg-gray-50 ${n.isRead ? '' : 'bg-primary-50/40'}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-primary-600'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-900">{n.title}</span>
                        <span className="mt-0.5 block line-clamp-2 text-xs text-gray-500">{n.message}</span>
                        <span className="mt-1 block text-[11px] text-gray-400">{relativeTime(n.createdAt)}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </Dropdown>

        <Dropdown
          className="w-56"
          trigger={
            <button type="button" className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gray-100">
              <Avatar name={employee?.fullName || user?.email} size="sm" />
              <span className="hidden text-left sm:block">
                <span className="block max-w-[12rem] truncate text-sm font-medium text-gray-900">
                  {employee?.fullName || user?.email}
                </span>
                <span className="block text-xs text-gray-400">{roleDisplayLabel(user?.role, employee?.department)}</span>
              </span>
            </button>
          }
        >
          {(close) => (
            <div className="py-1">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="truncate text-sm font-medium text-gray-900">{employee?.fullName || 'Account'}</p>
                <p className="truncate text-xs text-gray-500">{user?.email}</p>
              </div>
              {employee?._id && (
                <button
                  type="button"
                  onClick={() => { close(); navigate(`/employees/${employee._id}`); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                >
                  <UserIcon className="h-4 w-4" /> My profile
                </button>
              )}
              <button
                type="button"
                onClick={() => { close(); handleLogout(); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </Dropdown>
      </div>
    </header>
  );
}