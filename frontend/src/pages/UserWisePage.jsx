import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listFiles, getFileDetail, getODAnalysis, getCtcPerHour, getCtcPerHourByFunction, getCurrentUser, getWeeklyAnalysis } from '../lib/api'
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

// Calculation help for info button (On Time %, Work Hour, Work Hour Lost)
const CALCULATION_HELP = {
  on_time: {
    title: 'How On Time % is calculated',
    points: [
      'Only attendance rows for the selected filters (company, function, department, month, week) are included.',
      'Present = count of days with Flag "P" (Present) and "OD" (Outdoor Duty). Late = count with late arrival (Is Late = yes). On Time = Present and not late.',
      'On Time % = (On Time count ÷ (Present + Late)) × 100 when there is at least one present/late day, else 0.',
      'Each user is aggregated by Employee Code/Name from the attendance file.',
    ],
  },
  work_hour: {
    title: 'How Work Hour Completion is calculated',
    points: [
      'Only rows with Flag "P" (Present) or "OD" (Outdoor Duty) are included; weekends (W) and holidays (H) are excluded.',
      'Shift Hours = duration between Shift In Time and Shift Out Time (overnight shifts supported). Work Hours = duration between In Time and Out Time.',
      'A day counts as "Completed" when Work Hours ≥ Shift Hours for that day.',
      'Completion % = (Completed days ÷ Total work days) × 100.',
    ],
  },
  work_hour_lost: {
    title: 'How Work Hour Lost is calculated',
    points: [
      'Only rows with Flag "P" (Present) or "OD" (Outdoor Duty) are included; weekends and holidays are excluded.',
      'Shift Hours = duration between Shift In Time and Shift Out Time. Work Hours = duration between In Time and Out Time.',
      'Lost Hours = max(0, Shift Hours − Work Hours) for each day. If Work Hours = 0, Lost = full Shift Hours.',
      'Lost % = (Total Lost Hours ÷ Total Shift Hours) × 100. Actual Overtime = max(0, Total Work Hours − Total Shift Hours − Total Lost Hours).',
    ],
  },
  work_hour_lost_cost: {
    title: 'How Lost Hours Cost is calculated',
    points: [
      'Uses the same Work Hour Lost logic (lost hours per user).',
      'Cost = Lost Hours × CTC per hour. CTC can be set globally in Cost Settings or per function (function-wise rate).',
      'If no CTC is set for a user\'s function, the global default is used.',
    ],
  },
}

const ALL_TABS = [
  { key: 'on_time', label: 'On Time %' },
  { key: 'work_hour', label: 'Work Hour Completion' },
  { key: 'work_hour_lost', label: 'Work Hour Lost' },
  { key: 'work_hour_lost_cost', label: 'Lost Hours Cost' },
  { key: 'cost_impact', label: 'Cost Impact' },
  { key: 'leave_analysis', label: 'Leave Analysis' },
  { key: 'od_analysis', label: 'OD Analysis' },
]

