import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../lib/api'

export default function PermissionRoute({ children, requiredModule, requiredFeature }) {
  // Use server-backed user so role changes apply without re-login
  const { data: serverUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: !!localStorage.getItem('token'),
    staleTime: 1 * 60 * 1000,
    refetchOnMount: 'always',
  })
  const localUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  })()
  const user = serverUser || localUser

  if (isLoading && !serverUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (!user?.role) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be logged in to access this page.</p>
        </div>
      </div>
    )
  }

  if (user.role === 'admin') {
    return children
  }

  const permissions = user.permissions || {}
  const moduleId = requiredModule || 'attendance_dashboard'
  const modulePerms = permissions[moduleId] || {}

  if (!modulePerms.enabled) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this module.</p>
          <p className="text-sm text-gray-500 mt-2">Please contact your administrator for access.</p>
        </div>
      </div>
    )
  }

  const features = modulePerms.features || []
  const allowedFeatures = Array.isArray(requiredFeature) ? requiredFeature : (requiredFeature ? [requiredFeature] : [])
  if (allowedFeatures.length > 0) {
    const hasAny = allowedFeatures.some((f) => features.includes(f))
    if (!hasAny) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this feature.</p>
            <p className="text-sm text-gray-500 mt-2">Please contact your administrator for access.</p>
          </div>
        </div>
      )
    }
  }

  return children
}

