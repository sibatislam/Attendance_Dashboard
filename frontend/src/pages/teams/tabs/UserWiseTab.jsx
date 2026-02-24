import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTeamsUserActivity } from '../../../lib/api'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList } from 'recharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import TeamsLicenseCards from '../../../components/TeamsLicenseCards'
import MultiSelectSearchable from '../../../components/MultiSelectSearchable'

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

export default function UserWiseTab({ files, employeeFiles, selectedFileId, setSelectedFileId, selectedEmployeeFileId, setSelectedEmployeeFileId }) {
  const [compareMode, setCompareMode] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [selectedFunctions, setSelectedFunctions] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const [chartsToShow, setChartsToShow] = useState(5)
  const chartRef = useRef(null)

  const INITIAL_CHARTS = 5
  const LOAD_MORE_STEP = 5

  // When function filter changes, clear department and user filters so options stay in sync
  useEffect(() => {
    setSelectedDepartments([])
    setSelectedUsers([])
  }, [selectedFunctions])

  // When department filter changes, clear user filter so options stay in sync
  useEffect(() => {
    setSelectedUsers([])
  }, [selectedDepartments])

  const statsRef = useRef(null)

  const { data: userData = [], isLoading: isLoadingData } = useQuery({
    queryKey: ['teams_user_activity', selectedFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsUserActivity(selectedFileId, selectedEmployeeFileId),
    enabled: files.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: compareData = [], isLoading: isLoadingCompare } = useQuery({
    queryKey: ['teams_user_activity_compare', compareFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsUserActivity(compareFileId, selectedEmployeeFileId),
    enabled: compareMode && compareFileId !== null,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  // Base data for filter options: when function(s) selected, only show departments/users under those functions
  const dataForFilterOptions = useMemo(() => {
    if (selectedFunctions.length === 0) return userData
    const set = new Set(selectedFunctions)
    return userData.filter(u => set.has((u.function != null ? String(u.function).trim() : '') || 'Unknown'))
  }, [userData, selectedFunctions])

  const uniqueFunctions = useMemo(() => {
    const set = new Set()
    userData.forEach(u => {
      const f = (u.function != null ? String(u.function).trim() : '') || 'Unknown'
      set.add(f)
    })
    if (compareMode && compareData.length > 0) {
      compareData.forEach(u => {
        const f = (u.function != null ? String(u.function).trim() : '') || 'Unknown'
        set.add(f)
      })
    }
    return Array.from(set).sort()
  }, [userData, compareData, compareMode])

  const uniqueDepartments = useMemo(() => {
    const set = new Set()
    dataForFilterOptions.forEach(u => {
      const d = (u.department != null ? String(u.department).trim() : '') || 'Unknown'
      set.add(d)
    })
    if (compareMode && compareData.length > 0) {
      const byFunction = selectedFunctions.length > 0
        ? compareData.filter(u => selectedFunctions.includes((u.function != null ? String(u.function).trim() : '') || 'Unknown'))
        : compareData
      byFunction.forEach(u => {
        const d = (u.department != null ? String(u.department).trim() : '') || 'Unknown'
        set.add(d)
      })
    }
    return Array.from(set).sort()
  }, [dataForFilterOptions, compareData, compareMode, selectedFunctions])

  // User options: restricted by selected function(s) and by selected department(s)
  const uniqueUsers = useMemo(() => {
    let list = dataForFilterOptions
    if (selectedDepartments.length > 0) {
      const deptSet = new Set(selectedDepartments)
      list = list.filter(u => deptSet.has((u.department != null ? String(u.department).trim() : '') || 'Unknown'))
    }
    const users = new Set()
    list.forEach(u => { if (u.user) users.add(u.user) })
    if (compareMode && compareData.length > 0) {
      let compareList = compareData
      if (selectedFunctions.length > 0) {
        const fnSet = new Set(selectedFunctions)
        compareList = compareList.filter(u => fnSet.has((u.function != null ? String(u.function).trim() : '') || 'Unknown'))
      }
      if (selectedDepartments.length > 0) {
        const deptSet = new Set(selectedDepartments)
        compareList = compareList.filter(u => deptSet.has((u.department != null ? String(u.department).trim() : '') || 'Unknown'))
      }
      compareList.forEach(u => { if (u.user) users.add(u.user) })
    }
    return Array.from(users).sort()
  }, [dataForFilterOptions, compareData, compareMode, selectedFunctions, selectedDepartments])

  // Apply Function, Department, User filters to get base filtered data
  const filteredBase = useMemo(() => {
    let list = userData
    if (selectedFunctions.length > 0) {
      const set = new Set(selectedFunctions)
      list = list.filter(u => set.has((u.function != null ? String(u.function).trim() : '') || 'Unknown'))
    }
    if (selectedDepartments.length > 0) {
      const set = new Set(selectedDepartments)
      list = list.filter(u => set.has((u.department != null ? String(u.department).trim() : '') || 'Unknown'))
    }
    if (selectedUsers.length > 0) {
      const set = new Set(selectedUsers)
      list = list.filter(u => set.has(u.user))
    }
    return list
  }, [userData, selectedFunctions, selectedDepartments, selectedUsers])

  const filteredCompareBase = useMemo(() => {
    if (!compareMode || !compareData.length) return []
    let list = compareData
    if (selectedFunctions.length > 0) {
      const set = new Set(selectedFunctions)
      list = list.filter(u => set.has((u.function != null ? String(u.function).trim() : '') || 'Unknown'))
    }
    if (selectedDepartments.length > 0) {
      const set = new Set(selectedDepartments)
      list = list.filter(u => set.has((u.department != null ? String(u.department).trim() : '') || 'Unknown'))
    }
    if (selectedUsers.length > 0) {
      const set = new Set(selectedUsers)
      list = list.filter(u => set.has(u.user))
    }
    return list
  }, [compareData, compareMode, selectedFunctions, selectedDepartments, selectedUsers])

  // Aggregate total activities (when no specific users selected)
  const totalActivities = useMemo(() => {
    if (selectedUsers.length > 0 || filteredBase.length === 0) return []
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
    filteredBase.forEach(u => {
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
  }, [filteredBase, selectedUsers.length])

  const totalCompareActivities = useMemo(() => {
    if (selectedUsers.length > 0 || filteredCompareBase.length === 0) return []
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
    filteredCompareBase.forEach(u => {
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
  }, [filteredCompareBase, selectedUsers.length])

  const filteredData = useMemo(() => {
    if (selectedUsers.length === 0) return totalActivities
    return filteredBase
  }, [filteredBase, totalActivities, selectedUsers.length])

  const filteredCompareData = useMemo(() => {
    if (selectedUsers.length === 0) return totalCompareActivities
    return filteredCompareBase
  }, [filteredCompareBase, totalCompareActivities, selectedUsers.length])

  // Merge data for comparison (always per-user, never single "Total" row)
  const mergedData = useMemo(() => {
    if (!compareMode || !compareFileId) return []
    const file1Map = {}
    const file2Map = {}
    filteredBase.forEach(u => { file1Map[u.user] = u })
    filteredCompareBase.forEach(u => { file2Map[u.user] = u })
    const allUsers = new Set([...Object.keys(file1Map), ...Object.keys(file2Map)])
    const merged = []
    allUsers.forEach(user => {
      const file1Data = file1Map[user]
      const file2Data = file2Map[user]
      merged.push({
        user,
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
  }, [filteredBase, filteredCompareBase, compareMode, compareFileId])

  // Chart data: always per-user (never cumulative total)
  const chartDataForChart = useMemo(() => {
    if (compareMode && mergedData.length > 0) return mergedData
    return filteredBase
  }, [compareMode, mergedData, filteredBase])

  // Activity keys and full labels for chart (match "Team Chat Message Count" style)
  const ACTIVITY_CHART_LABELS = [
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

  // Build one chart data array per user: [{ activity: label, count: n, countCompare?: n }, ...]
  const chartDataByUser = useMemo(() => {
    const file1 = files.find(f => f.id === selectedFileId)
    const file2 = files.find(f => f.id === compareFileId)
    const periodLabel = file1 ? formatMonthRange(file1.from_month, file1.to_month) || 'File 1' : 'File 1'
    const periodLabel2 = file2 ? formatMonthRange(file2.from_month, file2.to_month) || 'File 2' : 'File 2'
    return chartDataForChart.map((row) => {
      const dataPoints = ACTIVITY_CHART_LABELS.map(({ key, label }) => {
        const point = { activity: label, count: row[key] || 0 }
        if (compareMode && compareFileId && row[`${key} (Compare)`] != null) {
          point.countCompare = row[`${key} (Compare)`] || 0
        }
        return point
      })
      return { user: row.user, periodLabel, periodLabel2, dataPoints }
    })
  }, [chartDataForChart, files, selectedFileId, compareFileId, compareMode])

  // Reset to 5 charts when the data set changes (new file or filters)
  const chartDataByUserLengthRef = useRef(0)
  useEffect(() => {
    if (chartDataByUser.length !== chartDataByUserLengthRef.current) {
      chartDataByUserLengthRef.current = chartDataByUser.length
      setChartsToShow(INITIAL_CHARTS)
    }
  }, [chartDataByUser.length])

  // Build distinct user list with email, function, department (from current file data)
  const userListWithEmail = useMemo(() => {
    const seen = new Set()
    const list = []
    userData.forEach((row) => {
      const email = (row.user || '').trim()
      if (!email || seen.has(email)) return
      seen.add(email)
      list.push({
        email,
        function: (row.function != null ? String(row.function).trim() : '') || 'Unknown',
        department: (row.department != null ? String(row.department).trim() : '') || 'Unknown',
      })
    })
    list.sort((a, b) => (a.email || '').localeCompare(b.email || ''))
    return list
  }, [userData])

  // Download user list as CSV (S.No, Email, Function, Department)
  const downloadUserListCSV = () => {
    if (userListWithEmail.length === 0) {
      alert('No users to export. Select a Teams file and ensure data is loaded.')
      return
    }
    const headers = ['S.No', 'Email', 'Function', 'Department']
    const rows = userListWithEmail.map((u, i) => [i + 1, u.email, u.function, u.department])
    const escape = (v) => {
      const s = String(v ?? '')
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Teams_Users_${userListWithEmail.length}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

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
      const fileName = `User_Activity_Chart_${selectedUsers.length ? selectedUsers.join('_').slice(0, 30) : 'All'}_${new Date().toISOString().split('T')[0]}.png`
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
      if (chartRef.current && chartDataForChart.length > 0) {
        elements.push({
          element: chartRef.current,
          title: selectedUsers.length ? `Activity for ${selectedUsers.length} user(s)` : 'All Activities'
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
      
      const fileName = `User_Activity_Report_${selectedUsers.length ? selectedUsers.length + 'users' : 'All'}_${new Date().toISOString().split('T')[0]}.pdf`
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              {files.length === 0 && <option value="">No files uploaded</option>}
              {files.map(f => (
                <option key={f.id} value={f.id}>
                  {formatMonthRange(f.from_month, f.to_month) || f.filename}
                </option>
              ))}
            </select>
          </div>

          {employeeFiles.length > 0 && (
            <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
              <label htmlFor="employeeFileSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="lnr lnr-users text-blue-600"></span>
                Employee File (for Function / Department)
              </label>
              <select
                id="employeeFileSelect"
                value={selectedEmployeeFileId || ''}
                onChange={(e) => setSelectedEmployeeFileId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm hover:border-blue-400"
              >
                <option value="">None</option>
                {employeeFiles.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.filename || `File ${f.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

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
            <MultiSelectSearchable
              id="filter-function"
              label="Function"
              value={selectedFunctions}
              onChange={setSelectedFunctions}
              options={uniqueFunctions.map(f => ({ value: f, label: f }))}
              placeholder={`All Functions (${uniqueFunctions.length})`}
              icon="lnr-briefcase"
            />
          </div>
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <MultiSelectSearchable
              id="filter-department"
              label="Department"
              value={selectedDepartments}
              onChange={setSelectedDepartments}
              options={uniqueDepartments.map(d => ({ value: d, label: d }))}
              placeholder={`All Departments (${uniqueDepartments.length})`}
              icon="lnr-apartment"
            />
          </div>
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <MultiSelectSearchable
              id="filter-user"
              label="User"
              value={selectedUsers}
              onChange={setSelectedUsers}
              options={uniqueUsers.map(u => ({ value: u, label: u }))}
              placeholder={`All users in file (${uniqueUsers.length})`}
              icon="lnr-user"
            />
            <p className="text-xs text-gray-500 mt-1.5">Distinct users in the selected Teams activity file. May differ from assigned license (see cards above).</p>
            {userListWithEmail.length > 0 && (
              <button
                type="button"
                onClick={downloadUserListCSV}
                className="mt-2 w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Download user list ({userListWithEmail.length} users, CSV)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {chartDataForChart.length > 0 && (() => {
        const file1 = files.find(f => f.id === selectedFileId)
        const file2 = files.find(f => f.id === compareFileId)
        const file1Label = file1 ? formatMonthRange(file1.from_month, file1.to_month) || 'File 1' : 'File 1'
        const file2Label = file2 ? formatMonthRange(file2.from_month, file2.to_month) || 'File 2' : 'File 2'
        
        const calculateSum = (key) => {
          return chartDataForChart.reduce((sum, d) => sum + (d[key] || 0), 0)
        }
        
        const calculateCompareSum = (key) => {
          if (!compareMode || !compareFileId) return null
          return chartDataForChart.reduce((sum, d) => sum + (d[`${key} (Compare)`] || 0), 0)
        }
        
        return (
          <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card p-4 bg-gradient-to-br from-slate-600 to-slate-800 border-2 border-slate-700 shadow-lg">
              <p className="text-sm font-semibold text-white">Team Chats</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Team Chat').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-slate-200 mt-1">{calculateCompareSum('Team Chat').toLocaleString()}</p>
              )}
              <p className="text-xs text-slate-300 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-slate-400 mt-0.5 opacity-90">Messages sent in team channels</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-slate-400">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-emerald-500 to-emerald-700 border-2 border-emerald-600 shadow-lg">
              <p className="text-sm font-semibold text-white">Private Chats</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Private Chat').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-emerald-100 mt-1">{calculateCompareSum('Private Chat').toLocaleString()}</p>
              )}
              <p className="text-xs text-emerald-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-emerald-200 mt-0.5 opacity-90">1:1 or group chats (not in channels)</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-emerald-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-amber-500 to-amber-700 border-2 border-amber-600 shadow-lg">
              <p className="text-sm font-semibold text-white">Calls</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Calls').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-amber-100 mt-1">{calculateCompareSum('Calls').toLocaleString()}</p>
              )}
              <p className="text-xs text-amber-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-amber-200 mt-0.5 opacity-90">Voice or video calls</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-amber-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-violet-500 to-violet-700 border-2 border-violet-600 shadow-lg">
              <p className="text-sm font-semibold text-white">Meetings Organized</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Meetings Org').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-violet-100 mt-1">{calculateCompareSum('Meetings Org').toLocaleString()}</p>
              )}
              <p className="text-xs text-violet-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-violet-200 mt-0.5 opacity-90">Meetings the user scheduled</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-violet-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-rose-500 to-rose-700 border-2 border-rose-600 shadow-lg">
              <p className="text-sm font-semibold text-white">Meetings Attended</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Meetings Att').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-rose-100 mt-1">{calculateCompareSum('Meetings Att').toLocaleString()}</p>
              )}
              <p className="text-xs text-rose-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-rose-200 mt-0.5 opacity-90">Meetings the user joined</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-rose-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-cyan-500 to-cyan-700 border-2 border-cyan-600 shadow-lg">
              <p className="text-sm font-semibold text-white">One-time Meetings Organized</p>
              <p className="text-2xl font-bold text-white">{calculateSum('One-time Org').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-cyan-100 mt-1">{calculateCompareSum('One-time Org').toLocaleString()}</p>
              )}
              <p className="text-xs text-cyan-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-cyan-200 mt-0.5 opacity-90">Single-occurrence meetings scheduled</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-cyan-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-sky-500 to-sky-700 border-2 border-sky-600 shadow-lg">
              <p className="text-sm font-semibold text-white">One-time Meetings Attended</p>
              <p className="text-2xl font-bold text-white">{calculateSum('One-time Att').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-sky-100 mt-1">{calculateCompareSum('One-time Att').toLocaleString()}</p>
              )}
              <p className="text-xs text-sky-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-sky-200 mt-0.5 opacity-90">Single-occurrence meetings joined</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-sky-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-indigo-500 to-indigo-700 border-2 border-indigo-600 shadow-lg">
              <p className="text-sm font-semibold text-white">Recurring Meetings Organized</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Recurring Org').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-indigo-100 mt-1">{calculateCompareSum('Recurring Org').toLocaleString()}</p>
              )}
              <p className="text-xs text-indigo-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-indigo-200 mt-0.5 opacity-90">Series meetings the user scheduled</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-indigo-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 border-2 border-fuchsia-600 shadow-lg">
              <p className="text-sm font-semibold text-white">Recurring Meetings Attended</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Recurring Att').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-fuchsia-100 mt-1">{calculateCompareSum('Recurring Att').toLocaleString()}</p>
              )}
              <p className="text-xs text-fuchsia-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-fuchsia-200 mt-0.5 opacity-90">Series meetings the user joined</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-fuchsia-200">{file1Label} / {file2Label}</p>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-600 shadow-lg">
              <p className="text-sm font-semibold text-white">Post Messages</p>
              <p className="text-2xl font-bold text-white">{calculateSum('Post Messages').toLocaleString()}</p>
              {compareMode && compareFileId && (
                <p className="text-lg font-semibold text-red-100 mt-1">{calculateCompareSum('Post Messages').toLocaleString()}</p>
              )}
              <p className="text-xs text-red-100 mt-1">{selectedUsers.length ? `${selectedUsers.length} user(s)` : `${filteredBase.length} user(s)`}</p>
              <p className="text-xs text-red-200 mt-0.5 opacity-90">Messages posted in channel conversations</p>
              {compareMode && compareFileId && (
                <p className="text-xs text-red-200">{file1Label} / {file2Label}</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Export Actions - Show when chart is available */}
      {chartDataForChart.length > 0 && (
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

      {/* Charts - one vertical bar chart per user (activities on X-axis, count on Y-axis); show 5 initially, then Load more / Load all */}
      {chartDataByUser.length > 0 && (() => {
        const visibleCharts = chartDataByUser.slice(0, chartsToShow)
        const hasMore = chartDataByUser.length > chartsToShow
        const total = chartDataByUser.length
        return (
        <div ref={chartRef} id="user-activity-charts" className="space-y-8">
          <p className="text-sm text-gray-600">
            Showing {visibleCharts.length} of {total} user chart{total !== 1 ? 's' : ''}.
          </p>
          {visibleCharts.map(({ user, periodLabel, periodLabel2, dataPoints }) => (
            <div key={user} className="card p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{user}</h3>
              <div style={{ width: '100%', height: 420 }}>
                <ResponsiveContainer>
                  <BarChart data={dataPoints} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="activity"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={{ stroke: '#d1d5db' }}
                      interval={0}
                    />
                    <YAxis
                      label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 12 } }}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={{ stroke: '#d1d5db' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="square" />
                    <Bar dataKey="count" name={periodLabel} fill="#f97316" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="count" position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                    </Bar>
                    {compareMode && compareFileId && (
                      <Bar dataKey="countCompare" name={periodLabel2} fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="countCompare" position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
          {hasMore && (() => {
            const remaining = total - chartsToShow
            const nextBatch = Math.min(LOAD_MORE_STEP, remaining)
            return (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setChartsToShow(prev => Math.min(prev + LOAD_MORE_STEP, total))}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Load more ({nextBatch})
              </button>
              <button
                type="button"
                onClick={() => setChartsToShow(total)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Load all ({remaining})
              </button>
            </div>
            )
          })()}
        </div>
        )
      })()}
    </div>
  )
}
