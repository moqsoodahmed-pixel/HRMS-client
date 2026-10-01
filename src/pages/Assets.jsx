import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Package, Plus, UserPlus, Undo2, History, Boxes, CheckCircle2, Wrench, XCircle,
  Pencil, QrCode, Download, Printer, AlertTriangle, Clock, ChevronRight,
  ArrowRightLeft, ShieldCheck, RotateCcw, MoreHorizontal, X, Info,
  FileDown, Building2, Tag, MapPin, Hash, CalendarDays, DollarSign,
  ClipboardList, Cpu, Wifi, Monitor, Smartphone, Tablet, Archive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { assetAPI, employeeAPI } from '../api/axios';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, StatCardSkeleton, DataTable, Pagination, FilterBar, SearchInput,
  Select, Modal, FormField, StatusBadge, Avatar, EmptyState, InfoRow,
} from '../components/ui';
import { ASSET_STATUSES, ASSET_STATUS_LABELS, ASSET_CONDITIONS, ASSET_TYPES } from '../constants';
import { formatCurrency, formatDate, errorMessage, fieldErrors } from '../lib/format';

const PAGE_SIZE = 20;

const COMPANIES = [
  { value: 'DutyLaunch', label: 'DutyLaunch' },
  { value: 'LauncherDesk', label: 'LauncherDesk' },
];

const COMPANY_PREFIX = { DutyLaunch: 'DL', LauncherDesk: 'LD' };

const CATEGORY_PREFIX = {
  Laptop: 'LAP', Desktop: 'DSK', Monitor: 'MON', Mobile: 'MOB', Tablet: 'TAB',
  Peripheral: 'PER', Furniture: 'FUR', Networking: 'NET', 'Software Licence': 'SFT', Other: 'OTH',
};

const STATUS_ACTIONS = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  MAINTENANCE: 'maintenance',
  UNDER_REPAIR: 'maintenance',
  RETIRED: 'retired',
  DISPOSED: 'retired',
  LOST: 'lost',
  RETURNED: 'returned',
  TRANSFERRED: 'transferred',
};

