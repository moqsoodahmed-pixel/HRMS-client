import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Plus, Send, Archive, CheckCircle2, Eye, FileSignature } from 'lucide-react';
import toast from 'react-hot-toast';
import { policyAPI } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader, DataTable, FilterBar, SearchInput, Select, Modal, FormField,
  StatusBadge, EmptyState, ConfirmDialog, InfoRow, StatCard,
} from '../components/ui';
import { POLICY_CATEGORIES, POLICY_STATUSES } from '../constants';
import { formatDate, errorMessage, fieldErrors } from '../lib/format';

export default function Policies() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ status: '', category: '', search: '' });
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(null);
  const [archiving, setArchiving] = useState(null);

  const query = useQuery({
    queryKey: ['policies', filters],
    queryFn: () => policyAPI.list(filters),
  });
  const policies = query.data?.data?.data || [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['policies'] });

  const publish = useMutation({
    mutationFn: (id) => policyAPI.publish(id),
    onSuccess: () => { toast.success('Policy published'); refresh(); setPublishing(null); },
    onError: (err) => { toast.error(errorMessage(err)); setPublishing(null); },
  });

  const archive = useMutation({
    mutationFn: (id) => policyAPI.archive(id),
    onSuccess: () => { toast.success('Policy archived'); refresh(); setArchiving(null); },
    onError: (err) => { toast.error(errorMessage(err)); setArchiving(null); },
  });

  const acknowledge = useMutation({
    mutationFn: (id) => policyAPI.acknowledge(id),
    onSuccess: () => { toast.success('Policy acknowledged'); refresh(); },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const counts = {
    published: policies.filter((p) => p.status === 'PUBLISHED').length,
    draft: policies.filter((p) => p.status === 'DRAFT').length,
    pendingAck: policies.filter((p) => p.status === 'PUBLISHED' && p.isAcknowledgementRequired && !p.isAcknowledged).length,
  };

  const columns = [
    {
      key: 'title',
      header: 'Policy',
      render: (p) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{p.title}</p>
          {p.description && <p className="truncate text-xs text-gray-400">{p.description}</p>}
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (p) => p.category },
    { key: 'version', header: 'Version', render: (p) => <span className="font-mono text-xs">v{p.version}</span> },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'published', header: 'Published', render: (p) => formatDate(p.publishedAt) },
    { key: 'author', header: 'Author', render: (p) => <span className="text-xs text-gray-500">{p.createdBy?.email || '—'}</span> },
    {
      key: 'ack',
      header: 'Acknowledgement',
      render: (p) => {
        if (!p.isAcknowledgementRequired) return <span className="text-xs text-gray-400">Not required</span>;
        return (
          <div className="flex items-center gap-2">
            {p.isAcknowledged
              ? <StatusBadge status="APPROVED" label="Acknowledged" />
              : <StatusBadge status="PENDING" label="Pending" />}
            <span className="text-xs text-gray-400">{p.acknowledgementCount} total</span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <div className="flex items-center gap-2">
          <button type="button" className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline" onClick={(e) => { e.stopPropagation(); setViewing(p); }}>
            <Eye className="h-3.5 w-3.5" /> View
          </button>
          {can('managePolicies') && (
            <>
              <button type="button" className="text-xs font-medium text-gray-600 hover:underline" onClick={(e) => { e.stopPropagation(); setEditing(p); }}>
                Edit
              </button>
              {p.status === 'DRAFT' && (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-green-600 hover:underline" onClick={(e) => { e.stopPropagation(); setPublishing(p); }}>
                  <Send className="h-3.5 w-3.5" /> Publish
                </button>
              )}
              {p.status !== 'ARCHIVED' && (
                <button type="button" className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:underline" onClick={(e) => { e.stopPropagation(); setArchiving(p); }}>
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              )}
            </>
          )}
          {p.status === 'PUBLISHED' && p.isAcknowledgementRequired && !p.isAcknowledged && can('acknowledgePolicies') && (
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
              onClick={(e) => { e.stopPropagation(); acknowledge.mutate(p._id); }}
              disabled={acknowledge.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Policies"
        subtitle="Company policies, versions and acknowledgements"
        actions={can('managePolicies') && (
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New policy
          </button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Published Policies" value={counts.published} icon={ShieldCheck} tone="green" />
        <StatCard label="Drafts" value={counts.draft} icon={FileSignature} tone="gray" />
        <StatCard label="Awaiting My Acknowledgement" value={counts.pendingAck} icon={CheckCircle2} tone="amber" />
      </div>

      <div className="mt-6">
        <FilterBar onReset={() => setFilters({ status: '', category: '', search: '' })}>
          <SearchInput className="min-w-[14rem] flex-1" value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Search policies…" />
          {can('managePolicies') && (
            <div>
              <label className="label">Status</label>
              <Select className="w-40" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} options={POLICY_STATUSES} placeholder="All statuses" />
            </div>
          )}
          <div>
            <label className="label">Category</label>
            <Select className="w-44" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} options={POLICY_CATEGORIES} placeholder="All categories" />
          </div>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={policies}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={query.refetch}
          onRowClick={(p) => setViewing(p)}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title="No policies yet"
              description={can('managePolicies') ? 'Create your first policy and publish it to the organisation.' : 'No policies have been published yet.'}
              action={can('managePolicies') ? <button type="button" className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New policy</button> : null}
            />
          }
        />
      </div>

      <PolicyDetailModal
        policyId={viewing?._id}
        onClose={() => setViewing(null)}
        onAcknowledge={(id) => acknowledge.mutate(id)}
        acknowledging={acknowledge.isPending}
      />

      <PolicyFormModal
        open={creating || Boolean(editing)}
        policy={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={Boolean(publishing)}
        onClose={() => setPublishing(null)}
        onConfirm={() => publish.mutate(publishing._id)}
        loading={publish.isPending}
        tone="primary"
        title="Publish policy"
        message={publishing ? `Publish "${publishing.title}" (v${publishing.version})? Everyone will be notified and it becomes visible to all employees.` : ''}
        confirmLabel="Publish"
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={() => archive.mutate(archiving._id)}
        loading={archive.isPending}
        title="Archive policy"
        message={archiving ? `Archive "${archiving.title}"? It will no longer be visible to employees.` : ''}
        confirmLabel="Archive"
      />
    </div>
  );
}

function PolicyDetailModal({ policyId, onClose, onAcknowledge, acknowledging }) {
  const { can } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['policies', policyId],
    queryFn: () => policyAPI.get(policyId),
    enabled: Boolean(policyId),
  });
  const policy = data?.data?.data;

  return (
    <Modal
      open={Boolean(policyId)}
      onClose={onClose}
      size="lg"
      title={policy?.title || 'Policy'}
      description={policy ? `${policy.category} · Version ${policy.version}` : ''}
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          {policy?.status === 'PUBLISHED' && policy?.isAcknowledgementRequired && !policy?.isAcknowledged && can('acknowledgePolicies') && (
            <button type="button" className="btn-primary" onClick={() => onAcknowledge(policy._id)} disabled={acknowledging}>
              <CheckCircle2 className="h-4 w-4" /> {acknowledging ? 'Recording…' : 'I acknowledge this policy'}
            </button>
          )}
        </div>
      }
    >
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 animate-pulse rounded bg-gray-100" />)}</div>
        ) : error ? (
          <p className="text-sm text-red-600">{errorMessage(error)}</p>
        ) : policy ? (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-4">
              <InfoRow label="Status" value={<StatusBadge status={policy.status} />} />
              <InfoRow label="Published" value={formatDate(policy.publishedAt)} />
              <InfoRow label="Author" value={<span className="truncate text-xs">{policy.createdBy?.email || '—'}</span>} />
              <InfoRow label="Acknowledged by" value={`${policy.acknowledgementCount} people`} />
            </div>

            {policy.description && <p className="mb-4 text-sm text-gray-600">{policy.description}</p>}

            <div className="prose-sm whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {policy.content || 'No policy body has been written yet.'}
            </div>

            {policy.isAcknowledged && (
              <div className="mt-5 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                You acknowledged this policy on {formatDate(policy.acknowledgedAt)}.
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

function PolicyFormModal({ open, policy, onClose, onSaved }) {
  const isEdit = Boolean(policy);
  const empty = { title: '', description: '', category: '', content: '', version: '1.0', isAcknowledgementRequired: false };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loadedFor, setLoadedFor] = useState(null);

  if (open && isEdit && loadedFor !== policy._id) {
    setForm({
      title: policy.title || '', description: policy.description || '', category: policy.category || '',
      content: policy.content || '', version: policy.version || '1.0',
      isAcknowledgementRequired: Boolean(policy.isAcknowledgementRequired),
    });
    setLoadedFor(policy._id);
  }

  const save = useMutation({
    mutationFn: (data) => (isEdit ? policyAPI.update(policy._id, data) : policyAPI.create(data)),
    onSuccess: () => { toast.success(isEdit ? 'Policy updated' : 'Policy created as a draft'); onSaved(); close(); },
    onError: (err) => { setErrors(fieldErrors(err)); toast.error(errorMessage(err)); },
  });

  function close() { setForm(empty); setErrors({}); setLoadedFor(null); onClose(); }

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (form.title.trim().length < 3) next.title = 'Title must be at least 3 characters.';
    if (!form.category) next.category = 'Choose a category.';
    if (!form.version.trim()) next.version = 'Give the policy a version.';
    if (!form.content.trim()) next.content = 'Write the policy body.';
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  };

  return (
    <Modal open={open} onClose={close} size="lg" title={isEdit ? 'Edit policy' : 'New policy'}
      description={isEdit ? 'Changes apply to the current version.' : 'New policies are created as drafts — publish them when they are ready.'}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <FormField label="Title" required error={errors.title}>
          <input className="input" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Category" required error={errors.category}>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={POLICY_CATEGORIES} placeholder="Select a category" />
          </FormField>
          <FormField label="Version" required error={errors.version} hint="e.g. 1.0, 2.1">
            <input className="input" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </FormField>
        </div>

        <FormField label="Short description" hint="Shown in the policy list.">
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </FormField>

        <FormField label="Policy content" required error={errors.content}>
          <textarea
            className="input min-h-[220px] font-normal leading-relaxed"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Write the full policy text here. Line breaks are preserved."
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={form.isAcknowledgementRequired}
            onChange={(e) => setForm({ ...form, isAcknowledgementRequired: e.target.checked })}
          />
          Employees must acknowledge this policy
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create draft'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
