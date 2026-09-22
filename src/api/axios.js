import axios from 'axios';

/**
 * Shared API client. Auth is cookie based, so every request carries credentials
 * and no token juggling is needed on this side.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Guards a single in-flight "is the session actually gone?" check so that
// e.g. a dashboard's 10 parallel requests all 401ing at once triggers one
// re-check and, at most, one redirect — never a redirect storm.
let sessionCheck = null;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    const isAuthProbe = url.includes('/auth/me') || url.includes('/auth/login');

    // 403 = authenticated but not authorized (RBAC). That is never a reason
    // to sign the user out — only a genuinely invalid/expired session (401)
    // on a real endpoint gets here. The initial /auth/me probe and the login
    // call itself handle their own 401s locally (unauthenticated state /
    // invalid-credentials message) and must never trigger this redirect.
    if (status !== 401 || isAuthProbe || window.location.pathname.startsWith('/login')) {
      return Promise.reject(err);
    }

    // A single 401 could in principle be a transient blip, so confirm the
    // session is truly gone with one /auth/me call before disrupting the
    // user — and share that confirmation across every concurrent 401 rather
    // than re-checking (or redirecting) once per failed request.
    if (!sessionCheck) {
      sessionCheck = api.get('/auth/me')
        .catch(() => {
          window.location.href = '/login';
        })
        .finally(() => {
          sessionCheck = null;
        });
    }
    return Promise.reject(err);
  },
);

export default api;

/** Every endpoint returns `{ data, meta? }`; these helpers unwrap that shape. */
export const unwrap = (res) => res?.data?.data;
export const unwrapMeta = (res) => res?.data?.meta;

/** Drops empty filter values so they never reach the query string. */
function clean(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined),
  );
}

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

export const employeeAPI = {
  list: (params) => api.get('/employees', { params: clean(params) }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.patch(`/employees/${id}`, data),
  archive: (id) => api.post(`/employees/${id}/archive`),
  delete: (id) => api.delete(`/employees/${id}`),
  changePassword: (id, data) => api.patch(`/employees/${id}/password`, data),
  options: () => api.get('/employees/options'),
  uploadPhoto: (id, formData) => api.post(`/employees/${id}/photo`, formData),
  import: (rows) => api.post('/employees/import', { rows }),
};

/**
 * Employee self-service "request a profile change" — new, minimal flow (see
 * server/controllers/employeeEditRequestController.js). Not part of the
 * onboarding system; changes only ever apply once HR/Admin approves them.
 */
export const editRequestAPI = {
  create: (data) => api.post('/employees/edit-requests/me', data),
  list: (params) => api.get('/employees/edit-requests', { params: clean(params) }),
  get: (id) => api.get(`/employees/edit-requests/${id}`),
  approve: (id) => api.patch(`/employees/edit-requests/${id}/approve`),
  reject: (id, reason) => api.patch(`/employees/edit-requests/${id}/reject`, { reason }),
};

export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
};

export const attendanceAPI = {
  list: (params) => api.get('/attendance', { params: clean(params) }),
  stats: (params) => api.get('/attendance/stats', { params: clean(params) }),
  today: () => api.get('/attendance/me/today'),
  checkIn: () => api.post('/attendance/checkin'),
  checkOut: () => api.post('/attendance/checkout'),
  undoCheckOut: () => api.post('/attendance/checkout/undo'),
  breakStart: () => api.post('/attendance/break/start'),
  breakEnd: () => api.post('/attendance/break/end'),
  mark: (data) => api.post('/attendance', data),
  update: (id, data) => api.patch(`/attendance/${id}`, data),
};

/** Employee-submitted attendance correction / unlock requests — new, minimal flow (see server/controllers/attendanceRequestController.js). */
export const attendanceRequestAPI = {
  create: (data) => api.post('/attendance/requests', data),
  list: (params) => api.get('/attendance/requests', { params: clean(params) }),
  get: (id) => api.get(`/attendance/requests/${id}`),
  approve: (id) => api.patch(`/attendance/requests/${id}/approve`),
  reject: (id, reason) => api.patch(`/attendance/requests/${id}/reject`, { reason }),
};

/** Shift management — new, minimal (see server/models/Shift.js). */
export const shiftAPI = {
  list: (params) => api.get('/shifts', { params: clean(params) }),
  create: (data) => api.post('/shifts', data),
  update: (id, data) => api.patch(`/shifts/${id}`, data),
  assign: (employeeId, shiftId) => api.patch(`/employees/${employeeId}/shift`, { shiftId }),
};

