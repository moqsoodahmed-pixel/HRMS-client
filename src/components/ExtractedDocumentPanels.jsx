import { useState, useEffect } from 'react';
import { Copy, Check, Edit2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentAPI } from '../api/axios';
import { StatusBadge } from './ui';
import { errorMessage } from '../lib/format';

export function getCategoryMeta(category) {
  switch (category) {
    case 'Aadhaar Card':
      return {
        header: 'AADHAAR DETAILS',
        fields: [
          { key: 'aadhaarNumber', label: 'Aadhaar ID Number' },
          { key: 'fullName', label: 'Full Name' },
          { key: 'dob', label: 'Date of Birth (DOB)' },
          { key: 'gender', label: 'Gender' },
          { key: 'address', label: 'Address', multiline: true, fullWidth: true },
        ],
      };
    case 'PAN Card':
      return {
        header: 'PAN DETAILS',
        fields: [
          { key: 'panNumber', label: 'PAN Number' },
          { key: 'fullName', label: 'Name' },
          { key: 'fatherName', label: "Father's Name" },
          { key: 'dob', label: 'Date of Birth (DOB)' },
        ],
      };
    case 'Bank Account Details':
    case 'Cancelled Cheque':
      return {
        header: 'BANK DETAILS',
        fields: [
          { key: 'accountHolderName', label: 'Account Holder' },
          { key: 'accountNumber', label: 'Account Number' },
          { key: 'ifscCode', label: 'IFSC Code' },
          { key: 'bankName', label: 'Bank Name' },
          { key: 'branch', label: 'Branch' },
          { key: 'micrCode', label: 'MICR Code' },
        ],
      };
    case 'Educational Certificates':
      return {
        header: 'EDUCATIONAL DETAILS',
        fields: [
          { key: 'candidateName', label: 'Candidate Name' },
          { key: 'institution', label: 'Institution' },
          { key: 'degree', label: 'Degree' },
          { key: 'course', label: 'Course' },
          { key: 'passingYear', label: 'Passing Year' },
          { key: 'registrationNumber', label: 'Registration Number' },
        ],
      };
    case 'Experience Certificate':
      return {
        header: 'EXPERIENCE DETAILS',
        fields: [
          { key: 'employeeName', label: 'Employee Name' },
          { key: 'companyName', label: 'Company Name' },
          { key: 'designation', label: 'Designation' },
          { key: 'employmentPeriod', label: 'Employment Period' },
        ],
      };
    case 'Address Proof':
      return {
        header: 'ADDRESS PROOF DETAILS',
        fields: [
          { key: 'fullName', label: 'Full Name' },
          { key: 'documentType', label: 'Document Type' },
          { key: 'address', label: 'Address', multiline: true, fullWidth: true },
        ],
      };
    default:
      return {
        header: 'DOCUMENT DETAILS',
        fields: [],
      };
  }
}

export function ExtractedDocCard({ doc, canEdit, onUpdated }) {
  const meta = getCategoryMeta(doc.category);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState(doc.extractedData || {});
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    setFormValues(doc.extractedData || {});
  }, [doc.extractedData]);

  const knownKeys = new Set(meta.fields.map((f) => f.key));
  const extraFields = Object.keys(doc.extractedData || {})
    .filter((k) => !knownKeys.has(k))
    .map((k) => ({
      key: k,
      label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
    }));
  const allFields = [...meta.fields, ...extraFields];

  const copyValue = (key, val) => {
    if (!val) return;
    navigator.clipboard.writeText(String(val));
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await documentAPI.updateExtractedData(doc._id, formValues);
      toast.success('Extracted details updated');
      setIsEditing(false);
      onUpdated();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to update details'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id={`extracted-panel-${doc._id}`} className="card p-5 transition">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-700 bg-primary-50 px-2.5 py-1 rounded">
            {meta.header}
          </span>
          <span className="text-sm font-semibold text-gray-900">{doc.name}</span>
          <StatusBadge status={doc.status || 'PENDING'} />
        </div>

        {canEdit && (
          <div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary text-xs px-3 py-1.5"
                  onClick={() => {
                    setIsEditing(false);
                    setFormValues(doc.extractedData || {});
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs px-3 py-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Details
              </button>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allFields.map((f) => (
            <div key={f.key} className={f.fullWidth ? 'sm:col-span-2 lg:col-span-3' : ''}>
              <label className="label text-xs mb-1">{f.label}</label>
              {f.multiline ? (
                <textarea
                  className="input text-sm min-h-[70px]"
                  value={formValues[f.key] ?? (f.key === 'aadhaarNumber' ? formValues.idNumber : '') ?? ''}
                  onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  className="input text-sm"
                  value={formValues[f.key] ?? (f.key === 'aadhaarNumber' ? formValues.idNumber : '') ?? ''}
                  onChange={(e) => setFormValues({ ...formValues, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allFields.map((f) => {
            const val = doc.extractedData?.[f.key] || (f.key === 'aadhaarNumber' ? doc.extractedData?.idNumber : null);
            const isStandard = knownKeys.has(f.key);
            // Don't show custom extra fields if empty, but always show standard document section fields
            if (!isStandard && !val) return null;
            return (
              <div
                key={f.key}
                className={`rounded-lg bg-gray-50 border border-gray-100 p-3 flex flex-col justify-between ${
                  f.fullWidth ? 'sm:col-span-2 lg:col-span-3' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    {f.label}
                  </span>
                  {val ? (
                    <button
                      type="button"
                      title="Copy to clipboard"
                      onClick={() => copyValue(f.key, val)}
                      className="text-gray-400 hover:text-gray-700 p-0.5 rounded transition"
                    >
                      {copiedKey === f.key ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  ) : null}
                </div>
                <p className={`text-sm select-text break-words ${val ? 'font-semibold text-gray-900' : 'font-normal text-gray-400 italic'}`}>
                  {val || 'Not detected'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ExtractedDocumentPanels({ docs, isOwnRecord, canManage, onUpdated }) {
  const structuredCategories = new Set([
    'Aadhaar Card',
    'PAN Card',
    'Bank Account Details',
    'Cancelled Cheque',
    'Educational Certificates',
    'Experience Certificate',
    'Address Proof',
  ]);
  const docsWithData = (docs || []).filter(
    (d) =>
      !d.isArchived &&
      ((d.extractedData && Object.keys(d.extractedData).length > 0) ||
        structuredCategories.has(d.category))
  );

  if (!docsWithData.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary-600" />
            Extracted Document Information
          </h3>
          <p className="text-xs text-gray-400">
            Intelligent OCR data extracted from uploaded documents. Select or copy any text, or edit details if needed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {docsWithData.map((doc) => (
          <ExtractedDocCard
            key={doc._id}
            doc={doc}
            canEdit={isOwnRecord && doc.status !== 'VERIFIED'}
            onUpdated={onUpdated}
          />
        ))}
      </div>
    </div>
  );
}

export default ExtractedDocumentPanels;
