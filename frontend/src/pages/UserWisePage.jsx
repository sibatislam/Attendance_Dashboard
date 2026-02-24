import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listFiles, getFileDetail, getODAnalysis, getCtcPerHour, getCtcPerHourByFunction } from '../lib/api'
import DataTable from '../components/DataTable'
import MultiSelectSearchable from '../components/MultiSelectSearchable'
import { useScopeFilterOptions } from '../hooks/useScopeFilterOptions'

// Remove "Mr. " from the start of names (case-insensitive) for display
function stripMr(name) {
  if (!name || typeof name !== 'string') return name ? String(name).trim() : ''
  const s = String(name).trim()
  if (/^Mr\.\s+/i.test(s)) return s.replace(/^Mr\.\s+/i, '').trim()
  return s
}

const ALL_TABS = [
  { key: 'on_time', label: 'On Time %' },
  { key: 'work_hour', label: 'Work Hour Completion' },
  { key: 'work_hour_lost', label: 'Work Hour Lost' },
  { key: 'work_hour_lost_cost', label: 'Lost Hours Cost' },
  { key: 'leave_analysis', label: 'Leave Analysis' },
  { key: 'od_analysis', label: 'OD Analysis' },
]

export default function UserWisePage() {
  const scopeFilter = useScopeFilterOptions()
  const tabs = useMemo(() => {
    const keys = scopeFilter.visibleTabKeysUserWise || []
    if (scopeFilter.isLoading && keys.length === 0) return []
    if (keys.length === 0) return ALL_TABS
    const visible = ALL_TABS.filter(t => keys.includes(t.key))
    return visible.length ? visible : ALL_TABS
  }, [scopeFilter.visibleTabKeysUserWise, scopeFilter.isLoading])
  const [activeTab, setActiveTab] = useState(() => tabs[0]?.key || 'on_time')
  const tabKeys = useMemo(() => tabs.map(t => t.key), [tabs])
  useEffect(() => {
    if (tabKeys.length && !tabKeys.includes(activeTab)) {
      setActiveTab(tabKeys[0])
    }
  }, [activeTab, tabKeys])
  const [selectedCompanies, setSelectedCompanies] = useState([])
  const [selectedFunctions, setSelectedFunctions] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [selectedMonths, setSelectedMonths] = useState([])
  const [selectedWeeks, setSelectedWeeks] = useState([])
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [detailRow, setDetailRow] = useState(null)

  const { data: files = [] } = useQuery({
    queryKey: ['files'],
    queryFn: listFiles,
  })

  // Fetch all rows from all files
  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ['all_file_rows'],
    queryFn: async () => {
      const fileList = await listFiles()
      const rows = []
      for (const file of fileList) {
        try {
          const detail = await getFileDetail(file.id)
          if (detail.rows) {
            rows.push(...detail.rows)
          }
        } catch (e) {
          console.error(`Error loading file ${file.id}:`, e)
        }
      }
      return rows
    },
    enabled: files.length > 0,
  })

  // OD Analysis (employee-wise) for OD tab
  const { data: odData = [] } = useQuery({
    queryKey: ['od_analysis', 'employee'],
    queryFn: () => getODAnalysis('employee'),
    retry: 0,
  })

  // CTC per hour (for Lost Hours Cost tab)
  const { data: ctcData } = useQuery({ queryKey: ['ctc-per-hour'], queryFn: getCtcPerHour })
  const { data: ctcByFunctionData } = useQuery({ queryKey: ['ctc-per-hour-by-function'], queryFn: getCtcPerHourByFunction })
  const ctcPerHour = ctcData?.ctc_per_hour_bdt ?? null
  const ctcByFunction = ctcByFunctionData?.ctc_by_function && typeof ctcByFunctionData.ctc_by_function === 'object'
    ? ctcByFunctionData.ctc_by_function
    : {}

  // Restrict data to user's allowed companies, functions, departments (so they never see other data)
  const scopedRows = useMemo(() => {
    // While scope is loading, show no data so we don't flash all data to a restricted user
    if (scopeFilter.isLoading) return []
    if (scopeFilter.all || !Array.isArray(allRows) || allRows.length === 0) return allRows
    const allowedCompanies = scopeFilter.companies || []
    const allowedFunctionNames = (scopeFilter.functions || []).map(f => (f && typeof f === 'object' && f.name) ? f.name : f)
    const allowedDepartmentNames = (scopeFilter.departments || []).map(d => (d && typeof d === 'object' && d.name) ? d.name : d)
    // If we have explicit scope lists from API, filter even when "all" was returned (defensive)
    const hasExplicitScope = allowedCompanies.length > 0 || allowedFunctionNames.length > 0 || allowedDepartmentNames.length > 0
    if (!hasExplicitScope) return allRows
    // Lenient match so N-1 scope works when hierarchy names differ slightly from attendance (e.g. "Finance" vs "Finance & Accounts")
    const functionMatches = (rowFunc, allowedList) => {
      if (!allowedList.length) return true
      const r = (rowFunc || '').toLowerCase()
      return allowedList.some(a => {
        const al = (a || '').toLowerCase()
        return al === r || r.includes(al) || al.includes(r)
      })
    }
    const deptMatches = (rowDepts, allowedList) => {
      if (!allowedList.length) return true
      return rowDepts.some(d => {
        const rd = (d || '').toLowerCase()
        return allowedList.some(a => {
          const al = (a || '').toLowerCase()
          return al === rd || rd.includes(al) || al.includes(rd)
        })
      })
    }
    return allRows.filter(r => {
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const deptStr = String(r['Department Name'] || r['Department'] || '').trim()
      const rowDepts = deptStr ? deptStr.split(',').map(d => d.trim()).filter(Boolean) : []
      const companyOk = allowedCompanies.length === 0 || allowedCompanies.includes(company)
      const functionOk = functionMatches(functionName, allowedFunctionNames)
      const deptOk = allowedDepartmentNames.length === 0 || deptMatches(rowDepts, allowedDepartmentNames)
      return companyOk && functionOk && deptOk
    })
  }, [allRows, scopeFilter.all, scopeFilter.isLoading, scopeFilter.companies, scopeFilter.functions, scopeFilter.departments])

  // Helper: get date value from row (multiple possible column names)
  const getDateFromRow = (r) => {
    if (!r || typeof r !== 'object') return ''
    const v = r['Attendance Date'] ?? r['Attendance date'] ?? r['Date'] ?? r['AttendanceDate'] ?? ''
    return v != null && String(v).trim() !== '' ? String(v).trim() : ''
  }

  // Helper: normalize to YYYY-MM; handle Excel serial, ISO, DD-MM-YYYY, month names, etc.
  const monthOf = (dateStr) => {
    if (dateStr == null || String(dateStr).trim() === '') return ''
    const s = String(dateStr).trim()
    // Excel serial date (days since 1899-12-30)
    const num = Number(s)
    if (!Number.isNaN(num) && num > 0 && num < 100000) {
      try {
        const d = new Date((num - 25569) * 86400 * 1000)
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          return `${y}-${m}`
        }
      } catch {}
    }
    // YYYY-MM or YYYY-M
    let m = s.match(/(20\d{2})[-/](\d{1,2})/)
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}`
    // DD-MM-YYYY or D-M-YYYY
    m = s.match(/(\d{1,2})[-/](\d{1,2})[-/](20\d{2})/)
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}`
    // Month names (e.g. 15-Jan-2025, January 2025)
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
      const month = String(monthNames[monthMatch[1]] || 1).padStart(2, '0')
      return `${year}-${month}`
    }
    // Try JS Date parse as last resort
    try {
      const d = new Date(s)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const mo = String(d.getMonth() + 1).padStart(2, '0')
        return `${y}-${mo}`
      }
    } catch {}
    return ''
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

  const timeToHours = (timeStr) => {
    if (!timeStr) return 0.0
    const s = String(timeStr).trim()
    try {
      const dt = new Date(s)
      if (!isNaN(dt.getTime())) {
        return dt.getHours() + dt.getMinutes() / 60.0 + dt.getSeconds() / 3600.0
      }
    } catch {}
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

  // Compute On Time % per user
  const computeOnTimeUserWise = useMemo(() => {
    const userData = new Map()

    for (const r of scopedRows) {
      const dateVal = getDateFromRow(r)
      const month = monthOf(dateVal)
      const week = getWeekOfMonth(dateVal || r['Attendance Date'])
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const deptStr = String(r['Department Name'] || r['Department'] || '').trim()
      const rowDepts = deptStr ? deptStr.split(',').map(d => d.trim()).filter(Boolean) : []
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = stripMr(String(r['Name'] || ''))
      const userKey = empCode || empName

      if (!userKey) continue

      // Format user display for filter matching
      const userDisplay = empCode && empName 
        ? `${empName} (${empCode})`
        : empCode || empName

      // Apply filters (when no month/week selected, include all)
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(functionName)) continue
      if (selectedDepartments.length > 0 && !rowDepts.some(d => selectedDepartments.includes(d))) continue
      if (selectedUsers.length > 0 && !selectedUsers.includes(userDisplay)) continue
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) continue
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(week))) continue

      const key = userKey
      if (!userData.has(key)) {
        // Format user display: "Name (ID)" or "ID" if no name, or "Name" if no ID
        const userDisplay = empCode && empName 
          ? `${empName} (${empCode})`
          : empCode || empName
        
        userData.set(key, {
          user: userDisplay,
          userId: empCode,
          userName: empName,
          company,
          function: functionName,
          departments: new Set(),
          members: new Set(),
          present: 0,
          late: 0,
          onTime: 0,
        })
      }

      const data = userData.get(key)
      data.members.add(userKey)
      rowDepts.forEach(d => data.departments.add(d))
      const flag = String(r['Flag'] || '').trim()
      const isLate = String(r['Is Late'] || '').trim().toLowerCase() === 'yes'

      if (flag === 'P') {
        data.present += 1
        if (isLate) {
          data.late += 1
        } else {
          data.onTime += 1
        }
      }
    }

    const results = []
    for (const [key, data] of userData.entries()) {
      const totalPresent = data.present
      const onTimePctNum = totalPresent > 0 ? ((data.onTime / totalPresent) * 100) : 0
      const onTimePct = onTimePctNum.toFixed(2)
      results.push({
        user: data.user,
        company: data.company,
        function: data.function,
        department: Array.from(data.departments).sort().join(', ') || '',
        members: data.members.size,
        present: totalPresent,
        late: data.late,
        onTime: data.onTime,
        onTimePct: `${onTimePct}%`,
        _onTimePctNum: onTimePctNum,
        _userId: key,
      })
    }

    return results.sort((a, b) => a.user.localeCompare(b.user))
  }, [scopedRows, selectedCompanies, selectedFunctions, selectedDepartments, selectedUsers, selectedMonths, selectedWeeks])

  // Compute Work Hour Completion per user
  const computeWorkHourUserWise = useMemo(() => {
    const userData = new Map()

    for (const r of scopedRows) {
      const dateVal = getDateFromRow(r)
      const month = monthOf(dateVal)
      const week = getWeekOfMonth(dateVal || r['Attendance Date'])
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const deptStr = String(r['Department Name'] || r['Department'] || '').trim()
      const rowDepts = deptStr ? deptStr.split(',').map(d => d.trim()).filter(Boolean) : []
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = stripMr(String(r['Name'] || ''))
      const userKey = empCode || empName

      if (!userKey) continue

      // Format user display for filter matching
      const userDisplay = empCode && empName 
        ? `${empName} (${empCode})`
        : empCode || empName

      // Apply filters (when no month/week selected, include all)
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(functionName)) continue
      if (selectedDepartments.length > 0 && !rowDepts.some(d => selectedDepartments.includes(d))) continue
      if (selectedUsers.length > 0 && !selectedUsers.includes(userDisplay)) continue
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) continue
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(week))) continue

      const flag = String(r['Flag'] || '').trim()
      if (flag === 'W' || flag === 'H') continue // Skip weekends and holidays
      
      // Only count P and OD flags for Work Hour Completion
      if (flag !== 'P' && flag !== 'OD') continue

      const key = userKey
      if (!userData.has(key)) {
        // Format user display: "Name (ID)" or "ID" if no name, or "Name" if no ID
        const userDisplay = empCode && empName 
          ? `${empName} (${empCode})`
          : empCode || empName
        
        userData.set(key, {
          user: userDisplay,
          userId: empCode,
          userName: empName,
          company,
          function: functionName,
          departments: new Set(),
          members: new Set(),
          shiftHoursSum: 0,
          workHoursSum: 0,
          completedCount: 0,
          totalCount: 0,
        })
      }

      const data = userData.get(key)
      data.members.add(userKey)
      rowDepts.forEach(d => data.departments.add(d))

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
    }

    const results = []
    for (const [key, data] of userData.entries()) {
      const completionPctNum = data.totalCount > 0
        ? ((data.completedCount / data.totalCount) * 100)
        : 0
      const completionPct = completionPctNum.toFixed(2)
      results.push({
        user: data.user,
        company: data.company,
        function: data.function,
        department: Array.from(data.departments).sort().join(', ') || '',
        members: data.members.size,
        totalDays: data.totalCount,
        completedDays: data.completedCount,
        completionPct: `${completionPct}%`,
        _completionPctNum: completionPctNum,
        _userId: key,
      })
    }

    return results.sort((a, b) => a.user.localeCompare(b.user))
  }, [scopedRows, selectedCompanies, selectedFunctions, selectedDepartments, selectedUsers, selectedMonths, selectedWeeks])

  // Compute Work Hour Lost per user
  const computeWorkHourLostUserWise = useMemo(() => {
    const userData = new Map()

    // Helper function to compute duration in hours (handling overnight shifts)
    const computeDurationHours = (startStr, endStr) => {
      if (!startStr || !endStr) return 0.0
      const startH = timeToHours(startStr)
      const endH = timeToHours(endStr)
      if (startH === 0.0 || endH === 0.0) return 0.0
      // Handle overnight shifts (e.g., 22:00 to 06:00)
      const finalEndH = endH < startH ? endH + 24.0 : endH
      return Math.max(0, finalEndH - startH)
    }

    for (const r of scopedRows) {
      const dateVal = getDateFromRow(r)
      const month = monthOf(dateVal)
      const week = getWeekOfMonth(dateVal || r['Attendance Date'])
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const deptStr = String(r['Department Name'] || r['Department'] || '').trim()
      const rowDepts = deptStr ? deptStr.split(',').map(d => d.trim()).filter(Boolean) : []
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = stripMr(String(r['Name'] || ''))
      const userKey = empCode || empName

      if (!userKey) continue

      // Format user display for filter matching
      const userDisplay = empCode && empName 
        ? `${empName} (${empCode})`
        : empCode || empName

      // Apply filters (when no month/week selected, include all)
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(functionName)) continue
      if (selectedDepartments.length > 0 && !rowDepts.some(d => selectedDepartments.includes(d))) continue
      if (selectedUsers.length > 0 && !selectedUsers.includes(userDisplay)) continue
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) continue
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(week))) continue

      const flag = String(r['Flag'] || '').trim()
      // Work hour lost: only count P (Present) and OD (On Duty). Skip W, H, EL, A, L, etc.
      if (flag !== 'P' && flag !== 'OD') continue

      const key = userKey
      if (!userData.has(key)) {
        // Format user display: "Name (ID)" or "ID" if no name, or "Name" if no ID
        const userDisplay = empCode && empName 
          ? `${empName} (${empCode})`
          : empCode || empName
        
        userData.set(key, {
          user: userDisplay,
          userId: empCode,
          userName: empName,
          company,
          function: functionName,
          departments: new Set(),
          members: new Set(),
          shiftHoursSum: 0,
          workHoursSum: 0,
          lostHoursSum: 0,
        })
      }

      const data = userData.get(key)
      data.members.add(userKey)
      rowDepts.forEach(d => data.departments.add(d))

      // Calculate lost hours per day (matching backend logic exactly)
      const shiftInStr = String(r['Shift In Time'] || '').trim()
      const shiftOutStr = String(r['Shift Out Time'] || '').trim()
      const inTimeStr = String(r['In Time'] || '').trim()
      const outTimeStr = String(r['Out Time'] || '').trim()

      const shiftHrs = computeDurationHours(shiftInStr, shiftOutStr)
      const workHrs = computeDurationHours(inTimeStr, outTimeStr)

      // Only P and OD rows reach here. Add shift/work/lost for this day.
      if (shiftHrs > 0) {
        const shiftHrsRounded = Number(shiftHrs.toFixed(2))
        const workHrsRounded = Number(workHrs.toFixed(2))

        data.shiftHoursSum += shiftHrsRounded
        data.workHoursSum += workHrsRounded

        let lostHrs = workHrsRounded > 0
          ? Math.max(0.0, shiftHrsRounded - workHrsRounded)
          : shiftHrsRounded
        lostHrs = Number(lostHrs.toFixed(2))
        data.lostHoursSum += lostHrs
      }
    }

    const results = []
    for (const [key, data] of userData.entries()) {
      const totalShiftHours = data.shiftHoursSum || 0
      const totalWorkHours = data.workHoursSum || 0
      const totalLostHours = data.lostHoursSum || 0
      const lostPct = totalShiftHours > 0
        ? ((totalLostHours / totalShiftHours) * 100).toFixed(2)
        : '0.00'
      
      // Actual Overtime = sum(work hours) - sum(shift hours) - sum(lost hours), min 0
      const actualOvertime = Number(Math.max(0, totalWorkHours - totalShiftHours - totalLostHours).toFixed(2))
      
      results.push({
        user: data.user,
        company: data.company,
        function: data.function,
        department: Array.from(data.departments).sort().join(', ') || '',
        members: data.members.size,
        shiftHours: totalShiftHours.toFixed(2),
        workHours: totalWorkHours.toFixed(2),
        lostHours: totalLostHours.toFixed(2),
        lostPct: `${lostPct}%`,
        actualOvertime: actualOvertime.toFixed(2),
        // Store numeric values for sorting
        _shiftHoursNum: totalShiftHours,
        _workHoursNum: totalWorkHours,
        _lostHoursNum: totalLostHours,
        _lostPctNum: parseFloat(lostPct),
        _actualOvertimeNum: actualOvertime,
        _userId: key,
      })
    }

    return results.sort((a, b) => a.user.localeCompare(b.user))
  }, [scopedRows, selectedCompanies, selectedFunctions, selectedDepartments, selectedUsers, selectedMonths, selectedWeeks])

  // Lost Hours Cost: same as work_hour_lost plus cost (lost × CTC per hour by function)
  const computeWorkHourLostCostUserWise = useMemo(() => {
    const getRate = (functionName) => {
      const g = (functionName || '').trim()
      const dashIdx = g.indexOf(' - ')
      const functionPart = dashIdx >= 0 ? g.slice(dashIdx + 3).trim() : g
      if (functionPart && ctcByFunction[functionPart] != null) return Number(ctcByFunction[functionPart])
      return ctcPerHour
    }
    const lost = computeWorkHourLostUserWise
    return lost.map((r) => {
      const lostNum = (r._lostHoursNum ?? parseFloat(r.lostHours)) || 0
      const rate = getRate(r.function)
      const cost = rate != null ? Math.round(lostNum * rate * 100) / 100 : null
      return {
        ...r,
        ctcPerHourDisplay: rate != null ? Number(rate.toFixed(2)) : '—',
        costBdt: cost,
        costDisplay: cost != null && cost > 0 ? `৳${cost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (cost === 0 ? '৳0.00' : '—'),
        _costNum: cost != null ? cost : 0,
      }
    })
  }, [computeWorkHourLostUserWise, ctcPerHour, ctcByFunction])

  const WORKDAY_FLAGS = ['A', 'CL', 'EL', 'OD', 'P', 'SL', 'WHF']
  const parseDateKey = (dateStr) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? null : d.getTime()
    } catch { return null }
  }
  const isAdjacentDay = (ts1, ts2) => {
    if (ts1 == null || ts2 == null) return false
    const oneDayMs = 24 * 60 * 60 * 1000
    const diff = Math.abs(ts1 - ts2)
    return diff === oneDayMs
  }
  // Leave Analysis user-wise: per (user, month) with total_sl, total_cl, total_a, workdays, and adjacent SL/CL
  const computeLeaveUserWise = useMemo(() => {
    const userData = new Map()
    const userDayList = new Map() // key -> [{ dateStr, ts, flag }] for adjacency
    for (const r of scopedRows) {
      const dateVal = getDateFromRow(r)
      const month = monthOf(dateVal)
      const week = getWeekOfMonth(dateVal || r['Attendance Date'])
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const deptStr = String(r['Department Name'] || r['Department'] || '').trim()
      const rowDepts = deptStr ? deptStr.split(',').map(d => d.trim()).filter(Boolean) : []
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = stripMr(String(r['Name'] || ''))
      const userKey = empCode || empName
      if (!userKey) continue
      const userDisplay = empCode && empName ? `${empName} (${empCode})` : empCode || empName
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(functionName)) continue
      if (selectedDepartments.length > 0 && !rowDepts.some(d => selectedDepartments.includes(d))) continue
      if (selectedUsers.length > 0 && !selectedUsers.includes(userDisplay)) continue
      if (fromMonth && month < fromMonth) continue
      if (toMonth && month > toMonth) continue
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(week))) continue
      const key = `${userKey}|||${month}`
      const dateStr = dateVal || r['Attendance Date'] || ''
      const ts = parseDateKey(dateStr)
      const flag = String(r['Flag'] || '').trim().toUpperCase()
      if (!userData.has(key)) {
        userData.set(key, {
          user: userDisplay,
          _userId: userKey,
          company,
          function: functionName,
          department: [...new Set(rowDepts)].join(', '),
          month,
          total_sl: 0,
          total_cl: 0,
          total_a: 0,
          absentDayDates: new Set(), // unique days with A (avoids >100% when duplicate rows exist)
          workdayDates: new Set(),
          sl_adjacent: 0,
          cl_adjacent: 0,
        })
        userDayList.set(key, [])
      }
      const data = userData.get(key)
      const dayKey = ts != null ? Math.floor(ts / (24 * 60 * 60 * 1000)) : dateStr
      if (flag === 'SL') data.total_sl += 1
      else if (flag === 'CL') data.total_cl += 1
      else if (flag === 'A') {
        data.total_a += 1
        if (dateStr || ts != null) data.absentDayDates.add(dayKey)
      }
      if (WORKDAY_FLAGS.includes(flag) && (dateStr || ts != null)) {
        data.workdayDates.add(dayKey)
      }
      userDayList.get(key).push({ dateStr, ts, flag })
    }
    // Compute adjacent SL/CL: SL or CL next to W or H
    for (const [key, list] of userDayList) {
      list.sort((a, b) => (a.ts || 0) - (b.ts || 0))
      let slAdj = 0
      let clAdj = 0
      for (let i = 0; i < list.length; i++) {
        const curr = list[i]
        const prev = list[i - 1]
        const next = list[i + 1]
        const prevIsWH = prev && ['W', 'H'].includes(prev.flag)
        const nextIsWH = next && ['W', 'H'].includes(next.flag)
        const adj = (prev && isAdjacentDay(curr.ts, prev.ts) && prevIsWH) || (next && isAdjacentDay(curr.ts, next.ts) && nextIsWH)
        if (curr.flag === 'SL' && adj) slAdj += 1
        if (curr.flag === 'CL' && adj) clAdj += 1
      }
      const data = userData.get(key)
      if (data) {
        data.sl_adjacent = slAdj
        data.cl_adjacent = clAdj
      }
    }
    const results = []
    for (const data of userData.values()) {
      const w = (data.workdayDates && data.workdayDates.size) || 0
      const uniqueAbsentDays = (data.absentDayDates && data.absentDayDates.size) || 0
      // SL % and CL % = adjacent SL/CL as % of total SL/CL (not of workdays)
      const slPctNum = data.total_sl > 0 ? (data.sl_adjacent / data.total_sl) * 100 : 0
      const clPctNum = data.total_cl > 0 ? (data.cl_adjacent / data.total_cl) * 100 : 0
      // Absent % = unique days absent / workdays, capped at 100% (avoids >100% from duplicate rows)
      const aPctNum = w > 0 ? Math.min(100, (uniqueAbsentDays / w) * 100) : 0
      const totalSlDisplay = data.sl_adjacent > 0 ? `${data.total_sl} (${data.sl_adjacent} adj.)` : String(data.total_sl)
      const totalClDisplay = data.cl_adjacent > 0 ? `${data.total_cl} (${data.cl_adjacent} adj.)` : String(data.total_cl)
      results.push({
        ...data,
        workdays: w,
        total_sl: totalSlDisplay,
        total_cl: totalClDisplay,
        total_a: uniqueAbsentDays, // show unique days absent (may differ from row count if duplicates)
        _totalSlNum: data.total_sl,
        _totalClNum: data.total_cl,
        sl_pct: data.total_sl > 0 ? slPctNum.toFixed(2) + '%' : '0%',
        cl_pct: data.total_cl > 0 ? clPctNum.toFixed(2) + '%' : '0%',
        a_pct: w > 0 ? aPctNum.toFixed(2) + '%' : '0%',
        _slPctNum: slPctNum,
        _clPctNum: clPctNum,
        _aPctNum: aPctNum,
      })
    }
    return results.sort((a, b) => (a.month + a.user).localeCompare(b.month + b.user))
  }, [scopedRows, selectedCompanies, selectedFunctions, selectedDepartments, selectedUsers, fromMonth, toMonth, selectedWeeks])

  // OD Analysis user-wise: restrict by scope then filter by selected filters
  const odFilteredData = useMemo(() => {
    const allowedCompanies = scopeFilter.all ? null : (scopeFilter.companies || [])
    const allowedFunctionNames = scopeFilter.all ? null : (scopeFilter.functions || []).map(f => (f && typeof f === 'object' && f.name) ? f.name : f)
    const allowedDepartmentNames = scopeFilter.all ? null : (scopeFilter.departments || []).map(d => (d && typeof d === 'object' && d.name) ? d.name : d)
    return odData.filter(r => {
      if (!scopeFilter.all) {
        if (allowedCompanies && allowedCompanies.length > 0 && !allowedCompanies.includes(r.company)) return false
        if (allowedFunctionNames && allowedFunctionNames.length > 0 && !allowedFunctionNames.includes(r.function)) return false
        if (allowedDepartmentNames && allowedDepartmentNames.length > 0) {
          const rowDepts = (r.department || '').split(',').map(d => d.trim()).filter(Boolean)
          if (!rowDepts.some(d => allowedDepartmentNames.includes(d))) return false
        }
      }
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(r.company)) return false
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(r.function)) return false
      if (selectedDepartments.length > 0) {
        const rowDepts = (r.department || '').split(',').map(d => d.trim()).filter(Boolean)
        if (!rowDepts.some(d => selectedDepartments.includes(d))) return false
      }
      if (selectedUsers.length > 0 && !selectedUsers.includes(r.employee_name)) return false
      if (fromMonth && r.month < fromMonth) return false
      if (toMonth && r.month > toMonth) return false
      return true
    })
  }, [odData, scopeFilter.all, scopeFilter.companies, scopeFilter.functions, scopeFilter.departments, selectedCompanies, selectedFunctions, selectedDepartments, selectedUsers, fromMonth, toMonth])

  // Filter options restricted by user scope (from /users/me/scope filter_options)
  const uniqueCompanies = useMemo(() => {
    const list = scopeFilter.companies || []
    return Array.isArray(list) ? [...list].sort() : []
  }, [scopeFilter.companies])

  // Derive function options from attendance data only (Function Name column) so we never show departments in the Function filter
  const uniqueFunctions = useMemo(() => {
    const set = new Set()
    for (const r of scopedRows) {
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (functionName) set.add(functionName)
    }
    return Array.from(set).sort()
  }, [scopedRows, selectedCompanies])

  // Derive department options from attendance data only (Department Name column)
  const uniqueDepartments = useMemo(() => {
    const set = new Set()
    for (const r of scopedRows) {
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const deptStr = String(r['Department Name'] || r['Department'] || '').trim()
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(functionName)) continue
      if (deptStr) deptStr.split(',').map(d => d.trim()).filter(Boolean).forEach(d => set.add(d))
    }
    return Array.from(set).sort()
  }, [scopedRows, selectedCompanies, selectedFunctions])

  const uniqueUsers = useMemo(() => {
    const users = new Set()
    for (const r of scopedRows) {
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const deptStr = String(r['Department Name'] || r['Department'] || '').trim()
      const rowDepts = deptStr ? deptStr.split(',').map(d => d.trim()).filter(Boolean) : []
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = stripMr(String(r['Name'] || ''))
      const userKey = empCode || empName
      
      // Filter by selected company, function, and department if they are selected
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(functionName)) continue
      if (selectedDepartments.length > 0 && !rowDepts.some(d => selectedDepartments.includes(d))) continue
      
      if (userKey) {
        // Format user display: "Name (ID)" or "ID" if no name, or "Name" if no ID
        const userDisplay = empCode && empName 
          ? `${empName} (${empCode})`
          : empCode || empName
        users.add(userDisplay)
      }
    }
    return Array.from(users).sort()
  }, [scopedRows, selectedCompanies, selectedFunctions, selectedDepartments])

  const uniqueMonths = useMemo(() => {
    const months = new Set()
    for (const r of scopedRows) {
      const dateVal = getDateFromRow(r)
      const month = monthOf(dateVal)
      if (month) months.add(month)
    }
    return Array.from(months).sort()
  }, [scopedRows])

  const toMonthLabel = (m) => {
    if (!m) return ''
    const match = String(m).match(/(20\d{2})-(\d{2})/)
    if (!match) return String(m)
    const year = match[1]
    const month = parseInt(match[2], 10)
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return `${names[month - 1]} ${year}`
  }

  // Get table data based on active tab
  const tableData = useMemo(() => {
    if (activeTab === 'on_time') return computeOnTimeUserWise
    if (activeTab === 'work_hour') return computeWorkHourUserWise
    if (activeTab === 'work_hour_lost') return computeWorkHourLostUserWise
    if (activeTab === 'work_hour_lost_cost') return computeWorkHourLostCostUserWise
    if (activeTab === 'leave_analysis') {
      return computeLeaveUserWise.map(r => ({ ...r, month: toMonthLabel(r.month) }))
    }
    if (activeTab === 'od_analysis') {
      return odFilteredData.map(r => ({
        user: r.employee_name,
        company: r.company,
        function: r.function,
        department: r.department || '',
        month: toMonthLabel(r.month),
        od: r.od,
      }))
    }
    return []
  }, [activeTab, computeOnTimeUserWise, computeWorkHourUserWise, computeWorkHourLostUserWise, computeWorkHourLostCostUserWise, computeLeaveUserWise, odFilteredData])

  // Get columns based on active tab
  const columns = useMemo(() => {
    const detailsColumn = {
      key: '_details',
      label: 'Details',
      sortable: false,
      alignRight: true,
      fillRemaining: true,
        render: (row) => (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDetailRow(row)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            View details
          </button>
        </div>
      ),
    }
    if (activeTab === 'on_time') {
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'present', label: 'Present', sortable: true, compact: true },
        { key: 'late', label: 'Late', sortable: true, compact: true },
        { key: 'onTime', label: 'On Time', sortable: true, compact: true },
        { key: 'onTimePct', label: 'On Time %', sortable: true, sortKey: '_onTimePctNum', compact: true },
        detailsColumn,
      ]
    }
    if (activeTab === 'work_hour') {
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'totalDays', label: 'Total Days', sortable: true, compact: true },
        { key: 'completedDays', label: 'Completed Days', sortable: true, compact: true },
        { key: 'completionPct', label: 'Completion %', sortable: true, sortKey: '_completionPctNum', compact: true },
        detailsColumn,
      ]
    }
    if (activeTab === 'work_hour_lost') {
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'shiftHours', label: 'Shift Hours', sortable: true, sortKey: '_shiftHoursNum', compact: true },
        { key: 'workHours', label: 'Work Hours', sortable: true, sortKey: '_workHoursNum', compact: true },
        { key: 'lostHours', label: 'Lost Hours', sortable: true, sortKey: '_lostHoursNum', compact: true },
        { key: 'lostPct', label: 'Lost %', sortable: true, sortKey: '_lostPctNum', compact: true },
        { key: 'actualOvertime', label: 'Actual Overtime', sortable: true, sortKey: '_actualOvertimeNum', compact: true },
        detailsColumn,
      ]
    }
    if (activeTab === 'work_hour_lost_cost') {
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'shiftHours', label: 'Shift Hours', sortable: true, sortKey: '_shiftHoursNum', compact: true },
        { key: 'workHours', label: 'Work Hours', sortable: true, sortKey: '_workHoursNum', compact: true },
        { key: 'lostHours', label: 'Lost Hours', sortable: true, sortKey: '_lostHoursNum', compact: true },
        { key: 'lostPct', label: 'Lost %', sortable: true, sortKey: '_lostPctNum', compact: true },
        { key: 'ctcPerHourDisplay', label: 'CTC/hour (BDT)', sortable: true, compact: true },
        { key: 'costDisplay', label: 'Cost (BDT)', sortable: true, sortKey: '_costNum', compact: true },
        detailsColumn,
      ]
    }
    if (activeTab === 'leave_analysis') {
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'month', label: 'Month', sortable: true },
        { key: 'total_sl', label: 'Total SL', sortable: true, sortKey: '_totalSlNum', compact: true },
        { key: 'total_cl', label: 'Total CL', sortable: true, sortKey: '_totalClNum', compact: true },
        { key: 'total_a', label: 'Total A', sortable: true, compact: true },
        { key: 'workdays', label: 'Workdays (in month)', sortable: true, compact: true, title: 'Number of working days in the month shown in this row' },
        { key: 'sl_pct', label: 'Adj. SL%', sortable: true, sortKey: '_slPctNum', compact: true },
        { key: 'cl_pct', label: 'Adj. CL%', sortable: true, sortKey: '_clPctNum', compact: true },
        { key: 'a_pct', label: 'A %', sortable: true, sortKey: '_aPctNum', compact: true },
        detailsColumn,
      ]
    }
    if (activeTab === 'od_analysis') {
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'month', label: 'Month', sortable: true },
        { key: 'od', label: 'OD', sortable: true, compact: true },
        detailsColumn,
      ]
    }
    return []
  }, [activeTab])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Analytics</h2>
        <p className="text-gray-600 mt-1">View user-wise attendance metrics</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <MultiSelectSearchable
              id="companyFilter"
              label="Company"
              icon="lnr lnr-briefcase text-blue-600"
              value={selectedCompanies}
              onChange={setSelectedCompanies}
              options={uniqueCompanies.map(c => ({ value: c, label: c }))}
              placeholder="All Companies"
            />
          </div>

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <MultiSelectSearchable
              id="functionFilter"
              label="Function"
              icon="lnr lnr-layers text-blue-600"
              value={selectedFunctions}
              onChange={setSelectedFunctions}
              options={uniqueFunctions.map(f => ({ value: f, label: f }))}
              placeholder="All Functions"
            />
          </div>

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <MultiSelectSearchable
              id="departmentFilter"
              label="Department"
              icon="lnr lnr-folder text-blue-600"
              value={selectedDepartments}
              onChange={setSelectedDepartments}
              options={uniqueDepartments.map(d => ({ value: d, label: d }))}
              placeholder="All Departments"
            />
          </div>

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <MultiSelectSearchable
              id="userFilter"
              label="User"
              icon="lnr lnr-user text-blue-600"
              value={selectedUsers}
              onChange={setSelectedUsers}
              options={uniqueUsers.map(u => ({ value: u, label: u }))}
              placeholder="All Users"
            />
          </div>

          {(activeTab === 'leave_analysis' || activeTab === 'od_analysis') ? (
            <>
              <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-1">From Month</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={fromMonth}
                  onChange={e => setFromMonth(e.target.value)}
                >
                  <option value="">All</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>{toMonthLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-1">To Month</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={toMonth}
                  onChange={e => setToMonth(e.target.value)}
                >
                  <option value="">All</option>
                  {uniqueMonths.map(m => (
                    <option key={m} value={m}>{toMonthLabel(m)}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
              <MultiSelectSearchable
                id="monthFilter"
                label="Month"
                icon="lnr lnr-calendar-full text-blue-600"
                value={selectedMonths}
                onChange={setSelectedMonths}
                options={uniqueMonths.map(month => ({
                  value: month,
                  label: toMonthLabel(month)
                }))}
                placeholder="All Months"
              />
            </div>
          )}

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <MultiSelectSearchable
              id="weekFilter"
              label="Week"
              icon="lnr lnr-calendar text-blue-600"
              value={selectedWeeks}
              onChange={setSelectedWeeks}
              options={[1, 2, 3, 4, 5].map(week => ({
                value: String(week),
                label: `${week}${week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'} Week`
              }))}
              placeholder="All Weeks"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-6">
        {(isLoading || scopeFilter.isLoading) ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">{scopeFilter.isLoading ? 'Loading your access scope...' : 'Loading data...'}</p>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{tabs.find(t => t.key === activeTab)?.label}</h3>
            {activeTab === 'leave_analysis' && (
              <p className="text-sm text-gray-600 mb-3">
                Each row is <strong>one month per user</strong>. &quot;Workdays (in month)&quot; is the number of working days in that row&apos;s month (e.g. ~21–22 for a typical month).
              </p>
            )}
            {tableData.length > 0 ? (
              <DataTable columns={columns} rows={tableData} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                {!scopeFilter.all && allRows.length > 0 ? (
                  <p>No rows match your data scope. If you have restricted access (e.g. N-1), ensure your Employee Email and data scope are set in User Management and that attendance data exists for your function/department.</p>
                ) : allRows.length === 0 && !isLoading ? (
                  <p>No data available. Please upload attendance files first.</p>
                ) : (
                  <p>No data available for the selected filters. Try adjusting filters or upload attendance files.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {detailRow && (
        <DayWiseDetailModal
          row={detailRow}
          allRows={scopedRows}
          selectedMonths={selectedMonths}
          selectedWeeks={selectedWeeks}
          fromMonth={fromMonth}
          toMonth={toMonth}
          activeTab={activeTab}
          tabs={tabs}
          onClose={() => setDetailRow(null)}
          getDateFromRow={getDateFromRow}
          monthOf={monthOf}
          getWeekOfMonth={getWeekOfMonth}
          timeToHours={timeToHours}
          toMonthLabel={toMonthLabel}
        />
      )}
    </div>
  )
}

// Day-wise report modal for a single user over the selected period
function DayWiseDetailModal({ row, allRows, selectedMonths, selectedWeeks, fromMonth, toMonth, activeTab, tabs = [], onClose, getDateFromRow, monthOf, getWeekOfMonth, timeToHours, toMonthLabel }) {
  const dayRows = useMemo(() => {
    const uid = row._userId
    const displayName = row.user
    const getDate = getDateFromRow || (r => r['Attendance Date'] ?? r['Date'] ?? '')
    let filtered = allRows.filter(r => {
      const rEmpCode = String(r['Employee Code'] || '').trim()
      const rEmpName = String(r['Name'] || '').trim()
      const rUid = rEmpCode || rEmpName
      const rDisplay = rEmpCode && rEmpName ? `${rEmpName} (${rEmpCode})` : rUid
      const matchUser = uid ? rUid === uid : (displayName && rDisplay === displayName)
      if (!matchUser) return false
      const dateVal = getDate(r)
      if (selectedMonths.length > 0 && !selectedMonths.includes(monthOf(dateVal))) return false
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(getWeekOfMonth(dateVal || r['Attendance Date'])))) return false
      const flag = String(r['Flag'] || '').trim()
      if (activeTab === 'leave_analysis') {
        // Exclude P and OD; show only leave-related: SL, CL, A, EL, WHF, W, H
        if (!['SL', 'CL', 'A', 'EL', 'WHF', 'W', 'H', ''].includes(flag)) return false
      } else if (activeTab === 'od_analysis') {
        if (flag !== 'OD') return false
      } else if (activeTab === 'work_hour_lost' || activeTab === 'work_hour_lost_cost') {
        // Match summary: include all days except weekend/holiday (P, OD, A, L, etc.)
        if (flag === 'W' || flag === 'H') return false
      } else {
        // on_time, work_hour: only P and OD
        if (!['P', 'OD'].includes(flag)) return false
      }
      return true
    })
    filtered.sort((a, b) => {
      const dA = new Date(a['Attendance Date'] || 0).getTime()
      const dB = new Date(b['Attendance Date'] || 0).getTime()
      return dA - dB
    })
    return filtered
  }, [row, allRows, selectedMonths, selectedWeeks, fromMonth, toMonth, activeTab, getDateFromRow, monthOf, getWeekOfMonth])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return isNaN(d.getTime()) ? String(dateStr) : d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return String(dateStr)
    }
  }

  const computeDurationHours = (startStr, endStr) => {
    if (!startStr || !endStr) return 0
    const startH = timeToHours(startStr)
    const endH = timeToHours(endStr)
    if (startH === 0 || endH === 0) return 0
    const finalEndH = endH < startH ? endH + 24 : endH
    return Math.max(0, Number((finalEndH - startH).toFixed(2)))
  }

  const dayTableRows = useMemo(() => {
    const parseTs = (dateStr) => {
      if (!dateStr) return null
      try {
        const d = new Date(dateStr)
        return isNaN(d.getTime()) ? null : d.getTime()
      } catch { return null }
    }
    const isAdj = (ts1, ts2) => {
      if (ts1 == null || ts2 == null) return false
      return Math.abs(ts1 - ts2) === 24 * 60 * 60 * 1000
    }
    return dayRows.map((r, idx) => {
      const flag = String(r['Flag'] || '').trim()
      const ts = parseTs(r['Attendance Date'])
      const prev = dayRows[idx - 1]
      const next = dayRows[idx + 1]
      const prevTs = prev ? parseTs(prev['Attendance Date']) : null
      const nextTs = next ? parseTs(next['Attendance Date']) : null
      const prevIsWH = prev && ['W', 'H'].includes(String(prev['Flag'] || '').trim())
      const nextIsWH = next && ['W', 'H'].includes(String(next['Flag'] || '').trim())
      const isAdjacentRow = (flag === 'SL' || flag === 'CL' || flag === 'A') && ((prev && isAdj(ts, prevTs) && prevIsWH) || (next && isAdj(ts, nextTs) && nextIsWH))
      let adjNote = ''
      if ((flag === 'SL' || flag === 'CL' || flag === 'A') && isAdjacentRow) {
        const prevFlag = prev ? String(prev['Flag'] || '').trim() : ''
        const nextFlag = next ? String(next['Flag'] || '').trim() : ''
        if ((prev && isAdj(ts, prevTs) && prevFlag === 'W') || (next && isAdj(ts, nextTs) && nextFlag === 'W')) adjNote = ' (Adj. W)'
        else if ((prev && isAdj(ts, prevTs) && prevFlag === 'H') || (next && isAdj(ts, nextTs) && nextFlag === 'H')) adjNote = ' (Adj. H)'
      }
      const flagDisplay = activeTab === 'leave_analysis' && adjNote ? flag + adjNote : flag
      const isLate = String(r['Is Late'] || '').trim().toLowerCase() === 'yes'
      const shiftIn = r['Shift In Time']
      const shiftOut = r['Shift Out Time']
      const inTime = r['In Time']
      const outTime = r['Out Time']
      const shiftHrs = computeDurationHours(shiftIn, shiftOut)
      const workHrs = computeDurationHours(inTime, outTime)
      const completed = shiftHrs > 0 && workHrs >= shiftHrs
      let lostHrs = 0
      if (['P', 'OD', ''].includes(flag) && shiftHrs > 0) {
        lostHrs = workHrs > 0 ? Math.max(0, shiftHrs - workHrs) : shiftHrs
        lostHrs = Number(lostHrs.toFixed(2))
      }
      const actualOvertime = (workHrs > shiftHrs && shiftHrs > 0)
        ? Number(Math.max(0, workHrs - shiftHrs - lostHrs).toFixed(2))
        : 0
      return {
        date: r['Attendance Date'],
        flag: flagDisplay || flag,
        isLate,
        onTime: flag === 'P' && !isLate,
        shiftIn,
        shiftOut,
        inTime,
        outTime,
        shiftHrs,
        workHrs,
        completed,
        lostHrs,
        actualOvertime,
        isAdjacentRow: activeTab === 'leave_analysis' && isAdjacentRow,
      }
    })
  }, [dayRows, timeToHours, activeTab])

  const tabLabel = tabs.find(t => t.key === activeTab)?.label || activeTab
  const useMonthRange = activeTab === 'leave_analysis' || activeTab === 'od_analysis'
  const periodLabel = useMonthRange && (fromMonth || toMonth)
    ? `From ${toMonthLabel ? toMonthLabel(fromMonth) || 'start' : fromMonth || 'start'} to ${toMonthLabel ? toMonthLabel(toMonth) || 'end' : toMonth || 'end'}`
    : (selectedMonths.length > 0 || selectedWeeks.length > 0
      ? `Selected ${selectedMonths.length ? 'month(s)' : ''}${selectedMonths.length && selectedWeeks.length ? ', ' : ''}${selectedWeeks.length ? 'week(s)' : ''}`
      : 'All period')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-[95vw] w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Day-wise report — {row.user}</h3>
            <p className="text-sm text-gray-600 mt-1">{tabLabel} · {periodLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700" title="Close">
            <span className="lnr lnr-cross text-2xl" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {dayTableRows.length === 0 ? (
            <p className="text-gray-500">No day-wise data for the selected period.</p>
          ) : (
            <div className="overflow-auto border rounded max-h-[70vh]">
              <table className="table min-w-full text-sm day-wise-detail-table">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="th px-3 py-2 !text-center">Date</th>
                    <th className="th px-3 py-2 !text-center">Flag</th>
                    {activeTab === 'on_time' && (
                      <>
                        <th className="th px-3 py-2 !text-center">Is Late</th>
                        <th className="th px-3 py-2 !text-center">On Time</th>
                        <th className="th px-3 py-2 !text-center">In</th>
                        <th className="th px-3 py-2 !text-center">Out</th>
                      </>
                    )}
                    {(activeTab === 'work_hour' || activeTab === 'work_hour_lost' || activeTab === 'work_hour_lost_cost') && (
                      <>
                        <th className="th px-3 py-2 !text-center">Shift In</th>
                        <th className="th px-3 py-2 !text-center">Shift Out</th>
                        <th className="th px-3 py-2 !text-center">In</th>
                        <th className="th px-3 py-2 !text-center">Out</th>
                        <th className="th px-3 py-2 !text-center">Shift Hrs</th>
                        <th className="th px-3 py-2 !text-center">Work Hrs</th>
                        {activeTab === 'work_hour' && <th className="th px-3 py-2 !text-center">Completed</th>}
                        {(activeTab === 'work_hour_lost' || activeTab === 'work_hour_lost_cost') && (
                          <>
                            <th className="th px-3 py-2 !text-center">Lost Hrs</th>
                            <th className="th px-3 py-2 !text-center">Actual Overtime</th>
                          </>
                        )}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dayTableRows.map((d, idx) => {
                    const isRed = (activeTab === 'on_time' && d.isLate) || (activeTab === 'work_hour' && !d.completed) || ((activeTab === 'work_hour_lost' || activeTab === 'work_hour_lost_cost') && d.lostHrs > 0) || (activeTab === 'leave_analysis' && (d.isAdjacentRow || d.flag === 'A' || String(d.flag).startsWith('A ')))
                    return (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isRed ? '!bg-red-100' : ''}`}>
                      <td className="td px-3 py-2 !text-center">{formatDate(d.date)}</td>
                      <td className="td px-3 py-2 !text-center">{d.flag || '—'}</td>
                      {activeTab === 'on_time' && (
                        <>
                          <td className="td px-3 py-2 !text-center">{d.isLate ? 'Yes' : 'No'}</td>
                          <td className="td px-3 py-2 !text-center">{d.onTime ? 'Yes' : 'No'}</td>
                          <td className="td px-3 py-2 !text-center">{d.inTime ?? '—'}</td>
                          <td className="td px-3 py-2 !text-center">{d.outTime ?? '—'}</td>
                        </>
                      )}
                      {(activeTab === 'work_hour' || activeTab === 'work_hour_lost' || activeTab === 'work_hour_lost_cost') && (
                        <>
                          <td className="td px-3 py-2 !text-center">{d.shiftIn ?? '—'}</td>
                          <td className="td px-3 py-2 !text-center">{d.shiftOut ?? '—'}</td>
                          <td className="td px-3 py-2 !text-center">{d.inTime ?? '—'}</td>
                          <td className="td px-3 py-2 !text-center">{d.outTime ?? '—'}</td>
                          <td className="td px-3 py-2 !text-center">{d.shiftHrs}</td>
                          <td className="td px-3 py-2 !text-center">{d.workHrs}</td>
                          {activeTab === 'work_hour' && <td className="td px-3 py-2 !text-center">{d.completed ? 'Yes' : 'No'}</td>}
                          {(activeTab === 'work_hour_lost' || activeTab === 'work_hour_lost_cost') && (
                            <>
                              <td className="td px-3 py-2 !text-center">{d.lostHrs}</td>
                              <td className={`td px-3 py-2 !text-center ${d.actualOvertime > 0 ? 'bg-emerald-100 font-medium text-emerald-800' : ''}`}>
                                {d.actualOvertime}
                              </td>
                            </>
                          )}
                        </>
                      )}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
