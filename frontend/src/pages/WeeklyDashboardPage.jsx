import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeeklyAnalysis, listFiles, getFileDetail } from '../lib/api'
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Legend, Bar, Line, CartesianGrid, LabelList } from 'recharts'
import DataTable from '../components/DataTable'

function toWeekLabel(row) {
  if (!row) return ''
  if (row.month_name && row.week_in_month) {
    const weekNum = row.week_in_month
    const suffix = weekNum === 1 ? 'st' : weekNum === 2 ? 'nd' : weekNum === 3 ? 'rd' : 'th'
    return `${weekNum}${suffix} week ${row.month_name}`
  }
  return String(row.week || row)
}

const tabs = [
  { key: 'function', label: 'Function', base: 'function' },
  { key: 'company', label: 'Company', base: 'company' },
  { key: 'location', label: 'Location', base: 'location' },
]

export default function WeeklyDashboardPage() {
  // Load filters from localStorage on mount
  const [active, setActive] = useState(() => {
    const saved = localStorage.getItem('weekly_dashboard_filters')
    if (saved) {
      try {
        const filters = JSON.parse(saved)
        return filters.active || 'function'
      } catch (e) {
        return 'function'
      }
    }
    return 'function'
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const saved = localStorage.getItem('weekly_dashboard_filters')
    if (saved) {
      try {
        const filters = JSON.parse(saved)
        return filters.selectedMonth || ''
      } catch (e) {
        return ''
      }
    }
    return ''
  })
  const [selectedWeeks, setSelectedWeeks] = useState(() => {
    const saved = localStorage.getItem('weekly_dashboard_filters')
    if (saved) {
      try {
        const filters = JSON.parse(saved)
        return filters.selectedWeeks || []
      } catch (e) {
        return []
      }
    }
    return []
  })
  const [visibleGroups, setVisibleGroups] = useState(5)
  const [showUserWiseModal, setShowUserWiseModal] = useState(false)
  const [selectedGroupForModal, setSelectedGroupForModal] = useState('')
  const [selectedMetricForModal, setSelectedMetricForModal] = useState('on_time') // on_time, work_hour, work_hour_lost
  const dashboardRef = useRef(null)
  const groupRefs = useRef({})
  const current = tabs.find(t => t.key === active)
  const baseKey = current?.base || 'function'
  
  const { data: weeklyData = [], isLoading, isError, error } = useQuery({ 
    queryKey: ['weekly_dashboard', baseKey], 
    queryFn: () => getWeeklyAnalysis(baseKey),
    retry: 1,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
    refetchOnMount: true,
    onError: (error) => {
      console.error('[WeeklyDashboard] API error:', error)
      console.error('[WeeklyDashboard] Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        isTimeout: error.message?.includes('timeout') || error.code === 'ECONNABORTED'
      })
    },
    onSuccess: (data) => {
      console.log('[WeeklyDashboard] Data loaded:', data?.length || 0, 'records')
    }
  })

  // Get unique months (combine year and month for proper sorting)
  // Backend returns month as integer (1-12) and year separately
  const months = useMemo(() => {
    const monthYearSet = new Set()
    weeklyData.forEach(r => {
      if (r.year && r.month) {
        // Create YYYY-MM format for proper sorting
        const monthKey = `${r.year}-${String(r.month).padStart(2, '0')}`
        monthYearSet.add(monthKey)
      }
    })
    return Array.from(monthYearSet).sort((a, b) => a.localeCompare(b))
  }, [weeklyData])
  
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  
  // Set default to latest month if not set (only when data is available)
  useEffect(() => {
    if (months.length > 0 && !selectedMonth && weeklyData.length > 0) {
      // Get the latest month (last in sorted array, which is YYYY-MM format)
      const latestMonth = months[months.length - 1]
      setSelectedMonth(latestMonth)
    }
  }, [months, weeklyData.length]) // Remove selectedMonth from deps to avoid loop
  
  // Get weeks for selected month
  const weeksInMonth = selectedMonth 
    ? Array.from(new Set(weeklyData.filter(r => {
        // selectedMonth is in YYYY-MM format, compare with year-month combination
        const rMonthKey = `${r.year}-${String(r.month).padStart(2, '0')}`
        return rMonthKey === selectedMonth
      }).map(r => r.week_in_month).filter(Boolean))).sort()
    : []
  
  // Filter data by month and weeks (default to latest month)
  const filteredData = useMemo(() => {
    return weeklyData.filter(r => {
      if (selectedMonth) {
        // selectedMonth is in YYYY-MM format
        const rMonthKey = `${r.year}-${String(r.month).padStart(2, '0')}`
        if (rMonthKey !== selectedMonth) return false
      }
      // If weeks are selected, filter by them; otherwise show all weeks
      if (selectedWeeks.length > 0) {
        const weekNum = r.week_in_month
        if (!selectedWeeks.includes(weekNum)) return false
      }
      return true
    })
  }, [weeklyData, selectedMonth, selectedWeeks])

  // Group data by group (function/company/location)
  const groupedData = useMemo(() => {
    const groups = new Map()
    for (const row of filteredData) {
      const groupKey = row.group || 'Unknown'
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey).push({
        ...row,
        weekLabel: toWeekLabel(row)
      })
    }
    // Sort each group's data by year, month, week
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        if (a.month !== b.month) return a.month - b.month
        return (a.week_in_month || 0) - (b.week_in_month || 0)
      })
    }
    return groups
  }, [filteredData])

  const allGroups = Array.from(groupedData.keys()).sort()
  const displayedGroups = allGroups.slice(0, visibleGroups)
  const hasMoreGroups = visibleGroups < allGroups.length

  const loadMoreGroups = () => {
    setVisibleGroups(prev => Math.min(prev + 5, allGroups.length))
  }

  const showAllGroups = () => {
    setVisibleGroups(allGroups.length)
  }

  useMemo(() => {
    setVisibleGroups(5)
  }, [active, selectedMonth, selectedWeeks])

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


  // Helper to get chart data by group
  const getChartData = (group) => {
    const groupData = groupedData.get(group) || []
    return groupData
  }

  // Calculate summary statistics for selected weeks (aggregated across all selected weeks)
  const summaryStats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        totalMembers: 0,
        avgOnTime: 0,
        avgCompletion: 0,
        avgLost: 0,
        periodLabel: ''
      }
    }

    // Aggregate data across all selected weeks (or all weeks if none selected)
    const totalMembers = filteredData.reduce((sum, r) => sum + (r.members || 0), 0)
    const totalOnTimeMembers = filteredData.reduce((sum, r) => sum + (r.members || 0), 0)
    const weightedOnTime = filteredData.reduce((sum, r) => sum + ((r.on_time_pct || 0) * (r.members || 0)), 0)
    const avgOnTime = totalOnTimeMembers > 0 ? (weightedOnTime / totalOnTimeMembers).toFixed(2) : 0

    const weightedCompletion = filteredData.reduce((sum, r) => sum + ((r.completion_pct || 0) * (r.members || 0)), 0)
    const avgCompletion = totalOnTimeMembers > 0 ? (weightedCompletion / totalOnTimeMembers).toFixed(2) : 0

    const weightedLost = filteredData.reduce((sum, r) => sum + ((r.lost_pct || 0) * (r.members || 0)), 0)
    const avgLost = totalOnTimeMembers > 0 ? (weightedLost / totalOnTimeMembers).toFixed(2) : 0

    // Average Work Hour Lost in Hours - weighted by members
    const weightedLostHours = filteredData.reduce((sum, r) => sum + ((r.lost || 0) * (r.members || 0)), 0)
    const avgLostHours = totalOnTimeMembers > 0 ? (weightedLostHours / totalOnTimeMembers).toFixed(2) : 0

    // Generate period label based on selected weeks
    let periodLabel = ''
    if (selectedMonth) {
      const [year, monthNum] = selectedMonth.split('-')
      const month = parseInt(monthNum, 10)
      const monthName = monthNames[month] || `Month ${month}`
      
      if (selectedWeeks.length === 0) {
        periodLabel = `All Weeks ${monthName} ${year}`
      } else if (selectedWeeks.length === 1) {
        const week = selectedWeeks[0]
        const suffix = week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'
        periodLabel = `${week}${suffix} week ${monthName} ${year}`
      } else {
        // Multiple weeks selected
        const sortedWeeks = [...selectedWeeks].sort((a, b) => a - b)
        const weekLabels = sortedWeeks.map(w => {
          const suffix = w === 1 ? 'st' : w === 2 ? 'nd' : w === 3 ? 'rd' : 'th'
          return `${w}${suffix}`
        })
        periodLabel = `Weeks ${weekLabels.join(', ')} ${monthName} ${year}`
      }
    }

    return {
      totalMembers,
      avgOnTime,
      avgCompletion,
      avgLost,
      avgLostHours,
      periodLabel
    }
  }, [filteredData, selectedMonth, selectedWeeks])

  const hasAnyData = filteredData.length > 0

  if (allGroups.length === 0 && !isLoading) {
    return (
      <div className="space-y-6">
        {isError && (
          <div className="card p-4 bg-red-50 border border-red-200">
            <div className="text-red-800 font-semibold mb-2">Error Loading Data</div>
            <div className="text-red-600 text-sm">
              {error?.response?.data?.detail || error?.message || 'Failed to load weekly dashboard data.'}
              {(error?.message?.includes('timeout') || error?.code === 'ECONNABORTED') && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-yellow-800 text-xs">
                    <strong>Timeout Error:</strong> The data is taking longer than expected to process. 
                    This usually happens with large datasets. The timeout has been increased to 2 minutes. 
                    Please try refreshing the page, or contact support if the issue persists.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Retry Loading
              </button>
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
        {!isError && <div className="text-sm text-gray-500">No weekly data for charts.</div>}
      </div>
    )
  }

  if (isLoading && !hasAnyData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          </div>
          <p className="text-gray-600 font-medium mb-2">Loading Weekly Dashboard Data...</p>
          <p className="text-sm text-gray-500 mt-2 mb-4">Processing weekly attendance data, this may take a minute...</p>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 animate-pulse"
              style={{ width: '60%' }}
            ></div>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            Large datasets may take up to 2 minutes to process...
          </p>
        </div>
      </div>
    )
  }

  // Calculate loading progress (since we have one query, we'll simulate progress)
  const loadingProgress = isLoading ? 50 : 100

  return (
    <div className="space-y-8">
      {isError && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="text-red-800 font-semibold mb-2">Error Loading Data</div>
          <div className="text-red-600 text-sm">
            {error?.response?.data?.detail || error?.message || 'Failed to load weekly dashboard data. Please check your connection and try again.'}
            {(error?.message?.includes('timeout') || error?.code === 'ECONNABORTED') && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800 text-xs">
                  <strong>Timeout Error:</strong> The data is taking longer than expected to process. 
                  This usually happens with large datasets. The timeout has been increased to 2 minutes. 
                  Please try refreshing the page, or contact support if the issue persists.
                </p>
              </div>
            )}
          </div>
          <div className="mt-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Retry Loading
            </button>
          </div>
        </div>
      )}

      {/* Loading Indicator for Initial Load */}
      {isLoading && (
        <div className="card p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-3 border-blue-600"></div>
              <p className="text-gray-700 font-medium">Loading weekly dashboard data...</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className={`flex items-center gap-2 ${!isLoading ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`lnr ${!isLoading ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoading ? 'animate-spin' : ''}`}></span>
                <span>On Time %</span>
              </div>
              <div className={`flex items-center gap-2 ${!isLoading ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`lnr ${!isLoading ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoading ? 'animate-spin' : ''}`}></span>
                <span>Work Hour</span>
              </div>
              <div className={`flex items-center gap-2 ${!isLoading ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`lnr ${!isLoading ? 'lnr-checkmark-circle' : 'lnr-sync'} ${isLoading ? 'animate-spin' : ''}`}></span>
                <span>Work Hour Lost</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${isLoading ? 50 : 100}%` }}
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
              {summaryStats.periodLabel && (
                <p className="text-xs text-blue-100 mt-2 opacity-90">{summaryStats.periodLabel}</p>
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
              {summaryStats.periodLabel && (
                <p className="text-xs text-green-100 mt-2 opacity-90">{summaryStats.periodLabel}</p>
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
              {summaryStats.periodLabel && (
                <p className="text-xs text-indigo-100 mt-2 opacity-90">{summaryStats.periodLabel}</p>
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
              {summaryStats.periodLabel && (
                <p className="text-xs text-orange-100 mt-2 opacity-90">{summaryStats.periodLabel}</p>
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
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm text-gray-600">Month:</label>
          <select 
            className="btn-outline" 
            value={selectedMonth || ''} 
            onChange={e => {
              setSelectedMonth(e.target.value)
              setSelectedWeeks([]) // Clear selected weeks when month changes
            }}
          >
            <option value="">All Months</option>
            {months.map(m => {
              // m is in YYYY-MM format
              const [year, monthNum] = m.split('-')
              const month = parseInt(monthNum, 10)
              return (
                <option key={m} value={m}>
                  {monthNames[month] || `Month ${month}`} {year}
                </option>
              )
            })}
          </select>
          
          <label className="text-sm text-gray-600">Week:</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (selectedWeeks.length === weeksInMonth.length) {
                  setSelectedWeeks([])
                } else {
                  setSelectedWeeks([...weeksInMonth])
                }
              }}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                selectedWeeks.length === weeksInMonth.length && weeksInMonth.length > 0
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              disabled={!selectedMonth || weeksInMonth.length === 0}
            >
              {selectedWeeks.length === weeksInMonth.length && weeksInMonth.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
            {weeksInMonth.map(w => {
              const isSelected = selectedWeeks.includes(w)
              const suffix = w === 1 ? 'st' : w === 2 ? 'nd' : w === 3 ? 'rd' : 'th'
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedWeeks(selectedWeeks.filter(sw => sw !== w))
                    } else {
                      setSelectedWeeks([...selectedWeeks, w].sort((a, b) => a - b))
                    }
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={!selectedMonth}
                >
                  {w}{suffix} week
                </button>
              )
            })}
          </div>
        </div>
      </div>
      
      <div ref={dashboardRef}>
        {displayedGroups.map((group, groupIdx) => {
          const chartData = getChartData(group)
          if (chartData.length === 0) return null

          return (
            <div key={group} ref={el => groupRefs.current[group] = el} className="space-y-4">
              <h2 className="text-xl font-semibold">{group}</h2>
              
              {/* Row 1: On Time % and Work Hour Completion */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* On Time % Chart */}
                <div className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-gray-700">On Time %</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroupForModal(group)
                        setSelectedMetricForModal('on_time')
                        setShowUserWiseModal(true)
                      }}
                      className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                      title="View user-wise On Time % data for this group"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      View Users
                    </button>
                  </div>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={chartData} margin={{ top: 30, right: 20, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={`gradient-blue-w-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.4}/>
                          </linearGradient>
                          <filter id={`shadow-w-${groupIdx}`}>
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.3"/>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'On Time %', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-blue-w-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-w-${groupIdx})`}>
                          <LabelList content={<BarValueLabel />} />
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="on_time_pct" name="On Time %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                          <LabelList content={<PercentLabel />} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Work Hour Completion Chart */}
                <div className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-gray-700">Work Hour Completion</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroupForModal(group)
                        setSelectedMetricForModal('work_hour')
                        setShowUserWiseModal(true)
                      }}
                      className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                      title="View user-wise Work Hour Completion data for this group"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      View Users
                    </button>
                  </div>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={chartData} margin={{ top: 30, right: 20, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={`gradient-green-w-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#34d399" stopOpacity={0.4}/>
                          </linearGradient>
                          <filter id={`shadow-green-w-${groupIdx}`}>
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.3"/>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Completion %', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-green-w-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-green-w-${groupIdx})`}>
                          <LabelList content={<BarValueLabel />} />
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="completion_pct" name="Completion %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                          <LabelList content={<PercentLabel />} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Row 2: Work Hour Lost */}
              <div className="grid grid-cols-1 gap-4">
                {/* Work Hour Lost Chart */}
                <div className="card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-gray-700">Work Hour Lost</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGroupForModal(group)
                        setSelectedMetricForModal('work_hour_lost')
                        setShowUserWiseModal(true)
                      }}
                      className="px-4 py-2 text-sm font-semibold bg-pink-600 text-white rounded-lg hover:bg-pink-700 active:bg-pink-800 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
                      title="View user-wise Work Hour Lost data for this group"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      View Users
                    </button>
                  </div>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={chartData} margin={{ top: 30, right: 20, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={`gradient-pink-w-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#f472b6" stopOpacity={0.4}/>
                          </linearGradient>
                          <filter id={`shadow-pink-w-${groupIdx}`}>
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ec4899" floodOpacity="0.3"/>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Lost % & Hours', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-pink-w-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-pink-w-${groupIdx})`}>
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
                </div>
              </div>
            </div>
          )
        })}
      </div>

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

      {/* User-wise Modal */}
      {showUserWiseModal && (
        <UserWiseModal
          group={selectedGroupForModal}
          month={selectedMonth}
          weeks={selectedWeeks}
          groupBy={baseKey}
          metric={selectedMetricForModal}
          onClose={() => setShowUserWiseModal(false)}
        />
      )}
    </div>
  )
}

// User-wise Modal Component
function UserWiseModal({ group, month, weeks, groupBy, metric, onClose }) {
  const [isLoading, setIsLoading] = useState(true)
  const [userData, setUserData] = useState([])
  
  const metricLabels = {
    on_time: 'On Time %',
    work_hour: 'Work Hour Completion',
    work_hour_lost: 'Work Hour Lost'
  }

  // Helper functions (same as UserWisePage)
  const monthOf = (dateStr) => {
    if (!dateStr) return ''
    const s = String(dateStr)
    let m = s.match(/(20\d{2})[-/](\d{1,2})/)
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`
    m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](20\d{2})/)
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}`
    const monthNames = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
      january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
      august: 8, september: 9, october: 10, november: 11, december: 12,
    }
    const lower = s.toLowerCase()
    const yearMatch = lower.match(/(20\d{2})/)
    const monthMatch = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)/)
    if (yearMatch && monthMatch) {
      const year = yearMatch[1]
      const monthNum = String(monthNames[monthMatch[1]]).padStart(2, '0')
      return `${year}-${monthNum}`
    }
    return s
  }

  const getWeekOfMonth = (dateStr) => {
    if (!dateStr) return 0
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return 0
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
      const dayOfMonth = date.getDate()
      return Math.ceil((dayOfMonth + firstDay.getDay()) / 7)
    } catch {
      return 0
    }
  }

  const getCompanyShortName = (companyName) => {
    if (!companyName) return ''
    const name = String(companyName).trim()
    // Map company names to their short codes (matching backend _get_company_short_name)
    // Handle variations in company name formatting
    const companyMap = {
      'Confidence Batteries Limited': 'CBL',
      'Confidence Batteries Limited.': 'CBL',
      'Confidence Infrastructure PLC.': 'CIPLC',
      'Confidence Infrastructure PLC': 'CIPLC',
      'Confidence Steel Export Limited': 'CSEL',
      'Confidence Steel Export Limited.': 'CSEL',
    }
    // Try exact match first
    if (companyMap[name]) {
      return companyMap[name]
    }
    // Try case-insensitive match
    const nameLower = name.toLowerCase()
    for (const [key, value] of Object.entries(companyMap)) {
      if (key.toLowerCase() === nameLower) {
        return value
      }
    }
    // If no match, return original name (backend returns original if not in map)
    return name
  }

  const getGroupValue = (row) => {
    if (groupBy === 'function') {
      const company = String(row['Company Name'] || row['Comapny Name'] || '').trim()
      let functionName = String(row['Function Name'] || '').trim()
      
      // Extract base function name (remove company suffix patterns like " - CIPLC & CBL")
      // This matches the backend logic in weekly_analysis.py
      if (functionName) {
        const parts = functionName.split(' - ')
        if (parts.length > 1) {
          const lastPart = parts[parts.length - 1].trim().toUpperCase()
          // Check if last part looks like company abbreviations (CBL, CIPLC, CSEL, etc.)
          const companyAbbrevs = ['CBL', 'CIPLC', 'CSEL']
          if (companyAbbrevs.some(abbrev => lastPart.includes(abbrev))) {
            // Remove the company suffix
            functionName = parts.slice(0, -1).join(' - ').trim()
          }
        }
      }
      
      // Match the format used in backend (CompanyShort - BaseFunction)
      if (company && functionName) {
        const companyShort = getCompanyShortName(company)
        return `${companyShort} - ${functionName}`
      }
      return functionName || company || ''
    } else if (groupBy === 'company') {
      const company = String(row['Company Name'] || row['Comapny Name'] || '').trim()
      return getCompanyShortName(company) || company
    } else if (groupBy === 'location') {
      return String(row['Job Location'] || '').trim()
    }
    return ''
  }

  // Normalize group names for comparison (handle spacing variations, case, special chars)
  const normalizeGroupName = (name) => {
    if (!name) return ''
    // Normalize whitespace, trim, and make case-insensitive comparison
    return String(name).replace(/\s+/g, ' ').trim()
  }
  
  // Compare group names (handles variations in spacing and case)
  const groupsMatch = (group1, group2) => {
    if (!group1 || !group2) return false
    const norm1 = normalizeGroupName(group1)
    const norm2 = normalizeGroupName(group2)
    // Case-insensitive comparison
    return norm1.toLowerCase() === norm2.toLowerCase()
  }

  // Fetch and calculate user-wise data
  useEffect(() => {
    const fetchAndCalculate = async () => {
      setIsLoading(true)
      try {
        const fileList = await listFiles()
        const allRows = []
        for (const file of fileList) {
          try {
            const detail = await getFileDetail(file.id)
            if (detail.rows) {
              allRows.push(...detail.rows)
            }
          } catch (e) {
            console.error(`Error loading file ${file.id}:`, e)
          }
        }

        // Helper function to convert time string to hours (matching backend _time_to_hours)
        const timeToHours = (timeStr) => {
          if (!timeStr) return 0.0
          const s = String(timeStr).trim()
          
          // Try to parse as datetime first (handles formats like "2024-05-01 09:00:00")
          try {
            // Try format: "YYYY-MM-DD HH:MM:SS"
            const dtMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2}):(\d{2})$/)
            if (dtMatch) {
              const h = parseInt(dtMatch[4], 10)
              const m = parseInt(dtMatch[5], 10)
              const sec = parseInt(dtMatch[6], 10)
              return h + m / 60.0 + sec / 3600.0
            }
          } catch {}
          
          // Try other datetime formats
          try {
            const dt = new Date(s)
            if (!isNaN(dt.getTime())) {
              return dt.getHours() + dt.getMinutes() / 60.0 + dt.getSeconds() / 3600.0
            }
          } catch {}
          
          // Fallback: parse as HH:MM or HH:MM:SS
          const parts = s.split(/[:.]/)
          if (parts.length >= 2) {
            try {
              const h = parseInt(parts[0], 10)
              const m = parseInt(parts[1], 10)
              const sec = parts.length > 2 ? parseInt(parts[2], 10) : 0
              return h + m / 60.0 + sec / 3600.0
            } catch {
              return 0.0
            }
          }
          return 0.0
        }

        // Calculate metrics per user based on selected metric type
        const userDataMap = new Map()
        
        // Debug: Log the expected group and sample groups found
        console.log('[UserWiseModal] Expected group:', group)
        console.log('[UserWiseModal] Metric:', metric)
        console.log('[UserWiseModal] Group by:', groupBy)
        console.log('[UserWiseModal] Month:', month)
        console.log('[UserWiseModal] Weeks:', weeks)

        // First pass: collect unique groups for debugging (filtered by month/week only)
        const uniqueGroupsInData = new Set()
        for (const r of allRows) {
          const rowMonth = monthOf(r['Attendance Date'] || '')
          const rowWeek = getWeekOfMonth(r['Attendance Date'] || '')
          if (month && rowMonth !== month) continue
          if (weeks.length > 0 && !weeks.includes(rowWeek)) continue
          const rowGroup = getGroupValue(r)
          if (rowGroup) uniqueGroupsInData.add(rowGroup)
        }
        console.log('[UserWiseModal] Unique groups in data (matching month/week):', Array.from(uniqueGroupsInData).sort().slice(0, 20))

        let matchedRows = 0
        let totalRows = 0

        for (const r of allRows) {
          totalRows++
          const rowMonth = monthOf(r['Attendance Date'] || '')
          const rowWeek = getWeekOfMonth(r['Attendance Date'] || '')
          const rowGroup = getGroupValue(r)

          // Filter by group, month, and weeks (normalize for comparison)
          if (group) {
            if (!groupsMatch(rowGroup, group)) {
              continue
            }
          }
          if (month && rowMonth !== month) continue
          if (weeks.length > 0 && !weeks.includes(rowWeek)) continue
          
          matchedRows++

          const empCode = String(r['Employee Code'] || '').trim()
          const empName = String(r['Name'] || '').trim()
          const userKey = empCode || empName

          if (!userKey) continue

          const userDisplay = empCode && empName 
            ? `${empName} (${empCode})`
            : empCode || empName

          const flag = String(r['Flag'] || '').trim()

          // Initialize user data based on metric type
          if (!userDataMap.has(userKey)) {
            if (metric === 'on_time') {
              userDataMap.set(userKey, {
                user: userDisplay,
                company: String(r['Company Name'] || r['Comapny Name'] || '').trim(),
                function: String(r['Function Name'] || '').trim(),
                members: new Set(),
                present: 0,
                late: 0,
                onTime: 0,
              })
            } else if (metric === 'work_hour') {
              userDataMap.set(userKey, {
                user: userDisplay,
                company: String(r['Company Name'] || r['Comapny Name'] || '').trim(),
                function: String(r['Function Name'] || '').trim(),
                members: new Set(),
                shiftHoursSum: 0,
                workHoursSum: 0,
                completedCount: 0,
                totalCount: 0,
              })
            } else if (metric === 'work_hour_lost') {
              userDataMap.set(userKey, {
                user: userDisplay,
                company: String(r['Company Name'] || r['Comapny Name'] || '').trim(),
                function: String(r['Function Name'] || '').trim(),
                members: new Set(),
                shiftHoursSum: 0,
                workHoursSum: 0,
                lostHoursSum: 0,
              })
            }
          }

          const data = userDataMap.get(userKey)
          data.members.add(userKey)

          // Calculate based on metric type
          if (metric === 'on_time') {
            const isLate = String(r['Is Late'] || '').trim().toLowerCase() === 'yes'
            if (flag === 'P') {
              data.present += 1
              if (isLate) {
                data.late += 1
              } else {
                data.onTime += 1
              }
            }
          } else if (metric === 'work_hour') {
            // Only count P and OD flags for Work Hour Completion
            if (flag !== 'P' && flag !== 'OD') continue
            if (flag === 'W' || flag === 'H') continue // Skip weekends and holidays

            const shiftIn = timeToHours(r['Shift In Time'] || '')
            const shiftOut = timeToHours(r['Shift Out Time'] || '')
            const inTime = timeToHours(r['In Time'] || '')
            const outTime = timeToHours(r['Out Time'] || '')

            if (shiftIn > 0 && shiftOut > 0) {
              const shiftHours = shiftOut - shiftIn
              if (shiftHours > 0) {
                data.shiftHoursSum += shiftHours
                data.totalCount += 1

                if (inTime > 0 && outTime > 0) {
                  const workHours = outTime - inTime
                  if (workHours > 0) {
                    data.workHoursSum += workHours
                    // Completion: work hours >= shift hours (100% completion)
                    if (workHours >= shiftHours) {
                      data.completedCount += 1
                    }
                  }
                }
              }
            }
          } else if (metric === 'work_hour_lost') {
            // Backend processes ALL rows (except W and H), but only calculates lost hours for P/OD/blank
            // Other flags (A, L, etc.) still contribute to shift/work hours but not lost hours
            const flagStr = String(flag).trim()
            
            // Skip weekends and holidays (Flag="W" or "H") for work hour lost calculations
            // This matches backend: if flag == "W" or flag == "H": continue
            if (flagStr === 'W' || flagStr === 'H') continue
            
            const shiftInStr = String(r['Shift In Time'] || '').trim()
            const shiftOutStr = String(r['Shift Out Time'] || '').trim()
            const inTimeStr = String(r['In Time'] || '').trim()
            const outTimeStr = String(r['Out Time'] || '').trim()

            // Calculate lost hours per day (matching backend logic exactly)
            // Backend uses _compute_duration_hours which handles overnight shifts
            const computeDurationHours = (startStr, endStr) => {
              if (!startStr || !endStr) return 0.0
              const startH = timeToHours(startStr)
              const endH = timeToHours(endStr)
              if (startH === 0.0 || endH === 0.0) return 0.0
              // Handle overnight shifts (e.g., 22:00 to 06:00)
              // If end time is earlier than start time, it's an overnight shift
              const finalEndH = endH < startH ? endH + 24.0 : endH
              return Math.max(0, finalEndH - startH)
            }

            const shiftHrs = computeDurationHours(shiftInStr, shiftOutStr)
            const workHrs = computeDurationHours(inTimeStr, outTimeStr)

            // Calculate lost hours per person per day: if shift is 9h and work is 8h, lost = 1h
            // This matches backend logic in work_hour_lost.py lines 173-200
            // Backend: if shift_hrs > 0: (processes all rows with shift hours, regardless of flag)
            if (shiftHrs > 0) {
              const shiftHrsRounded = Number(shiftHrs.toFixed(2))
              const workHrsRounded = Number(workHrs.toFixed(2))

              // Always add shift and work hours for ALL flags (matching backend)
              // Backend: shift_hours_sum[key] += shift_hrs and work_hours_sum[key] += work_hrs
              data.shiftHoursSum = (data.shiftHoursSum || 0) + shiftHrsRounded
              data.workHoursSum = (data.workHoursSum || 0) + workHrsRounded

              // Lost-hour business rule (matching backend exactly):
              // We count loss ONLY for Present, OD, and blank-flag days.
              // - P/OD/blank + work > 0    → partial loss = shift - work (clamped at 0)
              // - P/OD/blank + work == 0   → full shift lost
              // - others (A, L, etc.) → no loss (but still counted in shift/work hours above)
              const countableFlags = ['P', 'OD', '']
              let lostHrs = 0.0
              if (countableFlags.includes(flagStr)) {
                if (workHrsRounded > 0) {
                  // Partial loss: shift - work (clamped at 0)
                  // If work > shift on this day, lost = 0 (correct per-day calculation)
                  // This is why total work > total shift can still have lost hours:
                  // Day 1: shift 8h, work 9h → lost 0h
                  // Day 2: shift 8h, work 7h → lost 1h
                  // Total: shift 16h, work 16h, lost 1h
                  lostHrs = Math.max(0.0, shiftHrsRounded - workHrsRounded)
                } else {
                  // Present/OD/blank but no in/out → full shift lost
                  lostHrs = shiftHrsRounded
                }
              } else {
                // Other flags (A, L, W, H, etc.) → no loss
                // But shift/work hours were already added above
                lostHrs = 0.0
              }
              
              lostHrs = Number(lostHrs.toFixed(2))
              data.lostHoursSum = (data.lostHoursSum || 0) + lostHrs
            }
          }
        }

        // Convert to array and calculate percentages/metrics
        const results = []
        for (const [key, data] of userDataMap.entries()) {
          if (metric === 'on_time') {
            const totalPresent = data.present
            const onTimePct = totalPresent > 0 ? ((data.onTime / totalPresent) * 100).toFixed(2) : '0.00'
            results.push({
              user: data.user,
              company: data.company,
              function: data.function,
              members: data.members.size,
              present: totalPresent,
              late: data.late,
              onTime: data.onTime,
              onTimePct: `${onTimePct}%`,
            })
          } else if (metric === 'work_hour') {
            const completionPct = data.totalCount > 0
              ? ((data.completedCount / data.totalCount) * 100).toFixed(2)
              : '0.00'
            results.push({
              user: data.user,
              company: data.company,
              function: data.function,
              members: data.members.size,
              totalDays: data.totalCount,
              completedDays: data.completedCount,
              completionPct: `${completionPct}%`,
            })
          } else if (metric === 'work_hour_lost') {
            const totalShiftHours = data.shiftHoursSum || 0
            const totalWorkHours = data.workHoursSum || 0
            const totalLostHours = data.lostHoursSum || 0
            const lostPct = totalShiftHours > 0
              ? ((totalLostHours / totalShiftHours) * 100).toFixed(2)
              : '0.00'
            results.push({
              user: data.user,
              company: data.company,
              function: data.function,
              members: data.members.size,
              shiftHours: totalShiftHours.toFixed(2),
              workHours: totalWorkHours.toFixed(2),
              lostHours: totalLostHours.toFixed(2),
              lostPct: `${lostPct}%`,
            })
          }
        }

        console.log('[UserWiseModal] Matched rows:', matchedRows, 'out of', totalRows)
        console.log('[UserWiseModal] User data results:', results.length)
        
        setUserData(results.sort((a, b) => a.user.localeCompare(b.user)))
      } catch (error) {
        console.error('Error fetching user-wise data:', error)
        setUserData([])
      } finally {
        setIsLoading(false)
      }
    }

    if (group && month) {
      fetchAndCalculate()
    }
  }, [group, month, weeks, groupBy, metric])

  // Get columns based on metric type
  const columns = useMemo(() => {
    if (metric === 'on_time') {
      return [
        { key: 'user', label: 'User' },
        { key: 'company', label: 'Company' },
        { key: 'function', label: 'Function' },
        { key: 'members', label: 'Members' },
        { key: 'present', label: 'Present' },
        { key: 'late', label: 'Late' },
        { key: 'onTime', label: 'On Time' },
        { key: 'onTimePct', label: 'On Time %' },
      ]
    } else if (metric === 'work_hour') {
      return [
        { key: 'user', label: 'User' },
        { key: 'company', label: 'Company' },
        { key: 'function', label: 'Function' },
        { key: 'members', label: 'Members' },
        { key: 'totalDays', label: 'Total Days' },
        { key: 'completedDays', label: 'Completed Days' },
        { key: 'completionPct', label: 'Completion %' },
      ]
    } else if (metric === 'work_hour_lost') {
      return [
        { key: 'user', label: 'User' },
        { key: 'company', label: 'Company' },
        { key: 'function', label: 'Function' },
        { key: 'members', label: 'Members' },
        { key: 'shiftHours', label: 'Shift Hours' },
        { key: 'workHours', label: 'Work Hours' },
        { key: 'lostHours', label: 'Lost Hours' },
        { key: 'lostPct', label: 'Lost %' },
      ]
    }
    return []
  }, [metric])

  const monthLabel = month ? (() => {
    const [year, monthNum] = month.split('-')
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    return `${monthNames[parseInt(monthNum, 10)]} ${year}`
  })() : ''

  const weeksLabel = weeks.length > 0 
    ? weeks.map(w => {
        const suffix = w === 1 ? 'st' : w === 2 ? 'nd' : w === 3 ? 'rd' : 'th'
        return `${w}${suffix} week`
      }).join(', ')
    : 'All Weeks'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">User-wise {metricLabels[metric] || 'On Time %'}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {group} - {monthLabel} - {weeksLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <span className="lnr lnr-cross text-2xl"></span>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading user data...</p>
              </div>
            </div>
          ) : userData.length > 0 ? (
            <DataTable columns={columns} rows={userData} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No user data available for the selected filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
