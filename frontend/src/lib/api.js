import axios from 'axios'
import { computeOnTime } from './kpi'
import { computeWorkHourCompletion } from './workHour'
import { computeWorkHourLost } from './workHourLost'
import { computeLeaveAnalysis } from './leaveAnalysis'

// Auto-detect API base URL: use same hostname as frontend
// Backend must be running (e.g. scripts\windows\run_backend.bat → port 8081).
// Override with VITE_API_BASE in frontend .env if your backend uses another port.
const getApiBase = () => {
  // Allow override via environment variable
  if (import.meta.env.VITE_API_BASE) {
    console.log('[API] Using VITE_API_BASE:', import.meta.env.VITE_API_BASE)
    return import.meta.env.VITE_API_BASE
  }
  // Use the same hostname as the frontend, but with backend port (default 8081)
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  const apiBase = `${protocol}//${hostname}:8081`
  console.log('[API] Using dynamic API base:', apiBase)
  return apiBase
}

export const API_BASE = getApiBase()
console.log('[API] Final API_BASE:', API_BASE)

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 120 seconds (2 minutes) timeout for large data processing
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 and connection errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_EMPTY_RESPONSE' || error.message === 'Network Error' || !error.response) {
      console.error('[API] Cannot reach backend at', API_BASE, '— is it running? Start with: scripts\\windows\\run_backend.bat')
    }
    if (error.response?.status === 401) {
      // Don't redirect if this was the login request — let the login page show the error
      const isLoginRequest = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/login')
      if (!isLoginRequest) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export async function uploadFiles(files) {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listFiles() {
  const { data } = await api.get('/files/')
  return data
}

export async function getFileDetail(id) {
  const { data } = await api.get(`/files/${id}`)
  return data
}

export async function deleteFiles(ids) {
  const { data } = await api.delete('/files/', { data: { file_ids: ids } })
  return data
}

export async function getOnTime(groupBy) {
  try {
    const { data } = await api.get(`/kpi/simple/${groupBy}`)
    return data
  } catch (e) {
    // fall back to local computation from uploaded rows
    try {
      const files = (await api.get('/files/')).data
      const allRows = []
      for (const f of files) {
        const detail = (await api.get(`/files/${f.id}`)).data
        allRows.push(...detail.rows)
      }
      return computeOnTime(allRows, groupBy)
    } catch (e3) {
      throw e3
    }
  }
}

export async function getWorkHourLost(groupBy) {
  try {
    const { data } = await api.get(`/work_hour/lost/${groupBy}`)
    return data
  } catch (e) {
    try {
      const files = (await api.get('/files/')).data
      const allRows = []
      for (const f of files) {
        const detail = (await api.get(`/files/${f.id}`)).data
        allRows.push(...detail.rows)
      }
      return computeWorkHourLost(allRows, groupBy)
    } catch (e3) {
      throw e3
    }
  }
}

export async function getWorkHourCompletion(groupBy) {
  try {
    const { data } = await api.get(`/work_hour/completion/${groupBy}`)
    return data
  } catch (e) {
    // fall back to local computation from uploaded rows
    try {
      const files = (await api.get('/files/')).data
      const allRows = []
      for (const f of files) {
        const detail = (await api.get(`/files/${f.id}`)).data
        allRows.push(...detail.rows)
      }
      return computeWorkHourCompletion(allRows, groupBy)
    } catch (e3) {
      throw e3
    }
  }
}

export async function getLeaveAnalysis(groupBy) {
  try {
    const { data } = await api.get(`/work_hour/leave/${groupBy}`)
    return data
  } catch (e) {
    // fall back to local computation from uploaded rows
    try {
      const files = (await api.get('/files/')).data
      const allRows = []
      for (const f of files) {
        const detail = (await api.get(`/files/${f.id}`)).data
        allRows.push(...detail.rows)
      }
      return computeLeaveAnalysis(allRows, groupBy)
    } catch (e3) {
      throw e3
    }
  }
}

export async function getWeeklyAnalysis(groupBy, breakdown = null) {
  try {
    const url = breakdown
      ? `/work_hour/weekly/${groupBy}?breakdown=${encodeURIComponent(breakdown)}`
      : `/work_hour/weekly/${groupBy}`
    const { data } = await api.get(url)
    return data
  } catch (e) {
    throw e
  }
}

// ===== App Config (CTC per hour for cost calculations) =====

export async function getCtcPerHour() {
  const { data } = await api.get('/config/ctc-per-hour')
  return data
}

export async function setCtcPerHour(value) {
  const { data } = await api.put('/config/ctc-per-hour', { value })
  return data
}

/** Function-wise average CTC per employee per hour (BDT). Returns { functions, ctc_by_function }. */
export async function getCtcPerHourByFunction() {
  const { data } = await api.get('/config/ctc-per-hour-by-function')
  return data
}

export async function setCtcPerHourByFunction(ctcByFunction) {
  const { data } = await api.put('/config/ctc-per-hour-by-function', { ctc_by_function: ctcByFunction })
  return data
}

export async function getODAnalysis(groupBy) {
  const { data } = await api.get(`/work_hour/od/${groupBy}`)
  return data
}

// ===== Dashboard Summary API (Optimized) =====

export async function getDashboardSummary(groupBy = 'function') {
  const { data } = await api.get(`/dashboard/summary?group_by=${groupBy}`)
  return data
}

// ===== Authentication APIs =====

export async function login(username, password) {
  const { data } = await api.post('/auth/login', { username, password })
  return data
}

export async function register(userData) {
  const { data } = await api.post('/auth/register', userData)
  return data
}

export async function getCurrentUser() {
  const { data } = await api.get('/auth/me')
  return data
}

export async function logout() {
  const { data } = await api.post('/auth/logout')
  return data
}

// ===== User Management APIs (Admin) =====

export async function getUsers() {
  const { data } = await api.get('/users/')
  return data
}

export async function createUser(userData) {
  const { data } = await api.post('/users/', userData)
  return data
}

export async function updateUser(userId, userData) {
  const { data } = await api.put(`/users/${userId}`, userData)
  return data
}

export async function deleteUser(userId) {
  const { data } = await api.delete(`/users/${userId}`)
  return data
}

/** Bulk delete users by IDs. Returns { deleted, skipped }. Skips self and admins. */
export async function deleteUsers(userIds) {
  const { data } = await api.post('/users/bulk-delete', { user_ids: userIds })
  return data
}

/** Get allowed_companies, allowed_functions, allowed_departments from hierarchy for an employee + level. Admin only. */
export async function getScopeFromHierarchy(employeeEmail, dataScopeLevel, employeeFileId = null) {
  const params = new URLSearchParams({ employee_email: employeeEmail, data_scope_level: dataScopeLevel })
  if (employeeFileId != null) params.set('employee_file_id', String(employeeFileId))
  const { data } = await api.get(`/users/scope-from-hierarchy?${params.toString()}`)
  return data
}

/** Sync each user's role and data_scope_level from Employee List hierarchy (N, N-1, N-2). Admin only. */
export async function syncUsersRolesFromHierarchy() {
  const { data } = await api.post('/users/sync-roles-from-hierarchy')
  return data
}

/** Download Excel template for bulk user upload. Columns: Employee Name, Designation, Function, Email (Official), Username. */
export async function downloadUserBulkTemplate() {
  const { data } = await api.get('/users/bulk-upload/template', { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([data]))
  const a = document.createElement('a')
  a.href = url
  a.download = 'bulk_users_template.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Bulk create users from Excel. Default password: 123456. Returns { created, skipped, errors, details }. */
export async function bulkUploadUsers(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/users/bulk-upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// ===== Roles API (Admin) =====

export async function getRoles() {
  const { data } = await api.get('/roles/')
  return data
}

export async function createRole(payload) {
  const { data } = await api.post('/roles/', payload)
  return data
}

export async function updateRole(roleId, payload) {
  const { data } = await api.put(`/roles/${roleId}`, payload)
  return data
}

export async function deleteRole(roleId) {
  const { data } = await api.delete(`/roles/${roleId}`)
  return data
}

// ===== MS Teams APIs =====

export async function uploadTeamsFiles(files, fromMonth, toMonth) {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  if (fromMonth) form.append('from_month', fromMonth)
  if (toMonth) form.append('to_month', toMonth)
  const { data } = await api.post('/teams/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listTeamsFiles() {
  const { data } = await api.get('/teams/files/')
  return data
}

export async function getTeamsFileDetail(id) {
  const { data } = await api.get(`/teams/files/${id}`)
  return data
}

export async function deleteTeamsFiles(ids) {
  const { data } = await api.delete('/teams/files/', { data: { file_ids: ids } })
  return data
}

export async function getTeamsUserActivity(fileId, employeeFileId = null) {
  const params = {}
  if (fileId) params.file_id = fileId
  if (employeeFileId) params.employee_file_id = employeeFileId
  const { data } = await api.get('/teams/analytics/user-activity', { params })
  return data
}

export async function getTeamsFunctionActivity(teamsFileId, employeeFileId) {
  const params = {}
  if (teamsFileId) params.teams_file_id = teamsFileId
  if (employeeFileId) params.employee_file_id = employeeFileId
  const { data } = await api.get('/teams/analytics/function-activity', { params })
  return data
}

export async function getTeamsCompanyActivity(teamsFileId, employeeFileId) {
  const params = {}
  if (teamsFileId) params.teams_file_id = teamsFileId
  if (employeeFileId) params.employee_file_id = employeeFileId
  const { data } = await api.get('/teams/analytics/company-activity', { params })
  return data
}

export async function getTeamsCXOActivity(fileId) {
  const params = {}
  if (fileId) params.file_id = fileId
  const { data } = await api.get('/teams/analytics/cxo-activity', { params })
  return data
}

// ===== CXO Management APIs =====

export async function listCXOUsers() {
  const { data } = await api.get('/cxo/')
  return data
}

export async function listEmployeesWithCXOStatus(employeeFileId) {
  const params = {}
  if (employeeFileId) params.employee_file_id = employeeFileId
  const { data } = await api.get('/cxo/employees', { params })
  return data
}

export async function markEmployeeAsCXO(email) {
  const { data } = await api.post('/cxo/mark', { email })
  return data
}

export async function unmarkEmployeeAsCXO(email) {
  await api.delete(`/cxo/unmark/${encodeURIComponent(email)}`)
}

export async function addCXOUser(email) {
  const { data } = await api.post('/cxo/', { email })
  return data
}

export async function removeCXOUser(cxoId) {
  await api.delete(`/cxo/${cxoId}`)
}

// ===== Employee List APIs =====

export async function uploadEmployeeFiles(files) {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  const { data } = await api.post('/employee/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listEmployeeFiles() {
  const { data } = await api.get('/employee/files/')
  return data
}

export async function getEmployeeFileDetail(id) {
  const { data } = await api.get(`/employee/files/${id}`)
  return data
}

export async function deleteEmployeeFiles(ids) {
  const { data } = await api.delete('/employee/files/', { data: { file_ids: ids } })
  return data
}

/** Employee list with N, N-1, N-2 hierarchy (admin). Optional employeeFileId. */
export async function getEmployeeHierarchy(employeeFileId = null) {
  const params = employeeFileId != null ? { employee_file_id: employeeFileId } : {}
  const { data } = await api.get('/employee/files/hierarchy', { params })
  return data
}

/** Organogram: supervisor and their direct subordinates from Employee List (admin). */
export async function getOrganogram(employeeFileId = null) {
  const params = employeeFileId != null ? { employee_file_id: employeeFileId } : {}
  const { data } = await api.get('/employee/files/organogram', { params })
  return data
}

/** Unique functions, departments, companies from employee list (admin; for user form multi-select). */
export async function getScopeOptions(employeeFileId = null) {
  const params = employeeFileId != null ? { employee_file_id: employeeFileId } : {}
  const { data } = await api.get('/employee/files/scope-options', { params })
  return data
}

/** Raw row from Employee List file for an email (shows exact column names and values from the Excel). */
export async function getEmployeeRowByEmail(email, employeeFileId = null) {
  const params = { email }
  if (employeeFileId != null) params.employee_file_id = employeeFileId
  const { data } = await api.get('/employee/files/row-by-email', { params })
  return data
}

/** Current user data scope: N = all, N-1 = function + depts, N-2 = department only; visible_tabs. */
export async function getMyScope() {
  const { data } = await api.get('/users/me/scope')
  return data
}

// ===== Teams App Usage APIs =====

export async function uploadTeamsAppFiles(files, fromMonth, toMonth) {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  if (fromMonth) form.append('from_month', fromMonth)
  if (toMonth) form.append('to_month', toMonth)
  const { data } = await api.post('/teams/app/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listTeamsAppFiles() {
  const { data } = await api.get('/teams/app/files/')
  return data
}

export async function getTeamsAppFileDetail(id) {
  const { data } = await api.get(`/teams/app/files/${id}`)
  return data
}

export async function deleteTeamsAppFiles(ids) {
  // Use POST instead of DELETE for better compatibility with request bodies
  // Some HTTP clients/proxies don't support DELETE with request bodies
  try {
    const { data } = await api.post('/teams/app/files/delete', { file_ids: ids })
    return data
  } catch (error) {
    // Fallback to DELETE if POST fails
    console.warn('POST delete failed, trying DELETE:', error)
    const { data } = await api.delete('/teams/app/files/', { data: { file_ids: ids } })
    return data
  }
}

export async function getTeamsAppActivity(fileId) {
  const params = {}
  if (fileId) params.file_id = fileId
  const { data } = await api.get('/teams/app/analytics/app-activity', { params })
  return data
}

// ===== Teams License APIs =====

export async function getTeamsLicense() {
  const { data } = await api.get('/teams/license/')
  return data
}

export async function updateTeamsLicense(licenseData) {
  const { data } = await api.put('/teams/license/', licenseData)
  return data
}

/** Upload MS Teams User List Excel (Teams + CBL_Teams sheets). Returns { total_assigned, by_sheet, total_teams, free, rows }. Saves to DB. */
export async function uploadTeamsUserList(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/teams/user-list/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Get the latest Teams User List from the database (persisted from last upload). */
export async function getLatestTeamsUserList() {
  const { data } = await api.get('/teams/user-list/latest')
  return data
}

