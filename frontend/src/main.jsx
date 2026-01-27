import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import TeamsApp from './TeamsApp'
import { queryClient } from './lib/queryClient'
import LoginPage from './pages/LoginPage'
import ModuleSelectionPage from './pages/ModuleSelectionPage'
import UserManagementPage from './pages/UserManagementPage'
import UserProfilePage from './pages/UserProfilePage'
import DashboardPage from './pages/DashboardPage'
import UploadPage from './pages/UploadPage'
import BatchesPage from './pages/BatchesPage'
import FileDetailPage from './pages/FileDetailPage'
import OnTimePage from './pages/OnTimePage'
import WorkHourPage from './pages/WorkHourPage'
import WorkHourLostPage from './pages/WorkHourLostPage'
import LeaveAnalysisPage from './pages/LeaveAnalysisPage'
import OdAnalysisPage from './pages/OdAnalysisPage'
import WeeklyAnalysisPage from './pages/WeeklyAnalysisPage'
import WeeklyDashboardPage from './pages/WeeklyDashboardPage'
import UserWisePage from './pages/UserWisePage'
import TeamsUploadPage from './pages/teams/TeamsUploadPage'
import TeamsBatchesPage from './pages/teams/TeamsBatchesPage'
import TeamsFileDetailPage from './pages/teams/TeamsFileDetailPage'
import TeamsDashboardPage from './pages/teams/TeamsDashboardPage'
import TeamsAppUploadPage from './pages/teams/TeamsAppUploadPage'
import TeamsAppBatchesPage from './pages/teams/TeamsAppBatchesPage'
import TeamsAppFileDetailPage from './pages/teams/TeamsAppFileDetailPage'
import TeamsAppActivityPage from './pages/teams/TeamsAppActivityPage'
import TeamsLicensePage from './pages/teams/TeamsLicensePage'
import EmployeeUploadPage from './pages/employee/EmployeeUploadPage'
import EmployeeBatchesPage from './pages/employee/EmployeeBatchesPage'
import EmployeeFileDetailPage from './pages/employee/EmployeeFileDetailPage'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import PermissionRoute from './components/PermissionRoute'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/modules',
    element: <ProtectedRoute><ModuleSelectionPage /></ProtectedRoute>
  },
  {
    path: '/admin/users',
    element: <AdminRoute><UserManagementPage /></AdminRoute>
  },
  {
    path: '/profile',
    element: <ProtectedRoute><UserProfilePage /></ProtectedRoute>
  },
  {
    path: '/attendance',
    element: <ProtectedRoute><App /></ProtectedRoute>,
    children: [
      { 
        index: true, 
        element: <PermissionRoute requiredFeature="dashboard"><DashboardPage /></PermissionRoute> 
      },
      { 
        path: 'dashboard', 
        element: <PermissionRoute requiredFeature="dashboard"><DashboardPage /></PermissionRoute> 
      },
      { 
        path: 'weekly-dashboard', 
        element: <PermissionRoute requiredFeature="dashboard"><WeeklyDashboardPage /></PermissionRoute> 
      },
      { 
        path: 'upload', 
        element: <PermissionRoute requiredFeature="upload"><UploadPage /></PermissionRoute> 
      },
      { 
        path: 'batches', 
        element: <PermissionRoute requiredFeature="batches"><BatchesPage /></PermissionRoute> 
      },
      { 
        path: 'files/:id', 
        element: <PermissionRoute requiredFeature="batches"><FileDetailPage /></PermissionRoute> 
      },
      { 
        path: 'on-time', 
        element: <PermissionRoute requiredFeature="on_time"><OnTimePage /></PermissionRoute> 
      },
      { 
        path: 'work-hour', 
        element: <PermissionRoute requiredFeature="work_hour"><WorkHourPage /></PermissionRoute> 
      },
      { 
        path: 'work-hour-lost', 
        element: <PermissionRoute requiredFeature="work_hour_lost"><WorkHourLostPage /></PermissionRoute> 
      },
      { 
        path: 'leave-analysis', 
        element: <PermissionRoute requiredFeature="leave_analysis"><LeaveAnalysisPage /></PermissionRoute> 
      },
      { 
        path: 'od-analysis', 
        element: <OdAnalysisPage />
      },
      { 
        path: 'weekly-analysis', 
        element: <WeeklyAnalysisPage />
      },
      { 
        path: 'user-wise', 
        element: <PermissionRoute requiredFeature="dashboard"><UserWisePage /></PermissionRoute> 
      },
    ],
  },
      {
        path: '/teams',
        element: <ProtectedRoute><TeamsApp /></ProtectedRoute>,
        children: [
          { 
            index: true, 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="user_activity"><TeamsDashboardPage /></PermissionRoute> 
          },
          { 
            path: 'dashboard', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="user_activity"><TeamsDashboardPage /></PermissionRoute> 
          },
          { 
            path: 'upload', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="upload_activity"><TeamsUploadPage /></PermissionRoute> 
          },
          { 
            path: 'batches', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="activity_batches"><TeamsBatchesPage /></PermissionRoute> 
          },
          { 
            path: 'files/:id', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="activity_batches"><TeamsFileDetailPage /></PermissionRoute> 
          },
          { 
            path: 'app/activity', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="app_activity"><TeamsAppActivityPage /></PermissionRoute> 
          },
          { 
            path: 'license', 
            element: <PermissionRoute requiredModule="teams_dashboard"><TeamsLicensePage /></PermissionRoute> 
          },
          { 
            path: 'app/upload', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="upload_app"><TeamsAppUploadPage /></PermissionRoute> 
          },
          { 
            path: 'app/batches', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="app_batches"><TeamsAppBatchesPage /></PermissionRoute> 
          },
          { 
            path: 'app/files/:id', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="app_batches"><TeamsAppFileDetailPage /></PermissionRoute> 
          },
          { 
            path: 'employee/upload', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="employee_list"><EmployeeUploadPage /></PermissionRoute> 
          },
          { 
            path: 'employee/batches', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="employee_list"><EmployeeBatchesPage /></PermissionRoute> 
          },
          { 
            path: 'employee/files/:id', 
            element: <PermissionRoute requiredModule="teams_dashboard" requiredFeature="employee_list"><EmployeeFileDetailPage /></PermissionRoute> 
          },
        ],
      },
      {
        path: '/',
        element: <ProtectedRoute><ModuleSelectionPage /></ProtectedRoute>
      }
    ])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)


