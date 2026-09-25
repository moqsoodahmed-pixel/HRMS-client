/**
 * Single source of truth for the enumerations shared across the app.
 * These mirror the server-side Mongoose enums — keep the two in step.
 */

/** Shown in the sidebar footer and the employee profile card — the org's display name. */
export const COMPANY_NAME = 'DutyLaunch Solutions Private Limited';

export const DEPARTMENTS = [
  'Management', 'Engineering', 'Finance', 'Operations', 'HR',
  // 'Business Development' sits next to 'Sales' on purpose: AuthContext.jsx
  // canAccess() already treats any department containing "sales" or
  // "business development" as Sales-Leads-accessible (it was written ahead
  // of this department actually being selectable here), and
  // leadController.js distributeLeads() now pulls its round-robin pool from
  // both departments too — so an employee placed in Business Development
  // gets the same Sales Leads access and lead assignments a Sales employee
  // does, without any further code changes.
  'Sales', 'Business Development', 'Marketing', 'IT', 'Legal', 'Design',
];

// FOUNDER_CEO and CTO carry identical, full effective permissions (see
// AuthContext's ELEVATED_ROLES) while remaining distinct, identifiable roles
// everywhere displayed — audit logs, employee details, approvals, notifications.
// SUPER_ADMIN is kept only for backward compatibility with pre-migration accounts.
export const ROLES = ['FOUNDER_CEO', 'CTO', 'SUPER_ADMIN', 'DIRECTOR', 'IT_HEAD', 'PROJECT_HEAD', 'HR_ADMIN', 'FINANCE', 'MANAGER', 'EMPLOYEE', 'AUDITOR'];

export const ROLE_LABELS = {
  FOUNDER_CEO: 'Founder & CEO',
  CTO: 'CTO',
  SUPER_ADMIN: 'Super Admin',
  DIRECTOR: 'Director',
  IT_HEAD: 'Head of IT',
  PROJECT_HEAD: 'Project Head',
  HR_ADMIN: 'HR Admin',
  FINANCE: 'Finance',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  AUDITOR: 'Auditor',
};

/**
 * True when a role + department combination is the "Sales Team Lead" — i.e. a
 * MANAGER (the role chosen to model a sales team lead) whose department is
 * Sales or Business Development. Kept in one place so the label, the form
 * note and the dashboard all agree on exactly who counts as a Sales Team Lead.
 */
export function isSalesTeamLead(role, department) {
  return role === 'MANAGER' && /sales|business development/i.test(department || '');
}

/**
 * The role label to SHOW a human. Identical to ROLE_LABELS for everyone
 * except a Sales Team Lead (Manager in Sales/BD), who is shown as
 * "Sales Team Lead" rather than the generic "Manager" — the underlying role
 * is still MANAGER everywhere in code/permissions; this only changes display.
 */
export function roleDisplayLabel(role, department) {
  if (isSalesTeamLead(role, department)) return 'Sales Team Lead';
  return ROLE_LABELS[role] || role;
}

export const EMPLOYEE_STATUSES = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'NOTICE_PERIOD', 'INACTIVE'];
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'];
export const GENDERS = ['Male', 'Female', 'Other'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'];
export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
export const PAYSLIP_STATUSES = ['DRAFT', 'GENERATED', 'PAID'];
export const DOCUMENT_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'ARCHIVED'];
export const POLICY_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
export const ANNOUNCEMENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED'];

/** Canonical asset statuses. Legacy values are still rendered via ASSET_STATUS_LABELS. */
export const ASSET_STATUSES = ['AVAILABLE', 'ASSIGNED', 'RETURNED', 'MAINTENANCE', 'RETIRED'];
export const ASSET_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
export const ASSET_TYPES = ['Laptop', 'Desktop', 'Monitor', 'Mobile', 'Tablet', 'Peripheral', 'Furniture', 'Networking', 'Software Licence', 'Other'];

export const ASSET_STATUS_LABELS = {
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned',
  RETURNED: 'Returned',
  MAINTENANCE: 'Maintenance',
  RETIRED: 'Retired',
  UNDER_REPAIR: 'Maintenance',
  DISPOSED: 'Retired',
};

export const DOCUMENT_CATEGORIES = [
  'Aadhaar Card', 'PAN Card', 'Passport-size Photo', 'Address Proof',
  'Bank Account Details', 'Cancelled Cheque', 'PF / UAN Details', 'ESI Details',
  'Educational Certificates', 'Experience Certificate', 'Relieving Letter',
  'Emergency Contact Details', 'Nominee Details', 'Driving Licence / Passport',
  'Offer Letter', 'Contract', 'Other',
];

export const IDENTITY_TYPES = ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'OTHER'];

