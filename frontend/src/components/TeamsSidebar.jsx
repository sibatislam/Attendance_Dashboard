import { NavLink, Link } from 'react-router-dom'

export default function TeamsSidebar() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = user.role === 'admin'
  const permissions = user.permissions?.teams_dashboard || {}
  const features = permissions.features || []

  const hasPermission = (feature) => {
    return isAdmin || features.includes(feature)
  }

  const linkClass = ({ isActive }) =>
    `block px-4 py-2 rounded-md transition-colors ${isActive ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'text-gray-700 hover:bg-white/60'}`

  return (
    <aside className="w-64 border-r border-white/30 backdrop-blur-md bg-white/30 flex-shrink-0 hidden md:block shadow-xl">
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-center mb-3">
          <img src="/logo/CIPLC_Logo-removebg-preview.png" alt="CIPLC Logo" className="h-12" />
        </div>
        <div className="text-center font-bold text-base text-gray-800 uppercase tracking-wide">
          MS TEAMS USER ACTIVITY
        </div>
      </div>
      <nav className="space-y-1 p-2">
        <Link to="/modules" className="flex items-center gap-3 px-4 py-2 rounded-md text-gray-700 hover:bg-white/60 mb-3 border-b border-white/20 pb-3 transition-colors">
          <span className="lnr lnr-arrow-left"></span>
          <span>Back to Modules</span>
        </Link>
        
        {hasPermission('user_activity') && (
          <NavLink to="/teams/dashboard" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-chart-bars"></span>
              <span>User Activity</span>
            </span>
          </NavLink>
        )}

        {hasPermission('license_entry') && (
          <NavLink to="/teams/license" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-cog"></span>
              <span>Teams License</span>
            </span>
          </NavLink>
        )}
        
        {hasPermission('upload_activity') && (
          <NavLink to="/teams/upload" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-upload"></span>
              <span>Upload Activity Files</span>
            </span>
          </NavLink>
        )}
        
        {hasPermission('activity_batches') && (
          <NavLink to="/teams/batches" className={linkClass}>
            <span className="flex items-center gap-3">
              <span className="lnr lnr-file-empty"></span>
              <span>Uploaded Activity Files</span>
            </span>
          </NavLink>
        )}
        
        {(hasPermission('app_activity') || hasPermission('upload_app') || hasPermission('app_batches')) && (
          <div className="pt-3 mt-3 border-t border-white/20">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">App Usage</p>
            
            {hasPermission('app_activity') && (
              <NavLink to="/teams/app/activity" className={linkClass}>
                <span className="flex items-center gap-3">
                  <span className="lnr lnr-chart-bars"></span>
                  <span>Teams App Activity</span>
                </span>
              </NavLink>
            )}
            
            {hasPermission('upload_app') && (
              <NavLink to="/teams/app/upload" className={linkClass}>
                <span className="flex items-center gap-3">
                  <span className="lnr lnr-cloud-upload"></span>
                  <span>Upload App Usage</span>
                </span>
              </NavLink>
            )}
            
            {hasPermission('app_batches') && (
              <NavLink to="/teams/app/batches" className={linkClass}>
                <span className="flex items-center gap-3">
                  <span className="lnr lnr-layers"></span>
                  <span>App Usage Files</span>
                </span>
              </NavLink>
            )}
          </div>
        )}
      </nav>
    </aside>
  )
}

