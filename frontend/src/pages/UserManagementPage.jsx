import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, deleteUser, deleteUsers, downloadUserBulkTemplate, bulkUploadUsers, syncUsersRolesFromHierarchy, getScopeFromHierarchy, getRoles, createRole, updateRole, deleteRole, getEmployeeHierarchy, getOrganogram, getScopeOptions, getEmployeeRowByEmail } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import MultiSelectSearchable from '../components/MultiSelectSearchable'
import TeamsUserListPage from './teams/TeamsUserListPage'

const DATA_SCOPE_LEVELS = [
  { value: '', label: 'Off (no data scope)' },
  { value: 'N', label: 'N — All functions & departments (e.g. MD)' },
  { value: 'N-1', label: 'N-1 — Own function & all departments under it' },
  { value: 'N-2', label: 'N-2 — Own department only' },
  { value: 'N-3', label: 'N-3 — Own department only' },
  { value: 'N-4', label: 'N-4 — Own department only' },
]
// Check if a string is an N-level (N, N-1, N-2, ...)
const isNLevel = (s) => s === 'N' || /^N-\d+$/.test(s)

// Parse API datetime as UTC so toLocaleString() shows correct local time (backend sends UTC).
function parseUtcDate(isoString) {
  if (!isoString) return null
  const s = typeof isoString === 'string' ? isoString.trim() : ''
  if (!s) return null
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s + 'Z')
  return new Date(s)
}

const MODULES = [
  { id: 'attendance_dashboard', name: 'Attendance Monitoring Dashboard', description: 'Access to attendance analytics and reports' },
  { id: 'teams_dashboard', name: 'MS Teams User Activity Dashboard', description: 'Access to Teams activity monitoring' }
]

// Attendance: menus, tabs, and views (function/department/company/location) – every menu, tab, and view selectable
const ATTENDANCE_PERMISSIONS = [
  { id: 'dashboard', name: 'Dashboard', description: 'View dashboard with all charts', group: 'menu' },
  { id: 'attendance_recognition', name: 'Attendance Recognition', description: 'Attendance recognition page', group: 'menu' },
  { id: 'weekly_dashboard', name: 'Weekly Analytics', description: 'Weekly analytics with charts', group: 'menu' },
  { id: 'user_wise', name: 'User Analytics', description: 'User-wise reports', group: 'menu' },
  // User Wise sub-menus (independent from standalone menu items)
  { id: 'user_wise_on_time', name: 'User Wise - On Time %', description: 'On Time % tab inside User Wise', group: 'tab' },
  { id: 'user_wise_work_hour', name: 'User Wise - Work Hour Completion', description: 'Work Hour Completion tab inside User Wise', group: 'tab' },
  { id: 'user_wise_work_hour_lost', name: 'User Wise - Work Hour Lost', description: 'Work Hour Lost tab inside User Wise', group: 'tab' },
  { id: 'user_wise_leave_analysis', name: 'User Wise - Leave Analysis', description: 'Leave Analysis tab inside User Wise', group: 'tab' },
  { id: 'user_wise_od_analysis', name: 'User Wise - OD Analysis', description: 'OD Analysis tab inside User Wise', group: 'tab' },
  { id: 'user_wise_work_hour_lost_cost', name: 'User Wise - Lost Hours Cost', description: 'Lost Hours Cost tab inside User Wise', group: 'tab' },
  { id: 'user_wise_cost_impact', name: 'User Wise - Cost Impact', description: 'Cost Impact tab: your cost vs department/function/company', group: 'tab' },
  { id: 'on_time', name: 'On Time %', description: 'View on-time percentage reports (standalone menu)', group: 'menu' },
  { id: 'work_hour', name: 'Work Hour Completion', description: 'View work hour completion reports', group: 'menu' },
  { id: 'work_hour_lost', name: 'Work Hour Lost', description: 'View work hour lost reports', group: 'menu' },
  { id: 'cost_settings', name: 'Cost Settings', description: 'Set average CTC per hour for cost calculations', group: 'menu' },
  { id: 'work_hour_lost_cost', name: 'Lost Hours Cost Analysis', description: 'View cost of lost work hours by department and function', group: 'menu' },
  { id: 'leave_analysis', name: 'Leave Analysis', description: 'View leave analysis reports', group: 'menu' },
  { id: 'od_analysis', name: 'OD Analysis', description: 'OD analysis reports', group: 'menu' },
  { id: 'weekly_analysis', name: 'Weekly Analysis', description: 'Weekly analysis reports', group: 'menu' },
  { id: 'upload', name: 'Upload Files', description: 'Upload attendance files', group: 'menu' },
  { id: 'batches', name: 'Manage Batches', description: 'View and delete uploaded batches', group: 'menu' },
  { id: 'export', name: 'Export Reports', description: 'Export reports to PDF', group: 'menu' },
  // Dashboard tabs
  { id: 'dashboard_tab_function', name: 'Dashboard - Function tab', description: 'Access Function tab in Dashboard', group: 'tab' },
  { id: 'dashboard_tab_company', name: 'Dashboard - Company tab', description: 'Access Company tab in Dashboard', group: 'tab' },
  { id: 'dashboard_tab_location', name: 'Dashboard - Location tab', description: 'Access Location tab in Dashboard', group: 'tab' },
  // Weekly Dashboard tabs
  { id: 'weekly_dashboard_tab_function', name: 'Weekly Dashboard - Function tab', description: 'Access Function tab in Weekly Dashboard', group: 'tab' },
  { id: 'weekly_dashboard_tab_company', name: 'Weekly Dashboard - Company tab', description: 'Access Company tab in Weekly Dashboard', group: 'tab' },
  { id: 'weekly_dashboard_tab_location', name: 'Weekly Dashboard - Location tab', description: 'Access Location tab in Weekly Dashboard', group: 'tab' },
  { id: 'weekly_dashboard_tab_department', name: 'Weekly Dashboard - Department tab', description: 'Access Department tab in Weekly Dashboard', group: 'tab' },
  // Legacy tab IDs for backward compatibility
  { id: 'tab_function', name: 'Function tab (legacy)', description: 'Access Function tab (applies to all)', group: 'tab' },
  { id: 'tab_department', name: 'Department tab (legacy)', description: 'Access Department tab (applies to all)', group: 'tab' },
  { id: 'tab_company', name: 'Company tab (legacy)', description: 'Access Company tab (applies to all)', group: 'tab' },
  { id: 'tab_location', name: 'Location tab (legacy)', description: 'Access Location tab (applies to all)', group: 'tab' },
  { id: 'view_function_wise', name: 'Function wise view', description: 'View data grouped by Function', group: 'view' },
  { id: 'view_department_wise', name: 'Department wise view', description: 'View data grouped by Department', group: 'view' },
  { id: 'view_company_wise', name: 'Company wise view', description: 'View data grouped by Company', group: 'view' },
  { id: 'view_location_wise', name: 'Location wise view', description: 'View data grouped by Location', group: 'view' },
]

