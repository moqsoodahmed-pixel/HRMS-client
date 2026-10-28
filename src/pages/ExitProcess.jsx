import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LogOut, Send, Ban, ClipboardCheck, CheckCircle2, Clock, AlertTriangle,
  FileText, Download, Package, Wallet, ShieldCheck, Building2, User,
  Calendar, Paperclip, ChevronRight, Info, AlertCircle, FileCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exitRequestAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, LoadingBlock, ErrorState, EmptyState, StatusBadge, ProgressBar,
  Modal, FormField, ConfirmDialog, InfoRow,
} from '../components/ui';
import { EXIT_REASONS, EXIT_TIMELINE_STAGES } from '../constants';
import { formatDate, formatCurrency, errorMessage } from '../lib/format';

export default function ExitProcess() {
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const requestsQuery = useQuery({
    queryKey: ['exit-requests', 'me'],
    queryFn: () => exitRequestAPI.mine(),
  });

  const responseData = requestsQuery.data?.data?.data || [];
  const profile = requestsQuery.data?.data?.meta?.employeeProfile || employee;
  const activeRequest = responseData.find((r) =>
    ['PENDING', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'OFFBOARDING_IN_PROGRESS', 'FNF_PROCESSING'].includes(r.status)
  ) || responseData[0];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['exit-requests'] });

  const cancelMutation = useMutation({
    mutationFn: (id) => exitRequestAPI.cancel(id),
    onSuccess: () => {
      toast.success('Exit request withdrawn successfully');
      refresh();
      setCancelling(null);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
      setCancelling(null);
    },
  });

  // Calculate timeline progress index (0 to 8)
  const getTimelineStepIndex = (req) => {
    if (!req) return 0;
    if (req.status === 'COMPLETED') return 8;
    if (req.status === 'FNF_PROCESSING' || req.fnfDetails?.status === 'APPROVED' || req.fnfDetails?.status === 'PAID') return 7;
    const allAssetsReturned = req.assetReturns?.length > 0 && req.assetReturns.every(a => a.status === 'Returned' || a.status === 'Not Applicable');
    if (allAssetsReturned) return 6;
    const someChecklistDone = req.offboardingChecklist?.some(c => c.status === 'COMPLETED');
    if (req.status === 'APPROVED' || req.status === 'OFFBOARDING_IN_PROGRESS') {
      return someChecklistDone ? 5 : 4;
    }
    if (req.currentApprovalStage === 'LEADERSHIP_APPROVAL') return 3;
    if (req.currentApprovalStage === 'HR_REVIEW') return 2;
    if (req.currentApprovalStage === 'MANAGER_REVIEW') return 1;
    return 0;
  };

  const currentStepIdx = getTimelineStepIndex(activeRequest);

  // Download document handler
  const handleDownloadDoc = async (docType, docTitle) => {
    if (!activeRequest) return;
    try {
      toast.loading(`Generating ${docTitle}...`, { id: 'doc-download' });
      const response = await exitRequestAPI.downloadDocument(activeRequest._id, docType);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${docTitle.replace(/\s+/g, '_')}_${profile?.fullName || 'Employee'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${docTitle} downloaded successfully!`, { id: 'doc-download' });
    } catch (err) {
      toast.error(errorMessage(err) || `Failed to download ${docTitle}`, { id: 'doc-download' });
    }
  };

  const checklistTotal = activeRequest?.offboardingChecklist?.length || 0;
  const checklistCompleted = activeRequest?.offboardingChecklist?.filter(c => c.status === 'COMPLETED').length || 0;
  const checklistProgress = checklistTotal ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;

  const assetsTotal = activeRequest?.assetReturns?.length || 0;
  const assetsReturned = activeRequest?.assetReturns?.filter(a => a.status === 'Returned' || a.status === 'Not Applicable').length || 0;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Exit Process"
        subtitle="Submit your resignation, track multi-level approval stages, monitor offboarding clearance, and access final separation documents."
        actions={
          (!activeRequest || ['CANCELLED', 'REJECTED', 'COMPLETED'].includes(activeRequest.status)) && (
            <button
              type="button"
              className="btn-primary flex items-center gap-2 shadow-sm"
              onClick={() => setRequesting(true)}
            >
              <Send className="h-4 w-4" /> Request Exit
            </button>
          )
        }
      />

      {requestsQuery.isLoading ? (
        <LoadingBlock label="Loading exit details…" />
      ) : requestsQuery.error ? (
        <div className="card p-6">
          <ErrorState error={requestsQuery.error} onRetry={requestsQuery.refetch} />
        </div>
      ) : !activeRequest ? (
        /* Empty State */
        <div className="space-y-6">
          <div className="card p-8 text-center">
            <EmptyState
              icon={LogOut}
              title="No exit request yet"
              description="If you would like to resign or need to leave DutyLaunch Solutions, you can initiate the formal exit workflow here for management review."
              action={
                <button
                  type="button"
                  className="btn-primary mt-4 inline-flex items-center gap-2"
                  onClick={() => setRequesting(true)}
                >
                  <Send className="h-4 w-4" /> Request Exit
                </button>
              }
            />
          </div>

          {/* Corporate Policy Overview Card */}
          <div className="card p-6 border-l-4 border-primary-600 bg-white shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary-600" /> DutyLaunch Separation & Exit Policy Guidelines
            </h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="font-semibold text-gray-800 block mb-1">Notice Period</span>
                Standard notice period is <strong>{profile?.noticePeriodDays != null ? `${profile.noticePeriodDays} days` : '30 days'}</strong> as per your employment agreement.
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="font-semibold text-gray-800 block mb-1">Approval Chain</span>
                Your request is reviewed by your Reporting Manager, HR Operations, and Executive Leadership (Founder / CEO / CTO).
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="font-semibold text-gray-800 block mb-1">Clearance & FNF</span>
                Asset return, knowledge handover, and Full & Final settlement are automatically tracked and disbursed on completion.
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Active Exit Workflow Experience */
        <div className="space-y-6">
          {/* Top Status Banner */}
          <div className="card p-6 border-t-4 border-primary-600 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900">
                    Resignation Request
                  </h2>
                  <StatusBadge status={activeRequest.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Submitted on {formatDate(activeRequest.resignationDate || activeRequest.createdAt)} &bull; Reference #{String(activeRequest._id).slice(-8).toUpperCase()}
                </p>
              </div>

              {['PENDING', 'CHANGES_REQUESTED', 'UNDER_REVIEW'].includes(activeRequest.status) && (
                <button
                  type="button"
                  className="btn-secondary text-xs text-red-600 hover:bg-red-50 hover:border-red-200 flex items-center gap-1.5"
                  onClick={() => setCancelling(activeRequest)}
                >
                  <Ban className="h-3.5 w-3.5" /> Withdraw Request
                </button>
              )}
            </div>

            {/* Alert if changes requested or rejected */}
            {activeRequest.status === 'CHANGES_REQUESTED' && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Modifications Requested by Approver</h4>
                  <p className="mt-1 text-xs text-amber-800">
                    {activeRequest.auditLogs?.slice(-1)[0]?.details?.notes || 'Please consult with HR or your reporting manager regarding your last working date.'}
                  </p>
                </div>
              </div>
            )}

            {activeRequest.status === 'REJECTED' && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Resignation Request Declined</h4>
                  <p className="mt-1 text-xs text-red-800">
                    {activeRequest.rejectionReason || 'The requested separation date could not be accommodated due to operational commitments.'}
                  </p>
                </div>
              </div>
            )}

            {activeRequest.status === 'APPROVED' && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold">Exit Approved & Notice Period Active</h4>
                  <p className="mt-1 text-xs text-green-800">
                    Your exit has been formally approved. Confirmed Last Working Day:{' '}
                    <strong>{formatDate(activeRequest.confirmedLastWorkingDate || activeRequest.requestedLastWorkingDate)}</strong>. Please complete the offboarding checklist and asset returns below.
                  </p>
                </div>
              </div>
            )}

            {/* Key Metadata Row */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg text-xs">
              <InfoRow label="Reason for Leaving" value={activeRequest.reason} />
              <InfoRow
                label="Confirmed Last Working Day"
                value={formatDate(activeRequest.confirmedLastWorkingDate || activeRequest.requestedLastWorkingDate)}
              />
              <InfoRow
                label="Notice Period"
                value={`${activeRequest.noticePeriodDays || 30} days ${activeRequest.noticeShortfallDays > 0 ? `(${activeRequest.noticeShortfallDays}d shortfall)` : ''}`}
              />
              <InfoRow
                label="Current Stage"
                value={activeRequest.currentApprovalStage ? activeRequest.currentApprovalStage.replace(/_/g, ' ') : 'Review'}
              />
            </div>
          </div>

          {/* Section 2: Enterprise Progress Tracker Stepper */}
          <div className="card p-6 bg-white shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-600" /> Exit Lifecycle & Approval Progress Tracker
            </h3>

            {/* Step Bar */}
            <div className="relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
              <div
                className="hidden md:block absolute top-1/2 left-0 h-0.5 bg-primary-600 -translate-y-1/2 z-0 transition-all duration-500"
                style={{ width: `${(currentStepIdx / (EXIT_TIMELINE_STAGES.length - 1)) * 100}%` }}
              />

              <div className="grid grid-cols-1 md:grid-cols-9 gap-3 relative z-10">
                {EXIT_TIMELINE_STAGES.map((stage, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={stage.key} className="flex md:flex-col items-center text-left md:text-center gap-3 md:gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all shadow-sm ${
                          isDone
                            ? 'bg-primary-600 text-white'
                            : isCurrent
                            ? 'bg-primary-600 text-white ring-4 ring-primary-100 animate-pulse'
                            : 'bg-white text-gray-400 border border-gray-300'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-primary-700 font-bold' : isDone ? 'text-gray-900' : 'text-gray-400'}`}>
                          {stage.label}
                        </p>
                        <p className="text-[10px] text-gray-400 hidden lg:block leading-tight mt-0.5">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Navigation Tabs */}
          <div className="flex border-b border-gray-200 space-x-6 text-sm font-medium">
            {[
              { id: 'overview', label: 'Overview & Approval Chain', icon: User },
              { id: 'checklist', label: `Offboarding Checklist (${checklistCompleted}/${checklistTotal})`, icon: ClipboardCheck },
              { id: 'assets', label: `Asset Return Register (${assetsReturned}/${assetsTotal})`, icon: Package },
              { id: 'fnf', label: 'Full & Final (FNF) Statement', icon: Wallet },
              { id: 'documents', label: 'Separation Documents', icon: FileCheck },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 pt-1 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW & APPROVAL STAGES */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Approval Stages Cards */}
              <div className="card p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary-600" /> Multi-Level Approval Chain Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {activeRequest.approvalStages?.map((stage, idx) => (
                    <div
                      key={stage._id || idx}
                      className={`p-4 rounded-lg border transition-all ${
                        stage.status === 'APPROVED'
                          ? 'border-green-200 bg-green-50/50'
                          : stage.status === 'REJECTED'
                          ? 'border-red-200 bg-red-50/50'
                          : stage.status === 'CHANGES_REQUESTED'
                          ? 'border-amber-200 bg-amber-50/50'
                          : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                          Level {idx + 1}: {stage.stage}
                        </span>
                        <StatusBadge status={stage.status} />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900">{stage.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {stage.assignedToEmployee?.fullName
                          ? `Assigned: ${stage.assignedToEmployee.fullName}`
                          : `Role: ${stage.assignedRole || 'Approver'}`}
                      </p>

                      {stage.actionAt && (
                        <p className="text-[11px] text-gray-400 mt-2">
                          Reviewed on {formatDate(stage.actionAt)}
                        </p>
                      )}

                      {stage.notes && (
                        <div className="mt-3 rounded bg-white p-2.5 text-xs text-gray-700 border border-gray-100">
                          <span className="font-semibold block text-gray-900 mb-0.5">Note:</span>
                          {stage.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Resignation Letter Attachment */}
              {activeRequest.resignationLetterUrl && (
                <div className="card p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Paperclip className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Attached Resignation Letter</p>
                      <p className="text-xs text-gray-500">{activeRequest.resignationLetterName || 'Official Resignation Letter Document'}</p>
                    </div>
                  </div>
                  <a
                    href={activeRequest.resignationLetterUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> View File
                  </a>
                </div>
              )}

              {/* Detailed Comments */}
              <div className="card p-6">
                <h4 className="text-sm font-bold text-gray-900 mb-2">Employee Statement & Comments</h4>
                <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">
                  {activeRequest.detailedComments || activeRequest.comments || 'No additional comments provided.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: OFFBOARDING CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="card p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Offboarding Clearance Checklist</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Clearances are verified in real-time by HR, IT, Finance, Admin, and Security.
                  </p>
                </div>
                <div className="w-48">
                  <ProgressBar value={checklistProgress} label={`${checklistCompleted} of ${checklistTotal} items cleared`} />
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {activeRequest.offboardingChecklist?.map((task) => (
                  <div key={task._id || task.taskId} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        task.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {task.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-3 w-3" />}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${task.status === 'COMPLETED' ? 'text-gray-900 line-through text-opacity-70' : 'text-gray-900'}`}>
                          {task.taskName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>
                        {task.remarks && (
                          <p className="text-xs text-primary-700 mt-1 italic font-medium">Remarks: {task.remarks}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        {task.category}
                      </span>
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ASSET RETURN REGISTER */}
          {activeTab === 'assets' && (
            <div className="card p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900">Company Hardware & Asset Return Register</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  All assigned IT hardware, peripherals, access cards, and company tokens must be returned in good condition.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Asset Item</th>
                      <th className="px-4 py-3">Asset Code</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Condition / Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeRequest.assetReturns?.map((asset) => (
                      <tr key={asset._id || asset.name} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-semibold text-gray-900 flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          {asset.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-500">{asset.assetCode || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{asset.category || 'IT'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={asset.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {asset.condition ? `Condition: ${asset.condition}` : 'Pending handover'}
                          {asset.deductionAmount > 0 && (
                            <span className="block text-red-600 font-semibold mt-0.5">
                              Deduction: {formatCurrency(asset.deductionAmount)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: FNF SETTLEMENT */}
          {activeTab === 'fnf' && (
            <div className="card p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Full & Final (FNF) Settlement Statement</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Reconciled by Finance & Payroll upon completion of notice period and clearances.
                  </p>
                </div>
                <StatusBadge status={activeRequest.fnfDetails?.status || 'PENDING'} />
              </div>

              {activeRequest.fnfDetails ? (
                <div className="space-y-6">
                  {/* Earnings vs Deductions Table */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Earnings Box */}
                    <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-3">
                        Settlement Earnings & Credits
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-blue-100/60">
                          <span className="text-gray-600">Payable Days</span>
                          <span className="font-semibold text-gray-900">{activeRequest.fnfDetails.payableDays || 0} days</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100/60">
                          <span className="text-gray-600">Earned Salary for Notice Period</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(activeRequest.fnfDetails.earnedSalary || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100/60">
                          <span className="text-gray-600">Leave Encashment ({activeRequest.fnfDetails.leaveBalanceDays || 0} days)</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(activeRequest.fnfDetails.leaveEncashment || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100/60">
                          <span className="text-gray-600">Bonus & Incentives</span>
                          <span className="font-semibold text-gray-900">{formatCurrency((activeRequest.fnfDetails.bonus || 0) + (activeRequest.fnfDetails.incentives || 0))}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100/60">
                          <span className="text-gray-600">Gratuity (if eligible)</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(activeRequest.fnfDetails.gratuity || 0)}</span>
                        </div>
                        <div className="flex justify-between pt-2 text-sm font-bold text-blue-950">
                          <span>Total Earnings (A)</span>
                          <span>{formatCurrency(activeRequest.fnfDetails.totalEarnings || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions Box */}
                    <div className="rounded-lg border border-red-100 bg-red-50/30 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-900 mb-3">
                        Recoveries & Deductions
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-red-100/60">
                          <span className="text-gray-600">Notice Period Shortfall ({activeRequest.fnfDetails.noticeShortfallDays || 0} days)</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(activeRequest.fnfDetails.noticeRecovery || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-red-100/60">
                          <span className="text-gray-600">Asset Damage / Replacement Recovery</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(activeRequest.fnfDetails.assetDeductions || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-red-100/60">
                          <span className="text-gray-600">Other Deductions / Advances</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(activeRequest.fnfDetails.otherDeductions || 0)}</span>
                        </div>
                        <div className="flex justify-between pt-2 text-sm font-bold text-red-950">
                          <span>Total Deductions (B)</span>
                          <span>{formatCurrency(activeRequest.fnfDetails.totalDeductions || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Net Amount Box */}
                  <div className="rounded-lg bg-green-50 border border-green-200 p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-green-800 block">
                        Net Settlement Amount Payable
                      </span>
                      <p className="text-2xl font-black text-green-900 mt-1">
                        {formatCurrency(activeRequest.fnfDetails.netSettlementAmount || 0)}
                      </p>
                    </div>

                    {activeRequest.fnfDetails.status === 'PAID' && (
                      <div className="text-right text-xs text-green-800">
                        <span className="font-semibold block">Disbursed on {formatDate(activeRequest.fnfDetails.paidDate)}</span>
                        <span className="font-mono text-[11px] text-green-700">Ref: {activeRequest.fnfDetails.paymentReference || 'Bank Transfer'}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">FNF statement is being prepared by the payroll team.</p>
              )}
            </div>
          )}

          {/* TAB 5: SEPARATION DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="card p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-gray-900">Official Separation Documents</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Generated and signed digitally upon successful completion of your exit process.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    type: 'relieving',
                    title: 'Relieving Letter',
                    desc: 'Official confirmation of release from duties and acceptance of resignation on company letterhead.',
                    icon: FileText,
                  },
                  {
                    type: 'experience',
                    title: 'Experience Certificate',
                    desc: 'Service tenure, designation, department, and conduct certificate signed by Executive Leadership.',
                    icon: ShieldCheck,
                  },
                  {
                    type: 'fnf',
                    title: 'Full & Final (FNF) Statement',
                    desc: 'Comprehensive statement of earnings, payable days, deductions, and settlement amount.',
                    icon: Wallet,
                  },
                  {
                    type: 'certificate',
                    title: 'Exit & No-Dues Certificate',
                    desc: 'Formal certification confirming no physical or financial dues remain outstanding.',
                    icon: CheckCircle2,
                  },
                ].map(doc => (
                  <div key={doc.type} className="p-4 rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-9 w-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                          <doc.icon className="h-5 w-5" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900">{doc.title}</h4>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-4">{doc.desc}</p>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-gray-400">Official PDF format</span>
                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(doc.type, doc.title)}
                        className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* REQUEST EXIT MODAL */}
      <RequestExitModal
        open={requesting}
        onClose={() => setRequesting(false)}
        onSaved={refresh}
        employee={profile}
      />

      {/* CONFIRM WITHDRAW DIALOG */}
      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelMutation.mutate(cancelling._id)}
        loading={cancelMutation.isPending}
        title="Withdraw Resignation Request"
        message="Are you sure you wish to withdraw your resignation request? Your exit formalities and approval process will be cancelled immediately."
        confirmLabel="Withdraw Resignation"
      />
    </div>
  );
}

/**
 * Request Exit Modal Form
 */
function RequestExitModal({ open, onClose, onSaved, employee }) {
  const empty = {
    reason: 'Better Opportunity',
    requestedLastWorkingDate: '',
    resignationDate: new Date().toISOString().slice(0, 10),
    detailedComments: '',
    confirmedAccuracy: false,
  };
  const [form, setForm] = useState(empty);
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState({});

  const saveMutation = useMutation({
    mutationFn: (formData) => exitRequestAPI.create(formData),
    onSuccess: () => {
      toast.success('Resignation request successfully submitted for approval.');
      onSaved();
      close();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function close() {
    setForm(empty);
    setSelectedFile(null);
    setErrors({});
    onClose();
  }

  const noticePeriodDays = employee?.noticePeriodDays != null ? employee.noticePeriodDays : 30;

  // Calculate shortfall
  const getShortfallInfo = () => {
    if (!form.requestedLastWorkingDate || !form.resignationDate) return null;
    const resDate = new Date(form.resignationDate);
    const lwd = new Date(form.requestedLastWorkingDate);
    const diffDays = Math.max(0, Math.round((lwd.getTime() - resDate.getTime()) / (1000 * 60 * 60 * 24)));
    const shortfall = Math.max(0, noticePeriodDays - diffDays);
    return { diffDays, shortfall };
  };

  const shortfallInfo = getShortfallInfo();

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.reason) next.reason = 'Please select a reason for leaving.';
    if (!form.requestedLastWorkingDate) next.requestedLastWorkingDate = 'Choose your intended last working date.';
    if (!form.confirmedAccuracy) next.confirmedAccuracy = 'Please confirm that the information provided is accurate.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const formData = new FormData();
    formData.append('reason', form.reason);
    formData.append('requestedLastWorkingDate', form.requestedLastWorkingDate);
    formData.append('resignationDate', form.resignationDate);
    formData.append('detailedComments', form.detailedComments);
    formData.append('comments', form.detailedComments);
    formData.append('confirmedAccuracy', String(form.confirmedAccuracy));
    if (selectedFile) {
      formData.append('resignationLetter', selectedFile);
    }

    saveMutation.mutate(formData);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Request Employee Exit / Resignation"
      size="lg"
      description="Submit your formal resignation for multi-level review by Reporting Manager, HR, and Leadership."
    >
      <form onSubmit={submit} className="space-y-4 p-6 text-xs sm:text-sm">
        {/* Auto-populated details card */}
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block mb-2">
            Your Employee Profile (Auto-populated)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-gray-400 block">Employee Name</span>
              <span className="font-semibold text-gray-900">{employee?.fullName || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Employee ID</span>
              <span className="font-semibold text-gray-900">{employee?.employeeCode || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Department</span>
              <span className="font-semibold text-gray-900">{employee?.department || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Designation</span>
              <span className="font-semibold text-gray-900">{employee?.designation || '—'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Reporting Manager</span>
              <span className="font-semibold text-gray-900">{employee?.manager?.fullName || 'Assigned Manager'}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Work Location</span>
              <span className="font-semibold text-gray-900">{employee?.workLocation || 'Office - Koramangala'}</span>
            </div>
          </div>
        </div>

        {/* Notice Period Notice */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 flex items-center justify-between">
          <span>Configured Notice Period Duration: <strong>{noticePeriodDays} Days</strong></span>
          {shortfallInfo && (
            <span className={shortfallInfo.shortfall > 0 ? 'text-amber-700 font-bold' : 'text-green-700 font-bold'}>
              {shortfallInfo.shortfall > 0 ? `Notice Shortfall: ${shortfallInfo.shortfall} Days` : 'Full Notice Served'}
            </span>
          )}
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Resignation Date" required>
            <input
              type="date"
              className="input text-xs"
              value={form.resignationDate}
              onChange={(e) => setForm({ ...form, resignationDate: e.target.value })}
            />
          </FormField>

          <FormField label="Requested Last Working Day" required error={errors.requestedLastWorkingDate}>
            <input
              type="date"
              className="input text-xs"
              value={form.requestedLastWorkingDate}
              min={form.resignationDate || new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, requestedLastWorkingDate: e.target.value })}
            />
          </FormField>
        </div>

        <FormField label="Reason for Leaving" required error={errors.reason}>
          <select
            className="input text-xs"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
          >
            {EXIT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Detailed Comments / Handover Notes" required>
          <textarea
            className="input min-h-[90px] text-xs"
            value={form.detailedComments}
            onChange={(e) => setForm({ ...form, detailedComments: e.target.value })}
            placeholder="Please detail your reason for leaving and any pertinent handover information..."
          />
        </FormField>

        <FormField label="Attach Official Resignation Letter (PDF / DOC / Image) (Optional)">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 text-xs text-gray-500"
            />
            {selectedFile && (
              <span className="text-xs text-green-700 font-medium">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
        </FormField>

        {/* Confirmation Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.confirmedAccuracy}
              onChange={(e) => setForm({ ...form, confirmedAccuracy: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-600">
              I confirm that the information provided is accurate and that I understand this submission initiates formal separation proceedings with DutyLaunch Solutions Private Limited.
            </span>
          </label>
          {errors.confirmedAccuracy && (
            <p className="text-xs text-red-600 mt-1">{errors.confirmedAccuracy}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" className="btn-secondary text-xs" onClick={close}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary text-xs"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Submitting Resignation…' : 'Submit Resignation Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