function exportCSV(assets) {
  const headers = ['Asset Code', 'Name', 'Company', 'Category', 'Brand', 'Model', 'Serial', 'Status', 'Condition', 'Assigned To', 'Location'];
  const rows = assets.map((a) => [
    a.assetCode, a.name, a.company || '', a.type, a.brand || '', a.model || '',
    a.serialNumber || '', a.status, a.condition,
    a.assignedTo?.fullName || '', a.location || '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url; el.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`; el.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Debounce hook                                                        */
/* ------------------------------------------------------------------ */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */
export default function Assets() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 400);
  const [filters, setFilters] = useState({
    company: '',
    category: '',
    status: searchParams.get('status') || '',
  });
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [returning, setReturning] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [viewingQR, setViewingQR] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);

  const setFilter = useCallback((key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, []);

  const queryFilters = useMemo(() => ({
    search,
    company: filters.company,
    type: filters.category,
    status: filters.status,
  }), [search, filters]);

  const listQuery = useQuery({
    queryKey: ['assets', 'list', queryFilters, page],
    queryFn: () => assetAPI.list({ ...queryFilters, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({ queryKey: ['assets', 'stats'], queryFn: () => assetAPI.stats() });

  const rows = listQuery.data?.data?.data || [];
  const meta = listQuery.data?.data?.meta;
  const stats = statsQuery.data?.data?.data;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['assets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [queryClient]);

  const resetFilters = () => {
    setSearchRaw('');
    setFilters({ company: '', category: '', status: '' });
    setPage(1);
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = () => setOpenMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenu]);

  const columns = useMemo(() => [
    {
      key: 'code',
      header: 'Asset Code',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
          {row.assetCode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Asset Name',
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900 text-sm">{row.name}</p>
          <p className="truncate text-xs text-gray-400">{[row.brand, row.model].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
          <Building2 className="h-3 w-3 shrink-0" />
          {row.company || '—'}
        </span>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <span className="text-xs text-gray-600">{row.type || row.assetCategory || '—'}</span> },
    {
      key: 'condition',
      header: 'Condition',
      render: (row) => row.condition ? (
        <StatusBadge status={row.condition} label={row.condition} />
      ) : <span className="text-gray-400 text-xs">—</span>,
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: (row) => row.assignedTo ? (
        <div className="flex items-center gap-2">
          <Avatar name={row.assignedTo.fullName} size="sm" />
          <span className="truncate text-xs text-gray-700">{row.assignedTo.fullName}</span>
        </div>
      ) : <span className="text-gray-400 text-xs">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} label={ASSET_STATUS_LABELS[row.status] || row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {can('manageAssets') && (
            <button
              type="button"
              title="Edit asset"
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-primary-600 transition-colors"
              onClick={() => setEditing(row)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {can('manageAssets') && row.status === 'AVAILABLE' && (
            <button
              type="button"
              title="Assign to employee"
              className="rounded p-1.5 text-gray-500 hover:bg-green-50 hover:text-green-600 transition-colors"
              onClick={() => setAssigning(row)}
            >
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          )}
          {can('manageAssets') && row.status === 'ASSIGNED' && (
            <button
              type="button"
              title="Return asset"
              className="rounded p-1.5 text-gray-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
              onClick={() => setReturning(row)}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            title="View QR code"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
            onClick={() => setViewingQR(row)}
          >
            <QrCode className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Assignment history"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setViewingHistory(row)}
          >
            <History className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ], [can]);

  const maintenanceCount = (stats?.maintenance ?? 0) + (stats?.underRepair ?? 0);
  const retiredCount = (stats?.retired ?? 0) + (stats?.disposed ?? 0) + (stats?.lost ?? 0);
  const warrantySoonCount = stats?.warrantySoon ?? stats?.expiringWarranty ?? 0;

  return (
    <div>
      <PageHeader
        title="Asset Management"
        subtitle="Track company equipment inventory, assignments and warranty"
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center gap-1.5"
              onClick={() => exportCSV(rows)}
              disabled={!rows.length}
            >
              <FileDown className="h-4 w-4" /> Export
            </button>
            {can('manageAssets') && (
              <button type="button" className="btn-primary flex items-center gap-1.5" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New Asset
              </button>
            )}
          </div>
        )}
      />

      {/* Stat Cards */}
      {statsQuery.isLoading ? <StatCardSkeleton count={6} /> : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Assets" value={stats?.total ?? 0} icon={Boxes} tone="indigo" hint={formatCurrency(stats?.totalValue, { compact: true })} onClick={() => { setFilter('status', ''); }} />
          <StatCard label="Available" value={stats?.available ?? 0} icon={CheckCircle2} tone="green" onClick={() => setFilter('status', 'AVAILABLE')} />
          <StatCard label="Assigned" value={stats?.assigned ?? 0} icon={Package} tone="blue" onClick={() => setFilter('status', 'ASSIGNED')} />
          <StatCard label="Maintenance" value={maintenanceCount} icon={Wrench} tone="amber" hint="incl. under repair" onClick={() => setFilter('status', 'MAINTENANCE')} />
          <StatCard label="Lost / Retired" value={retiredCount} icon={XCircle} tone="red" onClick={() => setFilter('status', 'RETIRED')} />
          <StatCard label="Warranty Soon" value={warrantySoonCount} icon={AlertTriangle} tone="orange" hint="expiring in 30 days" />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6">
        <FilterBar onReset={resetFilters}>
          <SearchInput
            className="min-w-[14rem] flex-1"
            value={searchRaw}
            onChange={(v) => { setSearchRaw(v); setPage(1); }}
            placeholder="Search code, name, serial, brand…"
          />
          <div>
            <label className="label">Company</label>
            <Select
              className="w-40"
              value={filters.company}
              onChange={(e) => setFilter('company', e.target.value)}
              options={COMPANIES}
              placeholder="All companies"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <Select
              className="w-44"
              value={filters.category}
              onChange={(e) => setFilter('category', e.target.value)}
              options={ASSET_TYPES.map((t) => ({ value: t, label: t }))}
              placeholder="All categories"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <Select
              className="w-40"
              value={filters.status}
              onChange={(e) => setFilter('status', e.target.value)}
              options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] || s }))}
              placeholder="All statuses"
            />
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
              description={can('manageAssets') ? 'Add your first asset to start tracking company equipment.' : 'No assets match the current filters.'}
              action={can('manageAssets') ? (
                <button type="button" className="btn-primary flex items-center gap-1.5" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New Asset
                </button>
              ) : null}
            />
          }
          footer={<Pagination page={meta?.page || 1} totalPages={meta?.totalPages} total={meta?.total} limit={PAGE_SIZE} onChange={setPage} />}
        />
      </div>

      {/* Modals */}
      <AssetFormModal
        open={creating || Boolean(editing)}
        asset={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={refresh}
      />
      <AssignAssetModal asset={assigning} onClose={() => setAssigning(null)} onSaved={refresh} />
      <ReturnAssetModal asset={returning} onClose={() => setReturning(null)} onSaved={refresh} />
      <AssetHistoryModal asset={viewingHistory} onClose={() => setViewingHistory(null)} />
      <AssetQRModal asset={viewingQR} onClose={() => setViewingQR(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabbed Asset Form Modal                                             */
/* ------------------------------------------------------------------ */
const FORM_TABS = ['Details', 'Warranty', 'Assignment'];
const EMPTY_FORM = {
  company: '', name: '', type: '', brand: '', model: '', serialNumber: '',
  purchaseDate: '', purchaseValue: '', condition: 'NEW', status: 'AVAILABLE',
  location: '', department: '', branch: '', floor: '', notes: '',
  warrantyStart: '', warrantyEnd: '', hasAMC: false, amcStart: '', amcEnd: '',
  vendorName: '', vendorContact: '', invoiceNumber: '', poNumber: '', serviceCenter: '',
};

function warrantyStatus(start, end) {
  if (!end) return null;
  const now = new Date();
  const endDate = new Date(end);
  const days = Math.ceil((endDate - now) / 86400000);
  if (days < 0) return { label: 'Expired', tone: 'red' };
  if (days <= 30) return { label: `Expiring in ${days}d`, tone: 'orange' };
  return { label: 'Active', tone: 'green' };
}

function AssetFormModal({ open, asset, onClose, onSaved }) {
  const isEdit = Boolean(asset);
  const [tab, setTab] = useState('Details');
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  if (open && isEdit && loadedFor !== asset._id) {
    setForm({
      company: asset.company || '',
      name: asset.name || '',
      type: asset.type || asset.assetCategory || '',
      brand: asset.brand || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      purchaseDate: asset.purchaseDate?.slice(0, 10) || '',
      purchaseValue: asset.purchaseValue ?? '',
      condition: asset.condition || 'NEW',
      status: asset.status || 'AVAILABLE',
      location: asset.location || '',
      department: asset.department || '',
      branch: asset.branch || '',
      floor: asset.floor || '',
      notes: asset.notes || '',
      warrantyStart: asset.warrantyStart?.slice(0, 10) || '',
      warrantyEnd: asset.warrantyEnd?.slice(0, 10) || '',
      hasAMC: asset.amc ?? asset.hasAMC ?? false,
      amcStart: asset.amcStart?.slice(0, 10) || '',
      amcEnd: asset.amcEnd?.slice(0, 10) || '',
      vendorName: asset.vendorName || '',
      vendorContact: asset.vendorContact || '',
      invoiceNumber: asset.invoiceNumber || '',
      poNumber: asset.poNumber || '',
      serviceCenter: asset.serviceCenter || '',
    });
    setLoadedFor(asset._id);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? assetAPI.update(asset._id, data) : assetAPI.create(data)),
    onSuccess: () => { toast.success(isEdit ? 'Asset updated' : 'Asset created'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(EMPTY_FORM); setErrors({}); setLoadedFor(null); setTab('Details'); onClose(); }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = 'Asset name is required.';
    if (!form.type) next.type = 'Choose a category.';
    if (!isEdit && !form.company) next.company = 'Choose a company.';
    if (form.purchaseValue !== '' && Number(form.purchaseValue) < 0) next.purchaseValue = 'Value cannot be negative.';
    setErrors(next);
    if (Object.keys(next).length) { setTab('Details'); return; }
    const payload = { ...form };
    // The Category dropdown is stored in `form.type`; the API requires it under
    // `assetCategory` as well. Send both so server validation + code generation work.
    payload.assetCategory = form.type;
    // The AMC checkbox is stored as `hasAMC`; the API/model field is `amc`.
    payload.amc = !!form.hasAMC;
    delete payload.hasAMC;
    if (payload.purchaseValue !== '') payload.purchaseValue = Number(payload.purchaseValue);
    else delete payload.purchaseValue;
    save.mutate(payload);
  };

  const codePreview = !isEdit && form.company && form.type
    ? `${COMPANY_PREFIX[form.company] || 'XX'}-${CATEGORY_PREFIX[form.type] || 'OTH'}-XXX`
    : null;

  const wStatus = warrantyStatus(form.warrantyStart, form.warrantyEnd);

  return (
    <Modal open={open} onClose={close} size="xl" title={isEdit ? `Edit — ${asset?.assetCode}` : 'New Asset'}>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 px-5 pt-1">
        {FORM_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`mr-4 border-b-2 pb-2.5 text-sm font-medium transition-colors ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        {/* ---- Details Tab ---- */}
        {tab === 'Details' && (
          <div className="space-y-4 p-5">
            {isEdit && (
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                <Hash className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Asset Code</p>
                  <p className="font-mono text-sm font-bold text-gray-900">{asset.assetCode}</p>
                </div>
              </div>
            )}
            {!isEdit && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Company" required error={errors.company}>
                  <Select
                    value={form.company}
                    onChange={(e) => set('company', e.target.value)}
                    options={COMPANIES}
                    placeholder="Select company"
                  />
                </FormField>
                <FormField label="Category" required error={errors.type}>
                  <Select
                    value={form.type}
                    onChange={(e) => set('type', e.target.value)}
                    options={ASSET_TYPES.map((t) => ({ value: t, label: t }))}
                    placeholder="Select category"
                  />
                </FormField>
              </div>
            )}
            {codePreview && (
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Asset code will be auto-assigned: <span className="font-mono font-semibold ml-1">{codePreview}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isEdit && (
                <FormField label="Company">
                  <input className="input bg-gray-50 cursor-not-allowed" value={form.company} readOnly disabled />
                </FormField>
              )}
              {isEdit && (
                <FormField label="Category">
                  <input className="input bg-gray-50 cursor-not-allowed" value={form.type} readOnly disabled />
                </FormField>
              )}
              <FormField label="Asset Name" required error={errors.name} className={isEdit ? '' : 'sm:col-span-2'}>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. MacBook Pro 14-inch" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Brand">
                <input className="input" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Apple" />
              </FormField>
              <FormField label="Model">
                <input className="input" value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="MNEH3HN/A" />
              </FormField>
              <FormField label="Serial Number">
                <input className="input font-mono" value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} placeholder="C02XK1XXJGH7" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Purchase Date">
                <input type="date" className="input" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
              </FormField>
              <FormField label="Purchase Value" error={errors.purchaseValue}>
                <input type="number" min="0" step="0.01" className="input" value={form.purchaseValue} onChange={(e) => set('purchaseValue', e.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Condition">
                <Select value={form.condition} onChange={(e) => set('condition', e.target.value)} options={ASSET_CONDITIONS.map((c) => ({ value: c, label: c }))} />
              </FormField>
            </div>
            {isEdit && (
              <FormField label="Status">
                <Select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  options={ASSET_STATUSES.map((s) => ({ value: s, label: ASSET_STATUS_LABELS[s] || s }))}
                />
              </FormField>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Location">
                <input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Bengaluru HQ" />
              </FormField>
              <FormField label="Department">
                <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Engineering" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Branch">
                <input className="input" value={form.branch} onChange={(e) => set('branch', e.target.value)} placeholder="Bengaluru" />
              </FormField>
              <FormField label="Floor">
                <input className="input" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="Floor 3" />
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any additional notes…" />
            </FormField>
          </div>
        )}

        {/* ---- Warranty Tab ---- */}
        {tab === 'Warranty' && (
          <div className="space-y-4 p-5">
            {wStatus && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium
                ${wStatus.tone === 'green' ? 'bg-green-50 border border-green-100 text-green-700'
                  : wStatus.tone === 'orange' ? 'bg-orange-50 border border-orange-100 text-orange-700'
                    : 'bg-red-50 border border-red-100 text-red-700'}`}
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Warranty status: {wStatus.label}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Warranty Start">
                <input type="date" className="input" value={form.warrantyStart} onChange={(e) => set('warrantyStart', e.target.value)} />
              </FormField>
              <FormField label="Warranty End">
                <input type="date" className="input" value={form.warrantyEnd} onChange={(e) => set('warrantyEnd', e.target.value)} />
              </FormField>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <input
                id="hasAMC"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={form.hasAMC}
                onChange={(e) => set('hasAMC', e.target.checked)}
              />
              <label htmlFor="hasAMC" className="text-sm font-medium text-gray-700">Annual Maintenance Contract (AMC)</label>
            </div>
            {form.hasAMC && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="AMC Start">
                  <input type="date" className="input" value={form.amcStart} onChange={(e) => set('amcStart', e.target.value)} />
                </FormField>
                <FormField label="AMC End">
                  <input type="date" className="input" value={form.amcEnd} onChange={(e) => set('amcEnd', e.target.value)} />
                </FormField>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Vendor Name">
                <input className="input" value={form.vendorName} onChange={(e) => set('vendorName', e.target.value)} placeholder="e.g. Apple India" />
              </FormField>
              <FormField label="Vendor Contact">
                <input className="input" value={form.vendorContact} onChange={(e) => set('vendorContact', e.target.value)} placeholder="Phone or email" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Invoice Number">
                <input className="input font-mono" value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} />
              </FormField>
              <FormField label="PO Number">
                <input className="input font-mono" value={form.poNumber} onChange={(e) => set('poNumber', e.target.value)} />
              </FormField>
              <FormField label="Service Center">
                <input className="input" value={form.serviceCenter} onChange={(e) => set('serviceCenter', e.target.value)} />
              </FormField>
            </div>
          </div>
        )}

        {/* ---- Assignment Tab (read-only overview) ---- */}
        {tab === 'Assignment' && (
          <div className="p-5 space-y-4">
            {asset?.assignedTo ? (
              <>
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <Avatar name={asset.assignedTo.fullName} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{asset.assignedTo.fullName}</p>
                    <p className="text-xs text-gray-500">{asset.assignedTo.employeeCode} · {asset.assignedTo.department || '—'}</p>
                  </div>
                  <StatusBadge status="ASSIGNED" label="Assigned" className="ml-auto" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <InfoRow label="Assigned on" value={formatDate(asset.assignedAt)} />
                  <InfoRow label="Expected return" value={asset.expectedReturn ? formatDate(asset.expectedReturn) : '—'} />
                  <InfoRow label="Condition out" value={asset.conditionAtAssignment || '—'} />
                  <InfoRow label="Department" value={asset.assignedDepartment || '—'} />
                </div>
              </>
            ) : (
              <EmptyState icon={UserPlus} title="Not assigned" description="This asset is currently not assigned to anyone." />
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          {tab !== 'Assignment' && (
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create asset'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Assign Asset Modal                                                  */
/* ------------------------------------------------------------------ */
function AssignAssetModal({ asset, onClose, onSaved }) {
  const empty = {
    employeeId: '',
    assignedAt: new Date().toISOString().slice(0, 10),
    expectedReturn: '',
    conditionAtAssignment: 'GOOD',
    department: '',
    branch: '',
    floor: '',
    notes: '',
  };
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
    onSuccess: () => { toast.success('Asset assigned successfully'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    if (!form.employeeId) { setErrors({ employeeId: 'Choose an employee.' }); return; }
    save.mutate(form);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Modal
      open={Boolean(asset)}
      onClose={close}
      size="lg"
      title="Assign Asset"
      description={asset ? `${asset.assetCode} — ${asset.name}` : ''}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Employee" required error={errors.employeeId}>
          <Select
            value={form.employeeId}
            onChange={(e) => set('employeeId', e.target.value)}
            options={staff.map((m) => ({ value: m._id, label: `${m.fullName} (${m.employeeCode})` }))}
            placeholder={employees.isLoading ? 'Loading…' : 'Select an employee'}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Assigned Date" required>
            <input type="date" className="input" value={form.assignedAt} onChange={(e) => set('assignedAt', e.target.value)} />
          </FormField>
          <FormField label="Expected Return Date">
            <input type="date" className="input" value={form.expectedReturn} onChange={(e) => set('expectedReturn', e.target.value)} />
          </FormField>
        </div>
        <FormField label="Condition at Assignment">
          <Select
            value={form.conditionAtAssignment}
            onChange={(e) => set('conditionAtAssignment', e.target.value)}
            options={ASSET_CONDITIONS.map((c) => ({ value: c, label: c }))}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Department">
            <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Engineering" />
          </FormField>
          <FormField label="Branch">
            <input className="input" value={form.branch} onChange={(e) => set('branch', e.target.value)} placeholder="Bengaluru" />
          </FormField>
          <FormField label="Floor">
            <input className="input" value={form.floor} onChange={(e) => set('floor', e.target.value)} placeholder="Floor 3" />
          </FormField>
        </div>
        <FormField label="Notes">
          <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Assigning…' : 'Assign Asset'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Return Asset Modal                                                  */
/* ------------------------------------------------------------------ */
function ReturnAssetModal({ asset, onClose, onSaved }) {
  const empty = { returnedAt: new Date().toISOString().slice(0, 10), conditionAtReturn: 'GOOD', status: 'AVAILABLE', notes: '' };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: (data) => assetAPI.returnAsset(asset._id, data),
    onSuccess: () => { toast.success('Asset returned successfully'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    save.mutate(form);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Modal
      open={Boolean(asset)}
      onClose={close}
      title="Return Asset"
      description={asset ? `${asset.assetCode} — ${asset.name} (with ${asset.assignedTo?.fullName || 'employee'})` : ''}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Return Date" required>
          <input type="date" className="input" value={form.returnedAt} onChange={(e) => set('returnedAt', e.target.value)} />
        </FormField>
        <FormField label="Condition on Return" required error={errors.conditionAtReturn}>
          <Select
            value={form.conditionAtReturn}
            onChange={(e) => set('conditionAtReturn', e.target.value)}
            options={ASSET_CONDITIONS.map((c) => ({ value: c, label: c }))}
          />
        </FormField>
        <FormField
          label="Post-Return Status"
          hint="Choose Maintenance if the asset needs repair before re-use."
        >
          <Select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={[
              { value: 'AVAILABLE', label: 'Available' },
              { value: 'MAINTENANCE', label: 'Maintenance' },
              { value: 'RETIRED', label: 'Retired' },
            ]}
          />
        </FormField>
        <FormField label="Notes">
          <textarea className="input min-h-[70px]" maxLength={500} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Processing…' : 'Confirm Return'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Assignment History Modal                                            */
/* ------------------------------------------------------------------ */
function AssetHistoryModal({ asset, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', 'history', asset?._id],
    queryFn: () => assetAPI.history(asset._id),
    enabled: Boolean(asset),
  });
  const history = data?.data?.data || [];

  return (
    <Modal open={Boolean(asset)} onClose={onClose} size="lg" title="Assignment History" description={asset ? `${asset.assetCode} — ${asset.name}` : ''}>
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}</div>
        ) : error ? (
          <p className="text-sm text-red-600">{errorMessage(error)}</p>
        ) : !history.length ? (
          <EmptyState icon={History} title="No assignment history" description="This asset has not been assigned to anyone yet." />
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h._id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={h.employee?.fullName} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{h.employee?.fullName}</p>
                      <p className="text-xs text-gray-400">{h.employee?.employeeCode} · {h.employee?.department}</p>
                    </div>
                  </div>
                  <StatusBadge status={h.returnedAt ? 'RETURNED' : 'ASSIGNED'} label={h.returnedAt ? 'Returned' : 'Active'} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <InfoRow label="Assigned" value={formatDate(h.assignedAt)} />
                  <InfoRow label="Returned" value={h.returnedAt ? formatDate(h.returnedAt) : '—'} />
                  <InfoRow label="Condition out" value={h.conditionAtAssignment || '—'} />
                  <InfoRow label="Condition in" value={h.conditionAtReturn || '—'} />
                </div>
                {h.notes && <p className="mt-2 text-xs text-gray-500 italic">{h.notes}</p>}
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

/* ------------------------------------------------------------------ */
/* QR Code Modal                                                       */
/* ------------------------------------------------------------------ */
function AssetQRModal({ asset, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', 'qr', asset?._id],
    queryFn: () => api.get(`/assets/${asset._id}/qr`),
    enabled: Boolean(asset),
    staleTime: 10 * 60 * 1000,
  });

  const qrCode = data?.data?.data?.qrCode || data?.data?.qrCode;

  function downloadQR() {
    if (!qrCode) return;
    const el = document.createElement('a');
    el.href = qrCode;
    el.download = `${asset.assetCode}-qr.png`;
    el.click();
  }

  function printQR() {
    if (!qrCode) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>${asset.assetCode} QR</title>
      <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;padding:2rem}
      img{max-width:250px}h2{margin:0.5rem 0 0.25rem}p{margin:0;color:#666;font-size:0.85rem}</style>
      </head><body>
      <img src="${qrCode}" />
      <h2>${asset.assetCode}</h2>
      <p>${asset.name}</p>
      <p>${asset.company || ''} · S/N: ${asset.serialNumber || 'N/A'}</p>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <Modal open={Boolean(asset)} onClose={onClose} title="Asset QR Code" description={asset ? `${asset.assetCode} — ${asset.name}` : ''}>
      <div className="p-5 flex flex-col items-center gap-4">
        {isLoading ? (
          <div className="h-48 w-48 animate-pulse rounded-xl bg-gray-100" />
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-center py-6">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="text-sm text-gray-600">Could not load QR code</p>
            <p className="text-xs text-gray-400">{errorMessage(error)}</p>
          </div>
        ) : qrCode ? (
          <>
            <div className="rounded-2xl border-2 border-gray-200 p-3 bg-white shadow-sm">
              <img src={qrCode} alt={`QR code for ${asset?.assetCode}`} className="h-48 w-48 object-contain" />
            </div>
            <div className="text-center space-y-0.5">
              <p className="font-mono text-sm font-bold text-gray-900">{asset?.assetCode}</p>
              <p className="text-sm text-gray-600">{asset?.name}</p>
              <p className="text-xs text-gray-400">{asset?.company} · S/N: {asset?.serialNumber || 'N/A'}</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn-secondary flex items-center gap-1.5" onClick={downloadQR}>
                <Download className="h-4 w-4" /> Download PNG
              </button>
              <button type="button" className="btn-secondary flex items-center gap-1.5" onClick={printQR}>
                <Printer className="h-4 w-4" /> Print
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-sm text-gray-500">No QR code available for this asset.</div>
        )}
        <button type="button" className="btn-secondary w-full mt-2" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}