import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeeklyAnalysis } from '../lib/api'
import DataTable from '../components/DataTable'
import WeeklyCharts from '../components/WeeklyCharts'
import MultiSelectSearchable from '../components/MultiSelectSearchable'
import { useScopeFilterOptions } from '../hooks/useScopeFilterOptions'

const tabs = [
  { key: 'function', label: 'Function wise', column: 'Function', mode: 'table', base: 'function' },
  { key: 'company', label: 'Company wise', column: 'Company', mode: 'table', base: 'company' },
  { key: 'location', label: 'Location wise', column: 'Location', mode: 'table', base: 'location' },
  { key: 'department', label: 'Department wise', column: 'Department', mode: 'table', base: 'function' },
  { key: 'function_chart', label: 'Function wise (Chart)', column: 'Function', mode: 'chart', base: 'function' },
  { key: 'company_chart', label: 'Company wise (Chart)', column: 'Company', mode: 'chart', base: 'company' },
  { key: 'location_chart', label: 'Location wise (Chart)', column: 'Location', mode: 'chart', base: 'location' },
  { key: 'department_chart', label: 'Department wise (Chart)', column: 'Department', mode: 'chart', base: 'function' },
]

function toWeekLabel(row) {
  if (!row) return ''
  // New format: Use month_name and week_in_month from backend
  if (row.month_name && row.week_in_month) {
    const weekNum = row.week_in_month
    const suffix = weekNum === 1 ? 'st' : weekNum === 2 ? 'nd' : weekNum === 3 ? 'rd' : 'th'
    return `${weekNum}${suffix} week ${row.month_name}`
  }
  // Fallback for old format: 2025-MM-W01
  const match = String(row.week || row).match(/(\d{4})-(\d{2})-W(\d{2})/)
  if (match) {
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']
    const month = parseInt(match[2], 10)
    const week = parseInt(match[3], 10)
    const monthName = monthNames[month] || `Month${month}`
    const suffix = week === 1 ? 'st' : week === 2 ? 'nd' : week === 3 ? 'rd' : 'th'
    return `${week}${suffix} week ${monthName}`
  }
  return String(row.week || row)
}