const TEAMS_PERMISSIONS = [
  { id: 'user_activity', name: 'User Activity Dashboard', description: 'View Teams user activity analytics', group: 'menu' },
  { id: 'upload_activity', name: 'Upload Activity Files', description: 'Upload Teams activity files', group: 'menu' },
  { id: 'activity_batches', name: 'Activity Files Management', description: 'View and delete uploaded activity files', group: 'menu' },
  { id: 'app_activity', name: 'Teams App Activity', description: 'View Teams app usage analytics', group: 'menu' },
  { id: 'upload_app', name: 'Upload App Usage', description: 'Upload Teams app usage files', group: 'menu' },
  { id: 'app_batches', name: 'App Usage Files Management', description: 'View and delete app usage files', group: 'menu' },
  { id: 'employee_list', name: 'Employee List Management', description: 'Upload and manage employee list files', group: 'menu' },
  { id: 'license_entry', name: 'License Entry', description: 'View Teams license information', group: 'menu' },
  { id: 'license_edit', name: 'License Edit', description: 'Edit Teams license values', group: 'menu' },
  { id: 'teams_user_list', name: 'MS Teams User list', description: 'Upload Excel and view merged Teams/CBL_Teams user list', group: 'menu' },
  { id: 'export', name: 'Export Reports', description: 'Export Teams reports to PDF', group: 'menu' },
  { id: 'tab_user_wise', name: 'User Wise tab', description: 'User-wise activity tab', group: 'tab' },
  { id: 'tab_function_wise', name: 'Function Wise tab', description: 'Function-wise activity tab', group: 'tab' },
  { id: 'tab_company_wise', name: 'Company Wise tab', description: 'Company-wise activity tab', group: 'tab' },
  { id: 'tab_cxo', name: 'CXO Comparison tab', description: 'CXO comparison tab', group: 'tab' },
]

const BUILTIN_ROLE_NAMES = ['admin', 'user']
// Check if role is built-in (admin, user, or any N-* level like N, N-1, N-2, N-3, ...)
const isBuiltinRole = (name) => {
  if (BUILTIN_ROLE_NAMES.includes(name)) return true
  return name === 'N' || /^N-\d+$/.test(name)
}

// Table layout for Role Management (Menu/Sub Menu | Yes/No) – matches spec image
// Each menu now has unique tab IDs to prevent cross-menu coupling
const ATTENDANCE_MENU_TABLE = [
  { type: 'menu', id: 'dashboard', label: 'Dashboard', subMenus: [
    { id: 'dashboard_tab_function', label: 'Function' }, { id: 'dashboard_tab_company', label: 'Company' }, { id: 'dashboard_tab_location', label: 'Location' }
  ]},
  { type: 'menu', id: 'attendance_recognition', label: 'Attendance Recognition' },
  { type: 'menu', id: 'weekly_dashboard', label: 'Weekly Analytics', subMenus: [
    { id: 'weekly_dashboard_tab_function', label: 'Function' }, { id: 'weekly_dashboard_tab_company', label: 'Company' }, { id: 'weekly_dashboard_tab_location', label: 'Location' }, { id: 'weekly_dashboard_tab_department', label: 'Department' }
  ]},
  { type: 'menu', id: 'user_wise', label: 'User Analytics', subMenus: [
    { id: 'user_wise_on_time', label: 'On Time %' }, { id: 'user_wise_work_hour', label: 'Work Hour Completion' }, { id: 'user_wise_work_hour_lost', label: 'Work Hour Lost' }, { id: 'user_wise_work_hour_lost_cost', label: 'Lost Hours Cost' }, { id: 'user_wise_cost_impact', label: 'Cost Impact' }, { id: 'user_wise_leave_analysis', label: 'Leave Analysis' }, { id: 'user_wise_od_analysis', label: 'OD Analysis' }
  ]},
  { type: 'menu', id: 'on_time', label: 'On Time %' },
  { type: 'menu', id: 'work_hour', label: 'Work Hour Completion' },
  { type: 'menu', id: 'work_hour_lost', label: 'Work Hour Lost', subMenus: [
    { id: 'cost_settings', label: 'Cost Settings' },
    { id: 'work_hour_lost_cost', label: 'Lost Hours Cost Analysis' },
  ]},
  { type: 'menu', id: 'leave_analysis', label: 'Leave Analysis Adjacent to Weekend and Holiday' },
  { type: 'menu', id: 'od_analysis', label: 'OD Analysis' },
  { type: 'menu', id: 'weekly_analysis', label: 'Weekly Analysis' },
  { type: 'menu', id: 'upload', label: 'Upload Files' },
  { type: 'menu', id: 'batches', label: 'Upload Batches' },
]

const TEAMS_MENU_TABLE = [
  { type: 'menu', id: 'user_activity', label: 'User Activity', subMenus: [
    { id: 'tab_user_wise', label: 'User-wise' }, { id: 'tab_function_wise', label: 'Function-wise' }, { id: 'tab_company_wise', label: 'Company-wise' }, { id: 'tab_cxo', label: 'CXO Comparison' }
  ]},
  { type: 'menu', id: 'license_entry', label: 'Teams License' },
  { type: 'menu', id: 'teams_user_list', label: 'MS Teams User list' },
  { type: 'menu', id: 'upload_activity', label: 'Upload Activity Files' },
  { type: 'menu', id: 'activity_batches', label: 'Uploaded Activity Files' },
  { type: 'menu', id: 'employee_list', label: 'Upload Employee List / Employee List Files' },
  { type: 'menu', id: 'app_activity', label: 'Teams App Activity', subMenus: [
    { id: 'app_activity', label: 'Table View' }, { id: 'app_activity', label: 'Chart View' }
  ]},
  { type: 'menu', id: 'upload_app', label: 'Upload App Usage' },
  { type: 'menu', id: 'app_batches', label: 'App Usage File' },
]

