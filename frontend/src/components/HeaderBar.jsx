import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function HeaderBar({ right }) {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <header className="border-b border-white/30 backdrop-blur-md bg-white/30 shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>{right}</div>
        {user && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">{user.full_name || user.username}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <button
              onClick={() => navigate('/profile', { state: { from: location.pathname } })}
              className="px-3 py-1.5 text-xs bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-md hover:bg-indigo-200 transition-all flex items-center gap-1"
            >
              <span className="lnr lnr-user"></span>
              Profile
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => navigate('/admin/users')}
                className="px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 text-slate-800 rounded-md hover:bg-slate-200 transition-all"
              >
                User & Role Management
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}


