import { NavLink, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../lib/api'

export default function Sidebar() {
  const [localUser, setLocalUser] = useState(null)
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        setLocalUser(JSON.parse(userData))
      } catch (_) {
        setLocalUser(null)
      }
    } else {
      setLocalUser(null)
    }
  }, [])

  // Fetch current user from server so menu reflects latest role permissions (no re-login needed)
  const { data: serverUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: !!localStorage.getItem('token'),
    staleTime: 1 * 60 * 1000,
    refetchOnMount: 'always',
  })
  const user = serverUser || localUser

  const linkClass = ({ isActive }) =>
    `block px-4 py-2 rounded-md transition-colors ${isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-gray-700 hover:bg-white/60'}`

  // Check if user has permission for a feature (uses server user when available)
  const hasPermission = (featureId) => {
    if (!user) return false
    if (user.role === 'admin') return true
    const permissions = user.permissions || {}
    const attendancePerms = permissions.attendance_dashboard || {}
    if (!attendancePerms.enabled) return false
    const features = attendancePerms.features || []
    return features.includes(featureId)
  }

  return (
    <aside className="w-64 border-r border-white/30 backdrop-blur-md bg-white/30 flex-shrink-0 hidden md:block shadow-xl">
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-center mb-3">
          <img src="/logo/CIPLC_Logo-removebg-preview.png" alt="CIPLC Logo" className="h-12" />
        </div>
        <div className="text-center font-bold text-base text-gray-800 uppercase tracking-wide">
          ATTENDANCE MONITORING DASHBOARD
        </div>
      </div>
      <nav className="space-y-1 p-2">
        <Link to="/modules" className="flex items-center gap-3 px-4 py-2 rounded-md text-gray-700 hover:bg-white/60 mb-3 border-b border-white/20 pb-3 transition-colors">
          <span className="lnr lnr-arrow-left"></span>
          <span>Back to Modules</span>
        </Link>
        {hasPermission('dashboard') && (
          <>
            <NavLink to="/attendance/dashboard" className={linkClass}>
              <span className="flex items-center gap-3">
                <span className="lnr lnr-chart-bars"></span>
                <span>Dashboard</span>
              </span>
            </NavLink>
            <NavLink to="/attendance/attendance-recognition" className={linkClass}>
              <span className="flex items-center gap-3">
                <span className="lnr lnr-star"></span>
                <span>Attendance Recognition</span>
              </span>
            </NavLink>
            <NavLink to="/attendance/weekly-dashboard" className={linkClass}>
              <span className="flex items-center gap-3">
                <span className="lnr lnr-chart-bars"></span>
                <span>Weekly Analytics</span>
              </span>
            </NavLink>
            <NavLink to="/attendance/user-wise" className={linkClass}>
              <span className="flex items-center gap-3">
                <span className="lnr lnr-users"></span>
                <span>User Analytics</span>
              </span>
            </NavLink>
          </>
        )}
        {hasPermission('on_time') && (
          <NavLink to="/attendance/on-time" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-clock"></span>
              <span>On Time %</span>
            </span>
          </NavLink>
        )}
        {hasPermission('work_hour') && (
          <NavLink to="/attendance/work-hour" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-calendar-full"></span>
              <span>Work Hour Completion</span>
            </span>
          </NavLink>
        )}
        {(hasPermission('work_hour_lost') || hasPermission('cost_settings') || hasPermission('work_hour_lost_cost')) && (
          <>
            {hasPermission('work_hour_lost') && (
              <NavLink to="/attendance/work-hour-lost" className={linkClass}>
                <span className="flex items-center gap-3">
                  <span className="lnr lnr-hourglass"></span>
                  <span>Work Hour Lost</span>
                </span>
              </NavLink>
            )}
            {hasPermission('work_hour_lost') || hasPermission('cost_settings') ? (
              <NavLink to="/attendance/cost-settings" className={linkClass}>
                <span className="flex items-center gap-3">
                  <span className="lnr lnr-cog"></span>
                  <span>Cost Settings</span>
                </span>
              </NavLink>
            ) : null}
            {hasPermission('work_hour_lost') || hasPermission('work_hour_lost_cost') ? (
              <NavLink to="/attendance/work-hour-lost-cost" className={linkClass}>
                <span className="flex items-center gap-3">
                  <span className="lnr lnr-pie-chart"></span>
                  <span>Lost Hours Cost Analysis</span>
                </span>
              </NavLink>
            ) : null}
          </>
        )}
        {hasPermission('leave_analysis') && (
          <NavLink to="/attendance/leave-analysis" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-users"></span>
              <span>Leave Analysis Adjacent to Weekend and Holiday</span>
            </span>
          </NavLink>
        )}
        {hasPermission('od_analysis') && (
          <NavLink to="/attendance/od-analysis" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-briefcase"></span>
              <span>OD Analysis</span>
            </span>
          </NavLink>
        )}
        {hasPermission('weekly_analysis') && (
          <NavLink to="/attendance/weekly-analysis" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-calendar-full"></span>
              <span>Weekly Analysis</span>
            </span>
          </NavLink>
        )}
        {hasPermission('upload') && (
          <NavLink to="/attendance/upload" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-upload"></span>
              <span>Upload Files</span>
            </span>
          </NavLink>
        )}
        {hasPermission('batches') && (
          <NavLink to="/attendance/batches" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-file-empty"></span>
              <span>Uploaded Batches</span>
            </span>
          </NavLink>
        )}
      </nav>
    </aside>
  )
}


