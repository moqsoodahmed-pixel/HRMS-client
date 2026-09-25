import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Clock, CalendarDays, Wallet, LogOut, ShieldCheck, Save, ExternalLink, Lock, Send,
  Smartphone, MapPin, Plane, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsAPI, leaveAPI, payrollAPI, remoteWorkAPI, employeeAPI } from '../api/axios';
import { PageHeader, FormField, StatusBadge, LoadingBlock, ErrorState, SearchInput, DataTable, EmptyState } from '../components/ui';
import { errorMessage, formatDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation } from '../lib/geolocation';
import { Link } from 'react-router-dom';

/**
 * Real, backend-wired organization settings (server/models/OrgSettings.js) —
 * previously a placeholder. Only Organization/Attendance/Exit are editable
 * here because those are the only sections with genuine backend effect;
 * Leave/Payroll/Security are shown read-only, reusing their existing owning
 * modules rather than duplicating configuration that lives elsewhere.
 */
export default function Settings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: () => settingsAPI.get() });
  const settings = query.data?.data?.data;

  const [form, setForm] = useState(null);
  const active = form || settings;

  const save = useMutation({
    mutationFn: (data) => settingsAPI.update(data),
    onSuccess: (res) => {
      toast.success('Settings saved');
      queryClient.setQueryData(['settings'], { data: { data: res.data.data } });
      setForm(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isLoading) return <LoadingBlock label="Loading settings…" />;
  if (query.error) return <div className="card"><ErrorState error={query.error} onRetry={query.refetch} /></div>;

  const update = (section, patch) => setForm({ ...active, [section]: { ...active[section], ...patch } });

  const submitSection = (section) => {
    if (!form) return;
    save.mutate({ [section]: form[section] });
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage organization settings and preferences" />

      <div className="grid grid-cols-1 gap-6">
        <SettingsSection icon={Building2} title="Organization" description="Basic organization information shown around the app.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Company Name">
              <input className="input" value={active.organization?.companyName || ''} onChange={(e) => update('organization', { companyName: e.target.value })} placeholder="e.g. DutyLaunch Solutions Pvt. Ltd." />
            </FormField>
            <FormField label="Contact Email">
              <input type="email" className="input" value={active.organization?.contactEmail || ''} onChange={(e) => update('organization', { contactEmail: e.target.value })} />
            </FormField>
            <FormField label="Contact Phone">
              <input className="input" value={active.organization?.contactPhone || ''} onChange={(e) => update('organization', { contactPhone: e.target.value })} />
            </FormField>
            <FormField label="Address">
              <input className="input" value={active.organization?.address || ''} onChange={(e) => update('organization', { address: e.target.value })} />
            </FormField>
          </div>
          <SectionSaveButton onSave={() => submitSection('organization')} disabled={!form?.organization} loading={save.isPending} />
        </SettingsSection>

        <SettingsSection icon={Clock} title="Attendance" description="Work-hours window used for check-in lateness and hours worked. Leave blank to use the server default.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Work Start Time" hint="24-hour HH:mm">
              <input type="time" className="input" value={active.attendance?.workStartTime || '10:30'} onChange={(e) => update('attendance', { workStartTime: e.target.value })} />
            </FormField>
            <FormField label="Work End Time" hint="24-hour HH:mm">
              <input type="time" className="input" value={active.attendance?.workEndTime || ''} onChange={(e) => update('attendance', { workEndTime: e.target.value })} />
            </FormField>
            <FormField label="Late Threshold (minutes)" hint="Grace period before a check-in counts as late">
              <input type="number" min="0" max="120" className="input" value={active.attendance?.lateThresholdMinutes ?? ''} onChange={(e) => update('attendance', { lateThresholdMinutes: e.target.value })} />
            </FormField>
            <FormField label="Break Duration (minutes)" hint="Deducted from gross hours to give net working hours (default 60 min = 1 hr)">
              <input
                type="number" min="0" max="120" className="input"
                placeholder="60"
                value={active.attendance?.breakDurationMinutes ?? ''}
                onChange={(e) => update('attendance', { breakDurationMinutes: e.target.value })}
              />
            </FormField>
          </div>
          <SectionSaveButton onSave={() => submitSection('attendance')} disabled={!form?.attendance} loading={save.isPending} />
        </SettingsSection>

        <SettingsSection icon={CalendarDays} title="Leave" description="Leave types, balances and holidays are managed on the Leave page.">
          <LeaveSummary />
        </SettingsSection>

        <SettingsSection icon={Wallet} title="Payroll" description="Salary/payroll processing is handled by the external XYZ payroll partner — no calculation logic lives here.">
          <PayrollSummaryReadOnly />
        </SettingsSection>

        <SettingsSection icon={LogOut} title="Exit" description="Suggested default notice period shown to employees when they submit an exit request. Each employee's own configured notice period always takes precedence.">
          <FormField label="Default Notice Period (days)">
            <input type="number" min="0" max="365" className="input w-48" value={active.exit?.defaultNoticePeriodDays ?? ''} onChange={(e) => update('exit', { defaultNoticePeriodDays: e.target.value })} />
          </FormField>
          <SectionSaveButton onSave={() => submitSection('exit')} disabled={!form?.exit} loading={save.isPending} />
        </SettingsSection>

        <SettingsSection icon={Send} title="Telegram Notifications" description="Send clock-in / clock-out alerts to a Telegram group or personal chat. Get your Bot Token from @BotFather and your Chat ID from @userinfobot.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Bot Token" hint="From @BotFather — leave blank to keep existing value">
              <input
                className="input font-mono text-sm"
                value={active.telegram?.botToken || ''}
                onChange={(e) => update('telegram', { botToken: e.target.value })}
                placeholder="1234567890:AAF..."
                autoComplete="off"
              />
            </FormField>
            <FormField label="Group / Chat ID" hint="From @userinfobot or the group chat info">
              <input
                className="input font-mono text-sm"
                value={active.telegram?.notifyChatId || ''}
                onChange={(e) => update('telegram', { notifyChatId: e.target.value })}
                placeholder="-1001234567890"
              />
            </FormField>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={active.telegram?.enabled ?? false}
                onChange={(e) => update('telegram', { enabled: e.target.checked })}
              />
              Enable clock-in notifications
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={active.telegram?.notifyClockOut ?? false}
                onChange={(e) => update('telegram', { notifyClockOut: e.target.checked })}
              />
              Also notify on clock-out
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <TelegramTestButton />
            <SectionSaveButton onSave={() => submitSection('telegram')} disabled={!form?.telegram} loading={save.isPending} />
          </div>
        </SettingsSection>

        <SettingsSection icon={Send} title="Daily Report Telegram Notifications" description="Send daily report submissions to a separate, dedicated Telegram bot/group. Get your Bot Token from @BotFather and your Chat ID from @userinfobot.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Bot Token" hint="From @BotFather — leave blank to keep existing value">
              <input
                className="input font-mono text-sm"
                value={active.dailyReportTelegram?.botToken || ''}
                onChange={(e) => update('dailyReportTelegram', { botToken: e.target.value })}
                placeholder="1234567890:AAF..."
                autoComplete="off"
              />
            </FormField>
            <FormField label="Group / Chat ID" hint="From @userinfobot or the group chat info">
              <input
                className="input font-mono text-sm"
                value={active.dailyReportTelegram?.notifyChatId || ''}
                onChange={(e) => update('dailyReportTelegram', { notifyChatId: e.target.value })}
                placeholder="-1001234567890"
              />
            </FormField>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={active.dailyReportTelegram?.enabled ?? false}
                onChange={(e) => update('dailyReportTelegram', { enabled: e.target.checked })}
              />
              Enable daily report notifications
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <DailyReportTelegramTestButton />
            <SectionSaveButton onSave={() => submitSection('dailyReportTelegram')} disabled={!form?.dailyReportTelegram} loading={save.isPending} />
          </div>
        </SettingsSection>

        <SettingsSection icon={ShieldCheck} title="Security" description="Current account-security policy.">
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-gray-400" /> Account lockout after 5 failed login attempts, for 30 minutes.</li>
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-gray-400" /> Passwords require uppercase, lowercase, a number and a special character (min. 8 characters).</li>
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-gray-400" /> Sessions are httpOnly-cookie based JWTs.</li>
          </ul>
        </SettingsSection>

        <SettingsSection
          icon={Smartphone}
          title="Device & Location Access"
          description="Restrict sign-in to desktop/laptop devices and/or to within a radius of the office. CEO, CTO and Project Head are always exempt from both."
        >
          <div className="mb-4 flex flex-wrap items-center gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={active.security?.mobileRestrictionEnabled ?? false}
                onChange={(e) => update('security', { mobileRestrictionEnabled: e.target.checked })}
              />
              Block mobile/tablet sign-in
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={active.security?.geoRestrictionEnabled ?? false}
                onChange={(e) => update('security', { geoRestrictionEnabled: e.target.checked })}
              />
              Restrict sign-in to office location
            </label>
          </div>
          <UseCurrentLocationButton onDetected={(coords) => update('security', coords)} />
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Office Latitude" hint="e.g. 12.9716">
              <input
                type="number" step="any" className="input"
                value={active.security?.officeLatitude ?? ''}
                onChange={(e) => update('security', { officeLatitude: e.target.value })}
                placeholder="Not set"
              />
            </FormField>
            <FormField label="Office Longitude" hint="e.g. 77.5946">
              <input
                type="number" step="any" className="input"
                value={active.security?.officeLongitude ?? ''}
                onChange={(e) => update('security', { officeLongitude: e.target.value })}
                placeholder="Not set"
              />
            </FormField>
            <FormField label="Allowed Radius (meters)" hint="Default 25m">
              <input
                type="number" min="1" className="input"
                value={active.security?.allowedRadiusMeters ?? ''}
                onChange={(e) => update('security', { allowedRadiusMeters: e.target.value })}
                placeholder="25"
              />
            </FormField>
          </div>
          {active.security?.geoRestrictionEnabled && (active.security?.officeLatitude == null || active.security?.officeLongitude == null) && (
            <p className="mt-3 flex items-center gap-2 text-xs text-amber-700">
              <MapPin className="h-3.5 w-3.5" /> Office location restriction is on but coordinates aren't set yet — every restricted sign-in will be denied until they are.
            </p>
          )}
          <SectionSaveButton onSave={() => submitSection('security')} disabled={!form?.security} loading={save.isPending} />
        </SettingsSection>

        <RemoteWorkAccessSection />
      </div>
    </div>
  );
}

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Icon className="h-4.5 w-4.5" /></div>
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SectionSaveButton({ onSave, disabled, loading }) {
  return (
    <div className="mt-4 flex justify-end">
      <button type="button" className="btn-primary" onClick={onSave} disabled={disabled || loading}>
        <Save className="h-4 w-4" /> {loading ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

function LeaveSummary() {
  const query = useQuery({ queryKey: ['leave', 'types', 'settings-summary'], queryFn: () => leaveAPI.types() });
  const types = query.data?.data?.data || [];
  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
      <p className="text-sm text-gray-600">{query.isLoading ? 'Loading…' : `${types.length} leave type(s) configured`}</p>
      <Link to="/leave?tab=types" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
        Manage leave types <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function TelegramTestButton() {
  const [testing, setTesting] = useState(false);
  const handleTest = async () => {
    setTesting(true);
    try {
      await settingsAPI.telegramTest();
      toast.success('Test message sent! Check your Telegram group.');
    } catch (err) {
      toast.error('Failed: ' + errorMessage(err));
    } finally {
      setTesting(false);
    }
  };
  return (
    <button type="button" className="btn-secondary flex items-center gap-2" onClick={handleTest} disabled={testing}>
      <Send className="h-4 w-4" /> {testing ? 'Sending…' : 'Send test message'}
    </button>
  );
}

function DailyReportTelegramTestButton() {
  const [testing, setTesting] = useState(false);
  const handleTest = async () => {
    setTesting(true);
    try {
      await settingsAPI.dailyReportTelegramTest();
      toast.success('Test message sent! Check your daily-report Telegram group.');
    } catch (err) {
      toast.error('Failed: ' + errorMessage(err));
    } finally {
      setTesting(false);
    }
  };
  return (
    <button type="button" className="btn-secondary flex items-center gap-2" onClick={handleTest} disabled={testing}>
      <Send className="h-4 w-4" /> {testing ? 'Sending…' : 'Send test message'}
    </button>
  );
}

/**
 * Auto-fills Office Latitude/Longitude from the free browser GPS Geolocation
 * API (lib/geolocation.js — the same one the login form uses), while the
 * admin is physically standing at the office. This is deliberately NOT an
 * IP-based "geolocation API" lookup: IP geolocation is only accurate to
 * city/neighborhood level (often off by kilometers), which is useless
 * against a ~25m radius — GPS is the only free option accurate enough to
 * actually match what this feature checks at login time.
 */
function UseCurrentLocationButton({ onDetected }) {
  const [detecting, setDetecting] = useState(false);

  const handleClick = async () => {
    setDetecting(true);
    try {
      const coords = await getCurrentLocation({ timeout: 15000 });
      if (!coords) {
        toast.error('Could not get your location — check that location permission is allowed for this site, then try again.');
        return;
      }
      onDetected({ officeLatitude: coords.latitude, officeLongitude: coords.longitude });
      const precision = coords.accuracy != null ? ` (±${Math.round(coords.accuracy)}m accuracy)` : '';
      toast.success(`Location captured${precision} — review it below, then Save changes.`);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <button type="button" className="btn-secondary flex items-center gap-2" onClick={handleClick} disabled={detecting}>
      <MapPin className="h-4 w-4" /> {detecting ? 'Getting your location…' : 'Use my current location'}
    </button>
  );
}

/**
 * PART 3 — Temporary Remote Work Access. Only rendered for roles that can
 * actually grant it (HR_ADMIN, PROJECT_HEAD, or elevated — mirrors server
 * routes/index.js REMOTE_WORK_APPROVER, see server/utils/roles.js
 * REMOTE_WORK_APPROVER_ROLES) so nobody else sees a form they'd get a 403
 * from. CEO/CTO/Project Head never need one for themselves — they're
 * already permanently exempt from geo-fencing — this is for granting the
 * exception to someone who IS restricted.
 */
function RemoteWorkAccessSection() {
  const { isElevated, hasRole } = useAuth();
  const canGrant = isElevated || hasRole('HR_ADMIN', 'PROJECT_HEAD');
  if (!canGrant) return null;

  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ employeeId: '', startDate: '', endDate: '', reason: '' });

  const listQuery = useQuery({ queryKey: ['remote-work-approvals'], queryFn: () => remoteWorkAPI.list() });
  const approvals = listQuery.data?.data?.data || [];

  const employeesQuery = useQuery({
    queryKey: ['employees', 'list', 'remote-work-picker', search],
    queryFn: () => employeeAPI.list({ search, limit: 10 }),
    enabled: search.length > 1,
  });
  const employeeOptions = employeesQuery.data?.data?.data || [];

  const grant = useMutation({
    mutationFn: (data) => remoteWorkAPI.create(data),
    onSuccess: () => {
      toast.success('Remote work access granted');
      queryClient.invalidateQueries({ queryKey: ['remote-work-approvals'] });
      setForm({ employeeId: '', startDate: '', endDate: '', reason: '' });
      setSearch('');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const revoke = useMutation({
    mutationFn: (id) => remoteWorkAPI.revoke(id),
    onSuccess: () => {
      toast.success('Remote work access revoked');
      queryClient.invalidateQueries({ queryKey: ['remote-work-approvals'] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.employeeId || !form.startDate || !form.endDate || !form.reason.trim()) {
      toast.error('Fill in employee, dates and a reason.');
      return;
    }
    grant.mutate(form);
  };

  return (
    <SettingsSection
      icon={Plane}
      title="Temporary Remote Work Access"
      description="Lets a specific employee sign in outside the office radius for a date range. Automatically stops applying once the end date passes — nothing to remember to turn back off."
    >
      <form onSubmit={submit} className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <FormField label="Employee" required>
            <SearchInput
              value={form.employeeId ? (employeeOptions.find((e) => e._id === form.employeeId)?.fullName || search) : search}
              onChange={(v) => { setSearch(v); setForm((f) => ({ ...f, employeeId: '' })); }}
              placeholder="Search by name or code…"
            />
          </FormField>
          {search.length > 1 && !form.employeeId && employeeOptions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {employeeOptions.map((emp) => (
                <li key={emp._id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => { setForm((f) => ({ ...f, employeeId: emp._id })); setSearch(emp.fullName); }}
                  >
                    {emp.fullName} <span className="text-xs text-gray-400">{emp.employeeCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <FormField label="Start Date" required>
          <input type="date" className="input" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
        </FormField>
        <FormField label="End Date" required>
          <input type="date" className="input" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
        </FormField>
        <FormField label="Reason" required>
          <input className="input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Client site visit" />
        </FormField>
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" className="btn-primary" disabled={grant.isPending}>
            {grant.isPending ? 'Granting…' : 'Grant remote work access'}
          </button>
        </div>
      </form>

      <DataTable
        columns={[
          {
            key: 'employee', header: 'Employee',
            render: (a) => <span>{a.employee?.fullName || '—'} <span className="text-xs text-gray-400">{a.employee?.employeeCode}</span></span>,
          },
          { key: 'range', header: 'Period', render: (a) => `${formatDate(a.startDate)} – ${formatDate(a.endDate)}` },
          { key: 'reason', header: 'Reason', render: (a) => <span className="text-gray-600">{a.reason}</span> },
          { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} tone={a.status === 'ACTIVE' ? 'green' : 'gray'} /> },
          {
            key: 'actions', header: '',
            render: (a) => a.status === 'ACTIVE' && (
              <button type="button" className="btn-ghost" title="Revoke" onClick={() => revoke.mutate(a._id)} disabled={revoke.isPending}>
                <X className="h-4 w-4" />
              </button>
            ),
          },
        ]}
        rows={approvals}
        isLoading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={listQuery.refetch}
        empty={<EmptyState icon={Plane} title="No remote work exceptions" description="Grant one above when an employee needs to sign in away from the office." />}
      />
    </SettingsSection>
  );
}

function PayrollSummaryReadOnly() {
  const now = new Date();
  const query = useQuery({ queryKey: ['payroll', 'summary', 'settings'], queryFn: () => payrollAPI.summary({ month: now.getMonth() + 1, year: now.getFullYear() }) });
  const s = query.data?.data?.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm text-gray-600">Current period payroll status</p>
          {query.isLoading ? <p className="text-xs text-gray-400">Loading…</p> : <div className="mt-1"><StatusBadge status={s?.status || 'NOT_STARTED'} /></div>}
        </div>
        <Link to="/payroll" className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
          Open Payroll <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="rounded-lg bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700">{s?.integration?.provider || 'XYZ'} Payroll Integration</span>
          <StatusBadge status={s?.integration?.status || 'NOT_CONNECTED'} tone="gray" />
        </div>
        <p className="mt-1 text-xs text-gray-500">Not connected yet — salary processing is handled by our external payroll partner. Sync status will appear here once configured.</p>
      </div>
    </div>
  );
}