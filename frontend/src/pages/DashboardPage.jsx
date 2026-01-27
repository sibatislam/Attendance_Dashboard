import { useState, useMemo, useRef, memo, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getOnTime } from '../lib/api'
import { getWorkHourCompletion } from '../lib/api'
import { getWorkHourLost } from '../lib/api'
import { getLeaveAnalysis } from '../lib/api'
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Legend, Bar, Line, CartesianGrid, LabelList } from 'recharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

function toMonthLabel(m) {
  if (!m) return ''
  const match = String(m).match(/(20\d{2})-(\d{2})/)
  if (!match) return String(m)
  const year = match[1].slice(-2) // Last 2 digits of year
  const month = parseInt(match[2], 10)
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[month-1]} ${year}`
}

const tabs = [
  { key: 'function', label: 'Function', base: 'function' },
  { key: 'company', label: 'Company', base: 'company' },
  { key: 'location', label: 'Location', base: 'location' },
]

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const [active, setActive] = useState('function')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 })
  // Load filters from localStorage on mount, or initialize with empty
  const [fromM, setFromM] = useState(() => {
    const saved = localStorage.getItem('dashboard_filters')
    if (saved) {
      try {
        const filters = JSON.parse(saved)
        return filters.fromM || ''
      } catch (e) {
        return ''
      }
    }
    return ''
  })
  const [toM, setToM] = useState(() => {
    const saved = localStorage.getItem('dashboard_filters')
    if (saved) {
      try {
        const filters = JSON.parse(saved)
        return filters.toM || ''
      } catch (e) {
        return ''
      }
    }
    return ''
  })
  const [visibleGroups, setVisibleGroups] = useState(5) // Show 5 groups initially
  const dashboardRef = useRef(null)
  const groupRefs = useRef({})
  const current = tabs.find(t => t.key === active)
  const baseKey = current?.base || 'function'
  
  // Force refetch on mount to ensure fresh data
  useEffect(() => {
    // Invalidate and refetch all dashboard queries when component mounts
    queryClient.invalidateQueries({ queryKey: ['kpi'] })
    queryClient.invalidateQueries({ queryKey: ['work_hour'] })
    queryClient.invalidateQueries({ queryKey: ['work_hour_lost'] })
    queryClient.invalidateQueries({ queryKey: ['leave_analysis'] })
  }, [queryClient])
  
  // Fetch all data for the selected group with parallel loading and caching
  const { data: onTimeData = [], isLoading: isLoadingOnTime, isError: isErrorOnTime, error: errorOnTime } = useQuery({ 
    queryKey: ['kpi', baseKey], 
    queryFn: () => getOnTime(baseKey),
    enabled: !!baseKey,
    staleTime: 5 * 60 * 1000, // Reduced to 5 minutes for faster updates
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true, // Changed to true to ensure data loads on mount
    retry: 1, // Allow one retry on failure
    onError: (error) => {
      console.error('[Dashboard] OnTime API error:', error)
      console.error('[Dashboard] OnTime error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    },
    onSuccess: (data) => {
      console.log('[Dashboard] OnTime data loaded:', data?.length || 0, 'records')
    }
  })
  const { data: workHourData = [], isLoading: isLoadingWorkHour, isError: isErrorWorkHour, error: errorWorkHour } = useQuery({ 
    queryKey: ['work_hour', baseKey], 
    queryFn: () => getWorkHourCompletion(baseKey),
    enabled: !!baseKey,
    staleTime: 5 * 60 * 1000, // Reduced to 5 minutes for faster updates
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true, // Changed to true to ensure data loads on mount
    retry: 1, // Allow one retry on failure
    onError: (error) => {
      console.error('[Dashboard] WorkHour API error:', error)
      console.error('[Dashboard] WorkHour error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    },
    onSuccess: (data) => {
      console.log('[Dashboard] WorkHour data loaded:', data?.length || 0, 'records')
    }
  })
  const { data: workHourLostData = [], isLoading: isLoadingWorkHourLost, isError: isErrorWorkHourLost, error: errorWorkHourLost } = useQuery({ 
    queryKey: ['work_hour_lost', baseKey], 
    queryFn: () => getWorkHourLost(baseKey),
    enabled: !!baseKey,
    staleTime: 5 * 60 * 1000, // Reduced to 5 minutes for faster updates
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true, // Changed to true to ensure data loads on mount
    retry: 1, // Allow one retry on failure
    onError: (error) => {
      console.error('[Dashboard] WorkHourLost API error:', error)
      console.error('[Dashboard] WorkHourLost error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    },
    onSuccess: (data) => {
      console.log('[Dashboard] WorkHourLost data loaded:', data?.length || 0, 'records')
    }
  })
  const { data: leaveAnalysisData = [], isLoading: isLoadingLeave, isError: isErrorLeave, error: errorLeave } = useQuery({ 
    queryKey: ['leave_analysis', baseKey], 
    queryFn: () => getLeaveAnalysis(baseKey),
    enabled: !!baseKey,
    staleTime: 5 * 60 * 1000, // Reduced to 5 minutes for faster updates
    cacheTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true, // Changed to true to ensure data loads on mount
    retry: 1, // Allow one retry on failure
    onError: (error) => {
      console.error('[Dashboard] LeaveAnalysis API error:', error)
      console.error('[Dashboard] LeaveAnalysis error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
    },
    onSuccess: (data) => {
      console.log('[Dashboard] LeaveAnalysis data loaded:', data?.length || 0, 'records')
    }
  })

  const isLoading = isLoadingOnTime || isLoadingWorkHour || isLoadingWorkHourLost || isLoadingLeave
  const hasError = isErrorOnTime || isErrorWorkHour || isErrorWorkHourLost || isErrorLeave
  const errorMessage = errorOnTime?.message || errorWorkHour?.message || errorWorkHourLost?.message || errorLeave?.message || 
                       errorOnTime?.response?.data?.detail || errorWorkHour?.response?.data?.detail || 
                       errorWorkHourLost?.response?.data?.detail || errorLeave?.response?.data?.detail

  // Get all unique months from all data
  const allMonths = useMemo(() => {
    const months = new Set()
    if (onTimeData && Array.isArray(onTimeData)) onTimeData.forEach(r => r && r.month && months.add(r.month))
    if (workHourData && Array.isArray(workHourData)) workHourData.forEach(r => r && r.month && months.add(r.month))
    if (workHourLostData && Array.isArray(workHourLostData)) workHourLostData.forEach(r => r && r.month && months.add(r.month))
    if (leaveAnalysisData && Array.isArray(leaveAnalysisData)) leaveAnalysisData.forEach(r => r && r.month && months.add(r.month))
    return Array.from(months).sort()
  }, [onTimeData, workHourData, workHourLostData, leaveAnalysisData])

  // Check if we have any data
  const hasAnyData = onTimeData.length > 0 || workHourData.length > 0 || workHourLostData.length > 0 || leaveAnalysisData.length > 0

  // Load active tab from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_filters')
    if (saved) {
      try {
        const filters = JSON.parse(saved)
        if (filters.active) setActive(filters.active)
      } catch (e) {
        // Ignore
      }
    }
  }, [])

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboard_filters', JSON.stringify({ fromM, toM, active }))
  }, [fromM, toM, active])

  // Set default month range to latest 3 months (only once when data first loads and no saved filters)
  // Use a ref to prevent multiple initializations
  const hasInitializedMonthRange = useRef(false)
  
  useEffect(() => {
    // Check if we have saved filters - if so, don't set defaults
    const savedFilters = localStorage.getItem('dashboard_filters')
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters)
        if (filters.fromM || filters.toM) {
          hasInitializedMonthRange.current = true
          return // Don't set defaults if we have saved filters
        }
      } catch (e) {
        // Continue to set defaults
      }
    }

    // Only initialize if filters aren't set yet and we haven't initialized before
    if (allMonths.length > 0 && !fromM && !toM && hasAnyData && !hasInitializedMonthRange.current) {
      // Use latest 3 months as default
      const latest3Months = allMonths.slice(-3)
      if (latest3Months.length > 0) {
        setFromM(latest3Months[0])
        setToM(latest3Months[latest3Months.length - 1])
        hasInitializedMonthRange.current = true
      }
    }
  }, [allMonths, hasAnyData, fromM, toM])

  // Filter data based on month range - memoized to prevent recreation
  const filterDataByMonth = useCallback((data) => {
    if (!data || !Array.isArray(data)) return []
    // If no filters are set, show all data
    if (!fromM && !toM) return data
    const fromVal = fromM || ''
    const toVal = toM || ''
    // Use string comparison for month filtering (months are in YYYY-MM format like "2024-12")
    // Ensure proper comparison by normalizing month strings
    return data.filter(r => {
      if (!r || !r.month) return false
      const monthStr = String(r.month).trim()
      // Normalize to YYYY-MM format for comparison
      const normalizedMonth = monthStr.match(/^(\d{4})-(\d{1,2})/) 
        ? monthStr 
        : monthStr // Keep as-is if already in correct format
      
      const afterFrom = !fromVal || normalizedMonth >= String(fromVal).trim()
      const beforeTo = !toVal || normalizedMonth <= String(toVal).trim()
      return afterFrom && beforeTo
    })
  }, [fromM, toM])

  // Helper to get chart data by group (filtered by month)
  // Memoize this function to prevent unnecessary recalculations
  const getChartData = useCallback((data, group) => {
    // Defensive check: ensure data is an array
    if (!data || !Array.isArray(data)) return []
    const filteredByMonth = filterDataByMonth(data)
    if (!filteredByMonth || !Array.isArray(filteredByMonth)) return []
    // Use strict equality for group matching - function groups might have special characters
    const filtered = filteredByMonth.filter(r => {
      if (!r || !r.group) return false
      // Ensure exact match - function groups are like "CI - Engineering"
      return String(r.group).trim() === String(group).trim()
    })
    if (!filtered || filtered.length === 0) return []
    return filtered
      .map(r => ({ ...r, monthLabel: toMonthLabel(r.month) }))
      .sort((a, b) => {
        // Stable sort - compare month first, then group
        const monthCompare = (a.month || '').localeCompare(b.month || '')
        if (monthCompare !== 0) return monthCompare
        return (a.group || '').localeCompare(b.group || '')
      })
  }, [filterDataByMonth]) // Depend on filterDataByMonth instead of fromM/toM directly

  const exportToPDF = async () => {
    if (allGroups.length === 0) return
    
    setIsExporting(true)
    setExportProgress({ current: 0, total: allGroups.length })
    
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      
      for (let i = 0; i < allGroups.length; i++) {
        const group = allGroups[i]
        const groupElement = groupRefs.current[group]
        if (!groupElement) {
          setExportProgress({ current: i + 1, total: allGroups.length })
          continue
        }
        
        const canvas = await html2canvas(groupElement, {
          scale: 1.2,
          useCORS: true,
          logging: false,
          removeContainer: true,
          backgroundColor: '#ffffff',
          imageTimeout: 5000
        })
        
        const imgData = canvas.toDataURL('image/jpeg', 0.85)
        const imgWidth = pdfWidth - 20
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        
        if (i > 0) pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight)
        
        setExportProgress({ current: i + 1, total: allGroups.length })
      }
      
      const tabLabel = current?.label || 'function'
      const dateStr = new Date().toISOString().split('T')[0]
      pdf.save(`Dashboard_${tabLabel}_${dateStr}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF. Please try again.')
    } finally {
      setIsExporting(false)
      setExportProgress({ current: 0, total: 0 })
    }
  }

  // Get unique groups from filtered data
  const allGroups = useMemo(() => {
    const groups = new Set()
    const filteredOnTime = filterDataByMonth(onTimeData)
    const filteredWorkHour = filterDataByMonth(workHourData)
    const filteredWorkHourLost = filterDataByMonth(workHourLostData)
    const filteredLeaveAnalysis = filterDataByMonth(leaveAnalysisData)
    
    if (filteredOnTime && Array.isArray(filteredOnTime)) filteredOnTime.forEach(r => r && r.group && groups.add(r.group))
    if (filteredWorkHour && Array.isArray(filteredWorkHour)) filteredWorkHour.forEach(r => r && r.group && groups.add(r.group))
    if (filteredWorkHourLost && Array.isArray(filteredWorkHourLost)) filteredWorkHourLost.forEach(r => r && r.group && groups.add(r.group))
    if (filteredLeaveAnalysis && Array.isArray(filteredLeaveAnalysis)) filteredLeaveAnalysis.forEach(r => r && r.group && groups.add(r.group))
    return Array.from(groups).sort()
  }, [onTimeData, workHourData, workHourLostData, leaveAnalysisData, filterDataByMonth])

  // Get only visible groups for rendering (lazy loading for performance)
  const displayedGroups = useMemo(() => {
    return allGroups.slice(0, visibleGroups)
  }, [allGroups, visibleGroups])

  // Memoize chart data for all displayed groups to prevent unnecessary re-renders
  const chartDataCache = useMemo(() => {
    const cache = {}
    displayedGroups.forEach(group => {
      // Always cache the result, even if empty - let rendering handle empty states
      // Ensure we always get arrays, even if data is undefined/null
      cache[`onTime-${group}`] = getChartData(onTimeData || [], group)
      cache[`workHour-${group}`] = getChartData(workHourData || [], group)
      cache[`workHourLost-${group}`] = getChartData(workHourLostData || [], group)
      cache[`leave-${group}`] = getChartData(leaveAnalysisData || [], group)
    })
    return cache
  }, [displayedGroups, onTimeData, workHourData, workHourLostData, leaveAnalysisData, getChartData])

  const hasMoreGroups = visibleGroups < allGroups.length

  const loadMoreGroups = () => {
    setVisibleGroups(prev => Math.min(prev + 5, allGroups.length))
  }

  const showAllGroups = () => {
    setVisibleGroups(allGroups.length)
  }

  // Reset visible groups when tab changes
  useMemo(() => {
    setVisibleGroups(5)
  }, [active])

  const palette = ['#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#38bdf8']

  const BarValueLabel = useMemo(() => (props) => {
    const { x, y, width, height, value } = props
    if (x == null || y == null || width == null || height == null) return null
    const cx = x + width / 2
    const cy = y + height / 2
    return <text x={cx} y={cy} fill="#ffffff" fontSize={12} fontWeight="700" textAnchor="middle" dominantBaseline="middle">{value}</text>
  }, [])

  const PercentLabel = useMemo(() => (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    return <text x={x} y={y + 12} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle">{value}%</text>
  }, [])

  const PercentLabelAbove = useMemo(() => (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    return <text x={x} y={y - 8} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle">{value}%</text>
  }, [])

  const HoursLabel = useMemo(() => (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    return <text x={x} y={y + 24} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle">{value}h</text>
  }, [])

  const SLPercentLabel = useMemo(() => (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    return <text x={x} y={y - 12} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle" dominantBaseline="bottom">{value}%</text>
  }, [])

  const CLPercentLabel = useMemo(() => (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    return <text x={x} y={y + 20} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle" dominantBaseline="top">{value}%</text>
  }, [])

  const APercentLabel = useMemo(() => (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    return <text x={x} y={y - 8} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle" dominantBaseline="bottom">{value}%</text>
  }, [])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const filteredOnTime = filterDataByMonth(onTimeData)
    const filteredWorkHour = filterDataByMonth(workHourData)
    const filteredWorkHourLost = filterDataByMonth(workHourLostData)
    
    // Get the latest month from the data
    const datasetToUse = filteredOnTime.length > 0 ? filteredOnTime : 
                         filteredWorkHour.length > 0 ? filteredWorkHour : 
                         filteredWorkHourLost
    
    // Find the latest month in the dataset
    let latestMonth = null
    datasetToUse.forEach(r => {
      if (!latestMonth || r.month > latestMonth) {
        latestMonth = r.month
      }
    })
    
    // Sum members from all groups in the latest month only
    const totalMembers = datasetToUse
      .filter(r => r.month === latestMonth)
      .reduce((sum, r) => sum + (r.members || 0), 0)
    
    // Average On Time % - Latest month only, weighted by members
    const latestOnTime = filteredOnTime.filter(r => r.month === latestMonth)
    const totalOnTimeMembers = latestOnTime.reduce((sum, r) => sum + (r.members || 0), 0)
    const weightedOnTime = latestOnTime.reduce((sum, r) => sum + ((r.on_time_pct || 0) * (r.members || 0)), 0)
    const avgOnTime = totalOnTimeMembers > 0 
      ? (weightedOnTime / totalOnTimeMembers).toFixed(2)
      : 0
    
    // Average Work Hour Completion % - Latest month only, weighted by members
    const latestWorkHour = filteredWorkHour.filter(r => r.month === latestMonth)
    const totalWorkHourMembers = latestWorkHour.reduce((sum, r) => sum + (r.members || 0), 0)
    const weightedCompletion = latestWorkHour.reduce((sum, r) => sum + ((r.completion_pct || 0) * (r.members || 0)), 0)
    const avgCompletion = totalWorkHourMembers > 0
      ? (weightedCompletion / totalWorkHourMembers).toFixed(2)
      : 0
    
    // Average Work Hour Lost % - Latest month only, weighted by members
    const latestWorkHourLost = filteredWorkHourLost.filter(r => r.month === latestMonth)
    const totalLostMembers = latestWorkHourLost.reduce((sum, r) => sum + (r.members || 0), 0)
    const weightedLost = latestWorkHourLost.reduce((sum, r) => sum + ((r.lost_pct || 0) * (r.members || 0)), 0)
    const avgLost = totalLostMembers > 0
      ? (weightedLost / totalLostMembers).toFixed(2)
      : 0
    
    // Average Work Hour Lost in Hours - Latest month only, weighted by members
    const weightedLostHours = latestWorkHourLost.reduce((sum, r) => sum + ((r.lost || 0) * (r.members || 0)), 0)
    const avgLostHours = totalLostMembers > 0
      ? (weightedLostHours / totalLostMembers).toFixed(2)
      : 0
    
    return {
      totalMembers: totalMembers,
      avgOnTime,
      avgCompletion,
      avgLost,
      avgLostHours,
      latestMonth: latestMonth ? toMonthLabel(latestMonth) : ''
    }
  }, [onTimeData, workHourData, workHourLostData, filterDataByMonth])

  // Debug: Log user permissions and data status
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const perms = user.permissions || {}
    const attPerms = perms.attendance_dashboard || {}
    console.log('[Dashboard] User permissions:', {
      role: user.role,
      attendance_enabled: attPerms.enabled,
      features: attPerms.features || [],
      hasDashboard: attPerms.features?.includes('dashboard')
    })
    console.log('[Dashboard] Data status:', {
      onTimeData: onTimeData.length,
      workHourData: workHourData.length,
      workHourLostData: workHourLostData.length,
      leaveAnalysisData: leaveAnalysisData.length,
      isLoading,
      hasError
    })
  }, [onTimeData, workHourData, workHourLostData, leaveAnalysisData, isLoading, hasError])

  if (allGroups.length === 0 && !isLoading) {
  return (
    <div className="space-y-6">
      {hasError && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="text-red-800 font-semibold mb-2">Error Loading Data</div>
          <div className="text-red-600 text-sm">
            {errorMessage || 'Failed to load dashboard data. Please check your connection and try again.'}
          </div>
          <div className="mt-2 text-xs text-red-500">
            Check browser console (F12) for more details. If you see 404 errors, ensure attendance files are uploaded.
          </div>
        </div>
      )}
      {!hasError && (
        <div className="card p-4 bg-yellow-50 border border-yellow-200">
          <div className="text-yellow-800 font-semibold mb-2">No Data Available</div>
          <div className="text-yellow-700 text-sm">
            No attendance data found. Please upload attendance files first.
          </div>
          <div className="mt-2">
            <a href="/attendance/upload" className="text-blue-600 hover:underline text-sm">
              Go to Upload Files →
            </a>
          </div>
        </div>
      )}
      <div className="card p-2 flex gap-2">
          {tabs.map(t => (
            <button 
              key={t.key} 
              className={`px-3 py-2 rounded-md ${active === t.key ? 'bg-blue-600 text-white' : 'btn-outline'}`} 
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (isLoading && !hasAnyData) {
    const loadingCount = [isLoadingOnTime, isLoadingWorkHour, isLoadingWorkHourLost, isLoadingLeave].filter(Boolean).length
    const totalCount = 4
    const progress = ((totalCount - loadingCount) / totalCount) * 100
    
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium mb-2">Loading Dashboard Data...</p>
          <p className="text-sm text-gray-500 mt-2 mb-4">Processing attendance data, this may take a minute...</p>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          {/* Loading Status */}
          <div className="space-y-2 text-sm text-gray-600">
            <div className={`flex items-center gap-2 ${!isLoadingOnTime ? 'text-green-600' : 'text-gray-500'}`}>
              <span className={`lnr ${!isLoadingOnTime ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingOnTime ? 'animate-spin' : ''}`}></span>
              <span>On Time % {!isLoadingOnTime && `(${onTimeData.length} records)`}</span>
            </div>
            <div className={`flex items-center gap-2 ${!isLoadingWorkHour ? 'text-green-600' : 'text-gray-500'}`}>
              <span className={`lnr ${!isLoadingWorkHour ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingWorkHour ? 'animate-spin' : ''}`}></span>
              <span>Work Hour {!isLoadingWorkHour && `(${workHourData.length} records)`}</span>
            </div>
            <div className={`flex items-center gap-2 ${!isLoadingWorkHourLost ? 'text-green-600' : 'text-gray-500'}`}>
              <span className={`lnr ${!isLoadingWorkHourLost ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingWorkHourLost ? 'animate-spin' : ''}`}></span>
              <span>Work Hour Lost {!isLoadingWorkHourLost && `(${workHourLostData.length} records)`}</span>
            </div>
            <div className={`flex items-center gap-2 ${!isLoadingLeave ? 'text-green-600' : 'text-gray-500'}`}>
              <span className={`lnr ${!isLoadingLeave ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingLeave ? 'animate-spin' : ''}`}></span>
              <span>Leave Analysis Adjacent to Weekend and Holiday {!isLoadingLeave && `(${leaveAnalysisData.length} records)`}</span>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            Large datasets may take up to 2 minutes to process...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Exporting PDF...</h3>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 text-center">
              {exportProgress.current} of {exportProgress.total} groups exported
            </p>
          </div>
        </div>
      )}
      
      {/* Loading Indicator for Initial Load */}
      {isLoading && (
        <div className="card p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-3 border-blue-600"></div>
              <p className="text-gray-700 font-medium">Loading dashboard data...</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className={`flex items-center gap-2 ${!isLoadingOnTime ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`lnr ${!isLoadingOnTime ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingOnTime ? 'animate-spin' : ''}`}></span>
                <span>On Time %</span>
              </div>
              <div className={`flex items-center gap-2 ${!isLoadingWorkHour ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`lnr ${!isLoadingWorkHour ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingWorkHour ? 'animate-spin' : ''}`}></span>
                <span>Work Hour</span>
              </div>
              <div className={`flex items-center gap-2 ${!isLoadingWorkHourLost ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`lnr ${!isLoadingWorkHourLost ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingWorkHourLost ? 'animate-spin' : ''}`}></span>
                <span>Work Hour Lost</span>
              </div>
              <div className={`flex items-center gap-2 ${!isLoadingLeave ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`lnr ${!isLoadingLeave ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoadingLeave ? 'animate-spin' : ''}`}></span>
                <span>Leave Analysis Adjacent to Weekend and Holiday</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((4 - [isLoadingOnTime, isLoadingWorkHour, isLoadingWorkHourLost, isLoadingLeave].filter(Boolean).length) / 4) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-100 mb-1">Total Members</p>
              <p className="text-3xl font-bold">{summaryStats.totalMembers}</p>
              {summaryStats.latestMonth && (
                <p className="text-xs text-blue-100 mt-2 opacity-90">{summaryStats.latestMonth}</p>
              )}
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="lnr lnr-users text-3xl"></span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100 mb-1">Avg On Time %</p>
              <p className="text-3xl font-bold">{summaryStats.avgOnTime}%</p>
              {summaryStats.latestMonth && (
                <p className="text-xs text-green-100 mt-2 opacity-90">{summaryStats.latestMonth}</p>
              )}
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="lnr lnr-clock text-3xl"></span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-100 mb-1">Avg Work Hour Completion %</p>
              <p className="text-3xl font-bold">{summaryStats.avgCompletion}%</p>
              {summaryStats.latestMonth && (
                <p className="text-xs text-indigo-100 mt-2 opacity-90">{summaryStats.latestMonth}</p>
              )}
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="lnr lnr-calendar-full text-3xl"></span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-100 mb-1">Avg Work Hour Lost %</p>
              <p className="text-3xl font-bold">{summaryStats.avgLost}%</p>
              <p className="text-lg font-semibold mt-1 text-orange-50">{summaryStats.avgLostHours} hrs</p>
              {summaryStats.latestMonth && (
                <p className="text-xs text-orange-100 mt-2 opacity-90">{summaryStats.latestMonth}</p>
              )}
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="lnr lnr-hourglass text-3xl"></span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card p-2">
        <div className="flex gap-2 items-center justify-between mb-3">
          <div className="flex gap-2">
            {tabs.map(t => (
              <button 
                key={t.key} 
                className={`px-3 py-2 rounded-md ${active === t.key ? 'bg-blue-600 text-white' : 'btn-outline'}`} 
                onClick={() => setActive(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button 
            onClick={exportToPDF}
            disabled={isExporting}
            className="btn"
          >
            {isExporting ? 'Exporting...' : 'Export as PDF'}
          </button>
        </div>
        
        {allMonths.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">From</label>
            <select className="btn-outline" value={fromM || ''} onChange={e => setFromM(e.target.value)}>
              <option value="">(min)</option>
              {allMonths.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
            </select>
            <label className="text-sm text-gray-600">To</label>
            <select className="btn-outline" value={toM || ''} onChange={e => setToM(e.target.value)}>
              <option value="">(max)</option>
              {allMonths.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
            </select>
          </div>
        )}
      </div>
      
      <div ref={dashboardRef}>

      {displayedGroups.map((group, groupIdx) => {
        // Get chart data from cache, ensuring it's always an array
        // Use a stable reference to prevent unnecessary re-renders
        const cacheKeyOnTime = `onTime-${group}`
        const cacheKeyWorkHour = `workHour-${group}`
        const cacheKeyWorkHourLost = `workHourLost-${group}`
        const cacheKeyLeave = `leave-${group}`
        
        const onTimeChartData = Array.isArray(chartDataCache[cacheKeyOnTime]) ? chartDataCache[cacheKeyOnTime] : []
        const workHourChartData = Array.isArray(chartDataCache[cacheKeyWorkHour]) ? chartDataCache[cacheKeyWorkHour] : []
        const workHourLostChartData = Array.isArray(chartDataCache[cacheKeyWorkHourLost]) ? chartDataCache[cacheKeyWorkHourLost] : []
        const leaveChartData = Array.isArray(chartDataCache[cacheKeyLeave]) ? chartDataCache[cacheKeyLeave] : []
        
        return (
        <div key={group} ref={el => groupRefs.current[group] = el} className="space-y-4">
          <h2 className="text-xl font-semibold">{group}</h2>
          
          {/* Row 1: On Time % and Work Hour Completion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* On Time % Chart */}
            <div className="card p-4">
              <div className="mb-2 font-semibold text-gray-700">On Time %</div>
              {isLoadingOnTime ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  Loading...
                </div>
              ) : !onTimeChartData || onTimeChartData.length === 0 ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  No on time data available for this group
                </div>
              ) : (
                <div style={{ width: '100%', height: 280, minHeight: 280 }} key={`ontime-chart-${group}-${groupIdx}`}>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart 
                      data={onTimeChartData} 
                      margin={{ top: 30, right: 20, bottom: 0, left: 0 }} 
                      key={`ontime-composed-${group}-${groupIdx}`}
                    >
                    <defs>
                      <linearGradient id={`gradient-blue-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.4}/>
                      </linearGradient>
                      <filter id={`shadow-${groupIdx}`}>
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.3"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'On Time %', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-blue-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-${groupIdx})`}>
                      <LabelList content={<BarValueLabel />} />
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="on_time_pct" name="On Time %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                      <LabelList content={<PercentLabel />} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>

            {/* Work Hour Completion Chart */}
            <div className="card p-4">
              <div className="mb-2 font-semibold text-gray-700">Work Hour Completion</div>
              {isLoadingWorkHour ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  Loading...
                </div>
              ) : !workHourChartData || workHourChartData.length === 0 ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  No work hour completion data available for this group
                </div>
              ) : (
                <div style={{ width: '100%', height: 280, minHeight: 280 }} key={`workhour-chart-${group}-${groupIdx}`}>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart 
                      data={workHourChartData} 
                      margin={{ top: 30, right: 20, bottom: 0, left: 0 }} 
                      key={`workhour-composed-${group}-${groupIdx}`}
                    >
                    <defs>
                      <linearGradient id={`gradient-green-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.4}/>
                      </linearGradient>
                      <filter id={`shadow-green-${groupIdx}`}>
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.3"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Completion %', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-green-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-green-${groupIdx})`}>
                      <LabelList content={<BarValueLabel />} />
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="completion_pct" name="Completion %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                      <LabelList content={<PercentLabel />} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>
          </div>

          {/* Row 2: Work Hour Lost and Leave Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Work Hour Lost Chart */}
            <div className="card p-4">
              <div className="mb-2 font-semibold text-gray-700">Work Hour Lost</div>
              {isLoadingWorkHourLost ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  Loading...
                </div>
              ) : !workHourLostChartData || workHourLostChartData.length === 0 ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  No work hour lost data available for this group
                </div>
              ) : (
                <div style={{ width: '100%', height: 280, minHeight: 280 }} key={`workhourlost-chart-${group}-${groupIdx}`}>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart 
                      data={workHourLostChartData} 
                      margin={{ top: 30, right: 20, bottom: 0, left: 0 }} 
                      key={`workhourlost-composed-${group}-${groupIdx}`}
                    >
                    <defs>
                      <linearGradient id={`gradient-pink-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#f472b6" stopOpacity={0.4}/>
                      </linearGradient>
                      <filter id={`shadow-pink-${groupIdx}`}>
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ec4899" floodOpacity="0.3"/>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Lost % & Hours', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-pink-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-pink-${groupIdx})`}>
                      <LabelList content={<BarValueLabel />} />
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="lost_pct" name="Work Hour Lost %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                      <LabelList content={<PercentLabelAbove />} />
                    </Line>
                    <Line yAxisId="right" type="monotone" dataKey="lost" name="Work Hours Lost" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                      <LabelList content={<HoursLabel />} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>

            {/* Leave Analysis Chart */}
            <div className="card p-4">
              <div className="mb-2 font-semibold text-gray-700">Leave Analysis Adjacent to Weekend and Holiday</div>
              {isLoadingLeave ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  Loading...
                </div>
              ) : !leaveChartData || leaveChartData.length === 0 ? (
                <div style={{ width: '100%', height: 280 }} className="flex items-center justify-center text-gray-500 text-sm">
                  No leave analysis data available for this group
                </div>
              ) : (
                <div style={{ width: '100%', height: 280, minHeight: 280 }} key={`leave-chart-${group}-${groupIdx}`}>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart 
                      data={leaveChartData} 
                      margin={{ top: 30, right: 20, bottom: 0, left: 0 }} 
                      key={`leave-composed-${group}-${groupIdx}`}
                    >
                        <defs>
                          <linearGradient id={`gradient-purple-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.4}/>
                          </linearGradient>
                          <filter id={`shadow-purple-${groupIdx}`}>
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.3"/>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'SL%, CL% & A%', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-purple-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-purple-${groupIdx})`}>
                          <LabelList content={<BarValueLabel />} />
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="sl_pct" name="SL %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                          <LabelList content={<SLPercentLabel />} />
                        </Line>
                        <Line yAxisId="right" type="monotone" dataKey="cl_pct" name="CL %" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                          <LabelList content={<CLPercentLabel />} />
                        </Line>
                        <Line yAxisId="right" type="monotone" dataKey="a_pct" name="A %" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                          <LabelList content={<APercentLabel />} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
              )}
            </div>
          </div>
        </div>
        )
      })}

      {/* Load More Button */}
      {hasMoreGroups && (
        <div className="flex justify-center gap-4 mt-8 mb-8">
          <button
            onClick={loadMoreGroups}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-lg transform transition-all hover:scale-105 font-medium flex items-center gap-2"
          >
            <span className="lnr lnr-chevron-down"></span>
            Load More ({allGroups.length - visibleGroups} remaining)
          </button>
          <button
            onClick={showAllGroups}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 shadow-lg transform transition-all hover:scale-105 font-medium flex items-center gap-2"
          >
            <span className="lnr lnr-layers"></span>
            Show All ({allGroups.length} groups)
          </button>
        </div>
      )}

      {!hasMoreGroups && allGroups.length > 5 && (
        <div className="text-center text-gray-500 mt-8 mb-8">
          <p className="text-sm">Showing all {allGroups.length} groups</p>
        </div>
      )}
      </div>
    </div>
  )
}
