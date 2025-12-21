import axios from 'axios'
import { computeOnTime } from './kpi'
import { computeWorkHourCompletion } from './workHour'
import { computeWorkHourLost } from './workHourLost'
import { computeLeaveAnalysis } from './leaveAnalysis'

// Auto-detect API base URL: use localhost if accessing locally, otherwise use server IP
// This allows the app to work both locally and from other PCs on the network
const getApiBase = () => {
  // Allow override via environment variable
  if (import.meta.env.VITE_API_BASE) {
    console.log('[API] Using VITE_API_BASE:', import.meta.env.VITE_API_BASE)
    return import.meta.env.VITE_API_BASE
  }
  
  // Auto-detect: if accessing via localhost, use localhost for API
  // Otherwise use the server IP
  const hostname = window.location.hostname
  console.log('[API] Detected hostname:', hostname)
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const apiBase = 'http://localhost:8081'
    console.log('[API] Using localhost API:', apiBase)
    return apiBase
  }
  
  // Default to server IP for network access
  const apiBase = 'http://172.16.50.50:8081'
  console.log('[API] Using server IP API:', apiBase)
  return apiBase
}

export const API_BASE = getApiBase()
console.log('[API] Final API_BASE:', API_BASE)

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30 seconds timeout
})

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
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

export async function getTeamsUserActivity(fileId) {
  const params = {}
  if (fileId) params.file_id = fileId
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
  const { data } = await api.delete('/teams/app/files/', { data: { file_ids: ids } })
  return data
}

export async function getTeamsAppActivity(fileId) {
  const params = {}
  if (fileId) params.file_id = fileId
  const { data } = await api.get('/teams/app/analytics/app-activity', { params })
  return data
}

