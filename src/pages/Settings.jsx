import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Clock, CalendarDays, Wallet, LogOut, ShieldCheck, Save, ExternalLink, Lock, Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsAPI, leaveAPI, payrollAPI } from '../api/axios';
import { PageHeader, FormField, StatusBadge, LoadingBlock, ErrorState } from '../components/ui';
import { errorMessage } from '../lib/format';
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Work Start Time" hint="24-hour HH:mm">
              <input type="time" className="input" value={active.attendance?.workStartTime || ''} onChange={(e) => update('attendance', { workStartTime: e.target.value })} />
            </FormField>
            <FormField label="Work End Time" hint="24-hour HH:mm">
              <input type="time" className="input" value={active.attendance?.workEndTime || ''} onChange={(e) => update('attendance', { workEndTime: e.target.value })} />
            </FormField>
            <FormField label="Late Threshold (minutes)" hint="Grace period before a check-in counts as late">
              <input type="number" min="0" max="120" className="input" value={active.attendance?.lateThresholdMinutes ?? ''} onChange={(e) => update('attendance', { lateThresholdMinutes: e.target.value })} />
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

        <SettingsSection icon={ShieldCheck} title="Security" description="Current account-security policy (read-only — not database-configurable in this build).">
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-gray-400" /> Account lockout after 5 failed login attempts, for 30 minutes.</li>
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-gray-400" /> Passwords require uppercase, lowercase, a number and a special character (min. 8 characters).</li>
            <li className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-gray-400" /> Sessions are httpOnly-cookie based JWTs.</li>
          </ul>
        </SettingsSection>
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