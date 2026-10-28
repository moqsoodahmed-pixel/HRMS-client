import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserMinus, CheckCircle2, Clock, ListChecks, AlertTriangle, ShieldCheck,
  Laptop, Wallet, Package, ClipboardCheck, XCircle, CalendarClock, Download,
  Send, UserCheck, AlertCircle, FileText, Ban, Building2, BellRing, Eye,
  RefreshCw, Check, X, FileSignature
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exitRequestAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, StatCard, DataTable, FilterBar, SearchInput, Select,
  Modal, FormField, StatusBadge, Avatar, EmptyState, ProgressBar, LoadingBlock,
  ErrorState, InfoRow, Tabs
} from '../components/ui';
import { DEPARTMENTS, EXIT_REQUEST_STATUSES } from '../constants';
import { formatCurrency, formatDate, errorMessage } from '../lib/format';

export default function Offboarding() {
  const { user, can } = useAuth();
  const [selectedExit, setSelectedExit] = useState(null);
  const [filters, setFilters] = useState({ status: '', department: '', search: '' });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['exit-requests', filters],
    queryFn: () => exitRequestAPI.list(filters),
  });

  const rows = query.data?.data?.data || [];

  // Metrics
  const total = rows.length;
  const pending = rows.filter(r => ['PENDING', 'UNDER_REVIEW', 'CHANGES_REQUESTED'].includes(r.status)).length;
  const inNotice = rows.filter(r => ['APPROVED', 'OFFBOARDING_IN_PROGRESS', 'FNF_PROCESSING'].includes(r.status)).length;
  const completed = rows.filter(r => r.status === 'COMPLETED').length;
  const assetsPendingCount = rows.filter(r => r.assetReturns?.some(a => a.status === 'Pending')).length;
  const fnfPendingCount = rows.filter(r => r.status === 'APPROVED' && (!r.fnfDetails || r.fnfDetails.status !== 'PAID')).length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['exit-requests'] });
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Exit Management Hub"
        subtitle="Manage end-to-end corporate employee separations, multi-level approvals, offboarding clearances, assets, FNF, and documents."
      />

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Exits"
          value={total}
          icon={UserMinus}
          tone="indigo"
          onClick={() => setFilters(f => ({ ...f, status: '' }))}
        />
        <StatCard
          label="Pending Review"
          value={pending}
          icon={Clock}
          tone="amber"
          onClick={() => setFilters(f => ({ ...f, status: 'PENDING' }))}
        />
        <StatCard
          label="In Notice Period"
          value={inNotice}
          icon={CalendarClock}
          tone="blue"
          onClick={() => setFilters(f => ({ ...f, status: 'APPROVED' }))}
        />
        <StatCard
          label="Assets Pending"
          value={assetsPendingCount}
          icon={Package}
          tone="orange"
        />
        <StatCard
          label="FNF Pending"
          value={fnfPendingCount}
          icon={Wallet}
          tone="purple"
        />
        <StatCard
          label="Completed"
          value={completed}
          icon={CheckCircle2}
          tone="green"
          onClick={() => setFilters(f => ({ ...f, status: 'COMPLETED' }))}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4">
        <FilterBar onReset={() => setFilters({ status: '', department: '', search: '' })}>
          <SearchInput
            className="min-w-[14rem] flex-1"
            value={filters.search}
            onChange={(v) => setFilters({ ...filters, search: v })}
            placeholder="Search employee by name or ID code…"
          />
          <div>
            <label className="label">Department</label>
            <Select
              className="w-44"
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              options={DEPARTMENTS}
              placeholder="All departments"
            />
          </div>
          <div>
            <label className="label">Status</label>
            <Select
              className="w-44"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              options={EXIT_REQUEST_STATUSES}
              placeholder="All statuses"
            />
          </div>
        </FilterBar>

        {/* Data Table */}
        <div className="mt-4">
          <DataTable
            columns={[
              {
                key: 'employee',
                header: 'Employee',
                render: (r) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={r.employee?.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{r.employee?.fullName}</p>
                      <p className="truncate text-xs text-gray-400">{r.employee?.employeeCode}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'department',
                header: 'Department / Role',
                render: (r) => (
                  <div>
                    <span className="font-medium text-gray-800">{r.employee?.department || '—'}</span>
                    <span className="block text-[11px] text-gray-400">{r.employee?.designation || '—'}</span>
                  </div>
                ),
              },
              {
                key: 'manager',
                header: 'Reporting Manager',
                render: (r) => r.employee?.manager?.fullName || 'Assigned Manager',
              },
              {
                key: 'lwd',
                header: 'Last Working Day',
                render: (r) => (
                  <div>
                    <span className="font-semibold text-gray-900">
                      {formatDate(r.confirmedLastWorkingDate || r.requestedLastWorkingDate)}
                    </span>
                    <span className="block text-[11px] text-gray-400">
                      {r.noticePeriodDays || 30}d notice {r.noticeShortfallDays > 0 ? `(${r.noticeShortfallDays}d shortfall)` : ''}
                    </span>
                  </div>
                ),
              },
              {
                key: 'reason',
                header: 'Reason',
                render: (r) => (
                  <span className="block max-w-[9rem] truncate text-xs text-gray-600" title={r.reason}>
                    {r.reason}
                  </span>
                ),
              },
              {
                key: 'approvalStage',
                header: 'Current Stage',
                render: (r) => (
                  <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {r.currentApprovalStage ? r.currentApprovalStage.replace(/_/g, ' ') : 'Pending'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: 'actions',
                header: 'Action',
                render: (r) => (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs py-1 px-3 flex items-center gap-1 shadow-none"
                      onClick={() => setSelectedExit(r)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Manage
                    </button>
                  </div>
                ),
              },
            ]}
            rows={rows}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            empty={
              <EmptyState
                icon={UserMinus}
                title="No exit requests found"
                description="Employee-submitted resignations and separation workflows will appear here."
              />
            }
          />
        </div>
      </div>

      {/* COMPREHENSIVE EXIT MANAGEMENT MODAL */}
      {selectedExit && (
        <ExitManagementModal
          exitId={selectedExit._id}
          onClose={() => setSelectedExit(null)}
          onChanged={() => {
            refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * COMPREHENSIVE EXIT MANAGEMENT MODAL
 * Includes: Approval Engine, Offboarding Checklist, Assets, FNF, Documents, Complete Exit
 */
function ExitManagementModal({ exitId, onClose, onChanged }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('approval');

  // Fetch full details
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exit-request', exitId],
    queryFn: () => exitRequestAPI.get(exitId),
  });

  const exit = data?.data?.data;
  const emp = exit?.employee;

  // Review stage mutation
  const [reviewForm, setReviewForm] = useState({
    stage: 'HR',
    action: 'APPROVE',
    notes: '',
    internalComments: '',
    confirmedLastWorkingDate: '',
    overrideNoticePeriodDays: '',
    noticeWaiverApproved: false,
  });

  const reviewMutation = useMutation({
    mutationFn: (body) => exitRequestAPI.reviewStage(exitId, body),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Approval decision recorded successfully.');
      refetch();
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Checklist update mutation
  const checklistMutation = useMutation({
    mutationFn: (body) => exitRequestAPI.updateChecklist(exitId, body),
    onSuccess: () => {
      toast.success('Checklist updated');
      refetch();
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Asset status mutation
  const assetMutation = useMutation({
    mutationFn: (body) => exitRequestAPI.updateAsset(exitId, body),
    onSuccess: () => {
      toast.success('Asset status updated');
      refetch();
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Send asset reminder email
  const reminderMutation = useMutation({
    mutationFn: () => exitRequestAPI.sendAssetReminder(exitId),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Reminder sent to employee');
      refetch();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // FNF update mutation
  const fnfMutation = useMutation({
    mutationFn: (body) => exitRequestAPI.calculateFNF(exitId, body),
    onSuccess: () => {
      toast.success('FNF calculations updated');
      refetch();
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // FNF approval mutation
  const fnfApproveMutation = useMutation({
    mutationFn: () => exitRequestAPI.approveFNF(exitId),
    onSuccess: () => {
      toast.success('FNF statement approved');
      refetch();
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // FNF payment mutation
  const [paymentRef, setPaymentRef] = useState('');
  const fnfPayMutation = useMutation({
    mutationFn: (body) => exitRequestAPI.recordFNFPayment(exitId, body),
    onSuccess: () => {
      toast.success('FNF payment recorded');
      refetch();
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Complete exit mutation
  const completeMutation = useMutation({
    mutationFn: () => exitRequestAPI.complete(exitId),
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Exit completed. Account deactivated and separation letters issued.');
      refetch();
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  // Document download
  const handleDownload = async (docType, docName) => {
    try {
      toast.loading(`Preparing ${docName}...`, { id: 'admin-doc' });
      const res = await exitRequestAPI.downloadDocument(exitId, docType);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${docName.replace(/\s+/g, '_')}_${emp?.fullName || 'Employee'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${docName} downloaded!`, { id: 'admin-doc' });
    } catch (e) {
      toast.error(errorMessage(e) || 'Failed to download document', { id: 'admin-doc' });
    }
  };

  if (isLoading) {
    return (
      <Modal open={true} onClose={onClose} title="Loading Exit Request" size="xl">
        <div className="p-8"><LoadingBlock label="Fetching exit record..." /></div>
      </Modal>
    );
  }

  if (error || !exit) {
    return (
      <Modal open={true} onClose={onClose} title="Error" size="md">
        <div className="p-6"><ErrorState error={error} onRetry={refetch} /></div>
      </Modal>
    );
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`Exit Management — ${emp?.fullName} (${emp?.employeeCode})`}
      size="2xl"
      description="Corporate separation management, multi-stage approval engine, clearances, asset recoveries, FNF, and documents."
    >
      <div className="space-y-6 p-6">
        {/* Top Header Card */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">{emp?.fullName}</h3>
                <StatusBadge status={exit.status} />
                <span className="text-xs bg-primary-100 text-primary-800 font-bold px-2 py-0.5 rounded-full">
                  {exit.currentApprovalStage ? exit.currentApprovalStage.replace(/_/g, ' ') : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {emp?.designation} &bull; {emp?.department} &bull; Official Email: {emp?.officialEmail}
              </p>
            </div>

            <div className="text-right text-xs">
              <span className="text-gray-400 block">Confirmed LWD</span>
              <span className="font-bold text-gray-900 text-sm">
                {formatDate(exit.confirmedLastWorkingDate || exit.requestedLastWorkingDate)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <InfoRow label="Reason" value={exit.reason} />
            <InfoRow label="Notice Period" value={`${exit.noticePeriodDays || 30} days`} />
            <InfoRow label="Notice Shortfall" value={exit.noticeShortfallDays > 0 ? `${exit.noticeShortfallDays} days` : 'None'} />
            <InfoRow label="Reporting Manager" value={emp?.manager?.fullName || 'Assigned Manager'} />
          </div>

          {exit.detailedComments && (
            <div className="mt-3 pt-3 border-t border-gray-200 text-xs">
              <span className="text-gray-400 block mb-0.5 font-medium">Employee Statement:</span>
              <p className="text-gray-700 italic">{exit.detailedComments}</p>
            </div>
          )}
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-gray-200 space-x-4 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'approval', label: 'Approval Workflow', icon: ShieldCheck },
            { id: 'checklist', label: 'Offboarding Checklist', icon: ClipboardCheck },
            { id: 'assets', label: 'Asset Return Register', icon: Package },
            { id: 'fnf', label: 'FNF Payroll Settlement', icon: Wallet },
            { id: 'documents', label: 'Exit Documents', icon: FileSignature },
            { id: 'audit', label: 'Audit Trail & Logs', icon: Clock },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 pb-2.5 pt-1 border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-primary-600 text-primary-600 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: APPROVAL WORKFLOW ENGINE */}
        {tab === 'approval' && (
          <div className="space-y-6">
            {/* Stages overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {exit.approvalStages?.map((stage, i) => (
                <div
                  key={stage._id || i}
                  className={`p-3.5 rounded-lg border text-xs ${
                    stage.status === 'APPROVED'
                      ? 'border-green-200 bg-green-50/60'
                      : stage.status === 'REJECTED'
                      ? 'border-red-200 bg-red-50/60'
                      : stage.status === 'CHANGES_REQUESTED'
                      ? 'border-amber-200 bg-amber-50/60'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold uppercase text-[10px] text-gray-500">Stage {i + 1}: {stage.stage}</span>
                    <StatusBadge status={stage.status} />
                  </div>
                  <p className="font-bold text-gray-900">{stage.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {stage.assignedToEmployee?.fullName ? `Assignee: ${stage.assignedToEmployee.fullName}` : `Role: ${stage.assignedRole}`}
                  </p>
                  {stage.actionAt && (
                    <p className="text-[10px] text-gray-400 mt-1">Decided {formatDate(stage.actionAt)}</p>
                  )}
                  {stage.notes && (
                    <p className="mt-2 p-2 bg-white rounded border border-gray-100 text-gray-700">
                      <strong>Note:</strong> {stage.notes}
                    </p>
                  )}
                  {stage.internalComments && (
                    <p className="mt-1 p-2 bg-white rounded border border-gray-100 text-gray-600 italic">
                      <strong>Internal:</strong> {stage.internalComments}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Approver Decision Form */}
            {exit.status !== 'COMPLETED' && exit.status !== 'REJECTED' && exit.status !== 'CANCELLED' && (
              <div className="card p-5 border border-primary-100 bg-white shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary-600" /> Approver Decision Panel
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Reviewing Stage">
                    <select
                      className="input text-xs"
                      value={reviewForm.stage}
                      onChange={(e) => setReviewForm({ ...reviewForm, stage: e.target.value })}
                    >
                      <option value="MANAGER">Reporting Manager Review</option>
                      <option value="HR">HR Review</option>
                      <option value="LEADERSHIP">Executive Leadership (Founder / CEO / CTO)</option>
                    </select>
                  </FormField>

                  <FormField label="Decision Action">
                    <select
                      className="input text-xs font-bold"
                      value={reviewForm.action}
                      onChange={(e) => setReviewForm({ ...reviewForm, action: e.target.value })}
                    >
                      <option value="APPROVE">Approve Stage</option>
                      <option value="REQUEST_CHANGES">Request Changes from Employee</option>
                      <option value="REJECT">Reject Resignation</option>
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Override Last Working Day (Optional)">
                    <input
                      type="date"
                      className="input text-xs"
                      value={reviewForm.confirmedLastWorkingDate}
                      onChange={(e) => setReviewForm({ ...reviewForm, confirmedLastWorkingDate: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Override Notice Period Days (Optional)">
                    <input
                      type="number"
                      className="input text-xs"
                      placeholder="e.g. 15 or 0"
                      value={reviewForm.overrideNoticePeriodDays}
                      onChange={(e) => setReviewForm({ ...reviewForm, overrideNoticePeriodDays: e.target.value })}
                    />
                  </FormField>
                </div>

                <FormField label="Public Notes (Visible to employee)">
                  <textarea
                    className="input text-xs min-h-[60px]"
                    placeholder="Notes, next steps, or reasons for changes..."
                    value={reviewForm.notes}
                    onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                  />
                </FormField>

                <FormField label="Confidential Internal Comments (Audit & HR only)">
                  <textarea
                    className="input text-xs min-h-[60px]"
                    placeholder="Confidential notes regarding replacement, handover, or severance..."
                    value={reviewForm.internalComments}
                    onChange={(e) => setReviewForm({ ...reviewForm, internalComments: e.target.value })}
                  />
                </FormField>

                <div className="flex justify-between items-center pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={reviewForm.noticeWaiverApproved}
                      onChange={(e) => setReviewForm({ ...reviewForm, noticeWaiverApproved: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    <span>Waive notice shortfall recovery penalty</span>
                  </label>

                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate(reviewForm)}
                  >
                    {reviewMutation.isPending ? 'Recording Decision…' : 'Submit Decision'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OFFBOARDING CHECKLIST */}
        {tab === 'checklist' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Update each department clearance item in real-time.
              </span>
              <span className="text-xs font-bold text-primary-700">
                {exit.offboardingChecklist?.filter(c => c.status === 'COMPLETED').length} of {exit.offboardingChecklist?.length} Cleared
              </span>
            </div>

            <div className="divide-y divide-gray-100 max-h-[380px] overflow-y-auto pr-1">
              {exit.offboardingChecklist?.map((task) => (
                <div key={task._id || task.taskId} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {task.category}
                      </span>
                      <p className="text-xs font-bold text-gray-900">{task.taskName}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{task.description}</p>
                    {task.remarks && (
                      <p className="text-[11px] text-primary-700 italic mt-0.5">Note: {task.remarks}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="input py-1 px-2 text-xs font-semibold w-32"
                      value={task.status}
                      disabled={checklistMutation.isPending}
                      onChange={(e) => {
                        checklistMutation.mutate({
                          taskId: task.taskId || task._id,
                          status: e.target.value,
                          remarks: task.remarks || '',
                        });
                      }}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="WAIVED">Waived</option>
                      <option value="BLOCKED">Blocked</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ASSET RETURN REGISTER */}
        {tab === 'assets' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Inspect physical condition and record return status for company property.
              </span>
              <button
                type="button"
                className="btn-secondary text-xs flex items-center gap-1.5 py-1"
                onClick={() => reminderMutation.mutate()}
                disabled={reminderMutation.isPending}
              >
                <BellRing className="h-3.5 w-3.5 text-amber-600" />
                {reminderMutation.isPending ? 'Sending…' : 'Send Reminder Email'}
              </button>
            </div>

            <div className="divide-y divide-gray-100 max-h-[380px] overflow-y-auto pr-1">
              {exit.assetReturns?.map((asset) => (
                <div key={asset._id || asset.name} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-gray-400" />
                      {asset.name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Code: {asset.assetCode || '—'} &bull; Category: {asset.category}
                      {asset.deductionAmount > 0 && (
                        <span className="text-red-600 font-bold ml-2">
                          Penalty: {formatCurrency(asset.deductionAmount)}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="input py-1 px-2 text-xs font-semibold w-28"
                      value={asset.status}
                      disabled={assetMutation.isPending}
                      onChange={(e) => {
                        assetMutation.mutate({
                          assetReturnId: asset._id,
                          status: e.target.value,
                          condition: asset.condition || 'Verified Good',
                          deductionAmount: asset.deductionAmount || 0,
                        });
                      }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Returned">Returned</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Lost">Lost</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Deduction"
                      className="input py-1 px-2 text-xs w-24"
                      defaultValue={asset.deductionAmount || ''}
                      onBlur={(e) => {
                        const val = Number(e.target.value) || 0;
                        if (val !== asset.deductionAmount) {
                          assetMutation.mutate({
                            assetReturnId: asset._id,
                            status: asset.status,
                            condition: asset.condition || 'Damaged/Lost',
                            deductionAmount: val,
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: FNF PAYROLL SETTLEMENT */}
        {tab === 'fnf' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                Reconcile salary, encashment, notice period recovery, and deductions.
              </span>
              <div className="flex items-center gap-2">
                <StatusBadge status={exit.fnfDetails?.status || 'PENDING'} />
                {exit.fnfDetails?.status !== 'APPROVED' && exit.fnfDetails?.status !== 'PAID' && (
                  <button
                    type="button"
                    className="btn-primary text-xs py-1 px-3"
                    onClick={() => fnfApproveMutation.mutate()}
                    disabled={fnfApproveMutation.isPending}
                  >
                    Approve FNF
                  </button>
                )}
              </div>
            </div>

            {/* FNF Form Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-lg text-xs">
              <div>
                <label className="text-gray-500 block mb-1">Payable Days</label>
                <input
                  type="number"
                  className="input text-xs"
                  defaultValue={exit.fnfDetails?.payableDays || 0}
                  onBlur={(e) => fnfMutation.mutate({ payableDays: e.target.value })}
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Earned Salary</label>
                <input
                  type="number"
                  className="input text-xs"
                  defaultValue={exit.fnfDetails?.earnedSalary || 0}
                  onBlur={(e) => fnfMutation.mutate({ earnedSalary: e.target.value })}
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Leave Encashment</label>
                <input
                  type="number"
                  className="input text-xs"
                  defaultValue={exit.fnfDetails?.leaveEncashment || 0}
                  onBlur={(e) => fnfMutation.mutate({ leaveEncashment: e.target.value })}
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Notice Recovery</label>
                <input
                  type="number"
                  className="input text-xs text-red-600 font-bold"
                  defaultValue={exit.fnfDetails?.noticeRecovery || 0}
                  onBlur={(e) => fnfMutation.mutate({ noticeRecovery: e.target.value })}
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Bonus / Ex-Gratia</label>
                <input
                  type="number"
                  className="input text-xs"
                  defaultValue={exit.fnfDetails?.bonus || 0}
                  onBlur={(e) => fnfMutation.mutate({ bonus: e.target.value })}
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Incentives</label>
                <input
                  type="number"
                  className="input text-xs"
                  defaultValue={exit.fnfDetails?.incentives || 0}
                  onBlur={(e) => fnfMutation.mutate({ incentives: e.target.value })}
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Asset Deductions</label>
                <input
                  type="number"
                  className="input text-xs text-red-600"
                  readOnly
                  value={exit.fnfDetails?.assetDeductions || 0}
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Other Deductions</label>
                <input
                  type="number"
                  className="input text-xs text-red-600"
                  defaultValue={exit.fnfDetails?.otherDeductions || 0}
                  onBlur={(e) => fnfMutation.mutate({ otherDeductions: e.target.value })}
                />
              </div>
            </div>

            {/* Net Amount Box */}
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-green-800 uppercase block">Net Settlement Amount</span>
                <span className="text-2xl font-black text-green-900">
                  {formatCurrency(exit.fnfDetails?.netSettlementAmount || 0)}
                </span>
              </div>

              {exit.fnfDetails?.status !== 'PAID' ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Bank Transfer Ref"
                    className="input text-xs py-1 px-2 w-36"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary text-xs py-1 px-3 bg-green-700 hover:bg-green-800"
                    disabled={fnfPayMutation.isPending}
                    onClick={() => fnfPayMutation.mutate({ paymentReference: paymentRef || 'BANK-TRANSFER', paidDate: new Date() })}
                  >
                    Mark as Paid
                  </button>
                </div>
              ) : (
                <div className="text-right text-xs text-green-800">
                  <span className="font-bold">PAID on {formatDate(exit.fnfDetails?.paidDate)}</span>
                  <span className="block text-[11px] text-green-600 font-mono">Ref: {exit.fnfDetails?.paymentReference}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: SEPARATION DOCUMENTS */}
        {tab === 'documents' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Download and verify official corporate separation documents generated on DutyLaunch letterhead.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { type: 'relieving', title: 'Relieving Letter', desc: 'Acceptance of resignation and official relief from duties.' },
                { type: 'experience', title: 'Experience Certificate', desc: 'Tenure, performance, conduct and character certification.' },
                { type: 'fnf', title: 'FNF Settlement Statement', desc: 'Itemized earnings, deductions, and bank disbursement summary.' },
                { type: 'certificate', title: 'Exit Clearance Certificate', desc: 'Verification of complete cross-departmental separation.' },
              ].map(d => (
                <div key={d.type} className="p-3.5 rounded-lg border border-gray-200 bg-white flex justify-between items-center">
                  <div>
                    <h5 className="text-xs font-bold text-gray-900">{d.title}</h5>
                    <p className="text-[11px] text-gray-400 mt-0.5">{d.desc}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5 ml-2"
                    onClick={() => handleDownload(d.type, d.title)}
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              ))}
            </div>

            {/* Complete Exit Formalities Button */}
            {exit.status !== 'COMPLETED' && (
              <div className="mt-6 rounded-lg bg-indigo-50 border border-indigo-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-indigo-900">Conclude Employment & Complete Exit</h4>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    This action will deactivate the employee's portal login account, archive their profile, mark FNF complete, and dispatch final formal separation letters.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary text-xs bg-indigo-600 hover:bg-indigo-700 py-2 px-4 shadow-sm"
                  disabled={completeMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Are you sure you wish to complete exit formalities for ${emp?.fullName}? This will immediately disable their login account.`)) {
                      completeMutation.mutate();
                    }
                  }}
                >
                  {completeMutation.isPending ? 'Completing Exit…' : 'Complete Exit Formalities'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: AUDIT TRAIL */}
        {tab === 'audit' && (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            <h4 className="text-xs font-bold text-gray-900 mb-2">Immutable Separation Audit Logs</h4>
            <div className="divide-y divide-gray-100 text-xs">
              {exit.auditLogs?.slice().reverse().map((log, i) => (
                <div key={log._id || i} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-gray-900 block">{log.action?.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-gray-500">
                      By: {log.performedByName || 'System'} ({log.role || 'HRMS'}) {log.ip ? `&bull; IP: ${log.ip}` : ''}
                    </span>
                    {log.details && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 bg-gray-50 p-1 rounded">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Close */}
        <div className="flex justify-end pt-3 border-t border-gray-100">
          <button type="button" className="btn-secondary text-xs" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
