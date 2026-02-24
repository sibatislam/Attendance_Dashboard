import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

const DOS_DONTS_CONTENT = {
  dos: [
    'Use attendance data to start timely and constructive conversations, focusing on improvement rather than delayed reactions.',
    'Look at patterns over time, not one-off instances, and always consider work context before responding.',
    'Share visibility early to support self-correction, not to assign blame.',
    'Apply attendance expectations consistently across the team to ensure fairness and trust.',
    'Frame discussions around professionalism and shared expectations, not personal judgement.',
    'Keep conversations respectful, appropriate, and solution-focused, whether in team settings or one-to-one support discussions.',
  ],
  donts: [
    "Don't use attendance data to track or question individuals on a day-to-day basis. The intent is to understand team patterns, while still allowing supportive one-to-one conversations when needed.",
    "Don't use attendance visibility as a disciplinary shortcut or public comparison. This is a tool for discussion and improvement, not for calling out teams or individuals.",
    "Don't react to single data points without first understanding the context. Attendance should always be discussed based on patterns and dialogue, not isolated figures.",
    "Don't create pressure or fear by over-emphasising tracking, warnings, or penalties. The focus is on early support and self-correction, not enforcement.",
    "Don't apply attendance expectations inconsistently across team members or roles. Fairness requires clear and equal standards for everyone.",
    "This system does not replace leadership responsibility. Attendance information supports leadership conversations — it does not replace dialogue, discretion, or human understanding.",
  ],
}

const LM_CONVERSATIONAL_QUESTIONS = [
  { range: 'Intro', question: '"This is not a performance discussion. It\'s a short team reflection to help us move forward together."' },
  { range: 'Attendance Role Models (≥ 93%)', question: '"What is one habit we should protect so we can maintain our position next month?"' },
  { range: 'Steady & Reliable Teams (90% – 92.9%)', question: '"What small change can we adopt to help us move into the Attendance Role Model category next month?"' },
  { range: 'On the Rise (85% – 89.9% + improving)', question: '"What small change would help us improve this month/week, so that we can cross 90% next?"' },
  { range: 'Attention Needed – Early Signals (80% – 84.9%)', question: '"What is the main thing affecting our attendance, and what can we do to fix it together this month/week?"' },
  { range: 'Immediate Focus Required (< 80%)', question: '"What one change can we commit to this month/week to stabilise our attendance?"' },
]

export default function ModuleSelectionPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [showDosDonts, setShowDosDonts] = useState(false)

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
        <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none">
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
        <svg className="w-12 h-12" viewBox="0 0 64 64" fill="none">
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
    <div className="h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Do's and Don'ts modal */}
      {showDosDonts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDosDonts(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-[92vw] max-w-6xl max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Do's and Don'ts</h3>
              <button
                type="button"
                onClick={() => setShowDosDonts(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <span className="lnr lnr-cross text-xl" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                <section>
                  <h4 className="flex items-center gap-2 font-semibold text-green-700 mb-2">✅ Do</h4>
                  <ul className="space-y-1.5 text-gray-700 leading-relaxed">
                    {DOS_DONTS_CONTENT.dos.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-green-500 shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                    <li key="one-on-one" className="flex gap-2">
                      <span className="text-green-500 shrink-0">•</span>
                      <span>Hold supportive one-on-one conversations with key employees.</span>
                    </li>
                  </ul>
                </section>
                <section>
                  <h4 className="flex items-center gap-2 font-semibold text-red-700 mb-2">❌ Don't</h4>
                  <ul className="space-y-1.5 text-gray-700 leading-relaxed">
                    {DOS_DONTS_CONTENT.donts.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-red-500 shrink-0">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-semibold text-gray-800 mb-2">LM Conversational Questions</h4>
                <ul className="space-y-2 text-gray-700">
                  {LM_CONVERSATIONAL_QUESTIONS.map((item, i) => (
                    <li key={i}>
                      <span className="font-medium text-gray-800">{item.range}:</span>{' '}
                      <span className="italic">{item.question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowDosDonts(false)}
                className="w-full py-2.5 px-4 font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

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
      <header className="relative z-10 shrink-0 backdrop-blur-none bg-white/5 border-b border-gray-300/20 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
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
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 flex flex-col max-w-6xl mx-auto px-6 w-full py-6 overflow-auto">
        <div className="text-center mb-8 shrink-0">
          <h1 className="max-w-3xl mx-auto text-lg md:text-xl font-bold text-gray-800 leading-snug" style={{ animationDelay: '0.1s' }}>
            This system exists to provide <span className="text-blue-600">clarity and visibility</span> — so we can self-correct early, work fairly, and uphold shared professional standards.
          </h1>
        </div>

        {/* Do's and Don'ts card - centered, above "Select a Module" */}
        <div className="flex justify-center mb-5 shrink-0">
          <div
            onClick={() => setShowDosDonts(true)}
            className="w-full max-w-lg md:max-w-xl backdrop-blur-none bg-white/5 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden group border border-gray-300/20 flex flex-col"
          >
            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
            <div className="p-5 flex flex-col">
              <div className="mb-3 flex justify-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 border-2 border-green-400" title="Do">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 border-2 border-red-400" title="Don't">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors text-center">Do's and Don'ts</h3>
              <p className="text-sm text-gray-700 leading-relaxed text-center">Attendance visibility is designed to support fairness and shared responsibility. Use this visibility to support timely conversations, guide improvement, and apply standards consistently.</p>
              <div className="flex items-center justify-center text-blue-600 font-semibold text-sm group-hover:text-blue-700 transition-colors mt-3">
                <span>View Do's and Don'ts</span>
                <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mb-5 shrink-0">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Select a Module</h2>
          <p className="text-gray-600 text-sm">Choose the dashboard you want to access</p>
        </div>

        {/* Module cards - comfortable size */}
        <div className="flex justify-center flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl content-start">
          {modules.map((module) => (
            <div
              key={module.id}
              onClick={() => navigate(module.path)}
              className="backdrop-blur-none bg-white/5 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden group border border-gray-300/20 flex flex-col min-h-[240px]"
            >
              <div className={`h-1 bg-gradient-to-r ${module.id === 'attendance' ? 'from-blue-500 to-blue-600' : 'from-purple-500 to-purple-600'}`} />
              <div className="p-6 flex-1 flex flex-col">
                <div className="mb-4 flex justify-center">{module.icon}</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-blue-500 group-hover:to-purple-500 transition-all leading-tight">
                  {module.title}
                </h3>
                <p className="text-sm text-gray-700 mb-4 leading-snug flex-1">{module.description}</p>
                <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:text-purple-600 transition-colors">
                  <span>Open Dashboard</span>
                  <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 shrink-0 text-center py-4">
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

        @keyframes intro-fade-up {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .intro-text-block .intro-line {
          opacity: 0;
          animation: intro-fade-up 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

