import { useState, useEffect, useCallback } from 'react';
import {
  Plus, RefreshCw, Eye, Download, FileText, X, User, Search,
  ChevronLeft, ChevronRight, Save, Zap, AlertCircle, CheckCircle2,
  Trash2, Edit2, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { appointmentLetterAPI, employeeAPI } from '../api/axios';
import { PageHeader, EmptyState, LoadingBlock } from '../components/ui';
import { LETTERHEAD_HEADER, LETTERHEAD_FOOTER } from '../assets/letterheadImages';

// ── Role-specific default duties ────────────────────────────────────────────
const ROLE_DUTIES = {
  'Full Stack Engineer': [
    'Managing technical projects from requirement gathering through successful delivery.',
    'Leading software development, integration and implementation activities.',
    'Understanding client requirements and converting them into practical technical solutions.',
    'Coordinating with clients, developers, vendors, designers and internal teams.',
    'Planning and monitoring project timelines, milestones, deliverables, quality and client satisfaction.',
    'Developing, reviewing, testing, debugging and maintaining software applications as assigned.',
    'Supporting deployment, maintenance, troubleshooting and post-delivery technical support.',
    'Supporting technical product/service sales, demonstrations, proposals and client conversions where required.',
    'Identifying opportunities for additional technical products, services, automation and process improvements.',
    'Providing technical guidance, documentation and project updates to management.',
    'Maintaining appropriate technical documentation, source-control practices and project records.',
    'Ensuring timely completion and delivery of assigned work.',
    'Performing other reasonable duties and responsibilities assigned by the Company from time to time.',
  ],
  'Sales Executive': [
    'Identifying and approaching potential clients to generate new business opportunities.',
    'Managing the complete sales cycle from prospecting to closure.',
    'Maintaining and growing relationships with existing clients.',
    'Achieving monthly and quarterly sales targets as communicated by management.',
    'Preparing and presenting proposals, quotations and product/service demonstrations.',
    'Coordinating with internal teams to ensure timely delivery and client satisfaction.',
    'Maintaining accurate records of sales activities, leads and client interactions.',
    'Reporting sales progress and pipeline updates to the reporting manager.',
    'Gathering market intelligence and providing feedback on competitive landscape.',
    'Participating in marketing events, trade shows and client meetings as required.',
    'Performing other reasonable duties and responsibilities assigned by the Company from time to time.',
  ],
  'Business Development Executive': [
    'Identifying, evaluating and pursuing new business opportunities and strategic partnerships.',
    'Developing and maintaining a robust pipeline of qualified business prospects.',
    'Conducting market research to identify trends, opportunities and competitive positioning.',
    'Preparing business proposals, presentations and partnership agreements.',
    'Building and maintaining long-term relationships with clients, partners and stakeholders.',
    'Tracking and reporting on business development activities, conversions and revenue targets.',
    'Collaborating with product, marketing and operations teams on go-to-market strategies.',
    'Participating in industry events, networking activities and client meetings.',
    'Performing other reasonable duties and responsibilities assigned by the Company from time to time.',
  ],
  'HR Executive': [
    'Assisting in end-to-end recruitment activities including job postings, screening and scheduling.',
    'Maintaining employee records, HR databases and documentation accurately.',
    'Supporting onboarding and offboarding processes for employees.',
    'Assisting with payroll processing, leave management and attendance tracking.',
    'Coordinating training programmes and employee development activities.',
    'Handling employee queries related to HR policies, benefits and procedures.',
    'Supporting performance review processes and appraisal documentation.',
    'Ensuring compliance with applicable labour laws and company HR policies.',
    'Performing other reasonable duties and responsibilities assigned by the Company from time to time.',
  ],
  'Project Manager': [
    'Planning, executing and delivering projects within defined scope, timeline and budget.',
    'Coordinating with cross-functional teams, clients and stakeholders throughout the project lifecycle.',
    'Defining project requirements, milestones, deliverables and success criteria.',
    'Monitoring project progress, identifying risks and implementing mitigation strategies.',
    'Conducting regular project status meetings and providing updates to senior management.',
    'Managing project documentation, change requests and version control.',
    'Ensuring quality standards are maintained throughout project delivery.',
    'Allocating and managing project resources effectively.',
    'Performing other reasonable duties and responsibilities assigned by the Company from time to time.',
  ],
};

const DEFAULT_DUTIES = ROLE_DUTIES['Full Stack Engineer'];

function getDutiesForDesignation(designation) {
  if (!designation) return DEFAULT_DUTIES;
  const d = designation.toLowerCase();
  for (const [role, duties] of Object.entries(ROLE_DUTIES)) {
    if (d.includes(role.toLowerCase())) return duties;
  }
  return DEFAULT_DUTIES;
}

// ── A4 Live Preview ──────────────────────────────────────────────────────────
// Renders an accurate A4-proportioned page preview matching the actual PDF output.
function A4Preview({ f }) {
  const ph = (v, label) => v
    ? <span>{v}</span>
    : <span className="text-red-400 italic text-[10px]">{'<<'}{label}{'>>'}</span>;

  const duties = f.duties?.length > 0 ? f.duties : getDutiesForDesignation(f.designation);
  const comp = f.compensation;
  const cwords = f.compensationWords;
  const co = f.registeredCompanyName || 'DutyLaunch Solutions Private Limited';

  // A4 ratio: 210:297 = 1:1.4142
  return (
    <div className="flex flex-col items-center overflow-y-auto h-full bg-gray-300 py-4 px-2 gap-4">
      {/* Single A4 page representation */}
      <div
        className="bg-white shadow-xl flex-shrink-0 overflow-hidden"
        style={{
          width: '210mm',
          minHeight: '297mm',
          position: 'relative',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ width: '100%', height: '31mm', position: 'relative', backgroundColor: '#f0f0f0' }}>
          <img
            src={LETTERHEAD_HEADER}
            alt="letterhead header"
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />
        </div>

        {/* ── BODY ── */}
        <div style={{
          margin: '0 19.5mm',
          paddingTop: '6mm',
          paddingBottom: '4mm',
          minHeight: 'calc(297mm - 31mm - 32mm)',
          fontSize: '9.5pt',
          lineHeight: '1.52',
          color: '#1a1a1a',
        }}>

          {/* Title */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11pt', marginBottom: '10mm' }}>
            APPOINTMENT LETTER
          </div>

          {/* Date + To */}
          <p style={{ marginBottom: '4mm' }}><strong>Date:</strong> {ph(f.dateOfIssue, 'DD Month YYYY')}</p>
          <p style={{ marginBottom: '0', fontWeight: 'bold' }}>To,</p>
          <p style={{ marginBottom: '0' }}>{ph(f.employeeFullName, 'Employee Full Name')}</p>
          <p style={{ marginBottom: '4mm' }}>Subject: Appointment as {ph(f.designation, 'Designation')}</p>
          <p style={{ marginBottom: '4mm' }}>Dear {ph(f.employeeFirstName || f.employeeFullName, 'First Name')},</p>

          {/* Intro paragraph */}
          <p style={{ textAlign: 'justify', marginBottom: '4mm' }}>
            We are pleased to confirm your appointment with {co} (the "Company") as a{' '}
            {ph(f.designation, 'Designation')}. This Appointment Letter records the terms and
            conditions of your employment
            {f.offerLetterDate
              ? ` and supersedes the joining-date reference contained in the Offer Letter dated ${f.offerLetterDate} to the extent that the Offer Letter stated a joining date of ${f.offerLetterJoiningDate || f.joiningDate}.`
              : '.'
            }{' '}
            Your actual date of joining and commencement of employment is{' '}
            {ph(f.joiningDate, 'Joining Date')}.
          </p>

          {/* Sections */}
          <Section n="1" title="Appointment and Designation">
            You are appointed as {ph(f.designation, 'Designation')} with effect from{' '}
            {ph(f.joiningDate, 'Joining Date')}. You will report to the{' '}
            {ph(f.reportingManager, 'Reporting Manager')} designated by the Company from time to time.
            The Company may reasonably modify your reporting structure, responsibilities, projects, or
            allocation of work based on business requirements without changing your substantive
            designation or agreed compensation unless otherwise communicated in writing.
          </Section>

          <Section n="2" title="Date of Joining">
            Your date of joining is {ph(f.joiningDate, 'Joining Date')}. For employment, payroll,
            internal records and service purposes, {ph(f.joiningDate, 'Joining Date')} shall be treated
            as your commencement date with the Company.
          </Section>

          <Section n="3" title="Compensation">
            {comp ? (
              <>
                Your monthly compensation is <strong>₹{comp}/- (Rupees {cwords} Only)</strong>,
                inclusive of applicable Provident Fund (PF) and insurance contributions/benefits,
                wherever applicable under the Company's policies and statutory requirements. Any
                applicable statutory deductions or employer contributions will be dealt with in
                accordance with applicable law and the Company's payroll practices.
              </>
            ) : (
              <>Your monthly compensation will be as communicated in writing.</>
            )}
          </Section>

          <Section n="4" title="Performance-Based Incentive">
            In addition to the above compensation, you are eligible for a performance-based incentive
            of up to <strong>{f.incentivePercent || '15'}%</strong> of eligible revenue generated from
            technical products/services sold to clients and attributable to your efforts. The incentive
            is not guaranteed compensation and is subject to: (a) the revenue being attributable to
            your contribution; (b) successful receipt of the relevant client payment by the Company;
            (c) verification and approval of the revenue and incentive calculation by the Company; and
            (d) the applicable incentive policy and payment cycle. The Company reserves the right to
            determine eligibility and calculation methodology in accordance with its applicable policy.
          </Section>

          <Section n="5" title="Key Duties and Responsibilities">
            <p style={{ marginBottom: '2mm' }}>Your responsibilities will include, but will not be limited to:</p>
            {duties.map((d, i) => (
              <p key={i} style={{ paddingLeft: '5mm', marginBottom: '1.5mm', textIndent: '-5mm', textAlign: 'justify' }}>
                •&nbsp; {d}
              </p>
            ))}
          </Section>

          <Section n="6" title="Working Hours, Location and Work Requirements">
            You shall follow the working hours, attendance requirements, work location, remote/hybrid
            arrangements, meeting schedules and other operational requirements communicated by the
            Company from time to time. You are expected to remain reasonably available during agreed
            working hours and to attend client or internal meetings and project discussions as required
            for effective performance of your role.
          </Section>

          <Section n="7" title="Professional Conduct">
            You shall maintain professional conduct, discipline, integrity, honesty and respectful
            behaviour in all dealings with the Company, its directors, employees, clients, vendors and
            other stakeholders. You shall comply with reasonable instructions, policies, procedures,
            security requirements and professional standards of the Company.
          </Section>

          <Section n="8" title="Confidentiality and Non-Disclosure">
            During your employment, you may have access to confidential information relating to the
            Company, its clients, products, technology, source code, credentials, software architecture,
            business plans, pricing, proposals, contracts, documentation, customer information,
            financial information, marketing plans and other proprietary information. You shall keep
            such information strictly confidential and shall not disclose, copy, transfer, misuse or
            share it with any unauthorised person during or after employment.
          </Section>

          <Section n="9" title="Intellectual Property and Work Product">
            All software, source code, scripts, documentation, designs, databases, technical solutions,
            processes, concepts, inventions, improvements, materials, configurations and other work
            product created, developed or substantially contributed to by you in the course of your
            employment or using Company resources shall belong to the Company, subject to applicable
            law and any separate written agreement.
          </Section>

          <Section n="10" title="Company Systems, Data and Security">
            You shall use Company systems, accounts, repositories, devices, credentials, APIs, cloud
            services and other resources only for authorised business purposes. You must maintain
            appropriate password and access security and immediately report any suspected unauthorised
            access, data loss, security incident or compromise of credentials.
          </Section>

          <Section n="11" title="Client and Vendor Communication">
            Where you interact with clients or vendors on behalf of the Company, you shall communicate
            professionally and within the authority granted to you. You shall not make commitments,
            pricing assurances or other commercial commitments on behalf of the Company unless
            authorised to do so.
          </Section>

          <Section n="12" title="Conflict of Interest">
            You shall promptly disclose any actual or potential conflict of interest that may affect
            your responsibilities or the interests of the Company.
          </Section>

          <Section n="13" title="Outside Work and Competing Activities">
            During your employment, you shall not undertake outside work, consulting, freelancing or
            other professional activity that materially conflicts with your duties or creates a conflict
            of interest.
          </Section>

          <Section n="14" title="Company Property and Return of Assets">
            All Company property shall remain Company property. Upon request or cessation of employment,
            you shall promptly return or hand over all Company property and information.
          </Section>

          <Section n="15" title="Leave, Attendance and Company Policies">
            Leave, attendance, holidays, payroll procedures and other employment administration matters
            shall be governed by applicable law and the Company's policies as communicated from time
            to time.
          </Section>

          <Section n="16" title="Statutory Deductions and Benefits">
            Any statutory deductions, contributions or benefits applicable to your employment shall be
            administered in accordance with applicable law and the Company's payroll policies.
            {comp && ` The stated monthly compensation of ₹${comp}/- is inclusive of applicable PF and insurance components.`}
          </Section>

          <Section n="17" title="Verification and Documentation">
            Your appointment is subject to submission and verification of documents and information
            reasonably required by the Company for employment, payroll, statutory and compliance
            purposes.
          </Section>

          <Section n="18" title="Performance and Role Review">
            Your performance may be reviewed periodically based on responsibilities, project delivery,
            quality, timelines, client satisfaction, technical contribution, teamwork and other
            reasonable performance parameters applicable to your role.
          </Section>

          <Section n="19" title="Termination and Separation">
            Your employment may be terminated or may otherwise come to an end in accordance with
            applicable law and the Company's employment policies. On separation, you shall complete
            all reasonable handover requirements and comply with continuing confidentiality and
            intellectual-property obligations.
          </Section>

          <Section n="20" title="Continuing Obligations">
            Clauses concerning confidentiality, intellectual property, return of Company property and
            data/security obligations shall survive cessation of employment to the extent permitted by
            applicable law.
          </Section>

          <Section n="21" title="Amendments and Company Policies">
            The Company may introduce or amend reasonable policies, procedures and operational
            guidelines from time to time.
          </Section>

          <Section n="22" title="Governing Law and Jurisdiction">
            This Appointment Letter shall be governed by the laws applicable in India. Subject to
            applicable law, matters arising from this employment shall be subject to the jurisdiction
            of the competent courts/authorities in Bengaluru, Karnataka.
          </Section>

          <Section n="23" title="Acceptance">
            By signing below, you acknowledge that you have read, understood and accepted the terms
            of this Appointment Letter and confirm your joining with the Company with effect from{' '}
            {ph(f.joiningDate, 'Joining Date')}.
          </Section>

          {/* Signature block */}
          <div style={{ marginTop: '8mm' }}>
            <p style={{ fontWeight: 'bold' }}>For {co.toUpperCase()}</p>
            <p style={{ marginTop: '2mm' }}>Authorized Signatory</p>
            <p>Name: {ph(f.authorizedSignatoryName, 'Signatory Name')}</p>
            <p>Designation: {ph(f.authorizedSignatoryDesignation, 'Signatory Designation')}</p>
            <p style={{ marginTop: '8mm' }}>Signature: ______________________________</p>
            <p>Date: {ph(f.dateOfIssue, 'Date')}</p>
          </div>

          {/* Employee acceptance */}
          <div style={{ marginTop: '8mm', borderTop: '1px solid #ccc', paddingTop: '4mm' }}>
            <p style={{ fontWeight: 'bold' }}>EMPLOYEE ACKNOWLEDGEMENT AND ACCEPTANCE</p>
            <p style={{ marginTop: '2mm', textAlign: 'justify' }}>
              I, {ph(f.employeeFullName, 'Employee Name')}, acknowledge that I have received, read and
              understood this Appointment Letter and accept the terms and conditions of my employment
              with {co}.
            </p>
            <p style={{ marginTop: '4mm' }}>Employee Name: {ph(f.employeeFullName, 'Name')}</p>
            <p>Signature: ______________________________</p>
            <p>Date: {ph(f.dateOfIssue, 'Date')}</p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ width: '100%', height: '32mm', position: 'relative' }}>
          <img
            src={LETTERHEAD_FOOTER}
            alt="letterhead footer"
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ n, title, children }) {
  return (
    <div style={{ marginBottom: '3mm' }}>
      <p style={{ fontWeight: 'bold', marginBottom: '1mm' }}>{n}. {title}</p>
      <p style={{ textAlign: 'justify' }}>{children}</p>
    </div>
  );
}