export const leaveAPI = {
  types: (params) => api.get('/leave/types', { params: clean(params) }),
  createType: (data) => api.post('/leave/types', data),
  updateType: (id, data) => api.patch(`/leave/types/${id}`, data),
  stats: (params) => api.get('/leave/stats', { params: clean(params) }),
  requests: (params) => api.get('/leave/requests', { params: clean(params) }),
  create: (data) => api.post('/leave/requests', data),
  approve: (id, note) => api.patch(`/leave/requests/${id}/approve`, { note }),
  reject: (id, reason) => api.patch(`/leave/requests/${id}/reject`, { reason }),
  cancel: (id) => api.patch(`/leave/requests/${id}/cancel`),
  myBalances: (params) => api.get('/leave/balances/me', { params: clean(params) }),
  balances: (employeeId, params) => api.get(`/leave/balances/${employeeId}`, { params: clean(params) }),
  holidays: (params) => api.get('/leave/holidays', { params: clean(params) }),
  createHoliday: (data) => api.post('/leave/holidays', data),
  updateHoliday: (id, data) => api.patch(`/leave/holidays/${id}`, data),
  deleteHoliday: (id) => api.delete(`/leave/holidays/${id}`),
};

export const payrollAPI = {
  summary: (params) => api.get('/payroll/summary', { params: clean(params) }),
  salaryStructures: (params) => api.get('/payroll/salary', { params: clean(params) }),
  salaryFor: (employeeId) => api.get(`/payroll/salary/${employeeId}`),
  createSalary: (employeeId, data) => api.post(`/payroll/salary/${employeeId}`, data),
  payslips: (params) => api.get('/payroll/payslips', { params: clean(params) }),
  generate: (data) => api.post('/payroll/payslips/generate', data),
  generateBulk: (data) => api.post('/payroll/payslips/generate-bulk', data),
  setStatus: (id, status) => api.patch(`/payroll/payslips/${id}/status`, { status }),
  download: (id) => api.get(`/payroll/payslips/${id}/download`, { responseType: 'blob' }),
};

/**
 * Compensation change requests — HR requests a salary/allowance change, only
 * a platform administrator (SUPER_ADMIN/CTO) can approve or reject it. See
 * server/controllers/compensationController.js for the enforcement.
 */
export const compensationAPI = {
  list: (params) => api.get('/payroll/compensation-requests', { params: clean(params) }),
  get: (id) => api.get(`/payroll/compensation-requests/${id}`),
  create: (data) => api.post('/payroll/compensation-requests', data),
  approve: (id, comments) => api.patch(`/payroll/compensation-requests/${id}/approve`, { comments }),
  reject: (id, comments) => api.patch(`/payroll/compensation-requests/${id}/reject`, { comments }),
  cancel: (id) => api.patch(`/payroll/compensation-requests/${id}/cancel`),
};

export const documentAPI = {
  list: (params) => api.get('/documents', { params: clean(params) }),
  stats: () => api.get('/documents/stats'),
  forEmployee: (employeeId) => api.get(`/employees/${employeeId}/documents`),
  checklist: (employeeId) => api.get(`/employees/${employeeId}/documents/checklist`),
  upload: (formData, onUploadProgress) =>
    api.post('/documents/upload', formData, { onUploadProgress }),
  download: (id) => api.get(`/documents/${id}/download?dl=1`, { responseType: 'blob' }),
  /** Fetches document as blob for in-browser viewing */
  view: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  /** Direct URL for opening a document inline */
  viewUrl: (id) => `${import.meta.env.VITE_API_URL || '/api'}/documents/${id}/download`,
  verify: (id) => api.patch(`/documents/${id}/verify`),
  reject: (id, reason) => api.patch(`/documents/${id}/reject`, { reason }),
  archive: (id) => api.patch(`/documents/${id}/archive`),
  updateExtractedData: (id, extractedData) => api.patch(`/documents/${id}/extracted-data`, { extractedData }),
  identity: {
    list: (employeeId) => api.get(`/employees/${employeeId}/identity`),
    save: (employeeId, data) => api.post(`/employees/${employeeId}/identity`, data),
    reveal: (employeeId, docType) => api.post(`/employees/${employeeId}/identity/${docType}/reveal`),
  },
};

