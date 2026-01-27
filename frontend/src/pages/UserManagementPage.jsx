import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, deleteUser, deleteUsers, downloadUserBulkTemplate, bulkUploadUsers, getRoles, createRole, updateRole, deleteRole } from '../lib/api'
import { useNavigate } from 'react-router-dom'

const MODULES = [
  { id: 'attendance_dashboard', name: 'Attendance Monitoring Dashboard', description: 'Access to attendance analytics and reports' },
  { id: 'teams_dashboard', name: 'MS Teams User Activity Dashboard', description: 'Access to Teams activity monitoring' }
]

const ATTENDANCE_PERMISSIONS = [
  { id: 'dashboard', name: 'Dashboard', description: 'View dashboard with all charts' },
  { id: 'on_time', name: 'On Time %', description: 'View on-time percentage reports' },
  { id: 'work_hour', name: 'Work Hour Completion', description: 'View work hour completion reports' },
  { id: 'work_hour_lost', name: 'Work Hour Lost', description: 'View work hour lost reports' },
  { id: 'leave_analysis', name: 'Leave Analysis', description: 'View leave analysis reports' },
  { id: 'upload', name: 'Upload Files', description: 'Upload attendance files' },
  { id: 'batches', name: 'Manage Batches', description: 'View and delete uploaded batches' },
  { id: 'export', name: 'Export Reports', description: 'Export reports to PDF' }
]

const TEAMS_PERMISSIONS = [
  { id: 'user_activity', name: 'User Activity Dashboard', description: 'View Teams user activity analytics' },
  { id: 'upload_activity', name: 'Upload Activity Files', description: 'Upload Teams activity files' },
  { id: 'activity_batches', name: 'Activity Files Management', description: 'View and delete uploaded activity files' },
  { id: 'app_activity', name: 'Teams App Activity', description: 'View Teams app usage analytics' },
  { id: 'upload_app', name: 'Upload App Usage', description: 'Upload Teams app usage files' },
  { id: 'app_batches', name: 'App Usage Files Management', description: 'View and delete app usage files' },
  { id: 'employee_list', name: 'Employee List Management', description: 'Upload and manage employee list files' },
  { id: 'license_entry', name: 'License Entry', description: 'View Teams license information (Total, Assigned, Free license)' },
  { id: 'license_edit', name: 'License Edit', description: 'Edit Teams license values (Total, Assigned, Free license)' },
  { id: 'export', name: 'Export Reports', description: 'Export Teams reports to PDF' }
]

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
      attendance_dashboard: { enabled: false, features: [] },
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
    is_active: true
  })

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
    enabled: mainTab === 'roles' || isModalOpen,
    refetchOnWindowFocus: false
  })

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
      is_active: true
    })
    setEditingUser(null)
  }

  const resetRoleForm = () => {
    setRoleForm({
      name: '',
      permissions: {
        attendance_dashboard: { enabled: false, features: [] },
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
      is_active: formData.is_active
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
      permissions: user.permissions || {
        attendance_dashboard: { enabled: false, features: [] },
        teams_dashboard: { enabled: false, features: [] }
      }
    })
    setIsModalOpen(true)
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
    setRoleForm({
      name: role.name,
      permissions: role.permissions && typeof role.permissions === 'object'
        ? {
            attendance_dashboard: role.permissions.attendance_dashboard || { enabled: false, features: [] },
            teams_dashboard: role.permissions.teams_dashboard || { enabled: false, features: [] }
          }
        : { attendance_dashboard: { enabled: false, features: [] }, teams_dashboard: { enabled: false, features: [] } }
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
              <h1 className="text-2xl font-bold text-white">User & role management</h1>
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
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => setMainTab('users')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mainTab === 'users' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setMainTab('roles')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mainTab === 'roles' ? 'bg-white text-gray-800' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Role management
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
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
                        {!['admin', 'user'].includes(r.name) && (
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Function</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length === 0 && users.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
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
                        <div className="text-sm text-gray-900">{user.department || '-'}</div>
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
                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
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
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.name}>
                              {r.name.charAt(0).toUpperCase() + r.name.slice(1)}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Permissions are defined in Role Management</p>
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
                      disabled={editingRole && ['admin', 'user'].includes(editingRole.name)}
                    />
                    {editingRole && ['admin', 'user'].includes(editingRole.name) && (
                      <p className="text-xs text-gray-500 mt-1">Built-in roles cannot be renamed</p>
                    )}
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-800">
                      <strong>Configure Access:</strong> Select which modules and menus (features) users with this role can access.
                    </p>
                  </div>

                  {MODULES.map(module => (
                    <div 
                      key={module.id} 
                      className={`border-2 rounded-xl p-5 transition-all ${
                        roleForm.permissions[module.id]?.enabled 
                          ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-md' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={roleForm.permissions[module.id]?.enabled || false}
                            onChange={() => toggleRoleModule(module.id)}
                            className="h-6 w-6 text-purple-600 focus:ring-2 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {module.id === 'attendance_dashboard' && (
                              <span className="lnr lnr-calendar-full text-2xl text-purple-600"></span>
                            )}
                            {module.id === 'teams_dashboard' && (
                              <span className="lnr lnr-users text-2xl text-indigo-600"></span>
                            )}
                            <h4 className="text-lg font-bold text-gray-900">{module.name}</h4>
                          </div>
                          <p className="text-sm text-gray-600 ml-9">{module.description}</p>
                        </div>
                      </div>

                      {module.id === 'attendance_dashboard' && roleForm.permissions[module.id]?.enabled && (
                        <div className="ml-10 mt-4 space-y-3 pl-4 border-l-4 border-purple-400">
                          <p className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Menus (Features):</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ATTENDANCE_PERMISSIONS.map(feature => (
                              <label 
                                key={feature.id} 
                                className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg transition-all ${
                                  roleForm.permissions[module.id]?.features?.includes(feature.id)
                                    ? 'bg-purple-100 border-2 border-purple-400 shadow-sm'
                                    : 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions[module.id]?.features?.includes(feature.id) || false}
                                  onChange={() => toggleRoleFeature(module.id, feature.id)}
                                  className="h-5 w-5 text-purple-600 focus:ring-2 focus:ring-purple-500 border-gray-300 rounded mt-0.5 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-gray-900 mb-1">{feature.name}</div>
                                  <div className="text-xs text-gray-600">{feature.description}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {module.id === 'teams_dashboard' && roleForm.permissions[module.id]?.enabled && (
                        <div className="ml-10 mt-4 space-y-3 pl-4 border-l-4 border-indigo-400">
                          <p className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Menus (Features):</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {TEAMS_PERMISSIONS.map(feature => (
                              <label 
                                key={feature.id} 
                                className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg transition-all ${
                                  roleForm.permissions[module.id]?.features?.includes(feature.id)
                                    ? 'bg-indigo-100 border-2 border-indigo-400 shadow-sm'
                                    : 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={roleForm.permissions[module.id]?.features?.includes(feature.id) || false}
                                  onChange={() => toggleRoleFeature(module.id, feature.id)}
                                  className="h-5 w-5 text-indigo-600 focus:ring-2 focus:ring-indigo-500 border-gray-300 rounded mt-0.5 cursor-pointer"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-gray-900 mb-1">{feature.name}</div>
                                  <div className="text-xs text-gray-600">{feature.description}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
