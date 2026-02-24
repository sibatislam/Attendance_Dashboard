import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTeamsCXOActivity, listCXOUsers, listEmployeesWithCXOStatus, markEmployeeAsCXO, unmarkEmployeeAsCXO } from '../../../lib/api'
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

export default function CXOComparisonTab({ files, employeeFiles, selectedFileId, setSelectedFileId }) {
  const [compareMode, setCompareMode] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)
  const [showCXOManagement, setShowCXOManagement] = useState(false)
  const [selectedEmployeeFileForCXO, setSelectedEmployeeFileForCXO] = useState(null)
  const [cxoSearchQuery, setCxoSearchQuery] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const cxoChartRefs = useRef({})
  const chartsContainerRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: cxoData = [], isLoading: isLoadingCXO } = useQuery({
    queryKey: ['teams_cxo_activity', selectedFileId],
    queryFn: () => getTeamsCXOActivity(selectedFileId),
    enabled: files.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: cxoCompareData = [], isLoading: isLoadingCXOCompare } = useQuery({
    queryKey: ['teams_cxo_activity_compare', compareFileId],
    queryFn: () => getTeamsCXOActivity(compareFileId),
    enabled: compareMode && compareFileId !== null,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: cxoUsers = [], isLoading: isLoadingCXOUsers } = useQuery({
    queryKey: ['cxo_users'],
    queryFn: listCXOUsers,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: employeesWithCXO = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees_with_cxo', selectedEmployeeFileForCXO],
    queryFn: () => listEmployeesWithCXOStatus(selectedEmployeeFileForCXO),
    enabled: showCXOManagement && employeeFiles.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  // CXO mutations with optimistic updates
  const markCXOMutation = useMutation({
    mutationFn: markEmployeeAsCXO,
    onMutate: async (email) => {
      await queryClient.cancelQueries(['employees_with_cxo'])
      const previousEmployees = queryClient.getQueryData(['employees_with_cxo', selectedEmployeeFileForCXO])
      queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], (old) => {
        if (!old) return old
        return old.map(emp => 
          emp.email.toLowerCase() === email.toLowerCase() 
            ? { ...emp, is_cxo: true }
            : emp
        )
      })
      return { previousEmployees }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cxo_users'])
      queryClient.invalidateQueries(['employees_with_cxo'])
      queryClient.invalidateQueries(['teams_cxo_activity'])
    },
    onError: (error, email, context) => {
      console.error('Mark CXO error:', error)
      if (!error.response) {
        queryClient.invalidateQueries(['employees_with_cxo'])
        queryClient.invalidateQueries(['cxo_users'])
        return
      }
      if (context?.previousEmployees && error.response?.status >= 400) {
        queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], context.previousEmployees)
      }
      if (error.response?.status === 403) {
        alert('Access denied: Admin privileges required to mark employees as CXO')
      } else if (error.response?.status === 401) {
        alert('Authentication required. Please log in again.')
      } else if (error.response?.status >= 400) {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to mark employee as CXO'
        alert(`Error: ${errorMessage}`)
      }
    }
  })

  const unmarkCXOMutation = useMutation({
    mutationFn: unmarkEmployeeAsCXO,
    onMutate: async (email) => {
      await queryClient.cancelQueries(['employees_with_cxo'])
      const previousEmployees = queryClient.getQueryData(['employees_with_cxo', selectedEmployeeFileForCXO])
      queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], (old) => {
        if (!old) return old
        return old.map(emp => 
          emp.email.toLowerCase() === email.toLowerCase() 
            ? { ...emp, is_cxo: false }
            : emp
        )
      })
      return { previousEmployees }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['cxo_users'])
      queryClient.invalidateQueries(['employees_with_cxo'])
      queryClient.invalidateQueries(['teams_cxo_activity'])
    },
    onError: (error, email, context) => {
      console.error('Unmark CXO error:', error)
      if (!error.response) {
        queryClient.invalidateQueries(['employees_with_cxo'])
        queryClient.invalidateQueries(['cxo_users'])
        return
      }
      if (context?.previousEmployees && error.response?.status >= 400) {
        queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], context.previousEmployees)
      }
      if (error.response?.status === 403) {
        alert('Access denied: Admin privileges required to unmark employees as CXO')
      } else if (error.response?.status === 401) {
        alert('Authentication required. Please log in again.')
      } else if (error.response?.status >= 400) {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to unmark employee as CXO'
        alert(`Error: ${errorMessage}`)
      }
    }
  })

  // CXO data processing - group by individual user
  const cxoUserData = useMemo(() => {
    if (cxoData.length === 0) return []
    
    const userMap = {}
    cxoData.forEach(u => {
      const email = u.user || u.email || 'Unknown'
      if (!userMap[email]) {
        userMap[email] = {
          user: email,
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
      }
      userMap[email]['Team Chat'] += u['Team Chat'] || 0
      userMap[email]['Private Chat'] += u['Private Chat'] || 0
      userMap[email]['Calls'] += u['Calls'] || 0
      userMap[email]['Meetings Org'] += u['Meetings Org'] || 0
      userMap[email]['Meetings Att'] += u['Meetings Att'] || 0
      userMap[email]['One-time Org'] += u['One-time Org'] || 0
      userMap[email]['One-time Att'] += u['One-time Att'] || 0
      userMap[email]['Recurring Org'] += u['Recurring Org'] || 0
      userMap[email]['Recurring Att'] += u['Recurring Att'] || 0
      userMap[email]['Post Messages'] += u['Post Messages'] || 0
    })
    
    return Object.values(userMap).sort((a, b) => a.user.localeCompare(b.user))
  }, [cxoData])

  const cxoCompareUserData = useMemo(() => {
    if (cxoCompareData.length === 0) return []
    
    const userMap = {}
    cxoCompareData.forEach(u => {
      const email = u.user || u.email || 'Unknown'
      if (!userMap[email]) {
        userMap[email] = {
          user: email,
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
      }
      userMap[email]['Team Chat (Compare)'] += u['Team Chat'] || 0
      userMap[email]['Private Chat (Compare)'] += u['Private Chat'] || 0
      userMap[email]['Calls (Compare)'] += u['Calls'] || 0
      userMap[email]['Meetings Org (Compare)'] += u['Meetings Org'] || 0
      userMap[email]['Meetings Att (Compare)'] += u['Meetings Att'] || 0
      userMap[email]['One-time Org (Compare)'] += u['One-time Org'] || 0
      userMap[email]['One-time Att (Compare)'] += u['One-time Att'] || 0
      userMap[email]['Recurring Org (Compare)'] += u['Recurring Org'] || 0
      userMap[email]['Recurring Att (Compare)'] += u['Recurring Att'] || 0
      userMap[email]['Post Messages (Compare)'] += u['Post Messages'] || 0
    })
    
    return Object.values(userMap).sort((a, b) => a.user.localeCompare(b.user))
  }, [cxoCompareData])

  // Merge CXO user data for comparison
  const cxoMergedUserData = useMemo(() => {
    if (!compareMode || !compareFileId) return cxoUserData

    const file1Map = {}
    const file2Map = {}

    cxoUserData.forEach(u => {
      file1Map[u.user] = u
    })

    cxoCompareUserData.forEach(u => {
      file2Map[u.user] = u
    })

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
        'Team Chat (Compare)': file2Data ? file2Data['Team Chat (Compare)'] : 0,
        'Private Chat (Compare)': file2Data ? file2Data['Private Chat (Compare)'] : 0,
        'Calls (Compare)': file2Data ? file2Data['Calls (Compare)'] : 0,
        'Meetings Org (Compare)': file2Data ? file2Data['Meetings Org (Compare)'] : 0,
        'Meetings Att (Compare)': file2Data ? file2Data['Meetings Att (Compare)'] : 0,
        'One-time Org (Compare)': file2Data ? file2Data['One-time Org (Compare)'] : 0,
        'One-time Att (Compare)': file2Data ? file2Data['One-time Att (Compare)'] : 0,
        'Recurring Org (Compare)': file2Data ? file2Data['Recurring Org (Compare)'] : 0,
        'Recurring Att (Compare)': file2Data ? file2Data['Recurring Att (Compare)'] : 0,
        'Post Messages (Compare)': file2Data ? file2Data['Post Messages (Compare)'] : 0,
      })
    })

    return merged.sort((a, b) => a.user.localeCompare(b.user))
  }, [cxoUserData, cxoCompareUserData, compareMode, compareFileId])

  // Generate activity chart data for each CXO user
  const cxoUserActivityCharts = useMemo(() => {
    const dataToUse = cxoMergedUserData.length > 0 ? cxoMergedUserData : cxoUserData
    if (dataToUse.length === 0) return []

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

    const file1 = files.find(f => f.id === selectedFileId)
    const file2 = files.find(f => f.id === compareFileId)
    const file1Label = file1 ? formatMonthRange(file1.from_month, file1.to_month) || 'File 1' : 'File 1'
    const file2Label = file2 ? formatMonthRange(file2.from_month, file2.to_month) || 'File 2' : 'File 2'

    return dataToUse.map(userData => {
      const chartData = activities.map(activity => {
        const result = {
          activity: activity.label,
        }

        result[file1Label] = userData[activity.key] || 0

        if (compareMode && compareFileId) {
          result[file2Label] = userData[`${activity.key} (Compare)`] || 0
        }

        return result
      })

      return {
        user: userData.user,
        chartData
      }
    })
  }, [cxoMergedUserData, cxoUserData, files, selectedFileId, compareFileId, compareMode])

  const isLoading = isLoadingCXO || isLoadingCXOCompare || isLoadingCXOUsers || isLoadingEmployees

  // Download all charts as PNG
  const downloadChartsAsPNG = async () => {
    try {
      const container = chartsContainerRef.current
      if (!container) {
        alert('Charts not found')
        return
      }

      setIsExporting(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 10000,
      })
      
      const imgData = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      const fileName = `CXO_Activity_Charts_${new Date().toISOString().split('T')[0]}.png`
      link.download = fileName.replace(/[^a-z0-9._-]/gi, '_')
      link.href = imgData
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading charts:', error)
      alert('Error downloading charts: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Export to PDF
  const exportToPDF = async () => {
    try {
      setIsExporting(true)
      
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const container = chartsContainerRef.current
      if (!container) {
        throw new Error('Charts container not found')
      }

      // Get all chart cards
      const chartCards = Array.from(container.querySelectorAll('.card')).filter(card => {
        const svg = card.querySelector('svg')
        const h3 = card.querySelector('h3')
        return svg && h3
      })
      
      if (chartCards.length === 0) {
        throw new Error('No charts found to export')
      }

      for (let i = 0; i < chartCards.length; i++) {
        const card = chartCards[i]
        const title = card.querySelector('h3')?.textContent?.trim() || `Chart ${i + 1}`
        
        card.scrollIntoView({ behavior: 'instant', block: 'center' })
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const canvas = await html2canvas(card, {
          scale: 1.2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 5000,
        })
        
        const imgData = canvas.toDataURL('image/jpeg', 0.85)
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        
        const pdfImgWidth = pdfWidth - 20
        const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth
        
        if (i > 0) pdf.addPage()
        
        pdf.setFontSize(18)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(40, 40, 40)
        pdf.text(title, pdfWidth / 2, 15, { align: 'center' })
        
        let yPos = 25
        if (pdfImgHeight > pdfHeight - 30) {
          const scaledHeight = pdfHeight - 30
          const scaledWidth = (imgWidth * scaledHeight) / imgHeight
          pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, yPos, scaledWidth, scaledHeight)
        } else {
          pdf.addImage(imgData, 'JPEG', 10, yPos, pdfImgWidth, pdfImgHeight)
        }
      }
      
      const fileName = `CXO_Activity_Report_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName.replace(/[^a-z0-9._-]/gi, '_'))
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading && cxoUserActivityCharts.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading CXO activity data...</p>
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

      {/* CXO Filters */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-blue-200">
          <div className="flex items-center gap-3">
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
          <button
            onClick={() => setShowCXOManagement(!showCXOManagement)}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
          >
            {showCXOManagement ? 'Hide' : 'Manage'} CXO Users
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <label htmlFor="cxoFileSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="lnr lnr-file-empty text-blue-600"></span>
              {compareMode ? 'Teams File 1' : 'Teams File'}
            </label>
            <select
              id="cxoFileSelect"
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

          {compareMode && (
            <div className="bg-white rounded-lg p-3 border-2 border-blue-400 shadow-sm">
              <label htmlFor="cxoCompareFileSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="lnr lnr-file-empty text-blue-600"></span>
                Teams File 2
              </label>
              <select
                id="cxoCompareFileSelect"
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

        {/* CXO Management UI */}
        {showCXOManagement && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-3">Mark Employees as CXO</h4>
            
            {employeeFiles.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                Please upload an Employee List file first to mark employees as CXO.
              </p>
            ) : (
              <>
                <div className="mb-4">
                  <label htmlFor="employeeFileForCXO" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Employee File
                  </label>
                  <select
                    id="employeeFileForCXO"
                    value={selectedEmployeeFileForCXO || ''}
                    onChange={(e) => setSelectedEmployeeFileForCXO(e.target.value ? parseInt(e.target.value) : null)}
                    className="form-select w-full"
                  >
                    <option value="">All Employee Files</option>
                    {employeeFiles.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-3">
                    <label htmlFor="cxoSearch" className="block text-sm font-medium text-gray-700 mb-1">
                      Search Employees
                    </label>
                    <input
                      type="text"
                      id="cxoSearch"
                      value={cxoSearchQuery}
                      onChange={(e) => setCxoSearchQuery(e.target.value)}
                      placeholder="Search by name, email, function, or company..."
                      className="form-input w-full"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Employees ({(() => {
                        const filtered = employeesWithCXO.filter(emp => {
                          if (!cxoSearchQuery.trim()) return true
                          const query = cxoSearchQuery.toLowerCase()
                          return (
                            (emp.name && emp.name.toLowerCase().includes(query)) ||
                            (emp.email && emp.email.toLowerCase().includes(query)) ||
                            (emp.function && emp.function.toLowerCase().includes(query)) ||
                            (emp.company && emp.company.toLowerCase().includes(query))
                          )
                        })
                        return filtered.length
                      })()})
                    </label>
                    <span className="text-xs text-gray-500">
                      {employeesWithCXO.filter(e => e.is_cxo).length} marked as CXO
                    </span>
                  </div>
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
                    {isLoadingEmployees ? (
                      <p className="text-sm text-gray-500 text-center py-4">Loading employees...</p>
                    ) : employeesWithCXO.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No employees found in selected file(s)</p>
                    ) : (() => {
                      const filteredEmployees = employeesWithCXO.filter(emp => {
                        if (!cxoSearchQuery.trim()) return true
                        const query = cxoSearchQuery.toLowerCase()
                        return (
                          (emp.name && emp.name.toLowerCase().includes(query)) ||
                          (emp.email && emp.email.toLowerCase().includes(query)) ||
                          (emp.function && emp.function.toLowerCase().includes(query)) ||
                          (emp.company && emp.company.toLowerCase().includes(query))
                        )
                      })
                      
                      if (filteredEmployees.length === 0) {
                        return (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No employees found matching "{cxoSearchQuery}"
                          </p>
                        )
                      }
                      
                      return (
                        <div className="space-y-1">
                          {filteredEmployees.map((employee, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={employee.is_cxo}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      markCXOMutation.mutate(employee.email)
                                    } else {
                                      unmarkCXOMutation.mutate(employee.email)
                                    }
                                  }}
                                  disabled={markCXOMutation.isLoading || unmarkCXOMutation.isLoading}
                                  className="form-checkbox h-4 w-4 text-blue-600 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {employee.name || employee.email}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {employee.email}
                                    {employee.function && ` • ${employee.function}`}
                                    {employee.company && ` • ${employee.company}`}
                                  </div>
                                </div>
                              </div>
                              {employee.is_cxo && (
                                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                  CXO
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Export Actions */}
      {cxoUserActivityCharts.length > 0 && (
        <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Export Options</h4>
              <p className="text-xs text-gray-600 mt-1">Download charts and reports</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadChartsAsPNG}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                title="Download all charts as PNG"
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
                title="Export all charts to PDF"
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

      {/* Individual CXO Activity Charts */}
      {cxoUserActivityCharts.length > 0 && (
        <div ref={chartsContainerRef} id="cxo-charts-container" className="space-y-6">
          {cxoUserActivityCharts.map((userChart, idx) => {
            const file1 = files.find(f => f.id === selectedFileId)
            const file2 = files.find(f => f.id === compareFileId)
            const file1Label = file1 ? formatMonthRange(file1.from_month, file1.to_month) || 'File 1' : 'File 1'
            const file2Label = file2 ? formatMonthRange(file2.from_month, file2.to_month) || 'File 2' : 'File 2'
            const allKeys = Object.keys(userChart.chartData[0] || {}).filter(k => k !== 'activity')
            const file1Key = allKeys[0]
            const file2Key = allKeys[1]

            return (
              <div key={idx} className="card p-6" id={`cxo-chart-card-${idx}`} ref={el => {
                if (el) {
                  cxoChartRefs.current[userChart.user] = el
                }
              }}>
                <div className="flex items-center justify-between mb-4 border-b pb-3">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {userChart.user}
                  </h3>
                </div>
                <div style={{ width: '100%', height: 500 }}>
                  <ResponsiveContainer>
                    <BarChart data={userChart.chartData} margin={{ top: 30, right: 30, left: 60, bottom: 100 }}>
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
                      {file1Key && (
                        <Bar 
                          key={file1Key}
                          dataKey={file1Key} 
                          name={file1Label}
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
                          name={file2Label}
                          fill="#3b82f6" 
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList dataKey={file2Key} position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                        </Bar>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cxoUserActivityCharts.length === 0 && !isLoading && (
        <div className="card p-6 text-center text-gray-600">
          <p>No CXO activity data available. {cxoUsers.length === 0 ? 'Please mark employees as CXO first.' : 'Please upload Teams activity files and mark employees as CXO.'}</p>
        </div>
      )}
    </div>
  )
}
