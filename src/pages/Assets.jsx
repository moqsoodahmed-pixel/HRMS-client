import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Package, Plus, UserPlus, Undo2, History, Boxes, CheckCircle2, Wrench, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { assetAPI, employeeAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, InfoRow,
} from '../components/ui';
import { ASSET_STATUSES, ASSET_STATUS_LABELS, ASSET_CONDITIONS, ASSET_TYPES } from '../constants';
import { formatCurrency, formatDate, errorMessage, fieldErrors } from '../lib/format';

const PAGE_SIZE = 20;

export default function Assets() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [returning, setReturning] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);

  const setFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };

  const listQuery = useQuery({
    queryKey: ['assets', 'list', filters, page],
    queryFn: () => assetAPI.list({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({ queryKey: ['assets', 'stats'], queryFn: () => assetAPI.stats() });

  const rows = listQuery.data?.data?.data || [];
  const meta = listQuery.data?.data?.meta;
  const stats = statsQuery.data?.data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const columns = useMemo(() => [
    { key: 'tag', header: 'Asset Tag', render: (row) => <span className="font-mono text-xs">{row.assetCode}</span> },
    {
      key: 'name',
      header: 'Asset Name',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{row.name}</p>
          <p className="truncate text-xs text-gray-400">{row.brand} {row.model}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Category', render: (row) => row.type },
    { key: 'serial', header: 'Serial Number', render: (row) => <span className="font-mono text-xs text-gray-500">{row.serialNumber || '—'}</span> },
    { key: 'purchaseDate', header: 'Purchase Date', render: (row) => formatDate(row.purchaseDate) },
    { key: 'value', header: 'Value', render: (row) => formatCurrency(row.purchaseValue) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} label={ASSET_STATUS_LABELS[row.status]} /> },
    {
      key: 'assignedTo',
      header: 'Assigned Employee',
      render: (row) => row.assignedTo ? (
        <div className="flex items-center gap-2">
          <Avatar name={row.assignedTo.fullName} size="sm" />
          <span className="truncate text-sm">{row.assignedTo.fullName}</span>
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    { key: 'location', header: 'Location', render: (row) => <span className="text-xs text-gray-500">{row.location || '—'}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button type="button" className="text-xs font-medium text-gray-500 hover:underline" onClick={(e) => { e.stopPropagation(); setViewingHistory(row); }} title="Assignment history">
            <History className="h-3.5 w-3.5" />
          </button>
          {can('manageAssets') && (
            <>
              <button type="button" className="text-xs font-medium text-primary-600 hover:underline" onClick={(e) => { e.stopPropagation(); setEditing(row); }}>Edit</button>
              {row.status === 'AVAILABLE' && (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-green-600 hover:underline" onClick={(e) => { e.stopPropagation(); setAssigning(row); }}>
                  <UserPlus className="h-3.5 w-3.5" /> Assign
                </button>
              )}
              {row.status === 'ASSIGNED' && (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline" onClick={(e) => { e.stopPropagation(); setReturning(row); }}>
                  <Undo2 className="h-3.5 w-3.5" /> Return
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ], [can]);

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Company equipment inventory, assignment and history"
        actions={can('manageAssets') && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New asset
          </button>
        )}
      />

      {statsQuery.isLoading ? <StatCardSkeleton count={5} /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Total Assets" value={stats?.total ?? 0} icon={Boxes} tone="indigo" hint={formatCurrency(stats?.totalValue, { compact: true })} />
          <StatCard label="Available" value={stats?.available ?? 0} icon={CheckCircle2} tone="green" />
          <StatCard label="Assigned" value={stats?.assigned ?? 0} icon={Package} tone="blue" />
          <StatCard label="Maintenance" value={stats?.maintenance ?? 0} icon={Wrench} tone="amber" />
          <StatCard label="Retired" value={stats?.retired ?? 0} icon={XCircle} tone="red" hint={`${stats?.returned ?? 0} returned to date`} />
        </div>
      )}

      <div className="mt-6">
        <FilterBar onReset={() => { setFilters({ search: '', status: '', type: '' }); setPage(1); }}>
          <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilter('search', v)} placeholder="Search tag, name, serial…" />
          <div>
            <label className="label">Status</label>
            <Select className="w-40" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} options={ASSET_STATUSES} placeholder="All statuses" />
          </div>
          <div>
            <label className="label">Category</label>
            <Select className="w-44" value={filters.type} onChange={(e) => setFilter('type', e.target.value)} options={ASSET_TYPES} placeholder="All categories" />
          </div>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={rows}
          isLoading={listQuery.isLoading}
          error={listQuery.error}
          onRetry={listQuery.refetch}
          empty={
            <EmptyState
              icon={Package}
              title="No assets found"
              description={can('manageAssets') ? 'Add your first asset to start tracking company equipment.' : 'No assets are currently assigned to you.'}
              action={can('manageAssets') ? <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New asset</button> : null}
            />
          }
          footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
        />
      </div>

      <AssetFormModal open={creating || Boolean(editing)} asset={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={refresh} />
      <AssignAssetModal asset={assigning} onClose={() => setAssigning(null)} onSaved={refresh} />
      <ReturnAssetModal asset={returning} onClose={() => setReturning(null)} onSaved={refresh} />
      <AssetHistoryModal asset={viewingHistory} onClose={() => setViewingHistory(null)} />
    </div>
  );
}

function AssetFormModal({ open, asset, onClose, onSaved }) {
  const isEdit = Boolean(asset);
  const empty = { assetCode: '', name: '', type: '', brand: '', model: '', serialNumber: '', purchaseDate: '', purchaseValue: '', condition: 'NEW', location: '', notes: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  if (open && isEdit && loadedFor !== asset._id) {
    setForm({
      assetCode: asset.assetCode, name: asset.name, type: asset.type, brand: asset.brand || '',
      model: asset.model || '', serialNumber: asset.serialNumber || '', purchaseDate: asset.purchaseDate?.slice(0, 10) || '',
      purchaseValue: asset.purchaseValue ?? '', condition: asset.condition || 'NEW', location: asset.location || '', notes: asset.notes || '',
    });
    setLoadedFor(asset._id);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? assetAPI.update(asset._id, data) : assetAPI.create(data)),
    onSuccess: () => { toast.success(isEdit ? 'Asset updated' : 'Asset created'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setLoadedFor(null); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.assetCode.trim()) next.assetCode = 'Asset tag is required.';
    if (!form.name.trim()) next.name = 'Asset name is required.';
    if (!form.type) next.type = 'Choose a category.';
    if (form.purchaseValue !== '' && Number(form.purchaseValue) < 0) next.purchaseValue = 'Value cannot be negative.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = { ...form };
    if (payload.purchaseValue !== '') payload.purchaseValue = Number(payload.purchaseValue);
    else delete payload.purchaseValue;
    save.mutate(payload);
  };

  return (
    <Modal open={open} onClose={close} size="lg" title={isEdit ? 'Edit asset' : 'New asset'}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Asset tag" required error={errors.assetCode}>
            <input className="input" value={form.assetCode} onChange={(e) => setForm({ ...form, assetCode: e.target.value })} disabled={isEdit} placeholder="DL-AST-0001" />
          </FormField>
          <FormField label="Asset name" required error={errors.name}>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Category" required error={errors.type}>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={ASSET_TYPES} placeholder="Select" />
          </FormField>
          <FormField label="Brand">
            <input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          </FormField>
          <FormField label="Model">
            <input className="input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Serial number">
            <input className="input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
          </FormField>
          <FormField label="Location">
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bengaluru HQ — Floor 3" />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Purchase date">
            <input type="date" className="input" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          </FormField>
          <FormField label="Purchase value" error={errors.purchaseValue}>
            <input type="number" min="0" className="input" value={form.purchaseValue} onChange={(e) => setForm({ ...form, purchaseValue: e.target.value })} />
          </FormField>
          <FormField label="Condition">
            <Select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} options={ASSET_CONDITIONS} />
          </FormField>
        </div>
        <FormField label="Notes">
          <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create asset'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AssignAssetModal({ asset, onClose, onSaved }) {
  const empty = { employeeId: '', assignedAt: new Date().toISOString().slice(0, 10), conditionAtAssignment: 'GOOD', notes: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const employees = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeeAPI.options(),
    enabled: Boolean(asset),
    staleTime: 5 * 60 * 1000,
  });
  const staff = employees.data?.data?.data?.managers || [];

  const save = useMutation({
    mutationFn: (data) => assetAPI.assign(asset._id, data),
    onSuccess: () => { toast.success('Asset assigned'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    if (!form.employeeId) { setErrors({ employeeId: 'Choose an employee.' }); return; }
    save.mutate(form);
  };

  return (
    <Modal open={Boolean(asset)} onClose={close} title="Assign asset" description={asset ? `${asset.assetCode} — ${asset.name}` : ''}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Employee" required error={errors.employeeId}>
          <Select
            value={form.employeeId}
            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            options={staff.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
            placeholder="Select an employee"
          />
        </FormField>
        <FormField label="Assigned date" required>
          <input type="date" className="input" value={form.assignedAt} onChange={(e) => setForm({ ...form, assignedAt: e.target.value })} />
        </FormField>
        <FormField label="Condition">
          <Select value={form.conditionAtAssignment} onChange={(e) => setForm({ ...form, conditionAtAssignment: e.target.value })} options={ASSET_CONDITIONS} />
        </FormField>
        <FormField label="Notes">
          <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Assigning…' : 'Assign asset'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ReturnAssetModal({ asset, onClose, onSaved }) {
  const empty = { returnedAt: new Date().toISOString().slice(0, 10), conditionAtReturn: 'GOOD', status: 'AVAILABLE', notes: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (data) => assetAPI.returnAsset(asset._id, data),
    onSuccess: () => { toast.success('Asset returned'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    save.mutate(form);
  };

  return (
    <Modal open={Boolean(asset)} onClose={close} title="Return asset" description={asset ? `${asset.assetCode} — ${asset.name} (currently with ${asset.assignedTo?.fullName || 'employee'})` : ''}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Return date" required>
          <input type="date" className="input" value={form.returnedAt} onChange={(e) => setForm({ ...form, returnedAt: e.target.value })} />
        </FormField>
        <FormField label="Condition on return" required error={errors.conditionAtReturn}>
          <Select value={form.conditionAtReturn} onChange={(e) => setForm({ ...form, conditionAtReturn: e.target.value })} options={ASSET_CONDITIONS} />
        </FormField>
        <FormField label="Set asset status to" hint="Send to maintenance instead of making it available again if it needs repair.">
          <Select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'AVAILABLE', label: 'Available' }, { value: 'MAINTENANCE', label: 'Maintenance' }, { value: 'RETIRED', label: 'Retired' }]}
          />
        </FormField>
        <FormField label="Notes">
          <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Returning…' : 'Return asset'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AssetHistoryModal({ asset, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', 'history', asset?._id],
    queryFn: () => assetAPI.history(asset._id),
    enabled: Boolean(asset),
  });
  const history = data?.data?.data || [];

  return (
    <Modal open={Boolean(asset)} onClose={onClose} size="lg" title="Assignment history" description={asset ? `${asset.assetCode} — ${asset.name}` : ''}>
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />)}</div>
        ) : error ? (
          <p className="text-sm text-red-600">{errorMessage(error)}</p>
        ) : !history.length ? (
          <EmptyState icon={History} title="No assignment history" description="This asset has not been assigned to anyone yet." />
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h._id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={h.employee?.fullName} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{h.employee?.fullName}</p>
                      <p className="text-xs text-gray-400">{h.employee?.employeeCode} · {h.employee?.department}</p>
                    </div>
                  </div>
                  <StatusBadge status={h.returnedAt ? 'RETURNED' : 'ASSIGNED'} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <InfoRow label="Assigned" value={formatDate(h.assignedAt)} />
                  <InfoRow label="Returned" value={h.returnedAt ? formatDate(h.returnedAt) : '—'} />
                  <InfoRow label="Condition out" value={h.conditionAtAssignment} />
                  <InfoRow label="Condition in" value={h.conditionAtReturn || '—'} />
                </div>
                {h.notes && <p className="mt-2 text-xs text-gray-500">{h.notes}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
