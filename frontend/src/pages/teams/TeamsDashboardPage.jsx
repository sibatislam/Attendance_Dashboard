import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTeamsFiles, listEmployeeFiles } from '../../lib/api'
import UserWiseTab from './tabs/UserWiseTab'
import FunctionWiseTab from './tabs/FunctionWiseTab'
import CompanyWiseTab from './tabs/CompanyWiseTab'
import CXOComparisonTab from './tabs/CXOComparisonTab'

export default function TeamsDashboardPage() {
  const [activeTab, setActiveTab] = useState('user') // user, function, company, cxo
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [selectedEmployeeFileId, setSelectedEmployeeFileId] = useState(null)
  const chartRef = useRef(null)

  const { data: files = [], isLoading: isLoadingFiles } = useQuery({
    queryKey: ['teams_files'],
    queryFn: listTeamsFiles,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - prevents refetching
    cacheTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch if data exists
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: employeeFiles = [], isLoading: isLoadingEmployeeFiles } = useQuery({
    queryKey: ['employee_files'],
    queryFn: listEmployeeFiles,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - prevents refetching
    cacheTime: 1000 * 60 * 60 * 24, // Keep in cache for 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch if data exists
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  // Auto-select files only once when data is first loaded (use ref to prevent re-runs)
  const hasInitializedFiles = useRef(false)
  const hasInitializedEmployeeFiles = useRef(false)

  useEffect(() => {
    if (files.length > 0 && selectedFileId === null && !hasInitializedFiles.current) {
      setSelectedFileId(files[0].id)
      hasInitializedFiles.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]) // Only depend on length, not the array itself

  useEffect(() => {
    if (employeeFiles.length > 0 && selectedEmployeeFileId === null && !hasInitializedEmployeeFiles.current) {
      setSelectedEmployeeFileId(employeeFiles[0].id)
      hasInitializedEmployeeFiles.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFiles.length]) // Only depend on length, not the array itself

  const isLoading = isLoadingFiles || isLoadingEmployeeFiles


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Activity</h2>
          <p className="text-gray-600 mt-1">View MS Teams user activity metrics</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              type="button"
              onClick={() => setActiveTab('user')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'user'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User-wise
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setActiveTab('function')
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'function'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Function-wise
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setActiveTab('company')
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'company'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Company-wise
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setActiveTab('cxo')
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cxo'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              CXO Comparison
            </button>
          </nav>
        </div>
      </div>

      {/* Charts Section with ref for PDF export */}
      <div ref={chartRef}>
        {activeTab === 'user' && (
          <UserWiseTab 
            files={files}
            selectedFileId={selectedFileId}
            setSelectedFileId={setSelectedFileId}
          />
        )}

        {activeTab === 'function' && (
          <FunctionWiseTab 
            files={files}
            employeeFiles={employeeFiles}
            selectedFileId={selectedFileId}
            setSelectedFileId={setSelectedFileId}
            selectedEmployeeFileId={selectedEmployeeFileId}
            setSelectedEmployeeFileId={setSelectedEmployeeFileId}
          />
        )}

        {activeTab === 'company' && (
          <CompanyWiseTab 
            files={files}
            employeeFiles={employeeFiles}
            selectedFileId={selectedFileId}
            setSelectedFileId={setSelectedFileId}
            selectedEmployeeFileId={selectedEmployeeFileId}
            setSelectedEmployeeFileId={setSelectedEmployeeFileId}
          />
        )}

        {activeTab === 'cxo' && (
          <CXOComparisonTab 
            files={files}
            employeeFiles={employeeFiles}
            selectedFileId={selectedFileId}
            setSelectedFileId={setSelectedFileId}
          />
        )}
      </div>
    </div>
  )
}