export const policyAPI = {
  list: (params) => api.get('/policies', { params: clean(params) }),
  get: (id) => api.get(`/policies/${id}`),
  create: (data) => api.post('/policies', data),
  update: (id, data) => api.patch(`/policies/${id}`, data),
  publish: (id) => api.patch(`/policies/${id}/publish`),
  archive: (id) => api.patch(`/policies/${id}/archive`),
  acknowledge: (id) => api.post(`/policies/${id}/acknowledge`),
};

export const announcementAPI = {
  list: (params) => api.get('/announcements', { params: clean(params) }),
  create: (data) => api.post('/announcements', data),
  update: (id, data) => api.patch(`/announcements/${id}`, data),
  remove: (id) => api.delete(`/announcements/${id}`),
  markRead: (id) => api.post(`/announcements/${id}/read`),
};

export const assetAPI = {
  list: (params) => api.get('/assets', { params: clean(params) }),
  stats: () => api.get('/assets/stats'),
  get: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.patch(`/assets/${id}`, data),
  assign: (id, data) => api.post(`/assets/${id}/assign`, data),
  returnAsset: (id, data) => api.post(`/assets/${id}/return`, data),
  history: (id) => api.get(`/assets/${id}/history`),
};

export const onboardingAPI = {
  overview: (params) => api.get('/onboarding', { params: clean(params) }),
  forEmployee: (employeeId) => api.get(`/onboarding/${employeeId}`),
  applyTemplate: (employeeId) => api.post(`/onboarding/${employeeId}/template`),
  createTask: (data) => api.post('/onboarding', data),
  updateTask: (id, data) => api.patch(`/onboarding/task/${id}`, data),
  deleteTask: (id) => api.delete(`/onboarding/task/${id}`),
};

/**
 * Employee self-service onboarding wizard (Personal/Education/Experience/
 * Bank/Emergency/Documents/Review). Separate from `onboardingAPI` above,
 * which drives the HR-run onboarding *task checklist* — these hit
 * /onboarding-profile* on the server, not /onboarding.
 */
export const onboardingProfileAPI = {
  me: () => api.get('/onboarding-profile/me'),
  saveStep: (stepKey, data) => api.put(`/onboarding-profile/me/step/${stepKey}`, data),
  submit: () => api.post('/onboarding-profile/me/submit'),
  list: (params) => api.get('/onboarding-profile', { params: clean(params) }),
  get: (employeeId) => api.get(`/onboarding-profile/${employeeId}`),
  approve: (employeeId) => api.patch(`/onboarding-profile/${employeeId}/approve`),
  reject: (employeeId, reason) => api.patch(`/onboarding-profile/${employeeId}/reject`, { reason }),
};

/** Training catalog + assignments — new, minimal (see server/controllers/trainingController.js). */
export const trainingAPI = {
  list: (params) => api.get('/training', { params: clean(params) }),
  stats: () => api.get('/training/stats'),
  get: (id) => api.get(`/training/${id}`),
  create: (formData) => api.post('/training', formData),
  update: (id, data) => api.patch(`/training/${id}`, data),
  deactivate: (id) => api.delete(`/training/${id}`),
  assign: (id, employeeIds) => api.post(`/training/${id}/assign`, { employeeIds }),
  assignees: (id) => api.get(`/training/${id}/assignees`),
  myAssignments: () => api.get('/training/assignments/me'),
  updateMyAssignment: (id, status) => api.patch(`/training/assignments/me/${id}`, { status }),
  download: (id) => api.get(`/training/${id}/download`, { responseType: 'blob' }),
  downloadUrl: (id) => `${import.meta.env.VITE_API_URL || '/api'}/training/${id}/download`,
};

/** Performance reviews — new, minimal (see server/controllers/performanceController.js). */
export const performanceAPI = {
  list: (params) => api.get('/performance-reviews', { params: clean(params) }),
  stats: () => api.get('/performance-reviews/stats'),
  get: (id) => api.get(`/performance-reviews/${id}`),
  myReviews: () => api.get('/performance-reviews/me'),
  create: (data) => api.post('/performance-reviews', data),
  update: (id, data) => api.patch(`/performance-reviews/${id}`, data),
  submit: (id) => api.patch(`/performance-reviews/${id}/submit`),
  complete: (id) => api.patch(`/performance-reviews/${id}/complete`),
  remove: (id) => api.delete(`/performance-reviews/${id}`),
};