export default function UserWisePage() {
  const scopeFilter = useScopeFilterOptions()
  // Eagerly load scope on mount so data loads without user having to open the menu
  useEffect(() => {
    scopeFilter.refetch?.()
  }, [])
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
  const [showCalcHelp, setShowCalcHelp] = useState(false)
  const [selectedCompanies, setSelectedCompanies] = useState([])
  const [selectedFunctions, setSelectedFunctions] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [selectedMonths, setSelectedMonths] = useState([])
  const [selectedWeeks, setSelectedWeeks] = useState([])
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const [detailRow, setDetailRow] = useState(null)

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['files'],
    queryFn: listFiles,
    refetchOnMount: 'always',
  })

  // Fetch all rows from all files (after scope is ready so N-2/N-N get correct subordinates filter on first load)
  const { data: allRows = [], isLoading: allRowsLoading } = useQuery({
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
    enabled: files.length > 0 && !scopeFilter.isLoading,
    refetchOnMount: 'always',
  })
  // Show loading when files are loading, scope is loading, or row data is loading (so we never flash "No data" while something is still fetching)
  const isLoading = filesLoading || allRowsLoading

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

  // Weekly analysis: for Cost Impact use full company/function totals (same as Lost Hour Cost Analysis)
  const { data: weeklyResponse } = useQuery({
    queryKey: ['weekly_dashboard', 'function', 'breakdown_department'],
    queryFn: () => getWeeklyAnalysis('function', 'department'),
    staleTime: 5 * 60 * 1000,
    enabled: !scopeFilter.isLoading,
  })
  const companyTotalsFull = weeklyResponse?.company_totals_full ?? null
  const weeklyData = Array.isArray(weeklyResponse) ? weeklyResponse : (weeklyResponse?.data ?? [])

  // Current user (for Cost Impact tab: match by employee_email)
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })

  // N = all employees; N-1 = all under user's function; N-2 and below = self + direct subordinates only.
  const scopedRows = useMemo(() => {
    if (scopeFilter.isLoading) return []
    if (!Array.isArray(allRows) || allRows.length === 0) return allRows

    const dataScopeLevel = scopeFilter.dataScopeLevel || ''
    const directCodes = scopeFilter.direct_employee_codes || []
    const directEmails = scopeFilter.direct_employee_emails || []
    const selfCode = (scopeFilter.employee_code_from_list || '').toString().trim().toLowerCase()
    const selfEmail = (currentUser?.employee_email || currentUser?.email || '').toString().trim().toLowerCase()
    const codeSet = new Set([selfCode, ...directCodes.map(c => String(c).trim().toLowerCase())].filter(Boolean))
    const emailSet = new Set([selfEmail, ...directEmails.map(e => String(e).trim().toLowerCase())].filter(Boolean))
    const hasDirectScope = codeSet.size > 0 || emailSet.size > 0
    const allowedCodes = scopeFilter.allowed_employee_codes || []
    const allowedEmails = scopeFilter.allowed_employee_emails || []
    const useDirectSubordinatesOnly = (dataScopeLevel !== 'N' && dataScopeLevel !== 'N-1') && hasDirectScope
    const hasIdentityScope = useDirectSubordinatesOnly || allowedCodes.length > 0 || allowedEmails.length > 0

    if (hasIdentityScope) {
      const useCodes = useDirectSubordinatesOnly ? codeSet : new Set(allowedCodes.map(c => String(c).trim().toLowerCase()).filter(Boolean))
      const useEmails = useDirectSubordinatesOnly ? emailSet : new Set((allowedEmails || []).map(e => String(e).trim().toLowerCase()).filter(Boolean))
      const filterByCodeOnly = useCodes.size > 0
      return allRows.filter(r => {
        const rowCode = (r['Employee Code'] ?? r['Employee ID'] ?? r['Emp Code'] ?? r['Code'] ?? '')
        const normCode = String(rowCode).trim().toLowerCase()
        if (filterByCodeOnly) return normCode && normCode !== 'id' && useCodes.has(normCode)
        const rowEmail = String(r['Email (Official)'] ?? r['Email'] ?? r['Official Email'] ?? '').trim().toLowerCase()
        return (normCode && normCode !== 'id' && useCodes.has(normCode)) || (rowEmail && useEmails.has(rowEmail))
      })
    }

    if (scopeFilter.all) return allRows

    const allowedCompanies = scopeFilter.companies || []
    const allowedFunctionNames = (scopeFilter.functions || []).map(f => (f && typeof f === 'object' && f.name) ? f.name : f)
    const allowedDepartmentNames = (scopeFilter.departments || []).map(d => (d && typeof d === 'object' && d.name) ? d.name : d)
    const hasExplicitScope = allowedCompanies.length > 0 || allowedFunctionNames.length > 0 || allowedDepartmentNames.length > 0
    if (!hasExplicitScope) return allRows
    const functionMatches = (rowFunc, allowedList) => {
      if (!allowedList.length) return true
      const r = (rowFunc || '').toLowerCase()
      return allowedList.some(a => { const al = (a || '').toLowerCase(); return al === r || r.includes(al) || al.includes(r) })
    }
    const deptMatches = (rowDepts, allowedList) => {
      if (!allowedList.length) return true
      return rowDepts.some(d => {
        const rd = (d || '').toLowerCase()
        return allowedList.some(a => { const al = (a || '').toLowerCase(); return al === rd || rd.includes(al) || al.includes(rd) })
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
  }, [allRows, currentUser, scopeFilter.all, scopeFilter.isLoading, scopeFilter.dataScopeLevel, scopeFilter.companies, scopeFilter.functions, scopeFilter.departments, scopeFilter.employee_code_from_list, scopeFilter.direct_employee_codes, scopeFilter.direct_employee_emails, scopeFilter.allowed_employee_codes, scopeFilter.allowed_employee_emails])

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

  // On Time % report: logged user + subordinates (by Employee Code in attendance). Present = P+OD, Late = Is Late=yes on those, On Time = Present - Late.
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
      const empCode = (r['Employee Code'] ?? r['Employee ID'] ?? r['Emp Code'] ?? r['Code'] ?? r['Emp No'] ?? r['Staff Code'] ?? r['Staff ID'] ?? r['ID'] ?? '')
      const empCodeStr = typeof empCode === 'number' ? String(empCode) : String(empCode || '').trim()
      const empName = stripMr(String(r['Name'] || ''))
      const userKey = empCodeStr || empName
      if (!userKey) continue

      const userDisplay = empCodeStr && empName ? `${empName} (${empCodeStr})` : empCodeStr || empName
      if (selectedCompanies.length > 0 && !selectedCompanies.includes(company)) continue
      if (selectedFunctions.length > 0 && !selectedFunctions.includes(functionName)) continue
      if (selectedDepartments.length > 0 && !rowDepts.some(d => selectedDepartments.includes(d))) continue
      if (selectedUsers.length > 0 && !selectedUsers.includes(userDisplay)) continue
      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) continue
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(week))) continue

      if (!userData.has(userKey)) {
        userData.set(userKey, {
          employeeCode: empCodeStr || '—',
          name: empName || '—',
          company,
          function: functionName,
          department: rowDepts.length ? [...rowDepts].sort().join(', ') : '',
          present: 0,
          late: 0,
          onTime: 0,
        })
      }
      const data = userData.get(userKey)
      const flag = String(r['Flag'] || '').trim().toUpperCase()
      const isLate = String(r['Is Late'] || '').trim().toLowerCase() === 'yes'
      if (flag === 'P' || flag === 'OD') {
        data.present += 1
        if (isLate) data.late += 1
        else data.onTime += 1
      }
    }

    const results = []
    for (const [key, data] of userData.entries()) {
      const present = data.present
      const onTimePctNum = present > 0 ? Number((((data.onTime) / present) * 100).toFixed(2)) : 0
      results.push({
        sl: 0,
        employeeCode: data.employeeCode,
        name: data.name,
        company: data.company,
        function: data.function,
        department: data.department,
        present: data.present,
        late: data.late,
        onTime: data.onTime,
        onTimePct: present > 0 ? `${onTimePctNum}%` : '0.00%',
        _onTimePctNum: onTimePctNum,
        _userId: key,
        user: data.name && data.employeeCode ? `${data.name} (${data.employeeCode})` : data.employeeCode || data.name,
      })
    }
    return results.sort((a, b) => (a.name || a.employeeCode || '').localeCompare(b.name || b.employeeCode || ''))
  }, [scopedRows, selectedCompanies, selectedFunctions, selectedDepartments, selectedUsers, selectedMonths, selectedWeeks])

  // Table: User and subordinates with Company, Function, Department (for On Time % tab). _userId = employee code or name for matching current user.
  const scopeUserDepartmentTable = useMemo(() => {
    return computeOnTimeUserWise.map(r => ({
      user: r.user,
      company: r.company || '—',
      function: r.function || '—',
      department: r.department || '—',
      _userId: r._userId,
    }))
  }, [computeOnTimeUserWise])

  // For On Time % tab: split into current user vs subordinates (match by employee code from scope)
  const onTimeCurrentUserRow = useMemo(() => {
    const code = (scopeFilter.employee_code_from_list || '').toString().trim().toLowerCase()
    if (!code || !scopeUserDepartmentTable.length) return null
    return scopeUserDepartmentTable.find(row => (row._userId || '').toString().trim().toLowerCase() === code) || null
  }, [scopeUserDepartmentTable, scopeFilter.employee_code_from_list])

  const onTimeSubordinatesList = useMemo(() => {
    const code = (scopeFilter.employee_code_from_list || '').toString().trim().toLowerCase()
    if (!code) return scopeUserDepartmentTable
    return scopeUserDepartmentTable.filter(row => (row._userId || '').toString().trim().toLowerCase() !== code)
  }, [scopeUserDepartmentTable, scopeFilter.employee_code_from_list])

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

  // Company full name -> short (for Cost Impact match with company_totals_full from Lost Hour Cost Analysis)
  const companyFullToShort = useMemo(() => {
    const m = {
      'Confidence Batteries Limited': 'CBL',
      'Confidence Infrastructure PLC.': 'CIPLC',
      'Confidence Steel Export Limited': 'CSEL',
    }
    return (name) => (name && m[name]) ? m[name] : (name || '').trim()
  }, [])

  // Cost Impact: for N, N-1, N-2 use scoped data (like N-3) so they don't see all users; for admin/all use allRows.
  const costImpact = useMemo(() => {
    const costImpactRows = scopeFilter.all ? allRows : scopedRows
    const getRate = (functionName) => {
      const g = (functionName || '').trim()
      const dashIdx = g.indexOf(' - ')
      const functionPart = dashIdx >= 0 ? g.slice(dashIdx + 3).trim() : g
      if (functionPart && ctcByFunction[functionPart] != null) return Number(ctcByFunction[functionPart])
      return ctcPerHour
    }
    const getRowEmail = (r) => {
      const raw = (r['Email (Official)'] ?? r['Email (Offical)'] ?? r['Official Email'] ?? r['Email'] ?? r['Work Email'] ?? r['E-mail'] ?? '').toString().trim()
      return raw ? raw.toLowerCase() : ''
    }
    // Name → username-style: "A.K.M Humayun Kabir" → "humayun.kabir" (last two words, lower, dot-separated)
    const nameToUsernamePart = (name) => {
      if (!name || typeof name !== 'string') return ''
      const parts = name.trim().split(/\s+/).filter(Boolean)
      if (parts.length < 2) return parts[0] ? parts[0].toLowerCase() : ''
      return parts.slice(-2).join('.').toLowerCase()
    }
    // Name → short username: "Mahmudul Islam" → "m.islam" (first initial + last name, lower)
    const nameToShortUsername = (name) => {
      if (!name || typeof name !== 'string') return ''
      const parts = name.trim().split(/\s+/).filter(Boolean)
      if (parts.length === 0) return ''
      if (parts.length === 1) return parts[0].toLowerCase().slice(0, 1)
      const first = parts[0]
      const last = parts[parts.length - 1]
      return (first.charAt(0).toLowerCase() + '.' + last.toLowerCase())
    }
    const computeDurationHours = (startStr, endStr) => {
      if (!startStr || !endStr) return 0.0
      const startH = timeToHours(startStr)
      const endH = timeToHours(endStr)
      if (startH === 0.0 || endH === 0.0) return 0.0
      const finalEndH = endH < startH ? endH + 24.0 : endH
      return Math.max(0, finalEndH - startH)
    }

    const byDept = new Map()
    const deptToUserKeys = new Map() // deptKey -> Set of userKeys (who has rows in this dept)
    const byUser = new Map() // userKey -> { user, company, function, department, shiftHoursSum, workHoursSum, lostHoursSum, costSum } for Cost Impact table
    const shortNameCandidatesNoEmail = new Set() // userKeys where name → short username matches but row has no email (for fallback when only one such person)
    let myCompany = ''
    let myFunction = ''
    let myDepartment = ''
    let myUserKey = ''
    const myEmail = (currentUser?.employee_email || currentUser?.email || '').toString().trim().toLowerCase()
    const myUsername = (currentUser?.username || '').toString().trim().toLowerCase()
    // When backend sends username as full email (e.g. m.islam@cg-bd.com), use part before @ for matching row email
    const myUsernameForMatch = myUsername.includes('@') ? myUsername.slice(0, myUsername.indexOf('@')) : myUsername
    // Employee Code from Employee List (Username → Email (Official) → Employee Code); match attendance by Employee Code when file has no email column
    const myEmployeeCodeFromList = (scopeFilter.employee_code_from_list || '').toString().trim()

    // First pass: scoped data for N/N-1/N-2 (so they see only their scope); month/week filter only
    for (const r of costImpactRows) {
      const flag = String(r['Flag'] || '').trim()
      if (flag !== 'P' && flag !== 'OD') continue

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

      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) continue
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(week))) continue

      const shiftInStr = String(r['Shift In Time'] || '').trim()
      const shiftOutStr = String(r['Shift Out Time'] || '').trim()
      const inTimeStr = String(r['In Time'] || '').trim()
      const outTimeStr = String(r['Out Time'] || '').trim()
      const shiftHrs = computeDurationHours(shiftInStr, shiftOutStr)
      const workHrs = computeDurationHours(inTimeStr, outTimeStr)
      if (shiftHrs <= 0) continue

      const shiftHrsRounded = Number(shiftHrs.toFixed(2))
      const workHrsRounded = Number(workHrs.toFixed(2))
      let lostHrs = workHrsRounded > 0 ? Math.max(0, shiftHrsRounded - workHrsRounded) : shiftHrsRounded
      lostHrs = Number(lostHrs.toFixed(2))
      const rate = getRate(functionName)
      const cost = rate != null ? Math.round(lostHrs * rate * 100) / 100 : 0

      const deptKey = rowDepts.length ? `${company}|${functionName}|${[...rowDepts].sort().join(',')}` : `${company}|${functionName}|`

      byDept.set(deptKey, (byDept.get(deptKey) || 0) + cost)
      if (!deptToUserKeys.has(deptKey)) deptToUserKeys.set(deptKey, new Set())
      deptToUserKeys.get(deptKey).add(userKey)

      const userDisplay = empCode && empName ? `${empName} (${empCode})` : empCode || empName
      if (!byUser.has(userKey)) {
        byUser.set(userKey, {
          user: userDisplay,
          company,
          function: functionName,
          department: rowDepts.length ? [...rowDepts].sort().join(', ') : '',
          shiftHoursSum: 0,
          workHoursSum: 0,
          lostHoursSum: 0,
          costSum: 0,
        })
      }
      const u = byUser.get(userKey)
      u.shiftHoursSum += shiftHrsRounded
      u.workHoursSum += workHrsRounded
      u.lostHoursSum += lostHrs
      u.costSum += cost

      const rowEmpCode = String(r['Employee Code'] || r['Employee ID'] || r['Emp Code'] || r['Code'] || '').trim()
      const employeeCodeMatch = myEmployeeCodeFromList && rowEmpCode && rowEmpCode === myEmployeeCodeFromList
      if (employeeCodeMatch) {
        myCompany = company
        myFunction = functionName
        myDepartment = rowDepts.length ? [...rowDepts].sort().join(', ') : ''
        myUserKey = userKey
      } else if (!myUserKey) {
        const rowEmail = getRowEmail(r)
        const emailMatch = myEmail && rowEmail === myEmail
        const rowEmailFirstPart = rowEmail && rowEmail.includes('@') ? rowEmail.slice(0, rowEmail.indexOf('@')) : rowEmail
        const usernameMatchesEmailPart = myUsernameForMatch && rowEmailFirstPart === myUsernameForMatch
        const usernameMatch = myUsername && (empCode.toLowerCase() === myUsername || empName.toLowerCase().replace(/\s+/g, '.') === myUsername)
        const namePartMatchesUsername = myUsernameForMatch && nameToUsernamePart(empName) === myUsernameForMatch
        const shortNameMatchesUsername = myUsernameForMatch && nameToShortUsername(empName) === myUsernameForMatch && rowEmailFirstPart === myUsernameForMatch
        if (emailMatch || usernameMatchesEmailPart || usernameMatch || namePartMatchesUsername || shortNameMatchesUsername) {
          myCompany = company
          myFunction = functionName
          myDepartment = rowDepts.length ? [...rowDepts].sort().join(', ') : ''
          myUserKey = userKey
        }
      }
      // Fallback: row has no email but name produces same short username (e.g. "Mahmudul Islam" → m.islam); use only if exactly one such person in data
      const rowEmailForFallback = getRowEmail(r)
      if (myUsernameForMatch && nameToShortUsername(empName) === myUsernameForMatch && !rowEmailForFallback) {
        shortNameCandidatesNoEmail.add(userKey)
      }
    }

    // If we still didn't match but exactly one person has that short name with no email in file, treat as current user
    if (!myUserKey && shortNameCandidatesNoEmail.size === 1) {
      myUserKey = [...shortNameCandidatesNoEmail][0]
      const u = byUser.get(myUserKey)
      if (u) {
        myCompany = u.company
        myFunction = u.function
        myDepartment = u.department
      }
    }

    // If we didn't find by email/username, try scope for my company/function/department
    if (!myUserKey && (scopeFilter.companies?.length === 1 || scopeFilter.departments?.length === 1 || scopeFilter.functions?.length === 1)) {
      myCompany = myCompany || (scopeFilter.companies && scopeFilter.companies[0])
      const fnList = scopeFilter.functions || []
      myFunction = myFunction || (fnList[0] && (typeof fnList[0] === 'object' ? fnList[0].name : fnList[0]))
      const deptList = scopeFilter.departments || []
      myDepartment = myDepartment || (deptList[0] && (typeof deptList[0] === 'object' ? deptList[0].name : deptList[0]))
    }

    // Fallback: if scope narrows to a single person in the department, treat that as the current user (your cost = their lost hours × avg CTC)
    const deptKeyForLookup = myCompany && myFunction ? `${myCompany}|${myFunction}|${(myDepartment || '').split(',').map(d => d.trim()).filter(Boolean).sort().join(',')}` : ''
    if (!myUserKey && deptKeyForLookup) {
      const userKeysInDept = deptToUserKeys.get(deptKeyForLookup)
      if (userKeysInDept && userKeysInDept.size === 1) {
        myUserKey = [...userKeysInDept][0]
      }
    }

    // Second pass: use allRows (full data) for function and company totals so they match Lost Hour Cost Analysis
    const byFunc = new Map()
    const byCompany = new Map()
    for (const r of allRows) {
      const flag = String(r['Flag'] || '').trim()
      if (flag !== 'P' && flag !== 'OD') continue

      const dateVal = getDateFromRow(r)
      const month = monthOf(dateVal)
      const week = getWeekOfMonth(dateVal || r['Attendance Date'])
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()

      if (selectedMonths.length > 0 && !selectedMonths.includes(month)) continue
      if (selectedWeeks.length > 0 && !selectedWeeks.includes(String(week))) continue

      const shiftInStr = String(r['Shift In Time'] || '').trim()
      const shiftOutStr = String(r['Shift Out Time'] || '').trim()
      const inTimeStr = String(r['In Time'] || '').trim()
      const outTimeStr = String(r['Out Time'] || '').trim()
      const shiftHrs = computeDurationHours(shiftInStr, shiftOutStr)
      const workHrs = computeDurationHours(inTimeStr, outTimeStr)
      if (shiftHrs <= 0) continue

      const shiftHrsRounded = Number(shiftHrs.toFixed(2))
      const workHrsRounded = Number(workHrs.toFixed(2))
      let lostHrs = workHrsRounded > 0 ? Math.max(0, shiftHrsRounded - workHrsRounded) : shiftHrsRounded
      lostHrs = Number(lostHrs.toFixed(2))
      const rate = getRate(functionName)
      const cost = rate != null ? Math.round(lostHrs * rate * 100) / 100 : 0

      const funcKey = `${company}|${functionName}`
      byFunc.set(funcKey, (byFunc.get(funcKey) || 0) + cost)
      byCompany.set(company, (byCompany.get(company) || 0) + cost)
    }

    // User cost and table from Cost Impact's own first pass (costImpactRows, month/week only)
    const costImpactUserRows = []
    for (const [key, data] of byUser.entries()) {
      const totalShiftHours = data.shiftHoursSum || 0
      const totalLostHours = data.lostHoursSum || 0
      const lostPct = totalShiftHours > 0 ? ((totalLostHours / totalShiftHours) * 100).toFixed(2) : '0.00'
      const rate = getRate(data.function)
      costImpactUserRows.push({
        user: data.user,
        company: data.company,
        function: data.function,
        department: data.department,
        shiftHours: data.shiftHoursSum.toFixed(2),
        workHours: data.workHoursSum.toFixed(2),
        lostHours: data.lostHoursSum.toFixed(2),
        lostPct: `${lostPct}%`,
        ctcPerHourDisplay: rate != null ? Number(rate.toFixed(2)) : '—',
        costBdt: data.costSum,
        costDisplay: data.costSum > 0 ? `৳${data.costSum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (data.costSum === 0 ? '৳0.00' : '—'),
        _userId: key,
        _shiftHoursNum: data.shiftHoursSum,
        _workHoursNum: data.workHoursSum,
        _lostHoursNum: data.lostHoursSum,
        _lostPctNum: parseFloat(lostPct),
        _costNum: data.costSum,
      })
    }
    costImpactUserRows.sort((a, b) => a.user.localeCompare(b.user))

    // Full company/function totals from weekly API (match Lost Hour Cost Analysis) when available
    const monthsForFull = selectedMonths.length > 0 ? selectedMonths : (() => {
      const set = new Set(); allRows.forEach(r => { const m = monthOf(getDateFromRow(r)); if (m) set.add(m) }); return [...set].sort()
    })()
    const byCompanyFromFull = new Map()
    const byFuncFromWeekly = new Map()
    if (companyTotalsFull && typeof companyTotalsFull === 'object') {
      monthsForFull.forEach(m => {
        const byCo = companyTotalsFull[m]
        if (byCo && typeof byCo === 'object') {
          Object.entries(byCo).forEach(([co, cost]) => {
            byCompanyFromFull.set(co, (byCompanyFromFull.get(co) || 0) + (Number(cost) || 0))
          })
        }
      })
    }
    if (weeklyData.length > 0 && (ctcPerHour != null || Object.keys(ctcByFunction || {}).length > 0)) {
      weeklyData.forEach(r => {
        const monthKey = r.year != null && r.month != null ? `${r.year}-${String(r.month).padStart(2, '0')}` : ''
        if (monthsForFull.length > 0 && !monthsForFull.includes(monthKey)) return
        const group = (r.group || '').trim()
        if (!group) return
        const lost = Number(r.lost ?? r.lost_hours ?? 0) || 0
        const rate = getRate(group)
        if (rate == null) return
        const cost = Math.round(lost * rate * 100) / 100
        byFuncFromWeekly.set(group, (byFuncFromWeekly.get(group) || 0) + cost)
      })
    }

    const myUserData = myUserKey ? byUser.get(myUserKey) : null
    const userCost = myUserData ? myUserData.costSum : 0
    const userLostHours = myUserData ? myUserData.lostHoursSum : 0
    const deptKey = myCompany && myFunction ? `${myCompany}|${myFunction}|${(myDepartment || '').split(',').map(d => d.trim()).filter(Boolean).sort().join(',')}` : ''
    const funcKey = myCompany && myFunction ? `${myCompany}|${myFunction}` : ''
    const deptCost = deptKey ? (byDept.get(deptKey) || 0) : 0
    const companyShort = companyFullToShort(myCompany)
    const funcGroupKey = companyShort && myFunction ? `${companyShort} - ${myFunction}` : ''
    const funcCostFromFull = funcGroupKey ? (byFuncFromWeekly.get(funcGroupKey) ?? byFunc.get(funcKey) ?? 0) : (funcKey ? (byFunc.get(funcKey) || 0) : 0)
    const funcCost = funcCostFromFull
    const companyCostFromFull = companyShort ? (byCompanyFromFull.get(companyShort) ?? byCompany.get(myCompany) ?? 0) : (myCompany ? (byCompany.get(myCompany) || 0) : 0)
    const companyCost = companyCostFromFull

    const pct = (num, den) => (den > 0 ? (num / den) * 100 : 0)
    const userPctOfDept = pct(userCost, deptCost)
    const deptPctOfFunc = pct(deptCost, funcCost)
    const funcPctOfCompany = pct(funcCost, companyCost)

    const fmt = (n) => (n != null && !Number.isNaN(n) ? `৳${Number(n).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—')
    const fmtPct = (n) => (n != null && !Number.isNaN(n) ? `${Number(n).toFixed(2)}%` : '—')

    // Table: when we match the logged-in user, one row only; otherwise show all rows in scope (N/N-1/N-2 see only their scope)
    const rowsToShow = myUserKey
      ? costImpactUserRows.filter((row) => row._userId === myUserKey)
      : costImpactUserRows
    const tableData = rowsToShow.map((row) => {
      const dKey = `${row.company}|${row.function}|${(row.department || '').split(',').map(d => d.trim()).filter(Boolean).sort().join(',')}`
      const fKey = `${row.company}|${row.function}`
      const rowCompanyShort = companyFullToShort(row.company)
      const rowFuncGroupKey = rowCompanyShort && row.function ? `${rowCompanyShort} - ${row.function}` : ''
      const rowDeptCost = byDept.get(dKey) || 0
      const rowFuncCost = rowFuncGroupKey ? (byFuncFromWeekly.get(rowFuncGroupKey) ?? byFunc.get(fKey)) : (byFunc.get(fKey) || 0)
      const rowCompanyCost = rowCompanyShort ? (byCompanyFromFull.get(rowCompanyShort) ?? byCompany.get(row.company)) : (byCompany.get(row.company) || 0)
      const costNum = row._costNum ?? 0
      const costPctDept = rowDeptCost > 0 ? (costNum / rowDeptCost) * 100 : 0
      const deptPctFunc = rowFuncCost > 0 ? (rowDeptCost / rowFuncCost) * 100 : 0
      const funcPctCompany = rowCompanyCost > 0 ? (rowFuncCost / rowCompanyCost) * 100 : 0
      const isLoggedInUser = myUserKey && row._userId === myUserKey
      return {
        ...row,
        userLoginId: isLoggedInUser ? (currentUser?.username ?? row._userId ?? '') : (row._userId ?? ''),
        departmentCost: rowDeptCost,
        costPctOfDepartment: costPctDept,
        functionCost: rowFuncCost,
        departmentCostPctOfFunction: deptPctFunc,
        companyCost: rowCompanyCost,
        functionCostPctOfCompany: funcPctCompany,
        departmentCostDisplay: fmt(rowDeptCost),
        functionCostDisplay: fmt(rowFuncCost),
        companyCostDisplay: fmt(rowCompanyCost),
        costPctOfDepartmentDisplay: `${costPctDept.toFixed(2)}%`,
        departmentCostPctOfFunctionDisplay: `${deptPctFunc.toFixed(2)}%`,
        functionCostPctOfCompanyDisplay: `${funcPctCompany.toFixed(2)}%`,
      }
    })

    return {
      userCost,
      userLostHours,
      deptCost,
      funcCost,
      companyCost,
      userPctOfDept,
      deptPctOfFunc,
      funcPctOfCompany,
      userCostDisplay: fmt(userCost),
      deptCostDisplay: fmt(deptCost),
      funcCostDisplay: fmt(funcCost),
      companyCostDisplay: fmt(companyCost),
      userPctDisplay: fmtPct(userPctOfDept),
      deptPctDisplay: fmtPct(deptPctOfFunc),
      funcPctDisplay: fmtPct(funcPctOfCompany),
      myCompany: myCompany || '—',
      myFunction: myFunction || '—',
      myDepartment: myDepartment || '—',
      hasEmailToMatch: !!(myEmail || myUsernameForMatch || myEmployeeCodeFromList),
      matchedUser: !!myUserKey,
      tableData,
    }
  }, [allRows, scopedRows, scopeFilter.all, scopeFilter.employee_code_from_list, currentUser, ctcPerHour, ctcByFunction, selectedMonths, selectedWeeks, scopeFilter.companies, scopeFilter.functions, scopeFilter.departments, companyTotalsFull, weeklyData, companyFullToShort])

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

  // OD rows: employee_name is "Name (EmployeeCode)". N = all; N-1 = whole function; N-2 and below = self + direct subordinates.
  const odAllowedCodeSet = useMemo(() => {
    if (scopeFilter.all) return null
    const level = scopeFilter.dataScopeLevel || ''
    if (level === 'N-1') {
      const allowed = (scopeFilter.allowed_employee_codes || []).map(c => String(c).trim().toLowerCase()).filter(Boolean)
      return allowed.length > 0 ? new Set(allowed) : null
    }
    const selfCode = (scopeFilter.employee_code_from_list || '').toString().trim().toLowerCase()
    const directCodes = (scopeFilter.direct_employee_codes || []).map(c => String(c).trim().toLowerCase()).filter(Boolean)
    const set = new Set([selfCode, ...directCodes].filter(Boolean))
    return set.size > 0 ? set : null
  }, [scopeFilter.all, scopeFilter.dataScopeLevel, scopeFilter.employee_code_from_list, scopeFilter.direct_employee_codes, scopeFilter.allowed_employee_codes])

  const odFilteredData = useMemo(() => {
    const allowedCompanies = scopeFilter.all ? null : (scopeFilter.companies || [])
    const allowedFunctionNames = scopeFilter.all ? null : (scopeFilter.functions || []).map(f => (f && typeof f === 'object' && f.name) ? f.name : f)
    const allowedDepartmentNames = scopeFilter.all ? null : (scopeFilter.departments || []).map(d => (d && typeof d === 'object' && d.name) ? d.name : d)
    const allowedCompaniesShort = allowedCompanies?.length ? allowedCompanies.map(c => companyFullToShort(c) || c).filter(Boolean) : []
    const functionMatches = (rowFunc, allowedList) => {
      if (!allowedList?.length) return true
      const r = (rowFunc || '').toLowerCase()
      return allowedList.some(a => {
        const al = (a || '').toLowerCase()
        return al === r || r.includes(al) || al.includes(r)
      })
    }
    const deptMatches = (rowDepts, allowedList) => {
      if (!allowedList?.length) return true
      return rowDepts.some(d => {
        const rd = (d || '').toLowerCase()
        return allowedList.some(a => (a || '').toLowerCase() === rd || rd.includes((a || '').toLowerCase()) || (a || '').toLowerCase().includes(rd))
      })
    }
    const extractCodeFromEmployeeName = (name) => {
      if (!name || typeof name !== 'string') return ''
      const m = name.match(/\(([^)]+)\)\s*$/)
      return m ? String(m[1]).trim().toLowerCase() : ''
    }
    return odData.filter(r => {
      if (odAllowedCodeSet) {
        const rowCode = extractCodeFromEmployeeName(r.employee_name)
        if (!rowCode || !odAllowedCodeSet.has(rowCode)) return false
      }
      if (!scopeFilter.all) {
        if (allowedCompaniesShort?.length > 0) {
          const rowCompanyNorm = (r.company || '').trim()
          const match = allowedCompaniesShort.some(sc => sc === rowCompanyNorm || (sc && rowCompanyNorm && sc.toLowerCase() === rowCompanyNorm.toLowerCase()))
          if (!match) return false
        }
        if (allowedFunctionNames?.length > 0 && !functionMatches(r.function, allowedFunctionNames)) return false
        if (allowedDepartmentNames?.length > 0) {
          const rowDepts = (r.department || '').split(',').map(d => d.trim()).filter(Boolean)
          if (!deptMatches(rowDepts, allowedDepartmentNames)) return false
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
  }, [odData, odAllowedCodeSet, scopeFilter.all, scopeFilter.companies, scopeFilter.functions, scopeFilter.departments, companyFullToShort, selectedCompanies, selectedFunctions, selectedDepartments, selectedUsers, fromMonth, toMonth])

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
    if (activeTab === 'on_time') {
      return computeOnTimeUserWise.map((row, idx) => ({ ...row, sl: idx + 1 }))
    }
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
      const blueLight = { headerStyle: { backgroundColor: '#93c5fd' }, cellStyle: { backgroundColor: '#dbeafe' } }
      const blueDark = { headerStyle: { backgroundColor: '#60a5fa' }, cellStyle: { backgroundColor: '#93c5fd' } }
      const greenLight = { headerStyle: { backgroundColor: '#86efac' }, cellStyle: { backgroundColor: '#dcfce7' } }
      const greenDark = { headerStyle: { backgroundColor: '#4ade80' }, cellStyle: { backgroundColor: '#bbf7d0' } }
      return [
        { key: 'sl', label: 'SL', sortable: true, compact: true },
        { key: 'employeeCode', label: 'Employee Code', sortable: true, wrapText: true },
        { key: 'name', label: 'Name', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'present', label: 'Present', sortable: true, compact: true, ...blueLight },
        { key: 'late', label: 'Late', sortable: true, compact: true, ...blueDark },
        { key: 'onTime', label: 'On Time', sortable: true, compact: true, ...greenLight },
        { key: 'onTimePct', label: 'On Time %', sortable: true, sortKey: '_onTimePctNum', compact: true, ...greenDark },
        detailsColumn,
      ]
    }
    if (activeTab === 'work_hour') {
      const blue1 = { headerStyle: { backgroundColor: '#93c5fd' }, cellStyle: { backgroundColor: '#dbeafe' } }
      const blue2 = { headerStyle: { backgroundColor: '#60a5fa' }, cellStyle: { backgroundColor: '#93c5fd' } }
      const green1 = { headerStyle: { backgroundColor: '#86efac' }, cellStyle: { backgroundColor: '#dcfce7' } }
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'totalDays', label: 'Total Days', sortable: true, compact: true, ...blue1 },
        { key: 'completedDays', label: 'Completed Days', sortable: true, compact: true, ...blue2 },
        { key: 'completionPct', label: 'Completion %', sortable: true, sortKey: '_completionPctNum', compact: true, ...green1 },
        detailsColumn,
      ]
    }
    if (activeTab === 'work_hour_lost') {
      const blue1 = { headerStyle: { backgroundColor: '#93c5fd' }, cellStyle: { backgroundColor: '#dbeafe' } }
      const blue2 = { headerStyle: { backgroundColor: '#60a5fa' }, cellStyle: { backgroundColor: '#93c5fd' } }
      const amber1 = { headerStyle: { backgroundColor: '#fcd34d' }, cellStyle: { backgroundColor: '#fef3c7' } }
      const amber2 = { headerStyle: { backgroundColor: '#fbbf24' }, cellStyle: { backgroundColor: '#fde68a' } }
      const green1 = { headerStyle: { backgroundColor: '#86efac' }, cellStyle: { backgroundColor: '#dcfce7' } }
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'shiftHours', label: 'Shift Hours', sortable: true, sortKey: '_shiftHoursNum', compact: true, ...blue1 },
        { key: 'workHours', label: 'Work Hours', sortable: true, sortKey: '_workHoursNum', compact: true, ...blue2 },
        { key: 'lostHours', label: 'Lost Hours', sortable: true, sortKey: '_lostHoursNum', compact: true, ...amber1 },
        { key: 'lostPct', label: 'Lost %', sortable: true, sortKey: '_lostPctNum', compact: true, ...amber2 },
        { key: 'actualOvertime', label: 'Actual Overtime', sortable: true, sortKey: '_actualOvertimeNum', compact: true, ...green1 },
        detailsColumn,
      ]
    }
    if (activeTab === 'work_hour_lost_cost') {
      const blue1 = { headerStyle: { backgroundColor: '#93c5fd' }, cellStyle: { backgroundColor: '#dbeafe' } }
      const blue2 = { headerStyle: { backgroundColor: '#60a5fa' }, cellStyle: { backgroundColor: '#93c5fd' } }
      const amber1 = { headerStyle: { backgroundColor: '#fcd34d' }, cellStyle: { backgroundColor: '#fef3c7' } }
      const amber2 = { headerStyle: { backgroundColor: '#fbbf24' }, cellStyle: { backgroundColor: '#fde68a' } }
      const violet1 = { headerStyle: { backgroundColor: '#c4b5fd' }, cellStyle: { backgroundColor: '#ede9fe' } }
      const violet2 = { headerStyle: { backgroundColor: '#a78bfa' }, cellStyle: { backgroundColor: '#ddd6fe' } }
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'shiftHours', label: 'Shift Hours', sortable: true, sortKey: '_shiftHoursNum', compact: true, ...blue1 },
        { key: 'workHours', label: 'Work Hours', sortable: true, sortKey: '_workHoursNum', compact: true, ...blue2 },
        { key: 'lostHours', label: 'Lost Hours', sortable: true, sortKey: '_lostHoursNum', compact: true, ...amber1 },
        { key: 'lostPct', label: 'Lost %', sortable: true, sortKey: '_lostPctNum', compact: true, ...amber2 },
        { key: 'ctcPerHourDisplay', label: 'CTC/hour (BDT)', sortable: true, compact: true, ...violet1 },
        { key: 'costDisplay', label: 'Cost (BDT)', sortable: true, sortKey: '_costNum', compact: true, ...violet2 },
        detailsColumn,
      ]
    }
    if (activeTab === 'leave_analysis') {
      const slate1 = { headerStyle: { backgroundColor: '#94a3b8' }, cellStyle: { backgroundColor: '#e2e8f0' } }
      const slate2 = { headerStyle: { backgroundColor: '#64748b' }, cellStyle: { backgroundColor: '#cbd5e1' } }
      const slate3 = { headerStyle: { backgroundColor: '#475569' }, cellStyle: { backgroundColor: '#94a3b8' } }
      const teal1 = { headerStyle: { backgroundColor: '#5eead4' }, cellStyle: { backgroundColor: '#ccfbf1' } }
      const teal2 = { headerStyle: { backgroundColor: '#2dd4bf' }, cellStyle: { backgroundColor: '#99f6e4' } }
      const teal3 = { headerStyle: { backgroundColor: '#14b8a6' }, cellStyle: { backgroundColor: '#5eead4' } }
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'month', label: 'Month', sortable: true },
        { key: 'total_sl', label: 'Total SL', sortable: true, sortKey: '_totalSlNum', compact: true, ...slate1 },
        { key: 'total_cl', label: 'Total CL', sortable: true, sortKey: '_totalClNum', compact: true, ...slate2 },
        { key: 'total_a', label: 'Total A', sortable: true, compact: true, ...slate3 },
        { key: 'workdays', label: 'Workdays (in month)', sortable: true, compact: true, title: 'Number of working days in the month shown in this row', ...slate1 },
        { key: 'sl_pct', label: 'Adj. SL%', sortable: true, sortKey: '_slPctNum', compact: true, ...teal1 },
        { key: 'cl_pct', label: 'Adj. CL%', sortable: true, sortKey: '_clPctNum', compact: true, ...teal2 },
        { key: 'a_pct', label: 'A %', sortable: true, sortKey: '_aPctNum', compact: true, ...teal3 },
        detailsColumn,
      ]
    }
    if (activeTab === 'od_analysis') {
      const indigo1 = { headerStyle: { backgroundColor: '#a5b4fc' }, cellStyle: { backgroundColor: '#e0e7ff' } }
      const indigo2 = { headerStyle: { backgroundColor: '#818cf8' }, cellStyle: { backgroundColor: '#c7d2fe' } }
      return [
        { key: 'user', label: 'User', sortable: true, wrapText: true },
        { key: 'company', label: 'Company', sortable: true, wrapText: true },
        { key: 'function', label: 'Function', sortable: true, wrapText: true },
        { key: 'department', label: 'Department', sortable: true, wrapText: true },
        { key: 'month', label: 'Month', sortable: true, ...indigo1 },
        { key: 'od', label: 'OD', sortable: true, compact: true, ...indigo2 },
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

      {/* Cost Impact tab: Month filter only → Cards → Table */}
      {activeTab === 'cost_impact' && (
        <div className="card p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">Cost Impact — Your lost hours cost and hierarchy</h3>

          {(isLoading || scopeFilter.isLoading) ? (
            <div className="flex items-center justify-center min-h-[280px] py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-blue-200 border-t-blue-600 mb-4"></div>
                <p className="text-gray-600">{scopeFilter.isLoading ? 'Loading your access scope...' : 'Loading data...'}</p>
              </div>
            </div>
          ) : (
          <>
          {/* 1. Month filter only — same visual style as Function/Department filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
              <MultiSelectSearchable
                id="cost-impact-month"
                label="Month"
                icon="lnr lnr-calendar-full text-blue-600"
                value={selectedMonths}
                onChange={setSelectedMonths}
                options={uniqueMonths.map(month => ({
                  value: month,
                  label: toMonthLabel(month)
                }))}
                placeholder="All months"
              />
            </div>
            <p className="text-xs text-gray-500 self-center">Cost = Lost hours × CTC/hour (Cost Settings).</p>
          </div>

          {/* 2. Impact summary line (you → dept → function → company) */}
          {costImpact.matchedUser && costImpact.userCost > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700">
              <span className="font-medium">Impact:</span> Your cost {costImpact.userCostDisplay} is <strong>{costImpact.userPctDisplay}</strong> of your department → department is <strong>{costImpact.deptPctDisplay}</strong> of your function → function is <strong>{costImpact.funcPctDisplay}</strong> of your company.
            </div>
          )}

          {/* 3. Cards */}
          <h3 className="text-lg font-semibold text-gray-800">Summary for you</h3>
          {costImpact.hasEmailToMatch && !costImpact.matchedUser && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm space-y-2">
              <p>No attendance rows found for your login. Matching uses: (1) <strong>Email</strong> — set your <strong>Employee Email</strong> in User Management to match an <strong>Email (Official)</strong> column in the attendance file, or (2) <strong>Employee Code</strong> — Username is matched to Employee List <strong>Email (Official)</strong> to get your <strong>Employee Code</strong>, then attendance rows are matched by <strong>Employee Code</strong> (no email column needed in attendance).</p>
              <p className="text-xs text-amber-700 mt-2">
                <strong>Your account:</strong> Login email = <code className="bg-amber-100 px-1 rounded">{(currentUser?.employee_email || currentUser?.email || '').trim() || '—'}</code>, Username = <code className="bg-amber-100 px-1 rounded">{(currentUser?.username || '').trim() || '—'}</code>, Employee Email (User Management) = <code className="bg-amber-100 px-1 rounded">{(currentUser?.employee_email || '').trim() || '—'}</code>. Employee Code from list = <code className="bg-amber-100 px-1 rounded">{scopeFilter.employee_code_from_list || '—'}</code>. Ensure your Username or Employee Email matches the Employee List <strong>Email (Official)</strong> and the attendance file has an <strong>Employee Code</strong> column matching that code.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-violet-100 p-5 shadow">
              <div className="text-sm font-semibold text-violet-800 uppercase tracking-wide">1. Your cost</div>
              <div className="text-2xl font-bold text-violet-900 mt-1">{costImpact.userCostDisplay}</div>
              {costImpact.matchedUser && costImpact.userLostHours > 0 && costImpact.userCost === 0 && (
                <div className="text-xs text-violet-700 mt-1">Your lost hours: <strong>{Number(costImpact.userLostHours).toFixed(2)} h</strong> — set CTC per hour in Cost Settings to see cost</div>
              )}
              {costImpact.matchedUser && costImpact.userLostHours === 0 && (
                <div className="text-xs text-violet-700 mt-1">No lost hours in selected month</div>
              )}
              <div className="text-xs text-violet-700 mt-2">Your cost as % of your department&apos;s total: <strong>{costImpact.userPctDisplay}</strong></div>
            </div>
            <div className="rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-blue-100 p-5 shadow">
              <div className="text-sm font-semibold text-blue-800 uppercase tracking-wide">2. Your department</div>
              <div className="text-xs text-blue-600 mb-1">{costImpact.myDepartment}</div>
              <div className="text-2xl font-bold text-blue-900">{costImpact.deptCostDisplay}</div>
              <div className="text-xs text-blue-700 mt-2">Your department&apos;s cost as % of your function&apos;s total: <strong>{costImpact.deptPctDisplay}</strong></div>
            </div>
            <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 shadow">
              <div className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">3. Your function</div>
              <div className="text-xs text-emerald-600 mb-1">{costImpact.myFunction}</div>
              <div className="text-2xl font-bold text-emerald-900">{costImpact.funcCostDisplay}</div>
              <div className="text-xs text-emerald-700 mt-2">Your function&apos;s cost as % of your company&apos;s total: <strong>{costImpact.funcPctDisplay}</strong></div>
            </div>
            <div className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 p-5 shadow">
              <div className="text-sm font-semibold text-amber-800 uppercase tracking-wide">4. Your company</div>
              <div className="text-xs text-amber-600 mb-1">{costImpact.myCompany}</div>
              <div className="text-2xl font-bold text-amber-900">{costImpact.companyCostDisplay}</div>
              <div className="text-xs text-amber-700 mt-2">Total company lost hour cost</div>
            </div>
          </div>

          {/* 4. Table */}
          <h3 className="text-lg font-semibold text-gray-800 pt-2">Your row (detail)</h3>
          {costImpact.tableData && costImpact.tableData.length > 0 ? (
            <>
              {!costImpact.matchedUser && (
                <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  We couldn&apos;t identify your row. Showing all users below — find your row by name.
                </p>
              )}
              <div className="overflow-x-auto -mx-2">
                <DataTable
                  columns={[
                    { key: 'user', label: 'User', sortable: true, wrapText: true },
                    { key: 'userLoginId', label: 'User Login ID', sortable: true, compact: true },
                    { key: 'company', label: 'Company', sortable: true, wrapText: true },
                    { key: 'function', label: 'Function', sortable: true, wrapText: true },
                    { key: 'department', label: 'Department', sortable: true, wrapText: true },
                    { key: 'shiftHours', label: 'Shift Hours', sortable: true, sortKey: '_shiftHoursNum', compact: true, headerStyle: { backgroundColor: '#93c5fd' }, cellStyle: { backgroundColor: '#dbeafe' } },
                    { key: 'workHours', label: 'Work Hours', sortable: true, sortKey: '_workHoursNum', compact: true, headerStyle: { backgroundColor: '#60a5fa' }, cellStyle: { backgroundColor: '#93c5fd' } },
                    { key: 'lostHours', label: 'Lost Hours', sortable: true, sortKey: '_lostHoursNum', compact: true, headerStyle: { backgroundColor: '#fcd34d' }, cellStyle: { backgroundColor: '#fef3c7' } },
                    { key: 'lostPct', label: 'Lost %', sortable: true, sortKey: '_lostPctNum', compact: true, headerStyle: { backgroundColor: '#fbbf24' }, cellStyle: { backgroundColor: '#fde68a' } },
                    { key: 'ctcPerHourDisplay', label: 'CTC/Hour (BDT)', sortable: false, compact: true, headerStyle: { backgroundColor: '#c4b5fd' }, cellStyle: { backgroundColor: '#ede9fe' } },
                    { key: 'costDisplay', label: 'Cost (BDT)', sortable: true, sortKey: '_costNum', compact: true, headerStyle: { backgroundColor: '#a78bfa' }, cellStyle: { backgroundColor: '#ddd6fe' } },
                    { key: 'departmentCostDisplay', label: 'Department Cost', sortable: true, sortKey: 'departmentCost', compact: true, headerStyle: { backgroundColor: '#5eead4' }, cellStyle: { backgroundColor: '#ccfbf1' } },
                    { key: 'costPctOfDepartmentDisplay', label: 'Cost % of Department', sortable: true, sortKey: 'costPctOfDepartment', compact: true, headerStyle: { backgroundColor: '#2dd4bf' }, cellStyle: { backgroundColor: '#99f6e4' } },
                    { key: 'functionCostDisplay', label: 'Function Cost', sortable: true, sortKey: 'functionCost', compact: true, headerStyle: { backgroundColor: '#34d399' }, cellStyle: { backgroundColor: '#d1fae5' } },
                    { key: 'departmentCostPctOfFunctionDisplay', label: 'Dept Cost % of Function', sortable: true, sortKey: 'departmentCostPctOfFunction', compact: true, headerStyle: { backgroundColor: '#10b981' }, cellStyle: { backgroundColor: '#a7f3d0' } },
                    { key: 'companyCostDisplay', label: 'Company Cost', sortable: true, sortKey: 'companyCost', compact: true, headerStyle: { backgroundColor: '#fcd34d' }, cellStyle: { backgroundColor: '#fef3c7' } },
                    { key: 'functionCostPctOfCompanyDisplay', label: 'Function Cost % of Company', sortable: true, sortKey: 'functionCostPctOfCompany', compact: true, headerStyle: { backgroundColor: '#fbbf24' }, cellStyle: { backgroundColor: '#fde68a' } },
                  ]}
                  rows={costImpact.tableData}
                />
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm">No data for the selected month. Choose a month above or upload attendance files.</p>
          )}
          <p className="text-xs text-gray-500">
            Set CTC per hour in <strong>Cost Settings</strong> to see non-zero costs.
          </p>
          </>
          )}
        </div>
      )}

      {/* Filters (hidden on Cost Impact — that tab has month-only filter above) */}
      {activeTab !== 'cost_impact' && (
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
      )}

      {/* Table (hidden for Cost Impact; that tab has its own panel above) */}
      {activeTab !== 'cost_impact' && (
      <div className="card p-6">
        {(isLoading || scopeFilter.isLoading) ? (
          <div className="flex items-center justify-center min-h-[320px] py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-blue-200 border-t-blue-600 mb-4"></div>
              <p className="text-gray-700">
                {scopeFilter.isLoading ? 'Loading your access scope...' : `Loading ${tabs.find(t => t.key === activeTab)?.label || 'user analytics'} data...`}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-800">{tabs.find(t => t.key === activeTab)?.label}</h3>
                {CALCULATION_HELP[activeTab] && (
                  <button
                    type="button"
                    onClick={() => setShowCalcHelp(!showCalcHelp)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    title={showCalcHelp ? 'Hide calculation info' : 'How is this calculated?'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              {showCalcHelp && CALCULATION_HELP[activeTab] && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">{CALCULATION_HELP[activeTab].title}</h4>
                  <ul className="text-sm text-slate-700 space-y-1.5 list-disc list-inside">
                    {CALCULATION_HELP[activeTab].points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {activeTab === 'leave_analysis' && (
              <p className="text-sm text-gray-600 mb-3">
                Each row is <strong>one month per user</strong>. &quot;Workdays (in month)&quot; is the number of working days in that row&apos;s month (e.g. ~21–22 for a typical month).
              </p>
            )}
            {tableData.length > 0 ? (
              <DataTable columns={columns} rows={tableData} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                {(scopeFilter.isLoading || filesLoading || (files.length > 0 && allRowsLoading)) ? (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-blue-200 border-t-blue-600"></div>
                    <p className="text-gray-700">Loading {tabs.find(t => t.key === activeTab)?.label || 'user analytics'} data...</p>
                  </div>
                ) : !scopeFilter.all && allRows.length > 0 ? (
                  <p>No rows match your data scope. Check User Management and data scope settings.</p>
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
      )}

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
