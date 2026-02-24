import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLeaveAnalysis } from '../lib/api'
import DataTable from '../components/DataTable'
import LeaveAnalysisCharts from '../components/LeaveAnalysisCharts'

const tabs = [
  { key: 'function', label: 'Function wise', column: 'Function', mode: 'table', base: 'function' },
  { key: 'company', label: 'Company wise', column: 'Company', mode: 'table', base: 'company' },
  { key: 'location', label: 'Location wise', column: 'Location', mode: 'table', base: 'location' },
  { key: 'function_chart', label: 'Function wise (Chart)', column: 'Function', mode: 'chart', base: 'function' },
  { key: 'company_chart', label: 'Company wise (Chart)', column: 'Company', mode: 'chart', base: 'company' },
  { key: 'location_chart', label: 'Location wise (Chart)', column: 'Location', mode: 'chart', base: 'location' },
]

export default function LeaveAnalysisPage() {
  const [active, setActive] = useState('function')
  const current = tabs.find(t => t.key === active)
  const baseKey = current?.base || 'function'
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: ['leave_analysis', baseKey], queryFn: () => getLeaveAnalysis(baseKey), retry: 0 })
  const [fromM, setFromM] = useState('')
  const [toM, setToM] = useState('')

  const cols = [
    { key: 'month', label: 'Month' },
    { key: 'group', label: current?.column || 'Group' },
    { key: 'members', label: 'Members' },
    { key: 'total_sl', label: 'Total SL' },
    { key: 'total_cl', label: 'Total CL' },
    { key: 'workdays', label: 'Workdays' },
    { key: 'total_a', label: 'A' },
    { key: 'sl_adjacent_w', label: 'SL Adjacent to W' },
    { key: 'cl_adjacent_w', label: 'CL Adjacent to W' },
    { key: 'sl_adjacent_h', label: 'SL Adjacent to H' },
    { key: 'cl_adjacent_h', label: 'CL Adjacent to H' },
    { key: 'sl_pct', label: 'Adj. SL%' },
    { key: 'cl_pct', label: 'Adj. CL%' },
    { key: 'a_pct', label: 'A %' },
  ]

  function toMonthLabel(m) {
    if (!m) return ''
    const match = String(m).match(/(20\d{2})-(\d{2})/)
    if (!match) return String(m)
    const year = match[1]
    const month = parseInt(match[2], 10)
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return `${names[month-1]} ${year}`
  }

  const months = Array.from(new Set(data.map(r => r.month))).sort()
  const fromVal = fromM || months[0] || ''
  const toVal = toM || months[months.length - 1] || ''
  const filtered = data.filter(r => (!fromVal || r.month >= fromVal) && (!toVal || r.month <= toVal))

  return (
    <div className="space-y-4">
      <div className="card p-2 flex gap-2">
        {tabs.map(t => (
          <button key={t.key} className={`px-3 py-2 rounded-md ${active === t.key ? 'bg-blue-600 text-white' : 'btn-outline'}`} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {current?.mode === 'table' && (
        <div className="card p-4">
          {months.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-600">From</label>
              <select className="btn-outline" value={fromM || ''} onChange={e => setFromM(e.target.value)}>
                <option value="">(min)</option>
                {months.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
              </select>
              <label className="text-sm text-gray-600">To</label>
              <select className="btn-outline" value={toM || ''} onChange={e => setToM(e.target.value)}>
                <option value="">(max)</option>
                {months.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
              </select>
            </div>
          )}
          {isLoading && <div>Loading...</div>}
          {(!isLoading && isError) && (
            <div className="mb-3 text-red-600 text-sm">
              {error?.response?.data?.detail || error?.message || 'Failed to load data. Showing empty table.'}
            </div>
          )}
          <DataTable columns={cols} rows={(!isLoading && !isError) ? filtered.map(r => ({ ...r, month: toMonthLabel(r.month), sl_pct: r.sl_pct + '%', cl_pct: r.cl_pct + '%' })) : []} />
          {(!isLoading && !isError && data.length === 0) && (
            <div className="mt-2 text-sm text-gray-500">No data yet. Upload attendance files to see results.</div>
          )}
        </div>
      )}

      {current?.mode === 'chart' && !isLoading && !isError && (
        <>
          {months.length > 0 && (
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-600">From</label>
              <select className="btn-outline" value={fromM || ''} onChange={e => setFromM(e.target.value)}>
                <option value="">(min)</option>
                {months.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
              </select>
              <label className="text-sm text-gray-600">To</label>
              <select className="btn-outline" value={toM || ''} onChange={e => setToM(e.target.value)}>
                <option value="">(max)</option>
                {months.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
              </select>
            </div>
          )}
          <LeaveAnalysisCharts rows={filtered} />
        </>
      )}
    </div>
  )
}