/** Employee-initiated exit requests — new, minimal (see server/controllers/exitRequestController.js). */
export const exitRequestAPI = {
  create: (data) => api.post('/exit-requests/me', data),
  mine: () => api.get('/exit-requests/me'),
  cancel: (id) => api.patch(`/exit-requests/me/${id}/cancel`),
  list: (params) => api.get('/exit-requests', { params: clean(params) }),
  get: (id) => api.get(`/exit-requests/${id}`),
  approve: (id) => api.patch(`/exit-requests/${id}/approve`),
  reject: (id, reason) => api.patch(`/exit-requests/${id}/reject`, { reason }),
  complete: (id) => api.patch(`/exit-requests/${id}/complete`),
};

/** Organization settings — new, minimal, elevated-only (see server/controllers/orgSettingsController.js). */
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.patch('/settings', data),
  telegramTest: () => api.post('/settings/telegram/test'),
  dailyReportTelegramTest: () => api.post('/settings/telegram/test-daily-report'),
};

export const offboardingAPI = {
  overview: (params) => api.get('/offboarding', { params: clean(params) }),
  forEmployee: (employeeId) => api.get(`/offboarding/${employeeId}`),
  clearance: (employeeId) => api.get(`/offboarding/${employeeId}/clearance`),
  initiate: (employeeId, data) => api.post(`/offboarding/${employeeId}/initiate`, data),
  applyTemplate: (employeeId) => api.post(`/offboarding/${employeeId}/template`),
  createTask: (data) => api.post('/offboarding', data),
  updateTask: (id, data) => api.patch(`/offboarding/task/${id}`, data),
  deleteTask: (id) => api.delete(`/offboarding/task/${id}`),
};

export const reportAPI = {
  employees: (params) => api.get('/reports/employees', { params: clean(params) }),
  attendance: (params) => api.get('/reports/attendance', { params: clean(params) }),
  leave: (params) => api.get('/reports/leave', { params: clean(params) }),
  payroll: (params) => api.get('/reports/payroll', { params: clean(params) }),
  assets: (params) => api.get('/reports/assets', { params: clean(params) }),
  lifecycle: (params) => api.get('/reports/lifecycle', { params: clean(params) }),
};

export const auditAPI = {
  list: (params) => api.get('/audit', { params: clean(params) }),
  get: (id) => api.get(`/audit/${id}`),
  filters: () => api.get('/audit/filters'),
};

export const notificationAPI = {
  list: (params) => api.get('/notifications', { params: clean(params) }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const leadsAPI = {
  preview: (formData) => api.post('/leads/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  upload: (formData) => api.post('/leads/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (params) => api.get('/leads', { params: clean(params) }),
  get: (id) => api.get(`/leads/${id}`),
  updateStatus: (id, data) => api.patch(`/leads/${id}/status`, data),
  reassign: (id, data) => api.patch(`/leads/${id}/assign`, data),
  // Re-splits every lead evenly across the CURRENTLY active Sales/Business
  // Development team — for when someone joined the team after the last
  // file import and so never received any leads in that round-robin.
  rebalance: () => api.post('/leads/rebalance'),
  stats: (params) => api.get('/leads/stats', { params: clean(params) }),
  batches: () => api.get('/leads/batches'),
  deleteBatch: (batch) => api.delete(`/leads/batch/${encodeURIComponent(batch)}`),
  reveal: (id) => api.post(`/leads/${id}/reveal`),
};

export const dailyReportAPI = {
  create: (data) => api.post('/daily-reports', data),
  update: (id, data) => api.patch(`/daily-reports/${id}`, data),
  submit: (id) => api.post(`/daily-reports/${id}/submit`),
  review: (id, data) => api.post(`/daily-reports/${id}/review`, data),
  mine: (params) => api.get('/daily-reports/me', { params: clean(params) }),
  list: (params) => api.get('/daily-reports', { params: clean(params) }),
  get: (id) => api.get(`/daily-reports/${id}`),
  stats: () => api.get('/daily-reports/stats'),
};

export const appointmentLetterAPI = {
  create: (data) => api.post('/appointment-letters', data),
  list: (params) => api.get('/appointment-letters', { params: clean(params) }),
  get: (id) => api.get(`/appointment-letters/${id}`),
  update: (id, data) => api.patch(`/appointment-letters/${id}`, data),
  generate: (id) => api.post(`/appointment-letters/${id}/generate`),
  downloadUrl: (id) => `${import.meta.env.VITE_API_URL || '/api'}/appointment-letters/${id}/pdf`,
  downloadPDF: async (id, filename) => {
    const res = await api.get(`/appointment-letters/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `appointment_letter_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};