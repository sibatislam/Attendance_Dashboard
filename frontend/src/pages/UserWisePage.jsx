import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listFiles, getFileDetail } from '../lib/api'
import DataTable from '../components/DataTable'
import SearchableSelect from '../components/SearchableSelect'

const tabs = [
  { key: 'on_time', label: 'On Time %' },
  { key: 'work_hour', label: 'Work Hour Completion' },
  { key: 'work_hour_lost', label: 'Work Hour Lost' },
]

export default function UserWisePage() {
  const [activeTab, setActiveTab] = useState('on_time')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedFunction, setSelectedFunction] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedWeek, setSelectedWeek] = useState('')

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

  // Helper functions
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
      const month = String(monthNames[monthMatch[1]]).padStart(2, '0')
      return `${year}-${month}`
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

    for (const r of allRows) {
      const month = monthOf(r['Attendance Date'] || '')
      const week = getWeekOfMonth(r['Attendance Date'] || '')
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = String(r['Name'] || '').trim()
      const userKey = empCode || empName

      if (!userKey) continue

      // Format user display for filter matching
      const userDisplay = empCode && empName 
        ? `${empName} (${empCode})`
        : empCode || empName

      // Apply filters
      if (selectedCompany && company !== selectedCompany) continue
      if (selectedFunction && functionName !== selectedFunction) continue
      if (selectedUser && userDisplay !== selectedUser) continue
      if (selectedMonth && month !== selectedMonth) continue
      if (selectedWeek && String(week) !== selectedWeek) continue

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
          members: new Set(),
          present: 0,
          late: 0,
          onTime: 0,
        })
      }

      const data = userData.get(key)
      data.members.add(userKey)
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
    }

    return results.sort((a, b) => a.user.localeCompare(b.user))
  }, [allRows, selectedCompany, selectedFunction, selectedUser, selectedMonth, selectedWeek])

  // Compute Work Hour Completion per user
  const computeWorkHourUserWise = useMemo(() => {
    const userData = new Map()

    for (const r of allRows) {
      const month = monthOf(r['Attendance Date'] || '')
      const week = getWeekOfMonth(r['Attendance Date'] || '')
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = String(r['Name'] || '').trim()
      const userKey = empCode || empName

      if (!userKey) continue

      // Format user display for filter matching
      const userDisplay = empCode && empName 
        ? `${empName} (${empCode})`
        : empCode || empName

      // Apply filters
      if (selectedCompany && company !== selectedCompany) continue
      if (selectedFunction && functionName !== selectedFunction) continue
      if (selectedUser && userDisplay !== selectedUser) continue
      if (selectedMonth && month !== selectedMonth) continue
      if (selectedWeek && String(week) !== selectedWeek) continue

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
          members: new Set(),
          shiftHoursSum: 0,
          workHoursSum: 0,
          completedCount: 0,
          totalCount: 0,
        })
      }

      const data = userData.get(key)
      data.members.add(userKey)

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
    }

    return results.sort((a, b) => a.user.localeCompare(b.user))
  }, [allRows, selectedCompany, selectedFunction, selectedUser, selectedMonth, selectedWeek])

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

    for (const r of allRows) {
      const month = monthOf(r['Attendance Date'] || '')
      const week = getWeekOfMonth(r['Attendance Date'] || '')
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = String(r['Name'] || '').trim()
      const userKey = empCode || empName

      if (!userKey) continue

      // Format user display for filter matching
      const userDisplay = empCode && empName 
        ? `${empName} (${empCode})`
        : empCode || empName

      // Apply filters
      if (selectedCompany && company !== selectedCompany) continue
      if (selectedFunction && functionName !== selectedFunction) continue
      if (selectedUser && userDisplay !== selectedUser) continue
      if (selectedMonth && month !== selectedMonth) continue
      if (selectedWeek && String(week) !== selectedWeek) continue

      const flag = String(r['Flag'] || '').trim()
      // Skip weekends and holidays (Flag="W" or "H") for work hour lost calculations
      if (flag === 'W' || flag === 'H') continue

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
          members: new Set(),
          shiftHoursSum: 0,
          workHoursSum: 0,
          lostHoursSum: 0,
        })
      }

      const data = userData.get(key)
      data.members.add(userKey)

      // Calculate lost hours per day (matching backend logic exactly)
      const shiftInStr = String(r['Shift In Time'] || '').trim()
      const shiftOutStr = String(r['Shift Out Time'] || '').trim()
      const inTimeStr = String(r['In Time'] || '').trim()
      const outTimeStr = String(r['Out Time'] || '').trim()

      const shiftHrs = computeDurationHours(shiftInStr, shiftOutStr)
      const workHrs = computeDurationHours(inTimeStr, outTimeStr)

      // Calculate lost hours per person per day: if shift is 9h and work is 8h, lost = 1h
      // This matches backend logic in work_hour_lost.py lines 173-200
      if (shiftHrs > 0) {
        const shiftHrsRounded = Number(shiftHrs.toFixed(2))
        const workHrsRounded = Number(workHrs.toFixed(2))

        // Always add shift and work hours for ALL flags (matching backend)
        // Backend: shift_hours_sum[key] += shift_hrs and work_hours_sum[key] += work_hrs
        data.shiftHoursSum += shiftHrsRounded
        data.workHoursSum += workHrsRounded

        // Lost-hour business rule (matching backend exactly):
        // We count loss ONLY for Present, OD, and blank-flag days.
        // - P/OD/blank + work > 0    → partial loss = shift - work (clamped at 0)
        // - P/OD/blank + work == 0   → full shift lost
        // - others (A, L, etc.) → no loss (but still counted in shift/work hours above)
        const countableFlags = ['P', 'OD', '']
        let lostHrs = 0.0
        if (countableFlags.includes(flag)) {
          if (workHrsRounded > 0) {
            // Partial loss: shift - work (clamped at 0)
            // If work > shift on this day, lost = 0 (correct per-day calculation)
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

    return results.sort((a, b) => a.user.localeCompare(b.user))
  }, [allRows, selectedCompany, selectedFunction, selectedUser, selectedMonth, selectedWeek])

  // Get unique values for filters
  const uniqueCompanies = useMemo(() => {
    const companies = new Set()
    for (const r of allRows) {
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      if (company) companies.add(company)
    }
    return Array.from(companies).sort()
  }, [allRows])

  const uniqueFunctions = useMemo(() => {
    const functions = new Set()
    for (const r of allRows) {
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const func = String(r['Function Name'] || '').trim()
      
      // Filter by selected company if it is selected
      if (selectedCompany && company !== selectedCompany) continue
      
      if (func) functions.add(func)
    }
    return Array.from(functions).sort()
  }, [allRows, selectedCompany])

  const uniqueUsers = useMemo(() => {
    const users = new Set()
    for (const r of allRows) {
      const company = String(r['Company Name'] || r['Comapny Name'] || '').trim()
      const functionName = String(r['Function Name'] || '').trim()
      const empCode = String(r['Employee Code'] || '').trim()
      const empName = String(r['Name'] || '').trim()
      const userKey = empCode || empName
      
      // Filter by selected company and function if they are selected
      if (selectedCompany && company !== selectedCompany) continue
      if (selectedFunction && functionName !== selectedFunction) continue
      
      if (userKey) {
        // Format user display: "Name (ID)" or "ID" if no name, or "Name" if no ID
        const userDisplay = empCode && empName 
          ? `${empName} (${empCode})`
          : empCode || empName
        users.add(userDisplay)
      }
    }
    return Array.from(users).sort()
  }, [allRows, selectedCompany, selectedFunction])

  const uniqueMonths = useMemo(() => {
    const months = new Set()
    for (const r of allRows) {
      const month = monthOf(r['Attendance Date'] || '')
      if (month) months.add(month)
    }
    return Array.from(months).sort()
  }, [allRows])

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
    return []
  }, [activeTab, computeOnTimeUserWise, computeWorkHourUserWise, computeWorkHourLostUserWise])

  // Get columns based on active tab
  const columns = useMemo(() => {
    if (activeTab === 'on_time') {
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
    }
    if (activeTab === 'work_hour') {
      return [
        { key: 'user', label: 'User' },
        { key: 'company', label: 'Company' },
        { key: 'function', label: 'Function' },
        { key: 'members', label: 'Members' },
        { key: 'totalDays', label: 'Total Days' },
        { key: 'completedDays', label: 'Completed Days' },
        { key: 'completionPct', label: 'Completion %' },
      ]
    }
    if (activeTab === 'work_hour_lost') {
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
  }, [activeTab])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Wise Analysis</h2>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <SearchableSelect
              id="companyFilter"
              label="Company"
              icon="lnr lnr-briefcase text-blue-600"
              value={selectedCompany}
              onChange={setSelectedCompany}
              options={uniqueCompanies}
              placeholder="All Companies"
            />
          </div>

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <SearchableSelect
              id="functionFilter"
              label="Function"
              icon="lnr lnr-layers text-blue-600"
              value={selectedFunction}
              onChange={setSelectedFunction}
              options={uniqueFunctions}
              placeholder="All Functions"
            />
          </div>

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <SearchableSelect
              id="userFilter"
              label="User"
              icon="lnr lnr-user text-blue-600"
              value={selectedUser}
              onChange={setSelectedUser}
              options={uniqueUsers}
              placeholder="All Users"
            />
          </div>

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <SearchableSelect
              id="monthFilter"
              label="Month"
              icon="lnr lnr-calendar-full text-blue-600"
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={uniqueMonths.map(month => ({
                value: month,
                label: toMonthLabel(month)
              }))}
              placeholder="All Months"
            />
          </div>

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <SearchableSelect
              id="weekFilter"
              label="Week"
              icon="lnr lnr-calendar text-blue-600"
              value={selectedWeek}
              onChange={setSelectedWeek}
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
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Loading data...</p>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{tabs.find(t => t.key === activeTab)?.label}</h3>
            {tableData.length > 0 ? (
              <DataTable columns={columns} rows={tableData} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No data available. Please upload attendance files first.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
