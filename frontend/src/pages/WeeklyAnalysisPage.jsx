import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeeklyAnalysis } from '../lib/api'
import DataTable from '../components/DataTable'
import WeeklyCharts from '../components/WeeklyCharts'

const tabs = [
  { key: 'function', label: 'Function wise', column: 'Function', mode: 'table', base: 'function' },
  { key: 'company', label: 'Company wise', column: 'Company', mode: 'table', base: 'company' },
  { key: 'location', label: 'Location wise', column: 'Location', mode: 'table', base: 'location' },
  { key: 'function_chart', label: 'Function wise (Chart)', column: 'Function', mode: 'chart', base: 'function' },
  { key: 'company_chart', label: 'Company wise (Chart)', column: 'Company', mode: 'chart', base: 'company' },
  { key: 'location_chart', label: 'Location wise (Chart)', column: 'Location', mode: 'chart', base: 'location' },
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
  const { data = [], isLoading, isError, error } = useQuery({ 
    queryKey: ['weekly', baseKey], 
    queryFn: () => getWeeklyAnalysis(baseKey), 
    retry: 0 
  })
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedWeek, setSelectedWeek] = useState('')

  const cols = [
    { key: 'week', label: 'Week' },
    { key: 'group', label: current?.column || 'Group' },
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
  ]

  // Get unique months and weeks for filters
  const months = Array.from(new Set(data.map(r => r.month || (r.week ? parseInt(r.week.split('-')[1]) : null)).filter(Boolean))).sort()
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  
  // Get weeks for selected month (or all weeks if no month selected)
  const weeksInMonth = selectedMonth 
    ? Array.from(new Set(data.filter(r => (r.month || parseInt(r.week?.split('-')[1] || '0')) === parseInt(selectedMonth))
      .map(r => r.week_in_month || parseInt(r.week?.split('-W')[1] || '0')).filter(Boolean))).sort()
    : Array.from(new Set(data.map(r => r.week_in_month || parseInt(r.week?.split('-W')[1] || '0')).filter(Boolean))).sort()
  
  // Filter data by month and week
  const filtered = data.filter(r => {
    const rowMonth = r.month || (r.week ? parseInt(r.week.split('-')[1]) : null)
    const rowWeek = r.week_in_month || parseInt(r.week?.split('-W')[1] || '0')
    
    if (selectedMonth && rowMonth !== parseInt(selectedMonth)) return false
    if (selectedWeek && rowWeek !== parseInt(selectedWeek)) return false
    return true
  })

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
          </div>
          <WeeklyCharts rows={filtered} />
        </div>
      )}
    </div>
  )
}
