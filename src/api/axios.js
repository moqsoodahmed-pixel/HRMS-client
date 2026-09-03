import axios from 'axios';

/**
 * Shared API client. Auth is cookie based, so every request carries credentials
 * and no token juggling is needed on this side.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const isAuthProbe = err.config?.url?.includes('/auth/me') || err.config?.url?.includes('/auth/login');
    // An expired session anywhere else means the user must sign in again.
    if (status === 401 && !isAuthProbe && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
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
  options: () => api.get('/employees/options'),
  uploadPhoto: (id, formData) => api.post(`/employees/${id}/photo`, formData),
  import: (rows) => api.post('/employees/import', { rows }),
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
  mark: (data) => api.post('/attendance', data),
  update: (id, data) => api.patch(`/attendance/${id}`, data),
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
  /** Direct URL for opening a document inline — the auth cookie travels with it. */
  viewUrl: (id) => `/api/documents/${id}/download`,
  verify: (id) => api.patch(`/documents/${id}/verify`),
  reject: (id, reason) => api.patch(`/documents/${id}/reject`, { reason }),
  archive: (id) => api.patch(`/documents/${id}/archive`),
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
