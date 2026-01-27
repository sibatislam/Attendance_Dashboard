import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTeamsUserActivity } from '../../../lib/api'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList } from 'recharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import TeamsLicenseCards from '../../../components/TeamsLicenseCards'

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
  
  // Handle abbreviated month names like "Aug", 'Oct', etc.
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

export default function UserWiseTab({ files, selectedFileId, setSelectedFileId }) {
  const [compareMode, setCompareMode] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const chartRef = useRef(null)
  const statsRef = useRef(null)

  const { data: userData = [], isLoading: isLoadingData } = useQuery({
    queryKey: ['teams_user_activity', selectedFileId],
    queryFn: () => getTeamsUserActivity(selectedFileId),
    enabled: files.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: compareData = [], isLoading: isLoadingCompare } = useQuery({
    queryKey: ['teams_user_activity_compare', compareFileId],
    queryFn: () => getTeamsUserActivity(compareFileId),
    enabled: compareMode && compareFileId !== null,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  // Get unique users for dropdown
  const uniqueUsers = useMemo(() => {
    const users = new Set()
    userData.forEach(u => {
      if (u.user) users.add(u.user)
    })
    if (compareMode && compareData.length > 0) {
      compareData.forEach(u => {
        if (u.user) users.add(u.user)
      })
    }
    return Array.from(users).sort()
  }, [userData, compareData, compareMode])

  // Aggregate total activities (when no user selected)
  const totalActivities = useMemo(() => {
    if (selectedUser || userData.length === 0) return []
    
    const total = {
      user: 'Total Activities',
      'Team Chat': 0,
      'Private Chat': 0,
      'Calls': 0,
      'Meetings Org': 0,
      'Meetings Att': 0,
      'One-time Org': 0,
      'One-time Att': 0,
      'Recurring Org': 0,
      'Recurring Att': 0,
      'Post Messages': 0,
    }

    userData.forEach(u => {
      total['Team Chat'] += u['Team Chat'] || 0
      total['Private Chat'] += u['Private Chat'] || 0
      total['Calls'] += u['Calls'] || 0
      total['Meetings Org'] += u['Meetings Org'] || 0
      total['Meetings Att'] += u['Meetings Att'] || 0
      total['One-time Org'] += u['One-time Org'] || 0
      total['One-time Att'] += u['One-time Att'] || 0
      total['Recurring Org'] += u['Recurring Org'] || 0
      total['Recurring Att'] += u['Recurring Att'] || 0
      total['Post Messages'] += u['Post Messages'] || 0
    })

    return [total]
  }, [userData, selectedUser])

  const totalCompareActivities = useMemo(() => {
    if (selectedUser || compareData.length === 0) return []
    
    const total = {
      user: 'Total Activities',
      'Team Chat (Compare)': 0,
      'Private Chat (Compare)': 0,
      'Calls (Compare)': 0,
      'Meetings Org (Compare)': 0,
      'Meetings Att (Compare)': 0,
      'One-time Org (Compare)': 0,
      'One-time Att (Compare)': 0,
      'Recurring Org (Compare)': 0,
      'Recurring Att (Compare)': 0,
      'Post Messages (Compare)': 0,
    }

    compareData.forEach(u => {
      total['Team Chat (Compare)'] += u['Team Chat'] || 0
      total['Private Chat (Compare)'] += u['Private Chat'] || 0
      total['Calls (Compare)'] += u['Calls'] || 0
      total['Meetings Org (Compare)'] += u['Meetings Org'] || 0
      total['Meetings Att (Compare)'] += u['Meetings Att'] || 0
      total['One-time Org (Compare)'] += u['One-time Org'] || 0
      total['One-time Att (Compare)'] += u['One-time Att'] || 0
      total['Recurring Org (Compare)'] += u['Recurring Org'] || 0
      total['Recurring Att (Compare)'] += u['Recurring Att'] || 0
      total['Post Messages (Compare)'] += u['Post Messages'] || 0
    })

    return [total]
  }, [compareData, selectedUser])

  // Filter data by selected user
  const filteredData = useMemo(() => {
    if (!selectedUser) return totalActivities
    return userData.filter(u => u.user === selectedUser)
  }, [userData, selectedUser, totalActivities])

  const filteredCompareData = useMemo(() => {
    if (!selectedUser) return totalCompareActivities
    return compareData.filter(u => u.user === selectedUser)
  }, [compareData, selectedUser, totalCompareActivities])

  // Merge data for comparison
  const mergedData = useMemo(() => {
    if (!compareMode || !compareFileId) return filteredData

    if (!selectedUser) {
      // Merge totals
      const merged = [{
        user: 'Total Activities',
        ...totalActivities[0],
        ...totalCompareActivities[0]
      }]
      return merged
    }

    // Create a map of user -> data for both files
    const file1Map = {}
    const file2Map = {}

    filteredData.forEach(u => {
      file1Map[u.user] = u
    })

    filteredCompareData.forEach(u => {
      file2Map[u.user] = u
    })

    // Get all users from both files
    const allUsers = new Set([...Object.keys(file1Map), ...Object.keys(file2Map)])

    // Create merged records
    const merged = []
    allUsers.forEach(user => {
      const file1Data = file1Map[user]
      const file2Data = file2Map[user]

      // Create a record with both files' data
      merged.push({
        user,
        // File 1 data (original columns)
        'Team Chat': file1Data ? file1Data['Team Chat'] : 0,
        'Private Chat': file1Data ? file1Data['Private Chat'] : 0,
        'Calls': file1Data ? file1Data['Calls'] : 0,
        'Meetings Org': file1Data ? file1Data['Meetings Org'] : 0,
        'Meetings Att': file1Data ? file1Data['Meetings Att'] : 0,
        'One-time Org': file1Data ? file1Data['One-time Org'] : 0,
        'One-time Att': file1Data ? file1Data['One-time Att'] : 0,
        'Recurring Org': file1Data ? file1Data['Recurring Org'] : 0,
        'Recurring Att': file1Data ? file1Data['Recurring Att'] : 0,
        'Post Messages': file1Data ? file1Data['Post Messages'] : 0,
        // File 2 data (with different names for comparison)
        'Team Chat (Compare)': file2Data ? file2Data['Team Chat'] : 0,
        'Private Chat (Compare)': file2Data ? file2Data['Private Chat'] : 0,
        'Calls (Compare)': file2Data ? file2Data['Calls'] : 0,
        'Meetings Org (Compare)': file2Data ? file2Data['Meetings Org'] : 0,
        'Meetings Att (Compare)': file2Data ? file2Data['Meetings Att'] : 0,
        'One-time Org (Compare)': file2Data ? file2Data['One-time Org'] : 0,
        'One-time Att (Compare)': file2Data ? file2Data['One-time Att'] : 0,
        'Recurring Org (Compare)': file2Data ? file2Data['Recurring Org'] : 0,
        'Recurring Att (Compare)': file2Data ? file2Data['Recurring Att'] : 0,
        'Post Messages (Compare)': file2Data ? file2Data['Post Messages'] : 0,
      })
    })

    return merged.sort((a, b) => a.user.localeCompare(b.user))
  }, [filteredData, filteredCompareData, compareMode, compareFileId, selectedUser, totalActivities, totalCompareActivities])

  const chartData = compareMode ? mergedData : filteredData

  // Transform data for activity-based chart (activities on X-axis)
  const activityChartData = useMemo(() => {
    if (chartData.length === 0) return []

    const activities = [
      { key: 'Team Chat', label: 'Team Chat Message Count' },
      { key: 'Private Chat', label: 'Private Chat Message Count' },
      { key: 'Calls', label: 'Call Count' },
      { key: 'Meetings Org', label: 'Meetings Organized Count' },
      { key: 'Meetings Att', label: 'Meetings Attended Count' },
      { key: 'One-time Org', label: 'One-time Meetings Organized' },
      { key: 'One-time Att', label: 'One-time Meetings Attended' },
      { key: 'Recurring Org', label: 'Recurring Meetings Organized' },
      { key: 'Recurring Att', label: 'Recurring Meetings Attended' },
      { key: 'Post Messages', label: 'Post Messages' },
    ]

    // Get file info for legend labels
    const file1 = files.find(f => f.id === selectedFileId)
    const file2 = files.find(f => f.id === compareFileId)
    const file1Label = file1 ? formatMonthRange(file1.from_month, file1.to_month) || 'File 1' : 'File 1'
    const file2Label = file2 ? formatMonthRange(file2.from_month, file2.to_month) || 'File 2' : 'File 2'

    return activities.map(activity => {
      const result = {
        activity: activity.label,
      }

      // Sum values from all users for this activity
      chartData.forEach(user => {
        if (!result[file1Label]) result[file1Label] = 0
        result[file1Label] += user[activity.key] || 0

        if (compareMode && compareFileId) {
          if (!result[file2Label]) result[file2Label] = 0
          result[file2Label] += user[`${activity.key} (Compare)`] || 0
        }
      })

      return result
    })
  }, [chartData, files, selectedFileId, compareFileId, compareMode])

  // Download chart as PNG
  const downloadChartAsPNG = async () => {
    try {
      const chartElement = chartRef.current
      if (!chartElement) {
        alert('Chart not found')
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
      const fileName = `User_Activity_Chart_${selectedUser || 'All'}_${new Date().toISOString().split('T')[0]}.png`
      link.download = fileName.replace(/[^a-z0-9._-]/gi, '_')
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

  // Export to PDF (includes summary stats + chart)
  const exportToPDF = async () => {
    try {
      setIsExporting(true)
      
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      // Wait for elements to render
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const elements = []
      
      // Add summary stats if available
      if (statsRef.current && filteredData.length > 0) {
        elements.push({
          element: statsRef.current,
          title: 'Summary Statistics'
        })
      }
      
      // Add chart
      if (chartRef.current && activityChartData.length > 0) {
        elements.push({
          element: chartRef.current,
          title: selectedUser ? `Activity for ${selectedUser}` : 'All Activities'
        })
      }
      
      if (elements.length === 0) {
        throw new Error('No content available to export')
      }
      
      // Export each element
      for (let i = 0; i < elements.length; i++) {
        const { element, title } = elements[i]
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'instant', block: 'center' })
        await new Promise(resolve => setTimeout(resolve, 300))
        
        const canvas = await html2canvas(element, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 10000,
        })
        
        const imgData = canvas.toDataURL('image/jpeg', 0.9)
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        
        // Calculate PDF dimensions
        const pdfImgWidth = pdfWidth - 20
        const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth
        
        if (i > 0) pdf.addPage()
        
        // Add title
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(40, 40, 40)
        pdf.text(title, pdfWidth / 2, 15, { align: 'center' })
        
        // Add image
        let yPos = 25
        if (pdfImgHeight > pdfHeight - 30) {
          const scaledHeight = pdfHeight - 30
          const scaledWidth = (imgWidth * scaledHeight) / imgHeight
          pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, yPos, scaledWidth, scaledHeight)
        } else {
          pdf.addImage(imgData, 'JPEG', 10, yPos, pdfImgWidth, pdfImgHeight)
        }
      }
      
      const fileName = `User_Activity_Report_${selectedUser || 'All'}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName.replace(/[^a-z0-9._-]/gi, '_'))
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoadingData || isLoadingCompare) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading user activity data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Exporting...</h3>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div className="bg-blue-600 h-4 rounded-full transition-all duration-300 w-full animate-pulse" />
            </div>
            <p className="text-sm text-gray-600 text-center">Please wait...</p>
          </div>
        </div>
      )}

      {/* License cards */}
      <TeamsLicenseCards />

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <label htmlFor="fileSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="lnr lnr-file-empty text-blue-600"></span>
              {compareMode ? 'Teams File 1' : 'Teams File'}
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
                Teams File 2
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

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <label htmlFor="userSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="lnr lnr-user text-blue-600"></span>
              Filter by User Email
            </label>
            <select
              id="userSelect"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm hover:border-blue-400"
            >
              <option value="">All Users ({uniqueUsers.length})</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {filteredData.length > 0 && (
        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Team Chats</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Team Chat'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Private Chats</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Private Chat'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600">Calls</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Calls'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600">Meetings Organized</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Meetings Org'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-pink-500">
            <p className="text-sm text-gray-600">Meetings Attended</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Meetings Att'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-teal-500">
            <p className="text-sm text-gray-600">One-time Meetings Organized</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['One-time Org'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-cyan-500">
            <p className="text-sm text-gray-600">One-time Meetings Attended</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['One-time Att'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-indigo-500">
            <p className="text-sm text-gray-600">Recurring Meetings Organized</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Recurring Org'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-violet-500">
            <p className="text-sm text-gray-600">Recurring Meetings Attended</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Recurring Att'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Post Messages</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Post Messages'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
        </div>
      )}

      {/* Export Actions - Show when chart is available */}
      {activityChartData.length > 0 && (
        <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
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
                title="Download chart as PNG"
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
                title="Export to PDF (includes stats and chart)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredData.length === 0 && (
        <div className="card p-6 text-center text-gray-600">
          <p>No data available. {userData.length > 0 ? 'Try adjusting your filters.' : 'Please upload Teams activity files first.'}</p>
        </div>
      )}

      {/* Chart */}
      {activityChartData.length > 0 && (
        <div ref={chartRef} id="user-activity-chart" className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {selectedUser ? `Activity for ${selectedUser}` : 'All Activities'}
          </h3>
          <div style={{ width: '100%', height: 500 }}>
            <ResponsiveContainer>
              <BarChart data={activityChartData} margin={{ top: 30, right: 30, left: 60, bottom: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis 
                  dataKey="activity" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  interval={0}
                />
                <YAxis 
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                  tick={{ fontSize: 11, fill: '#6b7280' }} 
                  axisLine={{ stroke: '#d1d5db' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
                  }} 
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="square"
                />
                
                {/* Determine the file labels dynamically */}
                {(() => {
                  const allKeys = Object.keys(activityChartData[0] || {}).filter(k => k !== 'activity')
                  const file1Key = allKeys[0]
                  const file2Key = allKeys[1]
                  
                  return (
                    <>
                      {file1Key && (
                        <Bar 
                          key={file1Key}
                          dataKey={file1Key} 
                          name={file1Key}
                          fill="#f97316" 
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList dataKey={file1Key} position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                        </Bar>
                      )}
                      
                      {compareMode && compareFileId && file2Key && (
                        <Bar 
                          key={file2Key}
                          dataKey={file2Key} 
                          name={file2Key}
                          fill="#3b82f6" 
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList dataKey={file2Key} position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                        </Bar>
                      )}
                    </>
                  )
                })()}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
