import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTeamsAppFiles, getTeamsAppActivity } from '../../lib/api'
import DataTable from '../../components/DataTable'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList } from 'recharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import TeamsLicenseCards from '../../components/TeamsLicenseCards'

// Helper function to format month string to "MonthName Year" format
const formatMonthWithYear = (monthStr) => {
  if (!monthStr) return ''
  
  // Handle formats like "2024-08", "2024-8", "08-2024", etc.
  const dateMatch = monthStr.match(/(\d{4})[-/](\d{1,2})/)
  if (dateMatch) {
    const year = dateMatch[1]
    const month = parseInt(dateMatch[2], 10)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December']
    if (month >= 1 && month <= 12) {
      return `${monthNames[month - 1]} ${year}`
    }
  }
  
  // Handle abbreviated month names like "Aug", "Oct", etc.
  const monthAbbr = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  }
  
  // Try to match abbreviated month
  for (const [abbr, full] of Object.entries(monthAbbr)) {
    if (monthStr.toLowerCase().includes(abbr.toLowerCase())) {
      // Try to extract year
      const yearMatch = monthStr.match(/(\d{4})/)
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear()
      return `${full} ${year}`
    }
  }
  
  // If it's already a full month name, try to add year
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December']
  for (const monthName of monthNames) {
    if (monthStr.toLowerCase().includes(monthName.toLowerCase())) {
      const yearMatch = monthStr.match(/(\d{4})/)
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear()
      return `${monthName} ${year}`
    }
  }
  
  // Fallback: return as-is if we can't parse it
  return monthStr
}

// Helper function to format month range
const formatMonthRange = (fromMonth, toMonth) => {
  if (!fromMonth && !toMonth) return ''
  const from = formatMonthWithYear(fromMonth)
  const to = formatMonthWithYear(toMonth)
  
  if (from && to) {
    return `${from} to ${to}`
  } else if (from) {
    return from
  } else if (to) {
    return to
  }
  return ''
}

export default function TeamsAppActivityPage() {
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)
  const [activeTab, setActiveTab] = useState('table')
  const [isExporting, setIsExporting] = useState(false)
  const chartsRef = useRef(null)

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
      file1Label: selectedFileId === null ? 'All Files' : (file1 ? formatMonthRange(file1.from_month, file1.to_month) || 'File 1' : 'File 1'),
      file2Label: compareFileId === null ? 'All Files' : (file2 ? formatMonthRange(file2.from_month, file2.to_month) || 'File 2' : 'File 2')
    }
  }, [files, selectedFileId, compareFileId])

  // Download chart as PNG
  const downloadChartAsPNG = async () => {
    try {
      const chartElement = chartsRef.current
      if (!chartElement) {
        alert('Charts not found')
        return
      }

      setIsExporting(true)
      
      // Wait a bit for chart to render
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 10000,
      })
      
      const imgData = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      const file1Label = fileLabels.file1Label.replace(/[^a-z0-9._-]/gi, '_')
      const fileName = `Teams_App_Activity_${compareMode ? `${file1Label}_vs_${fileLabels.file2Label.replace(/[^a-z0-9._-]/gi, '_')}` : file1Label}_${new Date().toISOString().split('T')[0]}.png`
      link.download = fileName
      link.href = imgData
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading chart:', error)
      alert('Error downloading chart: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Export to PDF (includes charts)
  const exportToPDF = async () => {
    try {
      setIsExporting(true)
      
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      
      // Wait for elements to render
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (!chartsRef.current || tableData.length === 0) {
        throw new Error('No charts available to export')
      }
      
      // Scroll element into view
      chartsRef.current.scrollIntoView({ behavior: 'instant', block: 'center' })
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const canvas = await html2canvas(chartsRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 10000,
      })
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9)
      const imgWidth = pdfWidth - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      // Add title
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Teams App Activity Report', pdfWidth / 2, 15, { align: 'center' })
      
      // Add file info
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      const fileInfo = compareMode 
        ? `File 1: ${fileLabels.file1Label} | File 2: ${fileLabels.file2Label}`
        : `File: ${fileLabels.file1Label}`
      pdf.text(fileInfo, pdfWidth / 2, 22, { align: 'center' })
      
      // Add chart image
      pdf.addImage(imgData, 'JPEG', 10, 28, imgWidth, imgHeight)
      
      const dateStr = new Date().toISOString().split('T')[0]
      pdf.save(`Teams_App_Activity_${dateStr}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

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

      {/* License cards */}
      <TeamsLicenseCards />

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
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-blue-200">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => {
                setCompareMode(e.target.checked)
                if (!e.target.checked) setCompareFileId(null)
              }}
              className="h-5 w-5 text-blue-600 rounded border-2 border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <span className="ml-2 text-base font-semibold text-gray-800">Enable Comparison Mode</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <label htmlFor="fileSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="lnr lnr-file-empty text-blue-600"></span>
              {compareMode ? 'App Usage File 1' : 'App Usage File'}
            </label>
            <select
              id="fileSelect"
              value={selectedFileId || ''}
              onChange={(e) => setSelectedFileId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm hover:border-blue-400"
            >
              <option value="">All Files</option>
              {files.map(f => (
                <option key={f.id} value={f.id}>
                  {formatMonthRange(f.from_month, f.to_month) || f.filename}
                </option>
              ))}
            </select>
          </div>

          {compareMode && (
            <div className="bg-white rounded-lg p-3 border-2 border-blue-400 shadow-sm">
              <label htmlFor="compareFileSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="lnr lnr-file-empty text-blue-600"></span>
                App Usage File 2
              </label>
              <select
                id="compareFileSelect"
                value={compareFileId || ''}
                onChange={(e) => setCompareFileId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2.5 border-2 border-blue-400 rounded-md bg-white text-gray-900 font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-300 transition-all shadow-sm hover:border-blue-500"
              >
                <option value="">Select file to compare</option>
                {files.filter(f => f.id !== selectedFileId).map(f => (
                  <option key={f.id} value={f.id}>
                    {formatMonthRange(f.from_month, f.to_month) || f.filename}
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
          
          {/* Export Options */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Export Options</h4>
                <p className="text-xs text-gray-600 mt-1">Download charts and reports</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={downloadChartAsPNG}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                  title="Download charts as PNG"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PNG
                </button>
                <button
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                  title="Export charts to PDF"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>
          </div>
          
          {/* Charts Side by Side */}
          <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

