import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ScrollText, Eye, ShieldAlert } from 'lucide-react';
import { auditAPI } from '../api/axios';
import {
  PageHeader, StatCard, DataTable, Pagination, FilterBar, SearchInput, Select,
  Modal, InfoRow, EmptyState,
} from '../components/ui';
import { formatDateTime } from '../lib/format';

const PAGE_SIZE = 30;

export default function AuditLogs() {
  const [filters, setFilters] = useState({ search: '', module: '', action: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const resetFilters = () => { setFilters({ search: '', module: '', action: '', startDate: '', endDate: '' }); setPage(1); };

  const filterOptions = useQuery({ queryKey: ['audit', 'filters'], queryFn: () => auditAPI.filters(), staleTime: 5 * 60 * 1000 });
  const modules = filterOptions.data?.data?.data?.modules || [];
  const actions = filterOptions.data?.data?.data?.actions || [];

  const query = useQuery({
    queryKey: ['audit', 'list', filters, page],
    queryFn: () => auditAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = query.data?.data?.data || [];
  const meta = query.data?.data?.meta;

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Immutable record of every sensitive action taken in the system" />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          These records cannot be edited or deleted by anyone, including administrators. This view is read-only by design.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Entries" value={meta?.total ?? 0} icon={ScrollText} tone="indigo" />
        <StatCard label="Modules Tracked" value={modules.length} icon={ScrollText} tone="blue" />
        <StatCard label="Action Types" value={actions.length} icon={ScrollText} tone="purple" />
      </div>

      <FilterBar onReset={resetFilters}>
        <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search user, record, action…" />
        <div>
          <label className="label">Module</label>
          <Select className="w-40" value={filters.module} onChange={(e) => setFilter('module', e.target.value)} options={modules} placeholder="All modules" />
        </div>
        <div>
          <label className="label">Action</label>
          <Select className="w-48" value={filters.action} onChange={(e) => setFilter('action', e.target.value)} options={actions} placeholder="All actions" />
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input w-40" value={filters.startDate} onChange={(e) => setFilter('startDate', e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input w-40" value={filters.endDate} onChange={(e) => setFilter('endDate', e.target.value)} />
        </div>
      </FilterBar>

      <DataTable
        columns={[
          { key: 'timestamp', header: 'Timestamp', render: (log) => <span className="whitespace-nowrap text-xs">{formatDateTime(log.createdAt)}</span> },
          { key: 'user', header: 'User', render: (log) => <span className="text-xs text-gray-600">{log.userEmail || 'System'}</span> },
          { key: 'action', header: 'Action', render: (log) => <span className="font-medium text-gray-900">{log.action}</span> },
          { key: 'module', header: 'Module', render: (log) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{log.module}</span> },
          { key: 'resource', header: 'Resource', render: (log) => <span className="block max-w-[10rem] truncate text-xs" title={log.recordLabel}>{log.recordLabel || '—'}</span> },
          { key: 'ip', header: 'IP Address', render: (log) => <span className="font-mono text-xs text-gray-400">{log.ipAddress || '—'}</span> },
          {
            key: 'actions',
            header: '',
            render: (log) => (
              <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline" onClick={() => setViewing(log)}>
                <Eye className="h-3.5 w-3.5" /> Detail
              </button>
            ),
          },
        ]}
        rows={rows}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={query.refetch}
        onRowClick={setViewing}
        empty={<EmptyState icon={ScrollText} title="No audit entries" description="Nothing matches the current filters." />}
        footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
      />

      <AuditDetailModal log={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function AuditDetailModal({ log, onClose }) {
  if (!log) return <Modal open={false} onClose={onClose} title="" />;
  return (
    <Modal open onClose={onClose} size="lg" title="Audit entry detail" description={formatDateTime(log.createdAt)}>
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
          <InfoRow label="User" value={log.userEmail} />
          <InfoRow label="Action" value={log.action} />
          <InfoRow label="Module" value={log.module} />
          <InfoRow label="Resource ID" value={<span className="font-mono text-xs">{log.recordId || '—'}</span>} />
          <InfoRow label="Resource" value={log.recordLabel} />
          <InfoRow label="IP Address" value={log.ipAddress} />
        </div>
        <InfoRow label="User agent" value={<span className="text-xs">{log.userAgent || '—'}</span>} className="rounded-xl bg-gray-50 p-4" />
        {log.oldValue && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Before</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{JSON.stringify(log.oldValue, null, 2)}</pre>
          </div>
        )}
        {log.newValue && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">After</p>
            <pre className="max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{JSON.stringify(log.newValue, null, 2)}</pre>
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
