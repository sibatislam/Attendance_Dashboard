import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function ModuleSelectionPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

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

  const allModules = [
    {
      id: 'attendance',
      permissionKey: 'attendance_dashboard',
      title: 'Attendance Monitoring Dashboard',
      description: 'Track employee attendance, work hours, and leave analysis',
      icon: (
        <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="32" width="12" height="24" fill="#34d399" rx="2"/>
          <rect x="26" y="16" width="12" height="40" fill="#60a5fa" rx="2"/>
          <rect x="44" y="24" width="12" height="32" fill="#f87171" rx="2"/>
        </svg>
      ),
      path: '/attendance/dashboard',
      accentColor: 'border-blue-500'
    },
    {
      id: 'msteams',
      permissionKey: 'teams_dashboard',
      title: 'MS Teams User Activity',
      description: 'Monitor MS Teams activity and manage employee information',
      icon: (
        <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
          <circle cx="20" cy="20" r="12" fill="#a78bfa"/>
          <path d="M20 34c-8 0-14 6-14 14h28c0-8-6-14-14-14z" fill="#a78bfa"/>
          <circle cx="44" cy="20" r="12" fill="#a78bfa"/>
          <path d="M44 34c-8 0-14 6-14 14h28c0-8-6-14-14-14z" fill="#a78bfa"/>
        </svg>
      ),
      path: '/teams/dashboard',
      accentColor: 'border-purple-500'
    }
  ]

  // Filter modules based on user permissions
  const modules = user?.role === 'admin' 
    ? allModules 
    : allModules.filter(module => {
        const permissions = user?.permissions || {}
        return permissions[module.permissionKey]?.enabled === true
      })

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Subtle animated waves */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-gray-200 rounded-full mix-blend-multiply filter blur-xl animate-wave"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gray-200 rounded-full mix-blend-multiply filter blur-xl animate-wave-delay-1"></div>
        <div className="absolute -bottom-40 left-20 w-80 h-80 bg-gray-200 rounded-full mix-blend-multiply filter blur-xl animate-wave-delay-2"></div>
        <div className="absolute top-1/3 -right-20 w-96 h-96 bg-gray-200 rounded-full mix-blend-multiply filter blur-2xl animate-wave-delay-3"></div>
        <div className="absolute bottom-1/4 -left-20 w-72 h-72 bg-gray-200 rounded-full mix-blend-multiply filter blur-2xl animate-wave-delay-4"></div>
        <div className="absolute top-1/2 left-1/3 w-88 h-88 bg-gray-200 rounded-full mix-blend-multiply filter blur-2xl animate-wave-delay-1"></div>
        <div className="absolute bottom-1/3 right-1/3 w-76 h-76 bg-gray-200 rounded-full mix-blend-multiply filter blur-xl animate-wave-delay-3"></div>
      </div>

      {/* Geometric shapes */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        {/* Circles & Squares */}
        <div className="absolute top-20 left-10 w-32 h-32 border-2 border-gray-400 rounded-lg animate-spin-slow"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 border-2 border-gray-300 rounded-full animate-spin-reverse"></div>
        <div className="absolute top-1/2 right-20 w-24 h-24 border-2 border-gray-500 rounded-lg animate-spin-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/4 left-1/3 w-28 h-28 border-2 border-gray-400 rounded-full animate-spin-reverse" style={{ animationDelay: '5s' }}></div>
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 border-2 border-gray-500 rounded-lg animate-spin-slow" style={{ animationDelay: '8s' }}></div>
      </div>

      {/* Floating dots */}
      <div className="absolute inset-0 overflow-hidden opacity-15">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-gray-400 rounded-full animate-float-up"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${100 + Math.random() * 20}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${15 + Math.random() * 10}s`
            }}
          ></div>
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 backdrop-blur-none bg-white/5 border-b border-gray-300/20 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard Modules</h1>
            {user && <p className="text-sm text-gray-600 mt-1">Welcome, {user.full_name || user.username}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile', { state: { from: '/modules' } })}
              className="px-4 py-2 text-sm backdrop-blur-sm bg-white/30 border border-gray-300/50 text-gray-700 rounded-lg hover:bg-white/50 transition-all shadow-lg flex items-center gap-2"
            >
              <span className="lnr lnr-user"></span>
              Profile
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin/users')}
                className="px-4 py-2 text-sm backdrop-blur-sm bg-white/30 border border-gray-300/50 text-gray-700 rounded-lg hover:bg-white/50 transition-all shadow-lg"
              >
                User & role management
              </button>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-lg hover:from-gray-800 hover:to-black transition-all shadow-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Select a Module</h2>
          <p className="text-gray-600 text-lg">Choose the dashboard you want to access</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {modules.map((module) => (
            <div
              key={module.id}
              onClick={() => navigate(module.path)}
              className="backdrop-blur-none bg-white/5 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 hover:scale-105 overflow-hidden group border border-gray-300/20"
            >
              <div className={`h-1.5 bg-gradient-to-r ${module.id === 'attendance' ? 'from-blue-500 to-blue-600' : 'from-purple-500 to-purple-600'}`} />
              <div className="p-8">
                <div className="mb-6 flex justify-center transform group-hover:scale-110 transition-transform duration-300">
                  {module.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500 transition-all">
                  {module.title}
                </h3>
                <p className="text-gray-700 mb-6 leading-relaxed">{module.description}</p>
                <div className="flex items-center text-blue-600 font-semibold group-hover:text-purple-600 transition-colors">
                  <span>Open Dashboard</span>
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6">
        <p className="text-gray-500 text-sm">© 2025 CIPLC. All rights reserved.</p>
      </footer>

      <style>{`
        @keyframes wave {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
          }
          33% { 
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% { 
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }
        
        @keyframes wave-delay-1 {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg);
          }
          33% { 
            transform: translate(-30px, 30px) rotate(-120deg);
          }
          66% { 
            transform: translate(20px, -20px) rotate(-240deg);
          }
        }
        
        @keyframes wave-delay-2 {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          50% { 
            transform: translate(15px, -15px) scale(1.1);
          }
        }
        
        @keyframes wave-delay-3 {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          50% { 
            transform: translate(-25px, 25px) rotate(180deg) scale(1.15);
          }
        }
        
        @keyframes wave-delay-4 {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          25% { 
            transform: translate(20px, -20px) scale(0.95);
          }
          75% { 
            transform: translate(-15px, 15px) scale(1.05);
          }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        @keyframes float-up {
          from {
            transform: translateY(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          to {
            transform: translateY(-100vh);
            opacity: 0;
          }
        }
        
        .animate-wave {
          animation: wave 20s ease-in-out infinite;
        }
        
        .animate-wave-delay-1 {
          animation: wave-delay-1 25s ease-in-out infinite;
        }
        
        .animate-wave-delay-2 {
          animation: wave-delay-2 30s ease-in-out infinite;
        }
        
        .animate-wave-delay-3 {
          animation: wave-delay-3 35s ease-in-out infinite;
        }
        
        .animate-wave-delay-4 {
          animation: wave-delay-4 28s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 40s linear infinite;
        }
        
        .animate-spin-reverse {
          animation: spin-reverse 50s linear infinite;
        }
        
        .animate-float-up {
          animation: float-up linear infinite;
        }
      `}</style>
    </div>
  )
}