/**
 * UI-only grouping of the free-text DOCUMENT_CATEGORIES above into the
 * higher-level buckets the reference design shows (Identity/Address/
 * Education/Experience/Bank/Employment/Other). Purely presentational —
 * the underlying category string on EmployeeDocument is unchanged.
 */
export const DOCUMENT_CATEGORY_GROUPS = {
  Identity: ['Aadhaar Card', 'PAN Card', 'Passport-size Photo', 'Driving Licence / Passport'],
  Address: ['Address Proof'],
  Education: ['Educational Certificates'],
  Experience: ['Experience Certificate', 'Relieving Letter'],
  Bank: ['Bank Account Details', 'Cancelled Cheque', 'PF / UAN Details', 'ESI Details'],
  Employment: ['Offer Letter', 'Contract', 'Nominee Details', 'Emergency Contact Details'],
  Other: ['Other'],
};

export function documentCategoryGroup(category) {
  return Object.entries(DOCUMENT_CATEGORY_GROUPS).find(([, cats]) => cats.includes(category))?.[0] || 'Other';
}

// Mirrors server/utils/documentRequirements.js — the definitive checklist is
// computed server-side once the employee exists; this copy is only used to
// preview what will be required during the "Add Employee" wizard.
export const REQUIRED_DOCUMENT_TYPES = [
  { category: 'Aadhaar Card', label: 'Aadhaar ID', required: true },
  { category: 'Address Proof', label: 'Address Proof', required: true },
  { category: 'PAN Card', label: 'PAN / Tax Document', required: true },
  { category: 'Bank Account Details', label: 'Bank Account Details', required: true },
  { category: 'Cancelled Cheque', label: 'Cancelled Cheque / Bank Proof', required: false },
  { category: 'Educational Certificates', label: 'Educational Certificate', required: true },
  { category: 'Experience Certificate', label: 'Experience Letter', required: false },
  { category: 'Passport-size Photo', label: 'Passport-size Photograph', required: true },
  { category: 'Offer Letter', label: 'Employment Agreement', required: true },
];

export const POLICY_CATEGORIES = ['HR', 'Conduct', 'IT', 'Finance', 'Compliance', 'Operations', 'Health & Safety', 'Other'];

export const TASK_CATEGORIES = ['Documentation', 'IT Setup', 'IT', 'HR', 'Finance', 'Training', 'Assets', 'Other'];

export const HOLIDAY_TYPES = ['NATIONAL', 'FESTIVAL', 'OPTIONAL', 'COMPANY'];

export const TRAINING_ASSIGNMENT_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'];
export const TRAINING_MATERIAL_TYPES = [
  { value: 'FILE', label: 'Upload a file' },
  { value: 'VIDEO_URL', label: 'Video URL' },
  { value: 'LINK', label: 'External link' },
];

export const PERFORMANCE_REVIEW_STATUSES = ['DRAFT', 'SUBMITTED', 'COMPLETED'];

export const EXIT_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'];
export const RATING_LABELS = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

/** Accepted upload types, mirroring the server's multer filter. */
export const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.docx,.csv,.xls,.xlsx';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Tailwind tone used by StatusBadge, keyed by status value. */
export const STATUS_TONES = {
  // Employee
  ACTIVE: 'green', INACTIVE: 'gray', PROBATION: 'amber', NOTICE_PERIOD: 'orange', ON_LEAVE: 'blue',
  // Attendance
  PRESENT: 'green', ABSENT: 'red', LATE: 'amber', HALF_DAY: 'purple',
  WORK_FROM_HOME: 'indigo', HOLIDAY: 'gray', WEEKEND: 'gray',
  // Leave / documents / policies / payslips
  PENDING: 'amber', APPROVED: 'green', REJECTED: 'red', CANCELLED: 'gray',
  VERIFIED: 'green', ARCHIVED: 'gray',
  DRAFT: 'gray', PUBLISHED: 'green',
  GENERATED: 'blue', PAID: 'green',
  // Document checklist (required-document tracking)
  MISSING: 'red', UPLOADED: 'blue', UNDER_REVIEW: 'amber', COMPLETE: 'green',
  // Assets
  AVAILABLE: 'green', ASSIGNED: 'blue', RETURNED: 'gray', MAINTENANCE: 'amber', RETIRED: 'red',
  UNDER_REPAIR: 'amber', DISPOSED: 'red',
  NEW: 'green', GOOD: 'green', FAIR: 'amber', POOR: 'orange', DAMAGED: 'red',
  // Tasks
  TODO: 'gray', IN_PROGRESS: 'blue', COMPLETED: 'green', BLOCKED: 'red', SKIPPED: 'gray',
  NOT_STARTED: 'gray',
  // Employee self-service onboarding wizard
  SUBMITTED: 'blue',
  // Announcement priority
  LOW: 'gray', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red',
  // Holiday type
  NATIONAL: 'blue', FESTIVAL: 'purple',
  // Training assignment status
  ASSIGNED: 'gray',
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];