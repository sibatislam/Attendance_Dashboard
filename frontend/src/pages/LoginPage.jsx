import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { login } from '../lib/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await login(username, password)
      
      // Store token and user info
      localStorage.setItem('token', response.access_token)
      localStorage.setItem('user', JSON.stringify(response.user))

      // Remove scope and user caches so the new user's permissions and scope are always fetched
      queryClient.removeQueries({ queryKey: ['myScope'] })
      queryClient.removeQueries({ queryKey: ['currentUser'] })
      queryClient.removeQueries({ queryKey: ['weekly_dashboard'] })
      // Clear saved Weekly Dashboard filters so restricted users don't inherit another user's selections
      localStorage.removeItem('weekly_dashboard_filters')

      // Navigate to module selection
      navigate('/modules')
    } catch (err) {
      console.error('Login error:', err)
      const detail = err.response?.data?.detail
      const errorMsg = typeof detail === 'string' ? detail : (err.response?.status === 401 ? 'Invalid username or password.' : err.message || 'Login failed. Please try again.')
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
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
        {/* Large shapes */}
        <div className="absolute top-20 left-10 w-32 h-32 border-2 border-gray-400 rounded-lg animate-spin-slow"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 border-2 border-gray-300 rounded-full animate-spin-reverse"></div>
        <div className="absolute top-1/2 right-20 w-24 h-24 border-2 border-gray-500 rounded-lg animate-spin-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/4 left-1/3 w-28 h-28 border-2 border-gray-400 rounded-full animate-spin-reverse" style={{ animationDelay: '5s' }}></div>
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 border-2 border-gray-500 rounded-lg animate-spin-slow" style={{ animationDelay: '8s' }}></div>
        
        {/* Medium shapes */}
        <div className="absolute top-1/3 left-20 w-24 h-24 border-2 border-gray-400 rounded-full animate-spin-slow" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-1/4 left-1/2 w-28 h-28 border-2 border-gray-500 rounded-lg animate-spin-reverse" style={{ animationDelay: '6s' }}></div>
        <div className="absolute top-2/3 right-1/3 w-20 h-20 border-2 border-gray-300 rounded-full animate-spin-slow" style={{ animationDelay: '9s' }}></div>
        <div className="absolute top-1/4 right-1/4 w-26 h-26 border-2 border-gray-400 rounded-lg animate-spin-reverse" style={{ animationDelay: '4s' }}></div>
        <div className="absolute bottom-40 left-1/4 w-22 h-22 border-2 border-gray-500 rounded-full animate-spin-slow" style={{ animationDelay: '7s' }}></div>
        
        {/* Small shapes */}
        <div className="absolute top-32 right-1/2 w-16 h-16 border-2 border-gray-400 rounded-lg animate-spin-reverse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-40 w-18 h-18 border-2 border-gray-300 rounded-full animate-spin-slow" style={{ animationDelay: '10s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-14 h-14 border-2 border-gray-500 rounded-lg animate-spin-reverse" style={{ animationDelay: '5.5s' }}></div>
        <div className="absolute bottom-1/2 right-40 w-16 h-16 border-2 border-gray-400 rounded-full animate-spin-slow" style={{ animationDelay: '8.5s' }}></div>
        <div className="absolute top-40 left-1/2 w-12 h-12 border-2 border-gray-300 rounded-lg animate-spin-reverse" style={{ animationDelay: '3.5s' }}></div>
      </div>
      
      {/* Additional decorative elements - triangles */}
      <div className="absolute inset-0 overflow-hidden opacity-5">
        <div className="absolute top-16 right-1/3 w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[35px] border-b-gray-400 animate-spin-slow" style={{ animationDelay: '2.5s' }}></div>
        <div className="absolute bottom-24 left-1/3 w-0 h-0 border-l-[25px] border-l-transparent border-r-[25px] border-r-transparent border-b-[43px] border-b-gray-500 animate-spin-reverse" style={{ animationDelay: '6.5s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[26px] border-b-gray-300 animate-spin-slow" style={{ animationDelay: '4.5s' }}></div>
        <div className="absolute top-2/3 left-1/2 w-0 h-0 border-l-[18px] border-l-transparent border-r-[18px] border-r-transparent border-b-[31px] border-b-gray-400 animate-spin-reverse" style={{ animationDelay: '9.5s' }}></div>
        <div className="absolute top-1/4 left-2/3 w-0 h-0 border-l-[22px] border-l-transparent border-r-[22px] border-r-transparent border-b-[38px] border-b-gray-400 animate-spin-slow" style={{ animationDelay: '7.5s' }}></div>
        <div className="absolute bottom-1/3 right-2/3 w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[28px] border-b-gray-300 animate-spin-reverse" style={{ animationDelay: '3.5s' }}></div>
      </div>
      
      {/* Diamond shapes */}
      <div className="absolute inset-0 overflow-hidden opacity-8">
        <div className="absolute top-24 left-1/4 w-8 h-8 border-2 border-gray-400 transform rotate-45 animate-spin-slow" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute bottom-28 right-1/3 w-10 h-10 border-2 border-gray-300 transform rotate-45 animate-spin-reverse" style={{ animationDelay: '5.5s' }}></div>
        <div className="absolute top-1/3 right-1/2 w-6 h-6 border-2 border-gray-500 transform rotate-45 animate-spin-slow" style={{ animationDelay: '8.5s' }}></div>
        <div className="absolute bottom-1/2 left-1/3 w-7 h-7 border-2 border-gray-400 transform rotate-45 animate-spin-reverse" style={{ animationDelay: '4.5s' }}></div>
        <div className="absolute top-2/3 left-2/3 w-9 h-9 border-2 border-gray-300 transform rotate-45 animate-spin-slow" style={{ animationDelay: '6.5s' }}></div>
        <div className="absolute bottom-40 right-1/4 w-6 h-6 border-2 border-gray-500 transform rotate-45 animate-spin-reverse" style={{ animationDelay: '2.5s' }}></div>
      </div>
      
      {/* Star-like shapes */}
      <div className="absolute inset-0 overflow-hidden opacity-6">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 animate-pulse"
            style={{
              left: `${10 + (i * 12)}%`,
              top: `${15 + (i * 8)}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${2 + (i * 0.3)}s`
            }}
          >
            <div className="absolute w-3 h-0.5 bg-gray-400 left-0 top-1/2 transform -translate-y-1/2"></div>
            <div className="absolute w-0.5 h-3 bg-gray-400 left-1/2 top-0 transform -translate-x-1/2"></div>
          </div>
        ))}
      </div>
      
      {/* Hexagon shapes */}
      <div className="absolute inset-0 overflow-hidden opacity-7">
        <div className="absolute top-36 right-20 w-8 h-8">
          <svg viewBox="0 0 100 100" className="animate-spin-slow" style={{ animationDelay: '2s' }}>
            <polygon points="50,5 90,30 90,70 50,95 10,70 10,30" fill="none" stroke="#9ca3af" strokeWidth="3"/>
          </svg>
        </div>
        <div className="absolute bottom-36 left-24 w-10 h-10">
          <svg viewBox="0 0 100 100" className="animate-spin-reverse" style={{ animationDelay: '7s' }}>
            <polygon points="50,5 90,30 90,70 50,95 10,70 10,30" fill="none" stroke="#9ca3af" strokeWidth="3"/>
          </svg>
        </div>
        <div className="absolute top-1/2 left-1/2 w-7 h-7">
          <svg viewBox="0 0 100 100" className="animate-spin-slow" style={{ animationDelay: '4.5s' }}>
            <polygon points="50,5 90,30 90,70 50,95 10,70 10,30" fill="none" stroke="#9ca3af" strokeWidth="3"/>
          </svg>
        </div>
      </div>

      {/* Floating dots */}
      <div className="absolute inset-0 overflow-hidden opacity-15">
        {[...Array(25)].map((_, i) => (
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
      
      {/* Small scattered dots */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-gray-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
          ></div>
        ))}
      </div>

      {/* Horizontal lines */}
      <div className="absolute inset-0 overflow-hidden opacity-5">
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
        <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-500 to-transparent"></div>
        <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent"></div>
      </div>

      {/* Logo above card */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20 animate-fade-in">
        <img src="/logo/CIPLC_Logo-removebg-preview.png" alt="CIPLC Logo" className="h-20 drop-shadow-2xl" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md animate-scale-in">
        {/* Subtle glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-gray-200 to-gray-300 rounded-3xl blur-xl opacity-20"></div>
        
        <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-300/30 p-10">
          {/* Welcome Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 tracking-wide mb-2">
              Welcome
            </h1>
            <p className="text-gray-500 text-sm">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-xl text-sm animate-shake">
                <div className="flex items-center gap-2">
                  <span className="lnr lnr-warning"></span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-800 placeholder-gray-400 transition-all hover:border-gray-400"
                  placeholder="Enter your username"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-800 placeholder-gray-400 transition-all hover:border-gray-400"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm mt-6">
              <label className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 transition-all ${
                    rememberMe 
                      ? 'bg-gray-700 border-gray-700 shadow-lg shadow-gray-400/50' 
                      : 'bg-white border-gray-300'
                  }`}>
                    {rememberMe && (
                      <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="ml-2 text-gray-600 group-hover:text-gray-800 transition-colors">Remember me</span>
              </label>
              <button type="button" className="text-gray-600 hover:text-gray-800 transition-colors font-medium">
                Forgot Password?
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-gradient-to-r from-gray-700 to-gray-900 text-white py-3.5 rounded-xl disabled:opacity-70 disabled:cursor-not-allowed font-semibold text-base transition-all hover:from-gray-800 hover:to-black shadow-lg"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Signing in...</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
            
            {isLoading && (
              <p className="text-xs text-center text-gray-600 mt-3 animate-pulse">
                Verifying credentials...
              </p>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>© 2025 CIPLC. All rights reserved.</p>
        </div>
      </div>

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
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes spin-reverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
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
        
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
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
        
        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  )
}