function SyncRolesButton({ onSuccess }) {
  const [syncing, setSyncing] = useState(false)
  const handleSync = async () => {
    if (syncing) return
    if (!window.confirm('Set each user\'s role and Data Scope Level to their hierarchy level (N, N-1, N-2, N-3, ...) based on the Employee List? For N-1, N-2, etc., Company, Function, and Department will be auto-assigned from the hierarchy so you don\'t have to set them manually. Users must have Employee Email (Official) set or their login email must match an employee. Admins are skipped.')) return
    setSyncing(true)
    try {
      const res = await syncUsersRolesFromHierarchy()
      alert(res?.message || `Synced. ${res?.updated ?? 0} user(s) updated.`)
      onSuccess?.()
    } catch (e) {
      alert(e.response?.data?.detail || 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }
  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-3 rounded-md hover:from-amber-700 hover:to-amber-800 shadow-lg transform transition-all hover:scale-105 flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      title="Set each user's role and Company/Function/Department from Employee List (N-1, N-2, etc.)"
    >
      <span className={`lnr ${syncing ? 'lnr-sync animate-spin' : 'lnr-users'}`}></span>
      Sync roles & scope from hierarchy
    </button>
  )
}

export default function UserManagementPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [mainTab, setMainTab] = useState('users') // users | roles
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm, setRoleForm] = useState({
    name: '',
    permissions: {
      attendance_dashboard: { enabled: true, features: [] },
      teams_dashboard: { enabled: false, features: [] }
    }
  })

  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    department: '',
    position: '',
    role: 'user',
    is_active: true,
    employee_email: '',
    data_scope_level: '',
    allowed_functions: [],
    allowed_departments: [],
    allowed_companies: []
  })
  const [fillingFromHierarchy, setFillingFromHierarchy] = useState(false)
  const [rawRowModal, setRawRowModal] = useState(null) // { email, loading, data } for "View in file" modal

  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    refetchOnWindowFocus: false,
    retry: 1,
    onError: (error) => {
      console.error('Error fetching users:', error)
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Admin access required!\n\nYou must be logged in as an admin to access User Management.\n\nPlease log in with admin credentials:\nUsername: admin\nPassword: admin123')
        setTimeout(() => navigate('/login'), 2000)
      } else {
        console.error('Failed to load users:', error.message || error)
      }
    },
    onSuccess: (data) => {
      console.log('Users loaded successfully:', data?.length || 0, 'users')
    }
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
    enabled: mainTab === 'roles' || mainTab === 'users' || isModalOpen,
    refetchOnWindowFocus: false
  })

  const { data: employeeHierarchy = [] } = useQuery({
    queryKey: ['employeeHierarchy'],
    queryFn: () => getEmployeeHierarchy(),
    enabled: mainTab === 'employees',
    refetchOnWindowFocus: false,
    refetchOnMount: 'always', // always refetch when opening tab so deleted employee list = empty table
  })

  const { data: organogramData = [] } = useQuery({
    queryKey: ['organogram'],
    queryFn: () => getOrganogram(),
    enabled: mainTab === 'organogram',
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })

  const { data: scopeOptions = { functions: [], departments: [], companies: [] } } = useQuery({
    queryKey: ['scopeOptions'],
    queryFn: () => getScopeOptions(),
    enabled: isModalOpen || roleModalOpen || mainTab === 'organization',
    refetchOnWindowFocus: false
  })

  // Functions under selected companies only; departments under selected functions only
  const filteredFunctionOptions = useMemo(() => {
    const list = scopeOptions.functions || []
    const companies = formData.allowed_companies || []
    if (companies.length === 0) return list
    return list.filter(f => (f && typeof f === 'object' && f.company && companies.includes(f.company)))
  }, [scopeOptions.functions, formData.allowed_companies])

  const filteredDepartmentOptions = useMemo(() => {
    const list = scopeOptions.departments || []
    const functions = formData.allowed_functions || []
    if (functions.length === 0) return list
    return list.filter(d => (d && typeof d === 'object' && d.function && functions.includes(d.function)))
  }, [scopeOptions.departments, formData.allowed_functions])

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      resetForm()
      setIsModalOpen(false)
    },
    onError: (error) => {
      console.error('Create user error:', error.response?.data)
      let errorMsg = 'Failed to create user'
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        errorMsg = 'Authentication Error: Admin access required to manage users.\n\nPlease log in with an admin account.'
      } else if (error.response?.status === 422) {
        // Validation error
        const detail = error.response?.data?.detail
        if (Array.isArray(detail)) {
          errorMsg = 'Validation Errors:\n' + detail.map(err => `- ${err.loc?.join('.')}: ${err.msg}`).join('\n')
        } else {
          errorMsg = detail || 'Invalid data provided'
        }
      } else {
        errorMsg = error.response?.data?.detail || error.message || errorMsg
      }
      
      alert(errorMsg)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      resetForm()
      setIsModalOpen(false)
    },
    onError: (error) => {
      alert(error.response?.data?.detail || 'Failed to update user')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => {
      alert(error.response?.data?.detail || 'Failed to delete user')
    }
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteUsers,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setSelectedIds(new Set())
      const msg = `Deleted: ${res.deleted}. Skipped: ${res.skipped?.length ?? 0}${res.skipped?.length ? ' (e.g. admin, self)' : ''}.`
      alert(msg)
    },
    onError: (error) => {
      alert(error.response?.data?.detail || 'Bulk delete failed')
    },
    onSettled: () => setBulkDeleting(false),
  })

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    const ids = filteredUsers.filter((u) => u.role !== 'admin').map((u) => u.id)
    setSelectedIds(new Set(ids))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!window.confirm(`Delete ${ids.length} selected user(s)? Admin and your own account cannot be deleted.`)) return
    setBulkDeleting(true)
    bulkDeleteMutation.mutate(ids)
  }

  const bulkUploadMutation = useMutation({
    mutationFn: bulkUploadUsers,
    onSuccess: (res) => {
      setBulkResult(res)
      setBulkFile(null)
      if (document.getElementById('bulk-file-input')) {
        document.getElementById('bulk-file-input').value = ''
      }
      // Invalidate and refetch users list after a short delay to avoid network errors
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['users'] })
        refetch()
      }, 1000)
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || error.message || 'Bulk upload failed'
      alert(msg)
      setBulkResult(null)
    },
    onSettled: () => {
      setBulkUploading(false)
    }
  })

  const handleBulkTemplateDownload = () => {
    downloadUserBulkTemplate().catch((e) => {
      alert(e.response?.data?.detail || e.message || 'Failed to download template')
    })
  }

  const handleBulkUpload = () => {
    if (!bulkFile) return
    setBulkUploading(true)
    setBulkResult(null)
    bulkUploadMutation.mutate(bulkFile)
  }

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      full_name: '',
      password: '',
      department: '',
      position: '',
      role: 'user',
      is_active: true,
      employee_email: '',
      data_scope_level: '',
      allowed_functions: [],
      allowed_departments: [],
      allowed_companies: []
    })
    setEditingUser(null)
    setFillingFromHierarchy(false)
  }

  const resetRoleForm = () => {
    setRoleForm({
      name: '',
      permissions: {
        attendance_dashboard: { enabled: true, features: [] },
        teams_dashboard: { enabled: false, features: [] }
      }
    })
    setEditingRole(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const submitData = {
      email: formData.email,
      username: formData.username,
      full_name: formData.full_name,
      department: formData.department,
      position: formData.position,
      role: formData.role,
      is_active: formData.is_active,
      employee_email: formData.employee_email?.trim() || null,
      data_scope_level: formData.data_scope_level?.trim() || null,
      allowed_functions: Array.isArray(formData.allowed_functions) ? formData.allowed_functions : [],
      allowed_departments: Array.isArray(formData.allowed_departments) ? formData.allowed_departments : [],
      allowed_companies: Array.isArray(formData.allowed_companies) ? formData.allowed_companies : []
    }
    if (editingUser && formData.password) submitData.password = formData.password
    if (!editingUser) submitData.password = formData.password || '123456'
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    const initialAllowed = {
      allowed_functions: Array.isArray(user.allowed_functions) ? user.allowed_functions : [],
      allowed_departments: Array.isArray(user.allowed_departments) ? user.allowed_departments : [],
      allowed_companies: Array.isArray(user.allowed_companies) ? user.allowed_companies : [],
    }
    setFormData({
      email: user.email,
      username: user.username,
      full_name: user.full_name || '',
      password: '',
      phone: user.phone || '',
      department: user.department || '',
      position: user.position || '',
      role: user.role,
      is_active: user.is_active,
      employee_email: user.employee_email || '',
      data_scope_level: user.data_scope_level || '',
      ...initialAllowed,
      permissions: user.permissions || {
        attendance_dashboard: { enabled: false, features: [] },
        teams_dashboard: { enabled: false, features: [] }
      }
    })
    setIsModalOpen(true)
    // Pre-fill Allowed Companies/Functions/Departments from hierarchy when user has employee link and N-level role
    const empEmail = (user.employee_email || '').trim()
    const scopeLevel = (user.data_scope_level || '').trim()
    if (empEmail && scopeLevel && isNLevel(scopeLevel)) {
      getScopeFromHierarchy(empEmail, scopeLevel)
        .then((scope) => {
          setFormData((prev) => ({
            ...prev,
            allowed_companies: scope.allowed_companies || [],
            allowed_functions: scope.allowed_functions || [],
            allowed_departments: scope.allowed_departments || [],
          }))
        })
        .catch(() => { /* keep initial allowed values on error */ })
    }
  }

  const handleDelete = (user) => {
    if (confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
      deleteMutation.mutate(user.id)
    }
  }

  const toggleRoleModule = (moduleId) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleId]: {
          ...prev.permissions[moduleId],
          enabled: !prev.permissions[moduleId].enabled
        }
      }
    }))
  }

  const toggleRoleFeature = (moduleId, featureId) => {
    setRoleForm(prev => {
      const features = prev.permissions[moduleId].features || []
      const hasFeature = features.includes(featureId)
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: {
            ...prev.permissions[moduleId],
            features: hasFeature ? features.filter(f => f !== featureId) : [...features, featureId]
          }
        }
      }
    })
  }

  const roleCreateMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setRoleModalOpen(false)
      resetRoleForm()
    },
    onError: (e) => alert(e.response?.data?.detail || 'Failed to create role')
  })

  const roleUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setRoleModalOpen(false)
      resetRoleForm()
    },
    onError: (e) => alert(e.response?.data?.detail || 'Failed to update role')
  })

  const roleDeleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => alert(e.response?.data?.detail || 'Failed to delete role')
  })

  const handleRoleSubmit = (e) => {
    e.preventDefault()
    if (editingRole) {
      roleUpdateMutation.mutate({ id: editingRole.id, data: { name: roleForm.name.trim(), permissions: roleForm.permissions } })
    } else {
      roleCreateMutation.mutate({ name: roleForm.name.trim(), permissions: roleForm.permissions })
    }
  }

  const handleEditRole = (role) => {
    setEditingRole(role)
    const perms = role.permissions && typeof role.permissions === 'object' ? role.permissions : {}
    setRoleForm({
      name: role.name,
      permissions: {
        attendance_dashboard: perms.attendance_dashboard || { enabled: true, features: [] },
        teams_dashboard: perms.teams_dashboard || { enabled: false, features: [] }
      }
    })
    setRoleModalOpen(true)
  }

  const handleDeleteRole = (role) => {
    if (!window.confirm(`Delete role "${role.name}"? Users with this role must be reassigned first.`)) return
    roleDeleteMutation.mutate(role.id)
  }

  // Debug: Log users count
  if (users.length > 0) {
    console.log('Users loaded:', users.length, 'total users')
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || user.role === filterRole
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && user.is_active) ||
                         (filterStatus === 'inactive' && !user.is_active)
    
    return matchesSearch && matchesRole && matchesStatus
  })

  // Statistics
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
    admins: users.filter(u => u.role === 'admin').length,
    users: users.filter(u => u.role === 'user').length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-700 to-gray-800 shadow-lg border-b border-gray-600 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">User & Role Management</h1>
              <p className="text-sm text-gray-300 mt-1">Manage users, roles, and module/menu permissions</p>
            </div>
            <button
              onClick={() => navigate('/modules')}
              className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-md transition-all flex items-center gap-2"
            >
              <span className="lnr lnr-arrow-left"></span>
              Back to Modules
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMainTab('users')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0 ${mainTab === 'users' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setMainTab('employees')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0 ${mainTab === 'employees' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Employees (N / N-1 / N-2)
            </button>
            <button
              type="button"
              onClick={() => setMainTab('organogram')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0 ${mainTab === 'organogram' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Organogram
            </button>
            <button
              type="button"
              onClick={() => setMainTab('roles')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0 ${mainTab === 'roles' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Role management
            </button>
            <button
              type="button"
              onClick={() => setMainTab('organization')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0 ${mainTab === 'organization' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Organization
            </button>
            <button
              type="button"
              onClick={() => setMainTab('teams_user_list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all shrink-0 ${mainTab === 'teams_user_list' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              MS Teams User list
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {mainTab === 'teams_user_list' && (
          <TeamsUserListPage />
        )}

        {mainTab === 'organization' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Companies, Functions &amp; Departments</h2>
              <p className="text-sm text-gray-600 mt-1">
                These lists are derived from uploaded <strong>Employee List</strong> files. To add or change companies, functions, or departments, upload or update an Employee List file (Teams module → Upload Employee List / Employee List Files).
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase">Companies</h3>
                </div>
                <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                  {(scopeOptions.companies || []).length === 0 ? (
                    <li className="px-4 py-3 text-sm text-gray-500">No companies (upload Employee List first)</li>
                  ) : (
                    (scopeOptions.companies || []).map((c, i) => (
                      <li key={i} className="px-4 py-2 text-sm text-gray-700">{c}</li>
                    ))
                  )}
                </ul>
              </div>
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase">Functions (with company)</h3>
                </div>
                <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                  {(scopeOptions.functions || []).length === 0 ? (
                    <li className="px-4 py-3 text-sm text-gray-500">No functions (upload Employee List first)</li>
                  ) : (
                    (scopeOptions.functions || []).map((f, i) => (
                      <li key={i} className="px-4 py-2 text-sm text-gray-700">
                        {typeof f === 'string' ? f : `${f.name || f}${f.company ? ` — ${f.company}` : ''}`}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase">Departments (function, company)</h3>
                </div>
                <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                  {(scopeOptions.departments || []).length === 0 ? (
                    <li className="px-4 py-3 text-sm text-gray-500">No departments (upload Employee List first)</li>
                  ) : (
                    (scopeOptions.departments || []).map((d, i) => (
                      <li key={i} className="px-4 py-2 text-sm text-gray-700">
                        {typeof d === 'string' ? d : `${d.name || d}${d.function ? ` — ${d.function}` : ''}${d.company ? ` (${d.company})` : ''}`}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {mainTab === 'organogram' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Organogram</h2>
              <p className="text-sm text-gray-600 mt-1">
                Supervisor and their direct subordinates, built from the latest <strong>Employee List</strong> (columns: <strong>Email (Offical)</strong>, <strong>Employee Code</strong>, <strong>Line Manager Employee ID</strong>, Supervisor Name). Each table shows one supervisor and their direct reports.
              </p>
            </div>
            {organogramData.length === 0 ? (
              <div className="bg-white rounded-lg shadow border border-gray-200 px-6 py-8 text-center text-gray-500">
                No organogram data. Upload an Employee List file (with Supervisor Name and Line Manager Employee ID) first.
              </div>
            ) : (
              <div className="space-y-6">
                {organogramData.map((entry, idx) => (
                  <div key={idx} className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-800">
                        Supervisor: {entry.supervisor?.name || '—'} {entry.supervisor?.employee_code ? `(${entry.supervisor.employee_code})` : ''} — {entry.supervisor?.email || '—'}
                        {entry.supervisor?.department ? ` · ${entry.supervisor.department}` : ''}{entry.supervisor?.function ? ` · ${entry.supervisor.function}` : ''}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Employee Code</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Function</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Company</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {(!entry.direct_subordinates || entry.direct_subordinates.length === 0) ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-3 text-sm text-gray-500 italic">No direct subordinates</td>
                            </tr>
                          ) : (
                            entry.direct_subordinates.map((sub, subIdx) => (
                              <tr key={subIdx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-sm text-gray-900">{sub.name || '—'}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{sub.email || '—'}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{sub.employee_code || '—'}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{sub.department || '—'}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{sub.function || '—'}</td>
                                <td className="px-4 py-2 text-sm text-gray-700">{sub.company || '—'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mainTab === 'employees' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Employee hierarchy (N, N-1, N-2)</h2>
              <p className="text-sm text-gray-600 mt-1">
                Built from the latest <strong>Employee List file</strong> you upload (User Management → Employee list / Batches). Company, Function, and Department come from that file’s columns (e.g. Company Name, Function Name or Function, Department Name). Levels (N, N-1, N-2) use Supervisor Name and Line Manager Employee ID. To fix wrong info (e.g. function for irina.const), update the Employee List Excel/CSV and re-upload. Link users to employees and set data scope in the Users tab.
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Employee Code</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Company</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Function</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Supervisor</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Line Manager ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Level</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Source file</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {employeeHierarchy.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                          No employee data. Upload an Employee List file (with Supervisor Name and Line Manager Employee ID) first.
                        </td>
                      </tr>
                    )}
                    {employeeHierarchy.map((emp, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-900">{emp.name || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{emp.email || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{emp.employee_code || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{emp.company || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{emp.function || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{emp.department || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{emp.supervisor_name || '—'}</td>
                        <td className="px-6 py-3 text-sm text-gray-700">{emp.line_manager_employee_id || '—'}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            emp.level === 'N' ? 'bg-amber-100 text-amber-800' :
                            emp.level === 'N-1' ? 'bg-blue-100 text-blue-800' :
                            emp.level === 'N-2' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {emp.level || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs text-gray-500" title="Uploaded Employee List file this row was read from">
                          {emp.source_filename || '—'}
                        </td>
                        <td className="px-6 py-3">
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:underline"
                            onClick={() => {
                              setRawRowModal({ email: emp.email, loading: true, data: null })
                              getEmployeeRowByEmail(emp.email)
                                .then((d) => setRawRowModal({ email: emp.email, loading: false, data: d }))
                                .catch(() => setRawRowModal((m) => m ? { ...m, loading: false, data: { found: false } } : null))
                            }}
                          >
                            View in file
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {rawRowModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRawRowModal(null)}>
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="px-6 py-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Row in Employee List file: {rawRowModal.email}</h3>
                    <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setRawRowModal(null)}>×</button>
                  </div>
                  <div className="p-6 overflow-auto">
                    {rawRowModal.loading && <p className="text-gray-500">Loading…</p>}
                    {!rawRowModal.loading && rawRowModal.data && (
                      <>
                        {rawRowModal.data.found ? (
                          <>
                            <p className="text-sm text-gray-600 mb-2">Source: <strong>{rawRowModal.data.source_filename || '—'}</strong></p>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Mapped (what the app uses):</p>
                            <ul className="text-sm mb-4 list-disc list-inside">
                              <li><strong>Company:</strong> {rawRowModal.data.mapped?.company || '—'}</li>
                              <li><strong>Function:</strong> {rawRowModal.data.mapped?.function || '—'}</li>
                              <li><strong>Department:</strong> {rawRowModal.data.mapped?.department || '—'}</li>
                            </ul>
                            <p className="text-xs font-semibold text-gray-700 mb-1">All columns in the Excel row (exact names and values):</p>
                            <div className="border rounded overflow-x-auto max-h-60 overflow-y-auto">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-100 sticky top-0">
                                  <tr><th className="px-2 py-1 text-left">Column</th><th className="px-2 py-1 text-left">Value</th></tr>
                                </thead>
                                <tbody>
                                  {(rawRowModal.data.header_order && rawRowModal.data.header_order.length
                                    ? rawRowModal.data.header_order
                                    : Object.keys(rawRowModal.data.row || {})
                                  ).map((col) => (
                                    <tr key={col} className="border-t">
                                      <td className="px-2 py-1 font-medium text-gray-700">{col}</td>
                                      <td className="px-2 py-1">{String((rawRowModal.data.row || {})[col] ?? '')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                            <p className="text-gray-600">{rawRowModal.data.message || 'Row not found for this email in the latest file.'}</p>
                          )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {mainTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Roles</h2>
              <button
                type="button"
                onClick={() => { resetRoleForm(); setRoleModalOpen(true) }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
              >
                <span className="lnr lnr-plus-circle"></span>
                Add role
              </button>
            </div>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase">Modules & menus</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-800 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {roles.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-sm font-medium rounded ${r.name === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                          {r.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {[r.permissions?.attendance_dashboard, r.permissions?.teams_dashboard].filter(Boolean).map((p, i) => (
                          <span key={i}>
                            {p?.enabled ? `${i ? 'Teams' : 'Attendance'} (${(p?.features || []).length} menus)` : ''}
                          </span>
                        )).filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleEditRole(r)}
                          className="text-blue-600 hover:text-blue-800 mr-4"
                        >
                          Edit
                        </button>
                        {!isBuiltinRole(r.name) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteRole(r)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {mainTab === 'users' && (
          <>
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 transform transition-transform hover:scale-105">
            <div className="text-sm text-blue-100">Total Users</div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-4 transform transition-transform hover:scale-105">
            <div className="text-sm text-green-100">Active</div>
            <div className="text-3xl font-bold text-white">{stats.active}</div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-4 transform transition-transform hover:scale-105">
            <div className="text-sm text-red-100">Inactive</div>
            <div className="text-3xl font-bold text-white">{stats.inactive}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 transform transition-transform hover:scale-105">
            <div className="text-sm text-purple-100">Administrators</div>
            <div className="text-3xl font-bold text-white">{stats.admins}</div>
          </div>
          <div className="bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg shadow-lg p-4 transform transition-transform hover:scale-105">
            <div className="text-sm text-gray-100">Regular Users</div>
            <div className="text-3xl font-bold text-white">{stats.users}</div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 lnr lnr-magnifier"></span>
                <input
                  type="text"
                  placeholder="Search by username, email, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => {
                resetForm()
                setIsModalOpen(true)
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-md hover:from-blue-700 hover:to-blue-800 shadow-lg transform transition-all hover:scale-105 flex items-center gap-2 font-medium"
            >
              <span className="lnr lnr-plus-circle"></span>
              Add New User
            </button>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="bg-gray-600 text-white px-4 py-3 rounded-md hover:bg-gray-700 shadow-lg transform transition-all hover:scale-105 flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh users list"
            >
              <span className={`lnr ${isLoading ? 'lnr-sync animate-spin' : 'lnr-sync'}`}></span>
              Refresh
            </button>
            <SyncRolesButton onSuccess={() => refetch()} />
            {filteredUsers.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-4 py-3 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0 || bulkDeleting}
                  className="bg-red-600 text-white px-4 py-3 rounded-md hover:bg-red-700 shadow-lg flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkDeleting ? (
                    <span className="lnr lnr-sync animate-spin"></span>
                  ) : (
                    <span className="lnr lnr-trash"></span>
                  )}
                  Delete selected ({selectedIds.size})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bulk Upload */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Bulk Upload Users</h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload an Excel (.xlsx) file with columns: <strong>Employee Name</strong>, <strong>Designation</strong>, <strong>Function</strong>, <strong>Email (Official)</strong> or <strong>Email (Offical)</strong>, <strong>Username</strong>, <strong>Role</strong>, <strong>Password</strong>. Use the Download Template for the exact format. Role defaults to <strong>User</strong> if empty; Password defaults to <strong>123456</strong> if empty. Users that already exist (same email) are skipped.
            <br />
            <span className="text-blue-600 font-medium">Employee List:</span> You can use the Employee List Excel (e.g. EmployeeList-latest) — it has Employee Name, Designation, Function, Email (Offical). Username is derived from email; Role and Password default to User and 123456 if columns are missing.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleBulkTemplateDownload}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              <span className="lnr lnr-download"></span>
              Download Template
            </button>
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium cursor-pointer">
              <span className="lnr lnr-upload"></span>
              Choose File
              <input
                id="bulk-file-input"
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  setBulkFile(f || null)
                  setBulkResult(null)
                }}
              />
            </label>
            {bulkFile && (
              <span className="text-sm text-gray-600">
                {bulkFile.name}
              </span>
            )}
            <button
              type="button"
              onClick={handleBulkUpload}
              disabled={!bulkFile || bulkUploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {bulkUploading ? (
                <>
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  Uploading…
                </>
              ) : (
                <>
                  <span className="lnr lnr-upload"></span>
                  Upload
                </>
              )}
            </button>
          </div>
          {bulkResult && (
            <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex flex-wrap gap-4 mb-2">
                <span className="text-sm font-medium text-green-700">Created: {bulkResult.created}</span>
                <span className="text-sm font-medium text-blue-700">Skipped (Already Exist): {bulkResult.skipped}</span>
                <span className="text-sm font-medium text-red-700">Errors: {bulkResult.errors}</span>
              </div>
              {bulkResult.skipped > 0 && (
                <p className="text-xs text-blue-600 mb-2">
                  <strong>Note:</strong> "Skipped" means these users already exist in the database. This is normal if you're re-uploading the same file. Check the users table below to see all existing users.
                </p>
              )}
              {(bulkResult.details?.errors?.length > 0 || bulkResult.details?.skipped?.length > 0) && (
                <details className="mt-2" open={bulkResult.errors > 0}>
                  <summary className="text-sm text-gray-600 cursor-pointer hover:underline font-medium">
                    View details ({bulkResult.details?.errors?.length || 0} errors, {bulkResult.details?.skipped?.length || 0} skipped)
                  </summary>
                  <ul className="mt-2 text-xs text-gray-600 space-y-1 max-h-64 overflow-y-auto">
                    {(bulkResult.details?.errors || []).map((e, i) => (
                      <li key={`err-${i}`} className="text-red-700">
                        Row {e.row}: {e.reason}
                        {e.email_value && ` (Email: "${e.email_value}")`}
                      </li>
                    ))}
                    {(bulkResult.details?.skipped || []).map((s, i) => (
                      <li key={`skip-${i}`} className="text-blue-600">
                        Row {s.row}: {s.reason} ({s.email || s.username})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          {isLoading && (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading users...</p>
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <div className="text-red-600 mb-4">
                <p className="font-semibold mb-2">Error loading users: {error.message}</p>
                {error.response?.data?.detail && (
                  <p className="text-sm">{error.response.data.detail}</p>
                )}
              </div>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="sticky top-0 z-10 bg-gradient-to-r from-gray-100 to-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider w-12">Select</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Email (Official)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider max-w-[220px]">Allowed: Companies / Functions / Departments</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length === 0 && users.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        <div>
                          <p className="mb-2">No users found in the database.</p>
                          <button
                            onClick={() => refetch()}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Click here to refresh
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredUsers.length === 0 && users.length > 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        No users found matching your search/filter criteria. Try clearing filters.
                      </td>
                    </tr>
                  )}
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-4">
                        {user.role !== 'admin' && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            onChange={() => toggleSelect(user.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                            {user.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                            <div className="text-sm text-gray-500">{user.full_name || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{user.email || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-[220px]">
                        <div className="text-xs text-gray-700 space-y-1">
                          {(() => {
                            const companies = Array.isArray(user.allowed_companies) ? user.allowed_companies : []
                            const functions = Array.isArray(user.allowed_functions) ? user.allowed_functions : []
                            const departments = Array.isArray(user.allowed_departments) ? user.allowed_departments : []
                            const hasAny = companies.length > 0 || functions.length > 0 || departments.length > 0
                            if (!hasAny) return <span className="text-gray-500">Default (Employee + scope)</span>
                            return (
                              <>
                                {companies.length > 0 && (
                                  <div><span className="font-medium text-gray-600">Companies:</span> {companies.join(', ')}</div>
                                )}
                                {functions.length > 0 && (
                                  <div><span className="font-medium text-gray-600">Functions:</span> {functions.join(', ')}</div>
                                )}
                                {departments.length > 0 && (
                                  <div><span className="font-medium text-gray-600">Departments:</span> {departments.join(', ')}</div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.last_login ? (parseUtcDate(user.last_login)?.toLocaleString() ?? 'Never') : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-900 font-medium flex items-center gap-1 transition-all hover:scale-105"
                          >
                            <span className="lnr lnr-pencil"></span>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-600 hover:text-red-900 font-medium flex items-center gap-1 transition-all hover:scale-105"
                            disabled={deleteMutation.isPending}
                          >
                            <span className="lnr lnr-trash"></span>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </>
        )}
      </main>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform transition-all animate-scale-in">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 border-b border-blue-500 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <span className="lnr lnr-cross text-xl"></span>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Employee Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Designation <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Function <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email (Official) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Username <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.role}
                          onChange={(e) => {
                            const newRole = e.target.value
                            const scopeLevel = isNLevel(newRole) ? newRole : formData.data_scope_level
                            setFormData({ ...formData, role: newRole, data_scope_level: scopeLevel })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.name}>
                              {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Permissions are defined in Role Management. Roles <strong>N</strong>, <strong>N-1</strong>, <strong>N-2</strong>, <strong>N-3</strong>, etc. auto-set Data Scope Level; data access is derived from <strong>Employee Email</strong> in the Employee List.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password {editingUser && <span className="text-gray-500 text-xs">(leave blank to keep current)</span>}
                          {!editingUser && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required={!editingUser}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">Active</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Employee Email (Official)
                        </label>
                        <input
                          type="email"
                          value={formData.employee_email}
                          onChange={(e) => setFormData({ ...formData, employee_email: e.target.value })}
                          placeholder="Link to employee list for data scope (N/N-1/N-2)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Must match Email (Official) in Employee List. Used with Data Scope Level.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data Scope Level
                        </label>
                        <select
                          value={formData.data_scope_level}
                          onChange={(e) => setFormData({ ...formData, data_scope_level: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {DATA_SCOPE_LEVELS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                          {/* Include current value if it's an N-level not in the predefined list */}
                          {formData.data_scope_level && isNLevel(formData.data_scope_level) && !DATA_SCOPE_LEVELS.some(o => o.value === formData.data_scope_level) && (
                            <option value={formData.data_scope_level}>
                              {formData.data_scope_level} — Own department only
                            </option>
                          )}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">N = all; N-1 = function + depts; N-2 = department only. Auto-set when Role is N, N-1, or N-2. Requires Employee Email.</p>
                      </div>

                      <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <p className="text-sm font-semibold text-gray-800">Allow or disallow access by company, function, department</p>
                          <button
                            type="button"
                            disabled={fillingFromHierarchy || !(formData.employee_email || '').trim() || !(formData.data_scope_level || '').trim() || !isNLevel((formData.data_scope_level || '').trim())}
                            onClick={() => {
                              const emp = (formData.employee_email || '').trim()
                              const lvl = (formData.data_scope_level || '').trim()
                              if (!emp || !lvl) return
                              setFillingFromHierarchy(true)
                              getScopeFromHierarchy(emp, lvl)
                                .then((scope) => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    allowed_companies: scope.allowed_companies || [],
                                    allowed_functions: scope.allowed_functions || [],
                                    allowed_departments: scope.allowed_departments || [],
                                  }))
                                })
                                .catch(() => {})
                                .finally(() => setFillingFromHierarchy(false))
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {fillingFromHierarchy ? 'Filling…' : 'Fill from hierarchy'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">Select which companies, functions, and departments this user can see. If you select any, the user sees only those. Use &quot;Fill from hierarchy&quot; when Employee Email and Data scope level are set (N, N-1, N-2).</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Companies</label>
                            <MultiSelectSearchable
                              id="allowed-companies"
                              value={formData.allowed_companies || []}
                              onChange={(v) => setFormData({ ...formData, allowed_companies: v })}
                              options={(scopeOptions.companies || []).map(c => ({ value: c, label: c }))}
                              placeholder="Select companies..."
                              className="min-w-0"
                              showSelectAll
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1 min-h-[24px]">
                              {(formData.allowed_companies || []).length === 0 ? (
                                <span className="text-xs text-gray-400">None selected</span>
                              ) : (
                                (formData.allowed_companies || []).map((c) => (
                                  <span key={c} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {c}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Functions</label>
                            <MultiSelectSearchable
                              id="allowed-functions"
                              value={formData.allowed_functions || []}
                              onChange={(v) => setFormData({ ...formData, allowed_functions: v })}
                              options={filteredFunctionOptions.map(f => ({ value: typeof f === 'string' ? f : f.name, label: typeof f === 'string' ? f : f.name }))}
                              placeholder={formData.allowed_companies?.length ? 'Select functions under selected companies...' : 'Select functions...'}
                              className="min-w-0"
                              showSelectAll
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1 min-h-[24px]">
                              {(formData.allowed_functions || []).length === 0 ? (
                                <span className="text-xs text-gray-400">None selected</span>
                              ) : (
                                (formData.allowed_functions || []).map((f) => (
                                  <span key={f} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {f}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Departments</label>
                            <MultiSelectSearchable
                              id="allowed-departments"
                              value={formData.allowed_departments || []}
                              onChange={(v) => setFormData({ ...formData, allowed_departments: v })}
                              options={filteredDepartmentOptions.map(d => ({ value: typeof d === 'string' ? d : d.name, label: typeof d === 'string' ? d : d.name }))}
                              placeholder={formData.allowed_functions?.length ? 'Select departments under selected functions...' : 'Select departments...'}
                              className="min-w-0"
                              showSelectAll
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1 min-h-[24px]">
                              {(formData.allowed_departments || []).length === 0 ? (
                                <span className="text-xs text-gray-400">None selected</span>
                              ) : (
                                (formData.allowed_departments || []).map((d) => (
                                  <span key={d} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    {d}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    resetForm()
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-200 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-md hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg transform transition-all hover:scale-105"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Create/Edit Modal */}
      {roleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 border-b border-purple-500 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </h2>
              <button
                onClick={() => {
                  setRoleModalOpen(false)
                  resetRoleForm()
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <span className="lnr lnr-cross text-xl"></span>
              </button>
            </div>

            <form onSubmit={handleRoleSubmit}>
              <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      required
                      disabled={editingRole && isBuiltinRole(editingRole.name)}
                    />
                    {editingRole && isBuiltinRole(editingRole.name) && (
                      <p className="text-xs text-gray-500 mt-1">Built-in roles cannot be renamed</p>
                    )}
                  </div>

                  {/* Attendance Monitoring Dashboard – Menu/Sub Menu | Yes/No */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <h3 className="px-4 py-2 bg-purple-100 font-semibold text-gray-800">Attendance Monitoring Dashboard</h3>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Menu / Sub Menu</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-24">Yes/No</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {ATTENDANCE_MENU_TABLE.map((row, idx) => (
                          <Fragment key={`att-${idx}`}>
                            <tr className={row.subMenus ? 'bg-gray-50' : ''}>
                              <td className="px-4 py-2 text-sm text-gray-900">{row.label}</td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions.attendance_dashboard?.features?.includes(row.id) || false}
                                  onChange={() => toggleRoleFeature('attendance_dashboard', row.id)}
                                  className="h-4 w-4 text-purple-600 rounded"
                                />
                              </td>
                            </tr>
                            {(row.subMenus || []).map((sub, sidx) => (
                              <tr key={`att-${idx}-${sidx}`}>
                                <td className="px-4 py-1.5 pl-8 text-sm text-gray-700">{sub.label}</td>
                                <td className="px-4 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={roleForm.permissions.attendance_dashboard?.features?.includes(sub.id) || false}
                                    onChange={() => toggleRoleFeature('attendance_dashboard', sub.id)}
                                    className="h-4 w-4 text-purple-600 rounded"
                                  />
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* MS Teams User Activity Dashboard – Menu/Sub Menu | Yes/No */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <h3 className="px-4 py-2 bg-indigo-100 font-semibold text-gray-800">MS Teams User Activity Dashboard</h3>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Menu / Sub Menu</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 uppercase w-24">Yes/No</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {TEAMS_MENU_TABLE.map((row, idx) => (
                          <Fragment key={`teams-${idx}`}>
                            <tr className={row.subMenus ? 'bg-gray-50' : ''}>
                              <td className="px-4 py-2 text-sm text-gray-900">{row.label}</td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions.teams_dashboard?.features?.includes(row.id) || false}
                                  onChange={() => toggleRoleFeature('teams_dashboard', row.id)}
                                  className="h-4 w-4 text-indigo-600 rounded"
                                />
                              </td>
                            </tr>
                            {(row.subMenus || []).map((sub, sidx) => (
                              <tr key={`teams-${idx}-${sidx}`}>
                                <td className="px-4 py-1.5 pl-8 text-sm text-gray-700">{sub.label}</td>
                                <td className="px-4 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={roleForm.permissions.teams_dashboard?.features?.includes(sub.id) || false}
                                    onChange={() => toggleRoleFeature('teams_dashboard', sub.id)}
                                    className="h-4 w-4 text-indigo-600 rounded"
                                  />
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Data visibility is user-wise, not role-wise */}
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <p className="text-sm font-semibold text-blue-900 mb-1">Data visibility (Company, Function, Department) is user-wise</p>
                    <p className="text-xs text-blue-800">
                      Which data a user sees is set per <strong>user</strong> (when creating/editing a user), not per role. Link the user to an employee via <strong>Employee Email</strong> and set <strong>Data scope level</strong>: <strong>N</strong> = see all companies, functions &amp; departments (e.g. MD); <strong>N-1</strong> = see own function and all departments under it; <strong>N-2</strong> = see only own department. Optionally add more allowed functions/departments/companies in the user form to grant extra access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRoleModalOpen(false)
                    resetRoleForm()
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-200 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleCreateMutation.isPending || roleUpdateMutation.isPending}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-md hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-lg"
                >
                  {(roleCreateMutation.isPending || roleUpdateMutation.isPending) && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  {editingRole ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