// ── Editor ────────────────────────────────────────────────────────────────────
const EMPTY = {
  dateOfIssue: '', offerLetterDate: '', offerLetterJoiningDate: '',
  employeeCode: '', employeeFullName: '', employeeFirstName: '',
  designation: '', joiningDate: '', workLocation: '', reportingManager: 'management/person',
  compensation: '', compensationWords: '', incentivePercent: '15',
  registeredCompanyName: 'DutyLaunch Solutions Private Limited',
  authorizedSignatoryName: 'Moqsood Ahmed',
  authorizedSignatoryDesignation: 'Founder and CEO',
  duties: [...DEFAULT_DUTIES],
};

function LetterEditor({ letter, onSaved, onClose }) {
  const [form, setForm] = useState(() => {
    if (!letter) return { ...EMPTY };
    return {
      ...EMPTY, ...letter,
      duties: letter.duties?.length > 0 ? letter.duties : getDutiesForDesignation(letter.designation),
    };
  });
  const [empSearch, setEmpSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [savedId, setSavedId] = useState(letter?._id || null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfReady, setPdfReady] = useState(!!letter?.pdfPath);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    employeeAPI.list({ limit: 200, status: 'ACTIVE' })
      .then(r => setEmployees(r.data.data || []))
      .catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const pickEmployee = emp => {
    setEmpSearch('');
    setForm(f => {
      const desig = emp.designation || f.designation;
      const duties = f.duties?.length > 0 && f.duties !== DEFAULT_DUTIES
        ? f.duties : getDutiesForDesignation(desig);
      return {
        ...f,
        employeeCode: emp.employeeCode || f.employeeCode,
        employeeFullName: emp.fullName || f.employeeFullName,
        employeeFirstName: emp.firstName || (emp.fullName?.split(' ')[0]) || f.employeeFirstName,
        designation: desig,
        workLocation: emp.workLocation || f.workLocation,
        joiningDate: emp.dateOfJoining
          ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
          : f.joiningDate,
        duties,
      };
    });
  };

  const loadRoleDuties = (desig) => {
    const duties = getDutiesForDesignation(desig);
    setForm(f => ({ ...f, designation: desig, duties }));
  };

  const updateDuty = (i, v) => setForm(f => { const d = [...f.duties]; d[i] = v; return { ...f, duties: d }; });
  const addDuty = () => setForm(f => ({ ...f, duties: [...f.duties, ''] }));
  const removeDuty = i => setForm(f => ({ ...f, duties: f.duties.filter((_, j) => j !== i) }));
  const resetDuties = () => setForm(f => ({ ...f, duties: getDutiesForDesignation(f.designation) }));

  const validate = () => {
    const e = {};
    if (!form.employeeFullName?.trim()) e.employeeFullName = 'Required';
    if (!form.designation?.trim())      e.designation = 'Required';
    if (!form.joiningDate?.trim())      e.joiningDate = 'Required';
    if (!form.dateOfIssue?.trim())      e.dateOfIssue = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { setMsg({ type: 'error', text: 'Please fill required fields.' }); return; }
    setSaving(true); setMsg({});
    try {
      let res;
      if (savedId) {
        res = await appointmentLetterAPI.update(savedId, form);
      } else {
        res = await appointmentLetterAPI.create(form);
        setSavedId(res.data.data._id);
      }
      setMsg({ type: 'success', text: 'Saved.' });
      onSaved();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || 'Save failed.' });
    } finally { setSaving(false); }
  };

  const handleGenerate = async () => {
    if (!validate()) { setMsg({ type: 'error', text: 'Please fill required fields before generating.' }); return; }
    let id = savedId;
    if (!id) {
      setSaving(true);
      try {
        const res = await appointmentLetterAPI.create(form);
        id = res.data.data._id;
        setSavedId(id);
        onSaved();
      } catch (err) {
        setMsg({ type: 'error', text: 'Save failed.' });
        setSaving(false); return;
      }
      setSaving(false);
    } else {
      // Save latest changes first
      try { await appointmentLetterAPI.update(id, form); } catch (_) {}
    }

    setGenerating(true); setMsg({});
    try {
      await appointmentLetterAPI.generate(id);
      setPdfReady(true);
      setMsg({ type: 'success', text: 'PDF generated! Click Download.' });
      onSaved();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error?.message || 'PDF generation failed.' });
    } finally { setGenerating(false); }
  };

  const filtered = empSearch.length > 1
    ? employees.filter(e =>
        e.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
        e.employeeCode?.toLowerCase().includes(empSearch.toLowerCase()))
    : [];

  const ic = (err) => `w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400 ${
    err ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:border-primary-400'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-600" />
          <span className="font-semibold text-gray-800">Appointment Letter Builder</span>
          {savedId && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">v{letter?.version || 1}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {msg.text && (
            <span className={`flex items-center gap-1 text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {msg.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {msg.text}
            </span>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-secondary flex items-center gap-1.5 py-1.5 text-sm">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button onClick={handleGenerate} disabled={generating || saving} className="btn-primary flex items-center gap-1.5 py-1.5 text-sm">
            {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Generate PDF
          </button>
          {pdfReady && savedId && (
            <a href={appointmentLetterAPI.downloadUrl(savedId)} target="_blank" rel="noopener noreferrer"
               className="btn-secondary flex items-center gap-1.5 py-1.5 text-sm">
              <Download className="h-4 w-4" /> Download
            </a>
          )}
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Body: left form + right A4 preview */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Form ── */}
        <div className="w-full lg:w-[400px] flex-shrink-0 overflow-y-auto bg-white border-r border-gray-200 p-4 space-y-5">

          {/* Employee auto-fill */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Auto-fill from Employee
            </label>
            <div className="relative">
              <div className="flex items-center rounded-lg border border-gray-200 px-3 py-2 gap-2 bg-white">
                <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  className="flex-1 text-sm outline-none"
                  placeholder="Search by name or code…"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                />
              </div>
              {filtered.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {filtered.slice(0, 8).map(emp => (
                    <button key={emp._id} onClick={() => pickEmployee(emp)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium truncate">{emp.fullName}</span>
                      <span className="text-gray-400 text-xs flex-shrink-0">{emp.employeeCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Letter details */}
          <FS title="Letter Details">
            <FI label="Date of Issue *" error={errors.dateOfIssue}>
              <input className={ic(errors.dateOfIssue)} value={form.dateOfIssue} onChange={set('dateOfIssue')} placeholder="e.g. 15 August 2026" />
            </FI>
            <div className="grid grid-cols-2 gap-2">
              <FI label="Offer Letter Date">
                <input className={ic()} value={form.offerLetterDate} onChange={set('offerLetterDate')} placeholder="11 August 2026" />
              </FI>
              <FI label="Offer Letter Joining Date">
                <input className={ic()} value={form.offerLetterJoiningDate} onChange={set('offerLetterJoiningDate')} placeholder="1 Sep 2026" />
              </FI>
            </div>
          </FS>

          {/* Employee */}
          <FS title="Employee">
            <div className="grid grid-cols-2 gap-2">
              <FI label="Employee Code">
                <input className={ic()} value={form.employeeCode} onChange={set('employeeCode')} placeholder="EMP-001" />
              </FI>
              <FI label="Joining Date *" error={errors.joiningDate}>
                <input className={ic(errors.joiningDate)} value={form.joiningDate} onChange={set('joiningDate')} placeholder="15 August 2026" />
              </FI>
            </div>
            <FI label="Full Name (with Mr./Ms.) *" error={errors.employeeFullName}>
              <input className={ic(errors.employeeFullName)} value={form.employeeFullName} onChange={set('employeeFullName')} placeholder="Mr. Srinivas" />
            </FI>
            <div className="grid grid-cols-2 gap-2">
              <FI label="First Name">
                <input className={ic()} value={form.employeeFirstName} onChange={set('employeeFirstName')} placeholder="Srinivas" />
              </FI>
              <FI label="Work Location">
                <input className={ic()} value={form.workLocation} onChange={set('workLocation')} placeholder="Bengaluru" />
              </FI>
            </div>
            <FI label="Reporting Manager">
              <input className={ic()} value={form.reportingManager} onChange={set('reportingManager')} placeholder="management/person" />
            </FI>
          </FS>

          {/* Role & Designation */}
          <FS title="Role & Designation">
            <FI label="Designation *" error={errors.designation}>
              <input
                className={ic(errors.designation)}
                value={form.designation}
                onChange={e => loadRoleDuties(e.target.value)}
                placeholder="Full Stack Engineer"
                list="designation-suggestions"
              />
              <datalist id="designation-suggestions">
                {Object.keys(ROLE_DUTIES).map(r => <option key={r} value={r} />)}
              </datalist>
            </FI>
            <p className="text-xs text-gray-400">Duties below auto-load based on designation. You can edit them.</p>
          </FS>

          {/* Compensation */}
          <FS title="Compensation">
            <div className="grid grid-cols-2 gap-2">
              <FI label="Monthly Salary (₹)">
                <input className={ic()} value={form.compensation} onChange={set('compensation')} placeholder="30,000" />
              </FI>
              <FI label="In Words">
                <input className={ic()} value={form.compensationWords} onChange={set('compensationWords')} placeholder="Thirty Thousand" />
              </FI>
            </div>
            <FI label="Performance Incentive %">
              <input className={ic()} type="number" value={form.incentivePercent} onChange={set('incentivePercent')} placeholder="15" min="0" max="100" />
            </FI>
          </FS>

          {/* Duties */}
          <FS title="Key Duties & Responsibilities">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{form.duties.length} items</span>
              <button onClick={resetDuties} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                <RotateCcw className="h-3 w-3" /> Reset for {form.designation || 'role'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {form.duties.map((d, i) => (
                <div key={i} className="flex gap-1.5">
                  <textarea
                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary-400"
                    rows={2}
                    value={d}
                    onChange={e => updateDuty(i, e.target.value)}
                    placeholder="Duty…"
                  />
                  <button onClick={() => removeDuty(i)} className="text-red-400 hover:text-red-600 flex-shrink-0 self-start mt-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addDuty} className="text-xs text-primary-600 hover:underline mt-1">+ Add Duty</button>
          </FS>

          {/* Company & Signatory */}
          <FS title="Company & Signatory">
            <FI label="Registered Company Name">
              <input className={ic()} value={form.registeredCompanyName} onChange={set('registeredCompanyName')} />
            </FI>
            <FI label="Authorized Signatory Name">
              <input className={ic()} value={form.authorizedSignatoryName} onChange={set('authorizedSignatoryName')} placeholder="Moqsood Ahmed" />
            </FI>
            <FI label="Signatory Designation">
              <input className={ic()} value={form.authorizedSignatoryDesignation} onChange={set('authorizedSignatoryDesignation')} placeholder="Founder and CEO" />
            </FI>
          </FS>
        </div>

        {/* ── RIGHT: A4 Preview ── */}
        <div className="flex-1 overflow-hidden hidden lg:block">
          <div className="h-full overflow-auto bg-gray-400 p-4">
            <div className="text-center text-xs text-gray-100 mb-3 font-medium tracking-wide uppercase">
              Live A4 Preview · Scroll to see full letter
            </div>
            {/* A4 page scaled to fit viewport width */}
            <div className="flex justify-center">
              <div style={{
                width: '210mm',
                transform: 'scale(0.75)',
                transformOrigin: 'top center',
                marginBottom: 'calc(-25% * 297mm / 100)',
              }}>
                <A4Preview f={form} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FS({ title, children }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

function FI({ label, children, error }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {error && <span className="ml-2 text-red-500">{error}</span>}
      </label>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AppointmentLetters() {
  const { user, isElevated } = useAuth();
  const canManage = isElevated || user?.role === 'HR_ADMIN';

  const [letters, setLetters] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editor, setEditor] = useState(undefined);
  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  const fetchLetters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await appointmentLetterAPI.list({ page, limit: LIMIT });
      setLetters(res.data.data || []);
      setTotal(res.data.meta?.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetchLetters(); }, [fetchLetters]);

  const openEdit = async id => {
    try {
      const res = await appointmentLetterAPI.get(id);
      setEditor(res.data.data);
    } catch { alert('Failed to load letter.'); }
  };

  const STATUS_CLS = {
    DRAFT: 'bg-gray-100 text-gray-600',
    GENERATED: 'bg-blue-100 text-blue-700',
    ISSUED: 'bg-green-100 text-green-700',
  };

  return (
    <div>
      <PageHeader
        title="Appointment Letters"
        subtitle="Generate official A4 appointment letters with DutyLaunch letterhead"
        actions={canManage && (
          <button onClick={() => setEditor(null)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Letter
          </button>
        )}
      />

      <div className="card overflow-hidden">
        {loading ? <LoadingBlock /> : letters.length === 0 ? (
          <EmptyState icon={FileText} title="No appointment letters yet"
            description="Create your first official appointment letter."
            action={canManage && (
              <button onClick={() => setEditor(null)} className="btn-primary flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Letter
              </button>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-3 text-left">Employee</th>
                  <th className="px-4 py-3 text-left">Designation</th>
                  <th className="px-4 py-3 text-left">Joining Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Ver.</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {letters.map(l => (
                  <tr key={l._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.employeeFullName || l.employee?.fullName || '—'}</div>
                      <div className="text-xs text-gray-400">{l.employeeCode || l.employee?.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[160px] truncate">{l.designation || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{l.joiningDate || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLS[l.status] || 'bg-gray-100'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">v{l.version}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(l._id)} className="text-primary-600 hover:text-primary-800" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {l.pdfPath && (
                          <a href={appointmentLetterAPI.downloadUrl(l._id)} target="_blank" rel="noopener noreferrer"
                             className="text-green-600 hover:text-green-800" title="Download PDF">
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="btn-secondary py-1 px-2"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} className="btn-secondary py-1 px-2"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {editor !== undefined && (
        <LetterEditor letter={editor} onSaved={fetchLetters} onClose={() => setEditor(undefined)} />
      )}
    </div>
  );
}