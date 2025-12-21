import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTeamsAppFiles, getTeamsAppActivity } from '../../lib/api'
import DataTable from '../../components/DataTable'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList } from 'recharts'

export default function TeamsAppActivityPage() {
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)
  const [activeTab, setActiveTab] = useState('table')

  const { data: files = [], isLoading: isLoadingFiles } = useQuery({
    queryKey: ['teams_app_files'],
    queryFn: listTeamsAppFiles,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onSuccess: (data) => {
      if (data.length > 0 && selectedFileId === null) {
        setSelectedFileId(data[0].id)
      }
    }
  })

  const { data: appData = [], isLoading: isLoadingData } = useQuery({
    queryKey: ['teams_app_activity', selectedFileId],
    queryFn: () => getTeamsAppActivity(selectedFileId),
    enabled: files.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: compareData = [], isLoading: isLoadingCompare } = useQuery({
    queryKey: ['teams_app_activity_compare', compareFileId],
    queryFn: () => getTeamsAppActivity(compareFileId),
    enabled: compareMode && compareFileId !== null,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const isLoading = isLoadingFiles || isLoadingData || (compareMode && isLoadingCompare)

  // Filter to show only Planner and Loop apps
  const filteredAppData = useMemo(() => {
    return appData.filter(app => 
      app.app_name === 'Planner' || app.app_name === 'Loop'
    )
  }, [appData])

  const filteredCompareData = useMemo(() => {
    return compareData.filter(app => 
      app.app_name === 'Planner' || app.app_name === 'Loop'
    )
  }, [compareData])

  // Merge data for comparison
  const mergedData = useMemo(() => {
    if (!compareMode || !compareFileId) return filteredAppData

    const file1Map = {}
    const file2Map = {}

    filteredAppData.forEach(app => {
      file1Map[app.app_name] = app
    })

    filteredCompareData.forEach(app => {
      file2Map[app.app_name] = app
    })

    const allApps = new Set([...Object.keys(file1Map), ...Object.keys(file2Map)])

    const merged = []
    allApps.forEach(appName => {
      const file1Data = file1Map[appName]
      const file2Data = file2Map[appName]

      merged.push({
        app_name: appName,
        team_using_app: file1Data ? file1Data.team_using_app : 0,
        users_using_app: file1Data ? file1Data.users_using_app : 0,
        'team_using_app_compare': file2Data ? file2Data.team_using_app : 0,
        'users_using_app_compare': file2Data ? file2Data.users_using_app : 0,
      })
    })

    return merged.sort((a, b) => b.users_using_app - a.users_using_app)
  }, [filteredAppData, filteredCompareData, compareMode, compareFileId])

  const tableData = compareMode ? mergedData : filteredAppData

  const cols = useMemo(() => {
    if (compareMode) {
      return [
        { key: 'app_name', label: 'Teams App' },
        { key: 'team_using_app', label: 'Team Using App (File 1)' },
        { key: 'users_using_app', label: 'Users Using App (File 1)' },
        { key: 'team_using_app_compare', label: 'Team Using App (File 2)' },
        { key: 'users_using_app_compare', label: 'Users Using App (File 2)' },
      ]
    } else {
      return [
        { key: 'app_name', label: 'Teams App' },
        { key: 'team_using_app', label: 'Team Using App' },
        { key: 'users_using_app', label: 'Users Using App' },
      ]
    }
  }, [compareMode])

  // Get file labels for charts
  const fileLabels = useMemo(() => {
    const file1 = files.find(f => f.id === selectedFileId)
    const file2 = files.find(f => f.id === compareFileId)
    return {
      file1Label: selectedFileId === null ? 'All Files' : (file1 ? `${file1.from_month || ''} to ${file1.to_month || ''}` : 'File 1'),
      file2Label: compareFileId === null ? 'All Files' : (file2 ? `${file2.from_month || ''} to ${file2.to_month || ''}` : 'File 2')
    }
  }, [files, selectedFileId, compareFileId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading app activity data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Teams App Activity</h2>
        <p className="text-gray-600 mt-1">View Teams application usage metrics</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('table')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'table'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'chart'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Chart View
            </button>
          </nav>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => {
                setCompareMode(e.target.checked)
                if (!e.target.checked) setCompareFileId(null)
              }}
              className="form-checkbox h-4 w-4 text-blue-600 rounded"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">Enable Comparison Mode</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fileSelect" className="block text-sm font-medium text-gray-700 mb-1">
              {compareMode ? 'App Usage File 1' : 'App Usage File'}
            </label>
            <select
              id="fileSelect"
              value={selectedFileId || ''}
              onChange={(e) => setSelectedFileId(e.target.value ? parseInt(e.target.value) : null)}
              className="form-select w-full"
            >
              <option value="">All Files</option>
              {files.map(f => (
                <option key={f.id} value={f.id}>
                  {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : 'No date range'})
                </option>
              ))}
            </select>
          </div>

          {compareMode && (
            <div>
              <label htmlFor="compareFileSelect" className="block text-sm font-medium text-gray-700 mb-1">App Usage File 2</label>
              <select
                id="compareFileSelect"
                value={compareFileId || ''}
                onChange={(e) => setCompareFileId(e.target.value ? parseInt(e.target.value) : null)}
                className="form-select w-full border-2 border-blue-300"
              >
                <option value="">Select file to compare</option>
                {files.filter(f => f.id !== selectedFileId).map(f => (
                  <option key={f.id} value={f.id}>
                    {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : 'No date range'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table View */}
      {activeTab === 'table' && tableData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Teams App Activity Data</h3>
          <DataTable headers={cols} rows={tableData} />
        </div>
      )}

      {/* Chart View */}
      {activeTab === 'chart' && tableData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Teams App Activity Charts</h3>
          
          {/* Charts Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Teams Using App Chart */}
            <div>
              <h4 className="text-md font-semibold text-gray-700 mb-3">Teams Using App</h4>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={tableData} margin={{ top: 30, right: 30, left: 60, bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="app_name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={150}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="team_using_app" name={compareMode ? fileLabels.file1Label : "Team Using App"} fill="#3b82f6" radius={[8, 8, 0, 0]}>
                      <LabelList dataKey="team_using_app" position="top" style={{ fill: '#374151', fontSize: 10, fontWeight: 600 }} />
                    </Bar>
                    {compareMode && compareFileId && (
                      <Bar dataKey="team_using_app_compare" name={fileLabels.file2Label} fill="#60a5fa" fillOpacity={0.7} radius={[8, 8, 0, 0]}>
                        <LabelList dataKey="team_using_app_compare" position="top" style={{ fill: '#374151', fontSize: 10, fontWeight: 600 }} />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Users Using App Chart */}
            <div>
              <h4 className="text-md font-semibold text-gray-700 mb-3">Users Using App</h4>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={tableData} margin={{ top: 30, right: 30, left: 60, bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis 
                      dataKey="app_name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={150}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="users_using_app" name={compareMode ? fileLabels.file1Label : "Users Using App"} fill="#10b981" radius={[8, 8, 0, 0]}>
                      <LabelList dataKey="users_using_app" position="top" style={{ fill: '#374151', fontSize: 10, fontWeight: 600 }} />
                    </Bar>
                    {compareMode && compareFileId && (
                      <Bar dataKey="users_using_app_compare" name={fileLabels.file2Label} fill="#6ee7b7" fillOpacity={0.7} radius={[8, 8, 0, 0]}>
                        <LabelList dataKey="users_using_app_compare" position="top" style={{ fill: '#374151', fontSize: 10, fontWeight: 600 }} />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {tableData.length === 0 && !isLoading && (
        <div className="card p-6 text-center text-gray-600">
          <p>No app activity data available. Please upload Teams app usage files first.</p>
        </div>
      )}
    </div>
  )
}

