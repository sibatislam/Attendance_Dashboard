import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export default function UserProfilePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [backPath, setBackPath] = useState('/modules')
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    position: '',
    department: ''
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const parsed = JSON.parse(userData)
      setUser(parsed)
      setFormData(prev => ({
        ...prev,
        position: parsed.position || '',
        department: parsed.department || ''
      }))
    }

    // Determine back path based on location state or referrer
    const state = location.state
    if (state?.from) {
      setBackPath(state.from)
    } else {
      // Check if we can determine from the previous path
      const referrer = document.referrer
      if (referrer) {
        try {
          const referrerUrl = new URL(referrer)
          const referrerPath = referrerUrl.pathname
          
          // If coming from attendance module
          if (referrerPath.startsWith('/attendance')) {
            setBackPath('/attendance/dashboard')
          }
          // If coming from teams module
          else if (referrerPath.startsWith('/teams')) {
            setBackPath('/teams/dashboard')
          }
          // If coming from modules page
          else if (referrerPath === '/modules' || referrerPath === '/') {
            setBackPath('/modules')
          }
          // Default to modules
          else {
            setBackPath('/modules')
          }
        } catch (e) {
          // If URL parsing fails, default to modules
          setBackPath('/modules')
        }
      }
    }
  }, [location.state])

  const { data: currentUser, refetch: refetchUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await api.get('/auth/me')
      return response.data
    },
    onSuccess: (data) => {
      setUser(data)
      setFormData(prev => ({
        ...prev,
        position: data.position || '',
        department: data.department || ''
      }))
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(data))
    }
  })

  const changePasswordMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/auth/change-password', {
        current_password: data.currentPassword,
        new_password: data.newPassword
      })
      return response.data
    },
    onSuccess: () => {
      setSuccess('Password changed successfully!')
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))
      setErrors({})
      setTimeout(() => setSuccess(''), 3000)
    },
    onError: (error) => {
      setErrors({ password: error.response?.data?.detail || 'Failed to change password' })
    }
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        position: data.position,
        department: data.department
      }
      if (data.newPassword) {
        payload.password = data.newPassword
        payload.current_password = data.currentPassword
      }
      const response = await api.put('/auth/profile', payload)
      return response.data
    },
    onSuccess: (data) => {
      setSuccess('Profile updated successfully!')
      setUser(data)
      localStorage.setItem('user', JSON.stringify(data))
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))
      setErrors({})
      refetchUser()
      setTimeout(() => setSuccess(''), 3000)
    },
    onError: (error) => {
      setErrors({ profile: error.response?.data?.detail || 'Failed to update profile' })
    }
  })

  const validateForm = () => {
    const newErrors = {}
    
    // If changing password, validate password fields
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = 'Current password is required'
      }
      if (formData.newPassword.length < 6) {
        newErrors.newPassword = 'Password must be at least 6 characters'
      }
      if (formData.newPassword !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePasswordChange = (e) => {
    e.preventDefault()
    if (!validateForm()) return
    
    changePasswordMutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    })
  }

  const handleProfileUpdate = (e) => {
    e.preventDefault()
    if (!validateForm()) return
    
    updateProfileMutation.mutate(formData)
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  const handleBack = () => {
    // Try to go back in history first
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      // Fallback to determined path
      navigate(backPath)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Profile</h2>
          <p className="text-gray-600 mt-1">Manage your account settings, password, and profile information</p>
        </div>
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="lnr lnr-arrow-left"></span>
          Back
        </button>
      </div>

      {success && (
        <div className="card p-4 bg-green-50 border border-green-200">
          <div className="flex items-center gap-2">
            <span className="lnr lnr-checkmark-circle text-green-600"></span>
            <span className="text-green-800 font-medium">{success}</span>
          </div>
        </div>
      )}

      {/* Account Information */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="lnr lnr-user text-blue-600"></span>
          Account Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={user.username || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user.email || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={user.full_name || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              type="text"
              value={user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Profile Update Form */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="lnr lnr-cog text-indigo-600"></span>
          Update Profile
        </h3>
        <form onSubmit={handleProfileUpdate}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Designation <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>
            {errors.profile && (
              <div className="text-red-600 text-sm">{errors.profile}</div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {updateProfileMutation.isPending && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Update Profile
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Change Password Form */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="lnr lnr-lock text-red-600"></span>
          Change Password
        </h3>
        <form onSubmit={handlePasswordChange}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                required={!!formData.newPassword}
              />
              {errors.currentPassword && (
                <div className="text-red-600 text-sm mt-1">{errors.currentPassword}</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Leave blank to keep current password"
              />
              {errors.newPassword && (
                <div className="text-red-600 text-sm mt-1">{errors.newPassword}</div>
              )}
            </div>
            {formData.newPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
                {errors.confirmPassword && (
                  <div className="text-red-600 text-sm mt-1">{errors.confirmPassword}</div>
                )}
              </div>
            )}
            {errors.password && (
              <div className="text-red-600 text-sm">{errors.password}</div>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending || !formData.newPassword}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {changePasswordMutation.isPending && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Change Password
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
