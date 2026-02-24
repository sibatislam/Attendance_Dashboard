import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getODAnalysis } from '../lib/api'
import DataTable from '../components/DataTable'
import OdAnalysisCharts from '../components/OdAnalysisCharts'
import { useScopeFilterOptions } from '../hooks/useScopeFilterOptions'

const tabs = [
  { key: 'function', label: 'Function wise', column: 'Function', mode: 'table', base: 'function' },
  { key: 'function_chart', label: 'Function wise (Chart)', column: 'Function', mode: 'chart', base: 'function' },
  { key: 'employee', label: 'Employee wise', column: 'Employee Name', mode: 'table', base: 'employee' },
]

export default function OdAnalysisPage() {
  const [active, setActive] = useState('function')
  const current = tabs.find(t => t.key === active)
  const baseKey = current?.base || 'function'
  const { data = [], isLoading, isError, error } = useQuery({ 
    queryKey: ['od_analysis', baseKey], 
    queryFn: () => getODAnalysis(baseKey), 
    retry: 0 
  })
  const [fromM, setFromM] = useState('')
  const [toM, setToM] = useState('')
  const [selectedFunction, setSelectedFunction] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')

  const cols = useMemo(() => {
    if (baseKey === 'employee') {
      return [
        { key: 'month', label: 'Month' },
        { key: 'function', label: 'Function' },
        { key: 'employee_name', label: 'Employee Name' },
        { key: 'od', label: 'OD' },
      ]
    } else {
      return [
        { key: 'month', label: 'Month' },
        { key: 'group', label: current?.column || 'Group' },
        { key: 'members', label: 'Members' },
        { key: 'od', label: 'OD' },
      ]
    }
  }, [baseKey, current])

  function toMonthLabel(m) {
    if (!m) return ''
    const match = String(m).match(/(20\d{2})-(\d{2})/)
    if (!match) return String(m)
    const year = match[1].slice(-2)
    const month = parseInt(match[2], 10)
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${names[month-1]} ${year}`
  }

  const months = Array.from(new Set(data.map(r => r.month))).sort()
  const fromVal = fromM || months[0] || ''
  const toVal = toM || months[months.length - 1] || ''

  // Scoped filter options so users only see allowed functions
  const scopeFilter = useScopeFilterOptions()
  const uniqueFunctions = useMemo(() => {
    const list = scopeFilter.functions || []
    if (!Array.isArray(list)) return []
    const names = list.map(f => (f && typeof f === 'object' ? f.name : f)).filter(Boolean)
    return [...new Set(names)].sort()
  }, [scopeFilter.functions])

  const uniqueEmployees = useMemo(() => {
    if (baseKey !== 'employee') return []
    const employees = new Set()
    data.forEach(r => {
      // If function is selected, only show employees from that function
      if (selectedFunction && r.function !== selectedFunction) {
        return
      }
      if (r.employee_name) employees.add(r.employee_name)
    })
    return Array.from(employees).sort()
  }, [data, baseKey, selectedFunction])

  const filteredData = useMemo(() => {
    let filtered = data

    // Filter by month range
    if (fromM || toM) {
      filtered = filtered.filter(row => {
        const rowMonth = row.month
        const isAfterFrom = fromM ? rowMonth >= fromM : true
        const isBeforeTo = toM ? rowMonth <= toM : true
        return isAfterFrom && isBeforeTo
      })
    }

    // Filter by function
    if (selectedFunction) {
      filtered = filtered.filter(row => {
        if (baseKey === 'employee') {
          return row.function === selectedFunction
        } else {
          return row.group === selectedFunction
        }
      })
    }

    // Filter by employee (only for employee-wise)
    if (selectedEmployee && baseKey === 'employee') {
      filtered = filtered.filter(row => row.employee_name === selectedEmployee)
    }

    return filtered
  }, [data, fromM, toM, selectedFunction, selectedEmployee, baseKey])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading OD analysis data...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-red-600 text-center p-4">
        Error loading data: {error?.response?.data?.detail || error?.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">OD Analysis</h2>
        <p className="text-gray-600 mt-1">Analyze OD (Outdoor Duty) attendance patterns</p>
      </div>

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

      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Month Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Month</label>
            <select className="form-select w-full" value={fromM || ''} onChange={e => setFromM(e.target.value)}>
              <option value="">All</option>
              {months.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Month</label>
            <select className="form-select w-full" value={toM || ''} onChange={e => setToM(e.target.value)}>
              <option value="">All</option>
              {months.map(m => <option key={m} value={m}>{toMonthLabel(m)}</option>)}
            </select>
          </div>

          {/* Function Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Function</label>
            <select 
              className="form-select w-full" 
              value={selectedFunction} 
              onChange={e => {
                setSelectedFunction(e.target.value)
                // Reset employee selection when function changes
                setSelectedEmployee('')
              }}
            >
              <option value="">All Functions</option>
              {uniqueFunctions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Employee Filter (only for employee-wise) */}
          {baseKey === 'employee' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select className="form-select w-full" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
                <option value="">All Employees</option>
                {uniqueEmployees.map(emp => <option key={emp} value={emp}>{emp}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="card p-6 text-center text-gray-600">
          <p>No OD analysis data available for the selected filters.</p>
        </div>
      ) : (
        <>
          {current?.mode === 'table' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">OD Analysis Table ({current.column} wise)</h3>
              <DataTable 
                headers={cols} 
                rows={filteredData.map(r => {
                  const row = { ...r, month: toMonthLabel(r.month) }
                  // For employee-wise, return as-is (no need to rename keys)
                  return row
                })} 
              />
            </div>
          )}

          {current?.mode === 'chart' && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">OD Analysis Charts ({current.column} wise)</h3>
              <OdAnalysisCharts data={filteredData} groupBy={current.column} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