export default function WeeklyAnalysisPage() {
  const [active, setActive] = useState('function')
  const current = tabs.find(t => t.key === active)
  const baseKey = current?.base || 'function'
  const useDepartmentBreakdown = active === 'department' || active === 'department_chart'
  const { data = [], isLoading, isError, error } = useQuery({ 
    queryKey: ['weekly', baseKey, useDepartmentBreakdown ? 'breakdown_department' : null], 
    queryFn: () => getWeeklyAnalysis(baseKey, useDepartmentBreakdown ? 'department' : null), 
    retry: 0 
  })
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedWeek, setSelectedWeek] = useState('')
  const [selectedFunctions, setSelectedFunctions] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])

  const cols = useMemo(() => {
    const baseCols = [
      { key: 'week', label: 'Week' },
      { key: 'group', label: current?.column || 'Group' },
    ]
    
    // Only show department column for department-wise views
    if (active === 'department' || active === 'department_chart') {
      baseCols.push({ key: 'department', label: 'Department' })
    }
    
    baseCols.push(
      { key: 'members', label: 'Members' },
      { key: 'present', label: 'Present' },
      { key: 'late', label: 'Late' },
      { key: 'on_time', label: 'On Time' },
      { key: 'on_time_pct', label: 'On Time %' },
      { key: 'shift_hours', label: 'Shift Hours' },
      { key: 'work_hours', label: 'Work Hours' },
      { key: 'completed', label: 'Work Hour Completed' },
      { key: 'completion_pct', label: 'Completion %' },
      { key: 'lost_hours', label: 'Lost Hours' },
      { key: 'lost_pct', label: 'Lost %' },
    )
    
    return baseCols
  }, [active, current])

  // Get unique months and weeks for filters
  const months = Array.from(new Set(data.map(r => r.month || (r.week ? parseInt(r.week.split('-')[1]) : null)).filter(Boolean))).sort()
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  
  const scopeFilter = useScopeFilterOptions()

  // Match row group (e.g. "CIPLC - Finance") to selected list (e.g. "Finance" or "CIPLC - Finance")
  const groupMatches = (rowGroup, selectedList) => {
    const rGroup = (rowGroup || '').trim()
    if (!rGroup) return false
    return selectedList.some(sel => {
      const s = (sel || '').trim()
      if (s === rGroup) return true
      const dashIdx = rGroup.indexOf(' - ')
      if (dashIdx >= 0 && rGroup.slice(dashIdx + 3).trim() === s) return true
      return false
    })
  }

  // On Department tab: derive function and department options from weekly data so Function shows only functions (group) and Department only departments
  const uniqueFunctions = useMemo(() => {
    if ((active === 'department' || active === 'department_chart') && data && data.length > 0) {
      const seen = new Set()
      data.forEach(r => {
        const g = (r.group || '').trim()
        if (!g) return
        const dashIdx = g.indexOf(' - ')
        const name = dashIdx >= 0 ? g.slice(dashIdx + 3).trim() : g
        if (name) seen.add(name)
      })
      return Array.from(seen).sort()
    }
    const list = scopeFilter.functions || []
    if (!Array.isArray(list)) return []
    const names = [...new Set(list.map(f => (f && typeof f === 'object' ? f.name : f)).filter(Boolean))].sort()
    if (selectedDepartments.length > 0) {
      const allowedFuncs = new Set((scopeFilter.departments || []).filter(d => selectedDepartments.includes(d && typeof d === 'object' ? d.name : d)).map(d => d && typeof d === 'object' ? d.function : ''))
      return names.filter(n => allowedFuncs.has(n))
    }
    return names
  }, [active, data, scopeFilter.functions, scopeFilter.departments, selectedDepartments])

  const uniqueDepartments = useMemo(() => {
    if ((active === 'department' || active === 'department_chart') && data && data.length > 0) {
      let rows = data
      if (selectedFunctions.length > 0) {
        rows = data.filter(r => groupMatches(r.group, selectedFunctions))
      }
      const seen = new Set()
      rows.forEach(r => {
        const d = (r.department || '').trim()
        if (!d) return
        d.split(',').forEach(part => {
          const name = part.trim()
          if (name) seen.add(name)
        })
      })
      return Array.from(seen).sort()
    }
    const list = scopeFilter.departments || []
    if (!Array.isArray(list)) return []
    let filtered = list
    if (selectedFunctions.length > 0) {
      filtered = filtered.filter(d => selectedFunctions.includes(d && typeof d === 'object' ? d.function : d))
    }
    return [...new Set(filtered.map(d => (d && typeof d === 'object' ? d.name : d)).filter(Boolean))].sort()
  }, [active, data, scopeFilter.departments, selectedFunctions])
  
  // Get weeks for selected month (or all weeks if no month selected)
  const weeksInMonth = selectedMonth 
    ? Array.from(new Set(data.filter(r => (r.month || parseInt(r.week?.split('-')[1] || '0')) === parseInt(selectedMonth))
      .map(r => r.week_in_month || parseInt(r.week?.split('-W')[1] || '0')).filter(Boolean))).sort()
    : Array.from(new Set(data.map(r => r.week_in_month || parseInt(r.week?.split('-W')[1] || '0')).filter(Boolean))).sort()
  
  // Process data: if department-wise view, split rows by department, keeping function name in group column
  const processedData = useMemo(() => {
    if (active === 'department' || active === 'department_chart') {
      // Split rows that have multiple departments into separate rows
      // Each row keeps the function name in 'group' column, and shows individual department in 'department' column
      const expanded = []
      data.forEach(r => {
        if (!r.department) {
          // If no department, keep the row as-is
          expanded.push({
            ...r,
            group: r.group || 'Unknown', // Keep original function name
            department: '', // Empty department
          })
          return
        }
        
        const departments = r.department.split(',').map(d => d.trim()).filter(Boolean)
        const groupName = r.group || 'Unknown' // This is the function name
        
        departments.forEach(dept => {
          expanded.push({
            ...r,
            group: groupName, // Keep the function name in group column
            department: dept, // Individual department in department column
          })
        })
      })
      
      // Sort by function first, then department, then week
      expanded.sort((a, b) => {
        // First by function (group)
        const funcA = a.group || ''
        const funcB = b.group || ''
        if (funcA !== funcB) {
          return funcA.localeCompare(funcB)
        }
        // Then by department
        const deptA = a.department || ''
        const deptB = b.department || ''
        if (deptA !== deptB) {
          return deptA.localeCompare(deptB)
        }
        // Then by year, month, week
        if (a.year !== b.year) return a.year - b.year
        if (a.month !== b.month) return a.month - b.month
        return (a.week_in_month || 0) - (b.week_in_month || 0)
      })
      
      return expanded
    }
    return data
  }, [data, active])
  
  // Filter data by month, week, function, and department
  const filtered = useMemo(() => {
    return processedData.filter(r => {
      const rowMonth = r.month || (r.week ? parseInt(r.week.split('-')[1]) : null)
      const rowWeek = r.week_in_month || parseInt(r.week?.split('-W')[1] || '0')
      
      if (selectedMonth && rowMonth !== parseInt(selectedMonth)) return false
      if (selectedWeek && rowWeek !== parseInt(selectedWeek)) return false
      
      if (selectedFunctions.length > 0) {
        if (!groupMatches(r.group, selectedFunctions)) return false
      }
      
      if (selectedDepartments.length > 0) {
        if (!r.department) return false
        const rowDepts = r.department.split(',').map(d => d.trim()).filter(Boolean)
        const hasMatch = selectedDepartments.some(sd => rowDepts.includes(sd))
        if (!hasMatch) return false
      }
      
      return true
    })
  }, [processedData, selectedMonth, selectedWeek, selectedFunctions, selectedDepartments, active])

  return (
    <div className="space-y-4">
      <div className="card p-2 flex gap-2 flex-wrap">
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

      {current?.mode === 'table' && (
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <label className="text-sm text-gray-600 font-medium">Filter by:</label>
            <select 
              className="btn-outline" 
              value={selectedMonth || ''} 
              onChange={e => {
                setSelectedMonth(e.target.value)
                setSelectedWeek('') // Reset week when month changes
              }}
            >
              <option value="">All Months</option>
              {months.map(m => (
                <option key={m} value={m}>{monthNames[m] || `Month ${m}`}</option>
              ))}
            </select>
            <select 
              className="btn-outline" 
              value={selectedWeek || ''} 
              onChange={e => setSelectedWeek(e.target.value)}
              disabled={!selectedMonth}
            >
              <option value="">All Weeks</option>
              {weeksInMonth.map(w => (
                <option key={w} value={w}>
                  {w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : `${w}th`} week
                </option>
              ))}
            </select>
            
            {(active === 'department' || active === 'department_chart') && (
              <>
                <MultiSelectSearchable
                  id="function-filter-analysis"
                  label="Function"
                  icon="lnr-briefcase"
                  value={selectedFunctions}
                  onChange={setSelectedFunctions}
                  options={uniqueFunctions.map(f => ({ value: f, label: f }))}
                  placeholder="All Functions"
                  className="min-w-[200px]"
                />
                
                <MultiSelectSearchable
                  id="department-filter-analysis"
                  label="Department"
                  icon="lnr-layers"
                  value={selectedDepartments}
                  onChange={setSelectedDepartments}
                  options={uniqueDepartments.map(d => ({ value: d, label: d }))}
                  placeholder="All Departments"
                  className="min-w-[200px]"
                />
              </>
            )}
          </div>
          {isLoading && <div>Loading...</div>}
          {(!isLoading && isError) && (
            <div className="mb-3 text-red-600 text-sm">
              {error?.response?.data?.detail || error?.message || 'Failed to load weekly data. Showing empty table.'}
            </div>
          )}
          <DataTable 
            columns={cols} 
            rows={(!isLoading && !isError) ? filtered.map(r => ({ ...r, week: toWeekLabel(r) })) : []} 
          />
          {(!isLoading && !isError && data.length === 0) && (
            <div className="mt-2 text-sm text-gray-500">No data yet. Upload attendance files to see results.</div>
          )}
        </div>
      )}

      {current?.mode === 'chart' && !isLoading && !isError && (
        <div className="space-y-3">
          <div className="card p-3 flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-600 font-medium">Filter by:</label>
            <select 
              className="btn-outline" 
              value={selectedMonth || ''} 
              onChange={e => {
                setSelectedMonth(e.target.value)
                setSelectedWeek('') // Reset week when month changes
              }}
            >
              <option value="">All Months</option>
              {months.map(m => (
                <option key={m} value={m}>{monthNames[m] || `Month ${m}`}</option>
              ))}
            </select>
            <select 
              className="btn-outline" 
              value={selectedWeek || ''} 
              onChange={e => setSelectedWeek(e.target.value)}
              disabled={!selectedMonth}
            >
              <option value="">All Weeks</option>
              {weeksInMonth.map(w => (
                <option key={w} value={w}>
                  {w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : `${w}th`} week
                </option>
              ))}
            </select>
            
            {(active === 'department_chart') && (
              <>
                <MultiSelectSearchable
                  id="function-filter-analysis-chart"
                  label="Function"
                  icon="lnr-briefcase"
                  value={selectedFunctions}
                  onChange={setSelectedFunctions}
                  options={uniqueFunctions.map(f => ({ value: f, label: f }))}
                  placeholder="All Functions"
                  className="min-w-[200px]"
                />
                
                <MultiSelectSearchable
                  id="department-filter-analysis-chart"
                  label="Department"
                  icon="lnr-layers"
                  value={selectedDepartments}
                  onChange={setSelectedDepartments}
                  options={uniqueDepartments.map(d => ({ value: d, label: d }))}
                  placeholder="All Departments"
                  className="min-w-[200px]"
                />
              </>
            )}
          </div>
          <WeeklyCharts rows={filtered} />
        </div>
      )}
    </div>
  )
}
