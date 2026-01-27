import { NavLink, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function Sidebar() {
  const [user, setUser] = useState(null)
  
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])
  
  const linkClass = ({ isActive }) =>
    `block px-4 py-2 rounded-md transition-colors ${isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-gray-700 hover:bg-white/60'}`

  // Check if user has permission for a feature
  const hasPermission = (featureId) => {
    if (!user) return false
    if (user.role === 'admin') return true // Admins have all permissions
    
    const permissions = user.permissions || {}
    const attendancePerms = permissions.attendance_dashboard || {}
    
    if (!attendancePerms.enabled) return false // Module not enabled
    
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
            <NavLink to="/attendance/weekly-dashboard" className={linkClass}>
              <span className="flex items-center gap-3">
                <span className="lnr lnr-chart-bars"></span>
                <span>Weekly Dashboard</span>
              </span>
            </NavLink>
            <NavLink to="/attendance/user-wise" className={linkClass}>
              <span className="flex items-center gap-3">
                <span className="lnr lnr-users"></span>
                <span>User Wise</span>
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
        {hasPermission('work_hour_lost') && (
          <NavLink to="/attendance/work-hour-lost" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-hourglass"></span>
              <span>Work Hour Lost</span>
            </span>
          </NavLink>
        )}
        {hasPermission('leave_analysis') && (
          <NavLink to="/attendance/leave-analysis" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-users"></span>
              <span>Leave Analysis Adjacent to Weekend and Holiday</span>
            </span>
          </NavLink>
        )}
        <NavLink to="/attendance/od-analysis" className={linkClass}>
          <span className="flex items-center gap-3">
            <span className="lnr lnr-briefcase"></span>
            <span>OD Analysis</span>
          </span>
        </NavLink>
        <NavLink to="/attendance/weekly-analysis" className={linkClass}>
          <span className="flex items-center gap-3">
            <span className="lnr lnr-calendar-full"></span>
            <span>Weekly Analysis</span>
          </span>
        </NavLink>
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


