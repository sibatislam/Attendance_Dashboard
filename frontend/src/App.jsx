import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import HeaderBar from './components/HeaderBar'

const PAGE_TITLES = {
  '/attendance': 'Dashboard',
  '/attendance/dashboard': 'Dashboard',
  '/attendance/upload': 'Upload Files',
  '/attendance/batches': 'Uploaded Batches',
  '/attendance/on-time': 'On Time %',
  '/attendance/work-hour': 'Work Hour Completion',
  '/attendance/work-hour-lost': 'Work Hour Lost',
  '/attendance/leave-analysis': 'Leave Analysis',
  '/attendance/user-wise': 'User Analytics',
}

function App() {
  return (
    <div className="h-screen overflow-hidden relative">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{ 
          backgroundImage: 'url(/background.jpg)',
          zIndex: 0
        }}
      ></div>
      
      <div className="flex h-full relative z-10">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <HeaderBar />
          <main className="flex-1 overflow-auto px-4 py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default App


