import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeeklyAnalysis, getCtcPerHour, getCtcPerHourByFunction } from '../lib/api'
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Legend, Bar, Line, CartesianGrid, LabelList } from 'recharts'
import MultiSelectSearchable from '../components/MultiSelectSearchable'
import DataTable from '../components/DataTable'
import { useScopeFilterOptions } from '../hooks/useScopeFilterOptions'

function toWeekLabel(row) {
  if (!row) return ''
  if (row.month_name && row.week_in_month) {
    const weekNum = row.week_in_month
    const suffix = weekNum === 1 ? 'st' : weekNum === 2 ? 'nd' : weekNum === 3 ? 'rd' : 'th'
    return `${weekNum}${suffix} week ${row.month_name}`
  }
  return String(row.week || row)
}

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function groupMatches(rowGroup, selectedList) {
  const rGroup = (rowGroup || '').trim()
  if (!rGroup) return false
  return selectedList.some(f => {
    const sel = (f || '').trim()
    if (sel === rGroup) return true
    const dashIdx = rGroup.indexOf(' - ')
    if (dashIdx >= 0) {
      const afterDash = rGroup.slice(dashIdx + 3).trim()
      if (afterDash === sel) return true
    }
    return false
  })
}

export default function WorkHourLostCostPage() {
  const scopeFilter = useScopeFilterOptions()
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedWeeks, setSelectedWeeks] = useState([])
  const [selectedFunctions, setSelectedFunctions] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [visibleGroups, setVisibleGroups] = useState(5)
  const [activeTab, setActiveTab] = useState('company') // 'company' | 'function' | 'department' | 'company_table' | 'function_table' | 'department_table'
  const [selectedMonthsCompany, setSelectedMonthsCompany] = useState([]) // month keys e.g. ['2025-01']; default latest month applied in effect
  const [companyChartBy, setCompanyChartBy] = useState('monthly') // 'weekly' | 'monthly' - bars by week or by month
  const [selectedMonthsFunction, setSelectedMonthsFunction] = useState([]) // for Function tab
  const [functionChartBy, setFunctionChartBy] = useState('monthly') // 'weekly' | 'monthly' - for Function tab
  const [selectedFunctionsForFunctionTab, setSelectedFunctionsForFunctionTab] = useState([]) // Function tab: filter which functions to show; empty = all
  const [selectedCompanies, setSelectedCompanies] = useState([]) // e.g. ['CIPLC','CBL']; empty = all companies (Company & Company table tabs only)
  const [selectedMonthsDepartment, setSelectedMonthsDepartment] = useState([]) // for Department tab: multi-select months
  const [departmentChartBy, setDepartmentChartBy] = useState('monthly') // 'weekly' | 'monthly' - chart bars for Department tab

  const { data: weeklyResponse, isLoading: weeklyLoading, isError, error } = useQuery({
    queryKey: ['weekly_dashboard', 'function', 'breakdown_department'],
    queryFn: () => getWeeklyAnalysis('function', 'department'),
    retry: 1,
    staleTime: 5 * 60 * 1000,
    enabled: !scopeFilter.isLoading,
  })
  // Backend may return { data: list, company_totals_full?, company_wise_full? } for N-1 full company view
  const weeklyData = Array.isArray(weeklyResponse) ? weeklyResponse : (weeklyResponse?.data ?? [])
  const companyTotalsFull = weeklyResponse?.company_totals_full ?? null
  const companyWiseFull = weeklyResponse?.company_wise_full ?? null

  const { data: ctcData } = useQuery({
    queryKey: ['ctc-per-hour'],
    queryFn: getCtcPerHour,
  })
  const { data: ctcByFunctionData } = useQuery({
    queryKey: ['ctc-per-hour-by-function'],
    queryFn: getCtcPerHourByFunction,
  })
  const ctcPerHour = ctcData?.ctc_per_hour_bdt ?? null
  const ctcByFunction = ctcByFunctionData?.ctc_by_function && typeof ctcByFunctionData.ctc_by_function === 'object'
    ? ctcByFunctionData.ctc_by_function
    : {}
  const getRateForGroup = (group) => {
    const g = (group || '').trim()
    const dashIdx = g.indexOf(' - ')
    const functionPart = dashIdx >= 0 ? g.slice(dashIdx + 3).trim() : g
    if (functionPart && ctcByFunction[functionPart] != null) return Number(ctcByFunction[functionPart])
    return ctcPerHour
  }
  const hasAnyCtcRate = useMemo(() => {
    return ctcPerHour != null || Object.keys(ctcByFunction).length > 0
  }, [ctcPerHour, ctcByFunction])

  const months = useMemo(() => {
    const set = new Set()
    weeklyData.forEach(r => {
      if (r.year && r.month) set.add(`${r.year}-${String(r.month).padStart(2, '0')}`)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [weeklyData])

  const weeksInMonth = selectedMonth
    ? Array.from(new Set(weeklyData.filter(r => `${r.year}-${String(r.month).padStart(2, '0')}` === selectedMonth).map(r => r.week_in_month).filter(Boolean))).sort()
    : []

  // Quarters for Company tab: Q1 = Jul–Sep, Q2 = Oct–Dec, Q3 = Jan–Mar, Q4 = Apr–Jun (month numbers 1–12)
  const QUARTER_MONTHS = { Q1: [7, 8, 9], Q2: [10, 11, 12], Q3: [1, 2, 3], Q4: [4, 5, 6] }
  const companyMonthOptions = useMemo(() => {
    return months.map(m => {
      const [, monthNum] = m.split('-')
      const month = parseInt(monthNum, 10)
      const year = m.slice(0, 4)
      return { value: m, label: `${monthNames[month] || `Month ${month}`} ${year}` }
    })
  }, [months])

  useEffect(() => {
    if (months.length > 0 && !selectedMonth && weeklyData.length > 0) {
      setSelectedMonth(months[months.length - 1])
    }
  }, [months.length, weeklyData.length])

  // Company tab: default to latest month when data loads or when selection is cleared
  useEffect(() => {
    if (months.length > 0 && selectedMonthsCompany.length === 0) {
      setSelectedMonthsCompany([months[months.length - 1]])
    }
  }, [months, selectedMonthsCompany.length])

  // Department tab: default to latest month when data loads or when selection is cleared
  useEffect(() => {
    if (months.length > 0 && selectedMonthsDepartment.length === 0) {
      setSelectedMonthsDepartment([months[months.length - 1]])
    }
  }, [months, selectedMonthsDepartment.length])

  // Function tab: default to latest month when data loads or when selection is cleared
  useEffect(() => {
    if (months.length > 0 && selectedMonthsFunction.length === 0) {
      setSelectedMonthsFunction([months[months.length - 1]])
    }
  }, [months, selectedMonthsFunction.length])

  // Effective months for Department/Calculation tab
  const effectiveDepartmentMonths = useMemo(() => {
    if (selectedMonthsDepartment.length > 0) return selectedMonthsDepartment
    if (months.length > 0) return [months[months.length - 1]]
    return []
  }, [selectedMonthsDepartment, months])

  const departmentMonthOptions = useMemo(() => {
    return months.map(m => {
      const [, monthNum] = m.split('-')
      const month = parseInt(monthNum, 10)
      const year = m.slice(0, 4)
      return { value: m, label: `${monthNames[month] || `Month ${month}`} ${year}` }
    })
  }, [months])

  // Department tab: base data filtered by selected months only (for deriving filter options)
  const departmentBaseDataForFilters = useMemo(() => {
    const monthSet = effectiveDepartmentMonths.length > 0 ? new Set(effectiveDepartmentMonths) : null
    if (!monthSet || monthSet.size === 0) return weeklyData
    return weeklyData.filter(r => monthSet.has(`${r.year}-${String(r.month).padStart(2, '0')}`))
  }, [weeklyData, effectiveDepartmentMonths])

  // Department tab: Function filter options — only functions that have data in selected months
  const uniqueFunctionsForDepartment = useMemo(() => {
    const companyCodes = ['CBL', 'CIPLC', 'CSEL']
    const names = new Set()
    departmentBaseDataForFilters.forEach(r => {
      const g = (r.group || '').trim()
      if (!g) return
      const dashIdx = g.indexOf(' - ')
      const funcPart = dashIdx >= 0 ? g.slice(dashIdx + 3).trim() : g
      if (funcPart && !companyCodes.includes(funcPart)) names.add(funcPart)
    })
    return Array.from(names).sort()
  }, [departmentBaseDataForFilters])

  // Department tab: Department filter options — departments in selected months; when functions selected, only those functions' departments
  const uniqueDepartmentsForDepartment = useMemo(() => {
    if (selectedFunctions.length > 0 && departmentBaseDataForFilters.length > 0) {
      const deptSet = new Set()
      departmentBaseDataForFilters.forEach(r => {
        if (!groupMatches(r.group, selectedFunctions)) return
        const deptStr = (r.department || '').trim()
        if (deptStr) deptStr.split(',').forEach(d => { const n = d.trim(); if (n) deptSet.add(n) })
      })
      return Array.from(deptSet).sort()
    }
    const deptSet = new Set()
    departmentBaseDataForFilters.forEach(r => {
      const deptStr = (r.department || '').trim()
      if (deptStr) deptStr.split(',').forEach(d => { const n = d.trim(); if (n) deptSet.add(n) })
    })
    if (deptSet.size > 0) return Array.from(deptSet).sort()
    const raw = scopeFilter.departments || []
    const list = Array.isArray(raw) ? raw : []
    const names = list.map(d => (d && typeof d === 'object' ? d.name : d)).filter(Boolean)
    return [...new Set(names)].sort()
  }, [scopeFilter.departments, selectedFunctions, departmentBaseDataForFilters])

  const filteredData = useMemo(() => {
    const monthSet = effectiveDepartmentMonths.length > 0 ? new Set(effectiveDepartmentMonths) : null
    return weeklyData.filter(r => {
      if (monthSet && monthSet.size > 0) {
        if (!monthSet.has(`${r.year}-${String(r.month).padStart(2, '0')}`)) return false
      }
      if (selectedFunctions.length > 0 && !groupMatches(r.group, selectedFunctions)) return false
      if (selectedDepartments.length > 0) {
        if (!r.department) return false
        const rowDepts = r.department.split(',').map(d => d.trim())
        if (!selectedDepartments.some(d => rowDepts.includes(d))) return false
      }
      if (scopeFilter.isDepartmentOnly && Array.isArray(scopeFilter.departments) && scopeFilter.departments.length > 0) {
        const deptNorm = (r.department || '').toLowerCase()
        const scopeDeptNames = scopeFilter.departments.map(d => (d && typeof d === 'object' && d.name != null ? d.name : d))
        if (!scopeDeptNames.some(name => name && String(name).trim().toLowerCase() === deptNorm)) return false
      }
      return true
    })
  }, [weeklyData, effectiveDepartmentMonths, selectedFunctions, selectedDepartments, scopeFilter.isDepartmentOnly, scopeFilter.departments])

  const groupedData = useMemo(() => {
    const groups = new Map()
    const groupLabels = new Map()
    for (const row of filteredData) {
      const groupName = row.group || 'Unknown'
      const dept = (row.department || '').trim()
      if (!dept) continue
      if (selectedDepartments.length > 0 && !selectedDepartments.includes(dept)) continue
      const dashIdx = groupName.indexOf(' - ')
      const companyPart = dashIdx >= 0 ? groupName.slice(0, dashIdx).trim() : groupName
      const functionPart = dashIdx >= 0 ? groupName.slice(dashIdx + 3).trim() : ''
      const groupLabel = functionPart ? `${companyPart} - ${dept} (${functionPart})` : `${companyPart} - ${dept}`
      const groupKey = `${groupName}|||${dept}`
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
        groupLabels.set(groupKey, groupLabel)
      }
      const lostNum = Number(row.lost) || 0
      const rate = getRateForGroup(groupName)
      const costBdt = rate != null ? Number((lostNum * rate).toFixed(2)) : null
      groups.get(groupKey).push({
        ...row,
        weekLabel: toWeekLabel(row),
        displayGroup: groupLabel,
        cost_bdt: costBdt,
      })
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        if (a.month !== b.month) return a.month - b.month
        return (a.week_in_month || 0) - (b.week_in_month || 0)
      })
    }
    return { groups, groupLabels }
  }, [filteredData, selectedDepartments, ctcByFunction, ctcPerHour, scopeFilter.isDepartmentOnly])

  const allGroups = useMemo(() => {
    if (!groupedData?.groups) return []
    return Array.from(groupedData.groups.keys()).sort((a, b) => {
      const la = groupedData.groupLabels.get(a) || a
      const lb = groupedData.groupLabels.get(b) || b
      return la.localeCompare(lb)
    })
  }, [groupedData])

  // Department chart data: weekly rows or monthly aggregated (for Chart bars toggle)
  const departmentChartDataByGroup = useMemo(() => {
    if (!groupedData?.groups) return new Map()
    const result = new Map()
    for (const [groupKey, rows] of groupedData.groups.entries()) {
      if (departmentChartBy === 'monthly') {
        const byMonth = new Map() // monthKey -> { monthLabel, members (max), lost, shift_hours, work_hours, cost_bdt }
        const membersByMonthDept = new Map() // monthKey -> max members (same group-dept, avoid week double-count)
        for (const r of rows) {
          const monthKey = `${r.year}-${String(r.month).padStart(2, '0')}`
          const monthLabel = `${monthNames[r.month] || `Month ${r.month}`} ${r.year}`
          if (!byMonth.has(monthKey)) {
            byMonth.set(monthKey, {
              monthLabel,
              year: r.year,
              month: r.month,
              members: 0,
              lost: 0,
              shift_hours: 0,
              work_hours: 0,
              cost_bdt: 0,
              displayGroup: r.displayGroup,
            })
            membersByMonthDept.set(monthKey, new Map())
          }
          const rec = byMonth.get(monthKey)
          const m = Number(r.members) || 0
          const prevMax = membersByMonthDept.get(monthKey).get(groupKey) ?? 0
          membersByMonthDept.get(monthKey).set(groupKey, Math.max(prevMax, m))
          rec.lost += Number(r.lost) || 0
          rec.shift_hours += Number(r.shift_hours) || 0
          rec.work_hours += Number(r.work_hours) || 0
          rec.cost_bdt = Math.round((rec.cost_bdt + (Number(r.cost_bdt) || 0)) * 100) / 100
        }
        const aggregated = Array.from(byMonth.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([monthKey, rec]) => {
            const members = Array.from(membersByMonthDept.get(monthKey)?.values() || [0]).reduce((s, v) => s + v, 0)
            const lost = Math.round((rec.lost || 0) * 100) / 100
            const lost_pct = rec.shift_hours > 0 ? Math.round((rec.lost / rec.shift_hours) * 10000) / 100 : 0
            return { ...rec, members, lost, lost_pct, weekLabel: rec.monthLabel }
          })
        result.set(groupKey, aggregated)
      } else {
        result.set(groupKey, rows)
      }
    }
    return result
  }, [groupedData, departmentChartBy])

  // Function-wise total cost (sum of all departments under each function for selected weeks)
  const functionWiseTotals = useMemo(() => {
    if (!groupedData?.groups || !hasAnyCtcRate) return []
    const byFunction = new Map() // functionName (e.g. "CIPLC - Factory") -> total cost
    for (const groupKey of groupedData.groups.keys()) {
      const functionName = groupKey.split('|||')[0] || groupKey
      const rows = groupedData.groups.get(groupKey) || []
      const total = rows.reduce((sum, r) => sum + (Number(r.cost_bdt) || 0), 0)
      byFunction.set(functionName, (byFunction.get(functionName) || 0) + total)
    }
    return Array.from(byFunction.entries())
      .map(([name, total]) => ({ functionName: name, totalCost: total }))
      .sort((a, b) => a.functionName.localeCompare(b.functionName))
  }, [groupedData, hasAnyCtcRate])

  // Company-wise total cost (sum of all functions per company: CIPLC, CBL, CSEL)
  const companyWiseTotals = useMemo(() => {
    if (!functionWiseTotals.length) return []
    const byCompany = new Map()
    for (const { functionName, totalCost } of functionWiseTotals) {
      const dashIdx = functionName.indexOf(' - ')
      const company = dashIdx >= 0 ? functionName.slice(0, dashIdx).trim() : functionName
      if (company) byCompany.set(company, (byCompany.get(company) || 0) + totalCost)
    }
    const order = ['CIPLC', 'CBL', 'CSEL']
    return order
      .filter(c => byCompany.has(c))
      .map(company => ({ companyName: company, totalCost: byCompany.get(company) }))
      .concat(
        Array.from(byCompany.entries())
          .filter(([c]) => !order.includes(c))
          .map(([companyName, totalCost]) => ({ companyName, totalCost }))
          .sort((a, b) => a.companyName.localeCompare(b.companyName))
      )
  }, [functionWiseTotals])

  // Company options for Company / Company table tabs (from data, preferred order)
  const companyFilterOptions = useMemo(() => {
    const order = ['CIPLC', 'CBL', 'CSEL']
    const fromData = new Set()
    weeklyData.forEach(r => {
      const g = (r.group || '').trim()
      const dashIdx = g.indexOf(' - ')
      const company = dashIdx >= 0 ? g.slice(0, dashIdx).trim() : g
      if (company) fromData.add(company)
    })
    const ordered = order.filter(c => fromData.has(c))
    const rest = [...fromData].filter(c => !order.includes(c)).sort()
    return ordered.concat(rest).map(c => ({ value: c, label: c }))
  }, [weeklyData])

  // Effective months for Company tab: selected or latest single month when none selected
  const effectiveCompanyMonths = useMemo(() => {
    if (selectedMonthsCompany.length > 0) return selectedMonthsCompany
    if (months.length > 0) return [months[months.length - 1]]
    return []
  }, [selectedMonthsCompany, months])

  // N-1: full company-wise rows from backend (members, shift, work, lost, cost per month per company)
  const companyWiseFullFiltered = useMemo(() => {
    if (!companyWiseFull || !Array.isArray(companyWiseFull) || effectiveCompanyMonths.length === 0) return []
    const set = new Set(effectiveCompanyMonths)
    return companyWiseFull.filter(r => set.has(r.month_key))
  }, [companyWiseFull, effectiveCompanyMonths])

  // N-1: monthly chart series built from full company data (same shape as companyChartSeriesMonthly)
  const companyChartSeriesMonthlyFromFull = useMemo(() => {
    if (!companyWiseFullFiltered.length) return []
    const byCompany = new Map()
    for (const r of companyWiseFullFiltered) {
      const company = r.company || 'Unknown'
      if (!byCompany.has(company)) byCompany.set(company, [])
      const monthLabel = `${monthNames[r.month] || `Month ${r.month}`} ${r.year}`
      const lost = Math.round((r.lost || 0) * 100) / 100
      const shift_hours = Number(r.shift_hours) || 0
      const lost_pct = shift_hours > 0 ? Math.round((lost / shift_hours) * 10000) / 100 : 0
      byCompany.get(company).push({
        monthLabel,
        year: r.year,
        month: r.month,
        members: r.members ?? 0,
        lost,
        shift_hours,
        work_hours: Number(r.work_hours) || 0,
        cost_bdt: Math.round((r.cost || 0) * 100) / 100,
        lost_pct,
        weekLabel: monthLabel,
      })
    }
    const order = ['CIPLC', 'CBL', 'CSEL']
    const companies = [...new Set(order.filter(c => byCompany.has(c)).concat([...byCompany.keys()].filter(c => !order.includes(c)).sort()))]
    return companies.map(company => {
      const data = (byCompany.get(company) || [])
        .sort((a, b) => (a.year - b.year) || (a.month - b.month))
      return { companyName: company, data }
    }).filter(c => c.data.length > 0)
  }, [companyWiseFullFiltered])

  // For Company tab: filter weeklyData by selected month(s)
  const companyTabData = useMemo(() => {
    if (weeklyData.length === 0 || effectiveCompanyMonths.length === 0) return []
    const set = new Set(effectiveCompanyMonths)
    return weeklyData.filter(r => set.has(`${r.year}-${String(r.month).padStart(2, '0')}`))
  }, [weeklyData, effectiveCompanyMonths])

  // Company tab: chart data per company — aggregate by company and week
  const companyChartSeries = useMemo(() => {
    if (!companyTabData.length) return []
    const byCompany = new Map() // company -> Map(weekKey -> { weekLabel, members, lost, shift_hours, work_hours, cost_bdt, rows })
    for (const row of companyTabData) {
      const groupName = row.group || ''
      const dashIdx = groupName.indexOf(' - ')
      const company = dashIdx >= 0 ? groupName.slice(0, dashIdx).trim() : groupName
      if (!company) continue
      const weekKey = `${row.year}-${String(row.month).padStart(2, '0')}-${row.week_in_month || 0}`
      if (!byCompany.has(company)) byCompany.set(company, new Map())
      const weekMap = byCompany.get(company)
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekLabel: toWeekLabel(row),
          year: row.year,
          month: row.month,
          week_in_month: row.week_in_month,
          members: 0,
          lost: 0,
          shift_hours: 0,
          work_hours: 0,
          cost_bdt: 0,
        })
      }
      const rec = weekMap.get(weekKey)
      rec.members += Number(row.members) || 0
      rec.lost += Number(row.lost) || 0
      rec.shift_hours += Number(row.shift_hours) || 0
      rec.work_hours += Number(row.work_hours) || 0
      const rate = getRateForGroup(groupName)
      const addCost = rate != null ? (Number(row.lost) || 0) * rate : 0
      rec.cost_bdt = Math.round((rec.cost_bdt + addCost) * 100) / 100
    }
    const order = ['CIPLC', 'CBL', 'CSEL']
    const companies = [...new Set(order.filter(c => byCompany.has(c)).concat([...byCompany.keys()].filter(c => !order.includes(c)).sort()))]
    return companies.map(company => {
      const weekMap = byCompany.get(company) || new Map()
      const data = Array.from(weekMap.values())
        .sort((a, b) => (a.year - b.year) || (a.month - b.month) || ((a.week_in_month || 0) - (b.week_in_month || 0)))
        .map(r => {
          const lost = Math.round((r.lost || 0) * 100) / 100
          const lost_pct = r.shift_hours > 0 ? Math.round((r.lost / r.shift_hours) * 10000) / 100 : 0
          return { ...r, lost, lost_pct }
        })
      return { companyName: company, data }
    }).filter(c => c.data.length > 0)
  }, [companyTabData, getRateForGroup, ctcByFunction, ctcPerHour])

  // Company tab: same data aggregated by month (for "monthly bars" option)
  // Members: use max per (group, department) across weeks to avoid double-counting same people
  const companyChartSeriesMonthly = useMemo(() => {
    if (!companyTabData.length) return []
    const byCompany = new Map() // company -> Map(monthKey -> { ..., membersByGroupDept: Map(group|||dept -> max) })
    for (const row of companyTabData) {
      const groupName = row.group || ''
      const dashIdx = groupName.indexOf(' - ')
      const company = dashIdx >= 0 ? groupName.slice(0, dashIdx).trim() : groupName
      if (!company) continue
      const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`
      const monthLabel = `${monthNames[row.month] || `Month ${row.month}`} ${row.year}`
      const groupDeptKey = `${groupName}|||${(row.department || '').trim()}`
      if (!byCompany.has(company)) byCompany.set(company, new Map())
      const monthMap = byCompany.get(company)
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthLabel,
          year: row.year,
          month: row.month,
          membersByGroupDept: new Map(), // group|||dept -> max members (avoids week-over-week double count)
          lost: 0,
          shift_hours: 0,
          work_hours: 0,
          cost_bdt: 0,
        })
      }
      const rec = monthMap.get(monthKey)
      const m = Number(row.members) || 0
      const prev = rec.membersByGroupDept.get(groupDeptKey) ?? 0
      rec.membersByGroupDept.set(groupDeptKey, Math.max(prev, m))
      rec.lost += Number(row.lost) || 0
      rec.shift_hours += Number(row.shift_hours) || 0
      rec.work_hours += Number(row.work_hours) || 0
      const rate = getRateForGroup(groupName)
      const addCost = rate != null ? (Number(row.lost) || 0) * rate : 0
      rec.cost_bdt = Math.round((rec.cost_bdt + addCost) * 100) / 100
    }
    const order = ['CIPLC', 'CBL', 'CSEL']
    const companies = [...new Set(order.filter(c => byCompany.has(c)).concat([...byCompany.keys()].filter(c => !order.includes(c)).sort()))]
    return companies.map(company => {
      const monthMap = byCompany.get(company) || new Map()
      const data = Array.from(monthMap.values())
        .sort((a, b) => (a.year - b.year) || (a.month - b.month))
        .map(r => {
          const members = r.membersByGroupDept ? Array.from(r.membersByGroupDept.values()).reduce((s, v) => s + v, 0) : 0
          const lost = Math.round((r.lost || 0) * 100) / 100
          const lost_pct = r.shift_hours > 0 ? Math.round((r.lost / r.shift_hours) * 10000) / 100 : 0
          return { ...r, members, lost, lost_pct, weekLabel: r.monthLabel }
        })
      return { companyName: company, data }
    }).filter(c => c.data.length > 0)
  }, [companyTabData, getRateForGroup, ctcByFunction, ctcPerHour])

  // When backend sends full company data (N-1), use it for chart so bars show same as admin. Else override cost only when companyTotalsFull present.
  const companyChartSeriesMonthlyResolved = useMemo(() => {
    if (companyChartSeriesMonthlyFromFull.length > 0) return companyChartSeriesMonthlyFromFull
    if (!companyTotalsFull || !companyChartSeriesMonthly.length) return companyChartSeriesMonthly
    return companyChartSeriesMonthly.map(s => ({
      ...s,
      data: (s.data || []).map(r => {
        const monthKey = `${r.year}-${String(r.month).padStart(2, '0')}`
        const fullCost = companyTotalsFull[monthKey] && companyTotalsFull[monthKey][s.companyName]
        const cost_bdt = fullCost != null ? Math.round(Number(fullCost) * 100) / 100 : (r.cost_bdt ?? 0)
        return { ...r, cost_bdt }
      }),
    }))
  }, [companyChartSeriesMonthlyFromFull, companyChartSeriesMonthly, companyTotalsFull])

  // Company tab: totals per company (for the card). Use backend full company totals when present (N-1 users) so cards show correct company totals
  const companyWiseTotalsForPeriod = useMemo(() => {
    if (companyTotalsFull && effectiveCompanyMonths.length > 0) {
      const order = ['CIPLC', 'CBL', 'CSEL']
      const companySet = new Set()
      effectiveCompanyMonths.forEach(m => {
        const byCompany = companyTotalsFull[m]
        if (byCompany && typeof byCompany === 'object') {
          Object.keys(byCompany).forEach(c => companySet.add(c))
        }
      })
      const byCompanyTotal = {}
      companySet.forEach(c => {
        byCompanyTotal[c] = 0
      })
      effectiveCompanyMonths.forEach(m => {
        const byCompany = companyTotalsFull[m]
        if (byCompany && typeof byCompany === 'object') {
          Object.entries(byCompany).forEach(([company, cost]) => {
            byCompanyTotal[company] = (byCompanyTotal[company] || 0) + (Number(cost) || 0)
          })
        }
      })
      const ordered = order.filter(c => companySet.has(c)).map(companyName => ({
        companyName,
        totalCost: Math.round((byCompanyTotal[companyName] || 0) * 100) / 100,
      }))
      const rest = [...companySet].filter(c => !order.includes(c)).sort((a, b) => a.localeCompare(b)).map(companyName => ({
        companyName,
        totalCost: Math.round((byCompanyTotal[companyName] || 0) * 100) / 100,
      }))
      return ordered.concat(rest)
    }
    const series = companyChartBy === 'monthly' ? companyChartSeriesMonthly : companyChartSeries
    if (!series.length || !hasAnyCtcRate) return []
    const order = ['CIPLC', 'CBL', 'CSEL']
    return order
      .filter(c => series.some(s => s.companyName === c))
      .map(companyName => {
        const s = series.find(s => s.companyName === companyName)
        const totalCost = (s?.data || []).reduce((sum, r) => sum + (Number(r.cost_bdt) || 0), 0)
        return { companyName, totalCost: Math.round(totalCost * 100) / 100 }
      })
      .concat(
        series
          .filter(s => !order.includes(s.companyName))
          .map(s => ({
            companyName: s.companyName,
            totalCost: Math.round((s.data || []).reduce((sum, r) => sum + (Number(r.cost_bdt) || 0), 0) * 100) / 100,
          }))
          .sort((a, b) => a.companyName.localeCompare(b.companyName))
      )
  }, [companyTotalsFull, effectiveCompanyMonths, companyChartBy, companyChartSeriesMonthly, companyChartSeries, hasAnyCtcRate])

  // Function tab: effective months and data
  const effectiveFunctionMonths = useMemo(() => {
    if (selectedMonthsFunction.length > 0) return selectedMonthsFunction
    if (months.length > 0) return [months[months.length - 1]]
    return []
  }, [selectedMonthsFunction, months])

  const functionTabData = useMemo(() => {
    if (weeklyData.length === 0 || effectiveFunctionMonths.length === 0) return []
    const set = new Set(effectiveFunctionMonths)
    return weeklyData.filter(r => set.has(`${r.year}-${String(r.month).padStart(2, '0')}`))
  }, [weeklyData, effectiveFunctionMonths])

  const functionMonthOptions = useMemo(() => companyMonthOptions, [companyMonthOptions])

  // Function tab: totals per function (for cards)
  const functionWiseTotalsForPeriod = useMemo(() => {
    if (!functionTabData.length || !hasAnyCtcRate) return []
    const byFunction = new Map()
    for (const row of functionTabData) {
      const groupName = row.group || ''
      if (!groupName) continue
      const lostNum = Number(row.lost) || 0
      const rate = getRateForGroup(groupName)
      const costBdt = rate != null ? lostNum * rate : 0
      byFunction.set(groupName, (byFunction.get(groupName) || 0) + costBdt)
    }
    return Array.from(byFunction.entries())
      .map(([functionName, totalCost]) => ({ functionName, totalCost }))
      .sort((a, b) => a.functionName.localeCompare(b.functionName))
  }, [functionTabData, hasAnyCtcRate, getRateForGroup, ctcByFunction, ctcPerHour])

  // Function tab: chart data per function — aggregate by function and week
  const functionChartSeries = useMemo(() => {
    if (!functionTabData.length) return []
    const byFunction = new Map()
    for (const row of functionTabData) {
      const groupName = row.group || ''
      if (!groupName) continue
      const weekKey = `${row.year}-${String(row.month).padStart(2, '0')}-${row.week_in_month || 0}`
      if (!byFunction.has(groupName)) byFunction.set(groupName, new Map())
      const weekMap = byFunction.get(groupName)
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekLabel: toWeekLabel(row),
          year: row.year,
          month: row.month,
          week_in_month: row.week_in_month,
          members: 0,
          lost: 0,
          shift_hours: 0,
          work_hours: 0,
          cost_bdt: 0,
        })
      }
      const rec = weekMap.get(weekKey)
      const groupDeptKey = `${groupName}|||${(row.department || '').trim()}`
      const m = Number(row.members) || 0
      const prevMax = rec.membersByGroupDept?.get(groupDeptKey) ?? 0
      if (!rec.membersByGroupDept) rec.membersByGroupDept = new Map()
      rec.membersByGroupDept.set(groupDeptKey, Math.max(prevMax, m))
      rec.lost += Number(row.lost) || 0
      rec.shift_hours += Number(row.shift_hours) || 0
      rec.work_hours += Number(row.work_hours) || 0
      const rate = getRateForGroup(groupName)
      const addCost = rate != null ? (Number(row.lost) || 0) * rate : 0
      rec.cost_bdt = Math.round((rec.cost_bdt + addCost) * 100) / 100
    }
    return Array.from(byFunction.entries())
      .map(([functionName, weekMap]) => {
        const data = Array.from(weekMap.values())
          .sort((a, b) => (a.year - b.year) || (a.month - b.month) || ((a.week_in_month || 0) - (b.week_in_month || 0)))
          .map(r => {
            const members = r.membersByGroupDept ? Array.from(r.membersByGroupDept.values()).reduce((s, v) => s + v, 0) : (r.members || 0)
            const lost = Math.round((r.lost || 0) * 100) / 100
            const lost_pct = r.shift_hours > 0 ? Math.round((r.lost / r.shift_hours) * 10000) / 100 : 0
            return { ...r, members, lost, lost_pct }
          })
        return { functionName, data }
      })
      .filter(f => f.data.length > 0)
      .sort((a, b) => a.functionName.localeCompare(b.functionName))
  }, [functionTabData, getRateForGroup, ctcByFunction, ctcPerHour])

  // Function tab: chart data aggregated by month
  const functionChartSeriesMonthly = useMemo(() => {
    if (!functionTabData.length) return []
    const byFunction = new Map()
    for (const row of functionTabData) {
      const groupName = row.group || ''
      if (!groupName) continue
      const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`
      const monthLabel = `${monthNames[row.month] || `Month ${row.month}`} ${row.year}`
      const groupDeptKey = `${groupName}|||${(row.department || '').trim()}`
      if (!byFunction.has(groupName)) byFunction.set(groupName, new Map())
      const monthMap = byFunction.get(groupName)
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthLabel,
          year: row.year,
          month: row.month,
          membersByGroupDept: new Map(),
          lost: 0,
          shift_hours: 0,
          work_hours: 0,
          cost_bdt: 0,
        })
      }
      const rec = monthMap.get(monthKey)
      const m = Number(row.members) || 0
      const prev = rec.membersByGroupDept.get(groupDeptKey) ?? 0
      rec.membersByGroupDept.set(groupDeptKey, Math.max(prev, m))
      rec.lost += Number(row.lost) || 0
      rec.shift_hours += Number(row.shift_hours) || 0
      rec.work_hours += Number(row.work_hours) || 0
      const rate = getRateForGroup(groupName)
      const addCost = rate != null ? (Number(row.lost) || 0) * rate : 0
      rec.cost_bdt = Math.round((rec.cost_bdt + addCost) * 100) / 100
    }
    return Array.from(byFunction.entries())
      .map(([functionName, monthMap]) => {
        const data = Array.from(monthMap.values())
          .sort((a, b) => (a.year - b.year) || (a.month - b.month))
          .map(r => {
            const members = r.membersByGroupDept ? Array.from(r.membersByGroupDept.values()).reduce((s, v) => s + v, 0) : 0
            const lost = Math.round((r.lost || 0) * 100) / 100
            const lost_pct = r.shift_hours > 0 ? Math.round((r.lost / r.shift_hours) * 10000) / 100 : 0
            return { ...r, members, lost, lost_pct, weekLabel: r.monthLabel }
          })
        return { functionName, data }
      })
      .filter(f => f.data.length > 0)
      .sort((a, b) => a.functionName.localeCompare(b.functionName))
  }, [functionTabData, getRateForGroup, ctcByFunction, ctcPerHour])

  // Function tab: filter options (function names from data)
  const functionFilterOptionsForFunctionTab = useMemo(() => {
    const names = new Set()
    functionWiseTotalsForPeriod.forEach(({ functionName }) => names.add(functionName))
    return Array.from(names).sort().map(f => ({ value: f, label: f }))
  }, [functionWiseTotalsForPeriod])

  // Function tab: apply function filter
  const functionChartSeriesFiltered = useMemo(() => {
    if (selectedFunctionsForFunctionTab.length === 0) return functionChartSeries
    return functionChartSeries.filter(({ functionName }) => selectedFunctionsForFunctionTab.includes(functionName))
  }, [functionChartSeries, selectedFunctionsForFunctionTab])

  const functionChartSeriesMonthlyFiltered = useMemo(() => {
    if (selectedFunctionsForFunctionTab.length === 0) return functionChartSeriesMonthly
    return functionChartSeriesMonthly.filter(({ functionName }) => selectedFunctionsForFunctionTab.includes(functionName))
  }, [functionChartSeriesMonthly, selectedFunctionsForFunctionTab])

  const functionWiseTotalsFiltered = useMemo(() => {
    if (selectedFunctionsForFunctionTab.length === 0) return functionWiseTotalsForPeriod
    return functionWiseTotalsForPeriod.filter(({ functionName }) => selectedFunctionsForFunctionTab.includes(functionName))
  }, [functionWiseTotalsForPeriod, selectedFunctionsForFunctionTab])

  // Function table tab: summary table rows (one per function × period)
  const functionCalculationTableRows = useMemo(() => {
    const series = functionChartBy === 'monthly' ? functionChartSeriesMonthly : functionChartSeries
    const rows = []
    for (const { functionName, data } of series) {
      for (const r of data) {
        const periodLabel = r.weekLabel || r.monthLabel || '—'
        const costNum = Number(r.cost_bdt) || 0
        const lostNum = Number(r.lost) || 0
        const lostPct = r.lost_pct != null ? Number(r.lost_pct) : (r.shift_hours > 0 ? (r.lost / r.shift_hours) * 100 : 0)
        const rate = getRateForGroup(functionName)
        const effectiveRate = lostNum > 0 ? costNum / lostNum : rate
        rows.push({
          periodLabel,
          function: functionName,
          members: r.members ?? 0,
          shift_hours: r.shift_hours != null ? Number(r.shift_hours).toFixed(2) : '—',
          work_hours: r.work_hours != null ? Number(r.work_hours).toFixed(2) : '—',
          lost_pct: `${Number(lostPct).toFixed(2)}%`,
          lost_hours: r.lost != null ? Number(r.lost).toFixed(2) : '—',
          _lostNum: lostNum,
          ctc_per_hour_display: effectiveRate != null ? Number(effectiveRate).toFixed(2) : '—',
          _ctc_per_hour: effectiveRate,
          calculation_display: lostNum > 0 && costNum > 0 ? `৳${Number(lostNum).toFixed(2)} × ৳${Number(effectiveRate).toFixed(2)} = ৳${costNum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          cost_display: costNum > 0 ? `৳${costNum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          _costNum: costNum,
        })
      }
    }
    return rows.sort((a, b) => {
      const fc = (a.function || '').localeCompare(b.function || '')
      if (fc !== 0) return fc
      return (a.periodLabel || '').localeCompare(b.periodLabel || '')
    })
  }, [functionChartBy, functionChartSeries, functionChartSeriesMonthly, getRateForGroup, ctcByFunction, ctcPerHour])

  const functionCalculationColumns = [
    { key: 'periodLabel', label: functionChartBy === 'monthly' ? 'Month' : 'Week', sortable: true },
    { key: 'function', label: 'Function', sortable: true, wrapText: true },
    { key: 'members', label: 'Members', sortable: true },
    { key: 'shift_hours', label: 'Shift hours', sortable: true },
    { key: 'work_hours', label: 'Work hours', sortable: true },
    { key: 'lost_pct', label: 'Lost %', sortable: true },
    { key: 'lost_hours', label: 'Lost (hours)', sortable: true },
    { key: 'ctc_per_hour_display', label: 'Effective CTC per hour (BDT)', sortable: true, sortKey: '_ctc_per_hour' },
    { key: 'calculation_display', label: 'Calculation (Lost × Rate = Cost)', sortable: false, wrapText: true },
    { key: 'cost_display', label: 'Cost (BDT)', sortable: true, sortKey: '_costNum' },
  ]

  // Function table tab: breakdown per (function, period, department)
  const functionCalculationBreakdownRows = useMemo(() => {
    if (!functionTabData.length) return []
    const map = new Map()
    for (const row of functionTabData) {
      const groupName = row.group || ''
      const dept = (row.department || '').trim() || '(No department)'
      if (!groupName) continue
      const periodKey = functionChartBy === 'monthly'
        ? `${row.year}-${String(row.month).padStart(2, '0')}`
        : `${row.year}-${String(row.month).padStart(2, '0')}-${row.week_in_month || 0}`
      const periodLabel = functionChartBy === 'monthly'
        ? `${monthNames[row.month] || row.month} ${row.year}`
        : toWeekLabel(row)
      const key = `${groupName}|${periodKey}|${dept}`
      const lostNum = Number(row.lost) || 0
      const rate = getRateForGroup(groupName)
      const costNum = rate != null ? lostNum * rate : 0
      if (!map.has(key)) {
        map.set(key, { function: groupName, periodLabel, department: dept, lost: 0, ctc_per_hour: rate, cost: 0 })
      }
      const rec = map.get(key)
      rec.lost = Math.round((rec.lost + lostNum) * 100) / 100
      rec.cost = Math.round((rec.cost + costNum) * 100) / 100
    }
    const rows = []
    for (const r of map.values()) {
      const rate = r.ctc_per_hour
      rows.push({
        function: r.function,
        periodLabel: r.periodLabel,
        department: r.department,
        lost_hours: r.lost != null ? Number(r.lost).toFixed(2) : '—',
        _lost: r.lost,
        ctc_per_hour_display: rate != null ? Number(rate).toFixed(2) : '—',
        _ctc: rate,
        cost_display: r.cost > 0 ? `৳${Number(r.cost).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
        _cost: r.cost,
        calculation_display: rate != null && r.lost > 0 ? `${Number(r.lost).toFixed(2)} × ৳${Number(rate).toFixed(2)} = ৳${Number(r.cost).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
      })
    }
    return rows.sort((a, b) => {
      const fc = (a.function || '').localeCompare(b.function || '')
      if (fc !== 0) return fc
      const pc = (a.periodLabel || '').localeCompare(b.periodLabel || '')
      if (pc !== 0) return pc
      return (a.department || '').localeCompare(b.department || '')
    })
  }, [functionTabData, functionChartBy, getRateForGroup, ctcByFunction, ctcPerHour])

  const functionBreakdownColumns = [
    { key: 'function', label: 'Function', sortable: true, wrapText: true },
    { key: 'periodLabel', label: functionChartBy === 'monthly' ? 'Month' : 'Week', sortable: true },
    { key: 'department', label: 'Department', sortable: true, wrapText: true },
    { key: 'lost_hours', label: 'Lost (hours)', sortable: true, sortKey: '_lost' },
    { key: 'ctc_per_hour_display', label: 'CTC per hour (BDT)', sortable: true, sortKey: '_ctc' },
    { key: 'calculation_display', label: 'Calculation (Lost × Rate = Cost)', sortable: false, wrapText: true },
    { key: 'cost_display', label: 'Cost (BDT)', sortable: true, sortKey: '_cost' },
  ]

  const functionFilterSet = useMemo(() => selectedFunctionsForFunctionTab.length > 0 ? new Set(selectedFunctionsForFunctionTab) : null, [selectedFunctionsForFunctionTab])
  const functionCalculationTableRowsFiltered = useMemo(() => {
    if (!functionFilterSet) return functionCalculationTableRows
    return functionCalculationTableRows.filter(r => functionFilterSet.has(r.function))
  }, [functionCalculationTableRows, functionFilterSet])
  const functionCalculationBreakdownRowsFiltered = useMemo(() => {
    if (!functionFilterSet) return functionCalculationBreakdownRows
    return functionCalculationBreakdownRows.filter(r => functionFilterSet.has(r.function))
  }, [functionCalculationBreakdownRows, functionFilterSet])

  // Company tab: summary table rows (one per company × period). N-1 uses full company rows from backend when present.
  const companyCalculationTableRowsFromFull = useMemo(() => {
    if (!companyWiseFullFiltered.length) return []
    return companyWiseFullFiltered.map(r => {
      const costNum = Number(r.cost) || 0
      const lostNum = Number(r.lost) || 0
      const shiftHours = Number(r.shift_hours) || 0
      const lostPct = shiftHours > 0 ? (lostNum / shiftHours) * 100 : 0
      const effectiveRate = lostNum > 0 ? costNum / lostNum : null
      const periodLabel = `${monthNames[r.month] || `Month ${r.month}`} ${r.year}`
      return {
        periodLabel,
        company: r.company || '—',
        members: r.members ?? 0,
        shift_hours: r.shift_hours != null ? Number(r.shift_hours).toFixed(2) : '—',
        work_hours: r.work_hours != null ? Number(r.work_hours).toFixed(2) : '—',
        lost_pct: `${Number(lostPct).toFixed(2)}%`,
        lost_hours: r.lost != null ? Number(r.lost).toFixed(2) : '—',
        _lostNum: lostNum,
        ctc_per_hour_display: effectiveRate != null ? Number(effectiveRate).toFixed(2) : '—',
        _ctc_per_hour: effectiveRate,
        calculation_display: lostNum > 0 && costNum > 0 ? `৳${Number(lostNum).toFixed(2)} × ৳${Number(effectiveRate).toFixed(2)} = ৳${costNum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
        cost_display: costNum > 0 ? `৳${costNum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
        _costNum: costNum,
      }
    }).sort((a, b) => {
      const cc = (a.company || '').localeCompare(b.company || '')
      if (cc !== 0) return cc
      return (a.periodLabel || '').localeCompare(b.periodLabel || '')
    })
  }, [companyWiseFullFiltered])

  const companyCalculationTableRows = useMemo(() => {
    if (companyCalculationTableRowsFromFull.length > 0) return companyCalculationTableRowsFromFull
    const series = companyChartBy === 'monthly' ? companyChartSeriesMonthlyResolved : companyChartSeries
    const rows = []
    for (const { companyName, data } of series) {
      for (const r of data) {
        const periodLabel = r.weekLabel || r.monthLabel || '—'
        const costNum = Number(r.cost_bdt) || 0
        const lostNum = Number(r.lost) || 0
        const lostPct = r.lost_pct != null ? Number(r.lost_pct) : (r.shift_hours > 0 ? (r.lost / r.shift_hours) * 100 : 0)
        const effectiveRate = lostNum > 0 ? costNum / lostNum : null
        rows.push({
          periodLabel,
          company: companyName,
          members: r.members ?? 0,
          shift_hours: r.shift_hours != null ? Number(r.shift_hours).toFixed(2) : '—',
          work_hours: r.work_hours != null ? Number(r.work_hours).toFixed(2) : '—',
          lost_pct: `${Number(lostPct).toFixed(2)}%`,
          lost_hours: r.lost != null ? Number(r.lost).toFixed(2) : '—',
          _lostNum: lostNum,
          ctc_per_hour_display: effectiveRate != null ? Number(effectiveRate).toFixed(2) : '—',
          _ctc_per_hour: effectiveRate,
          calculation_display: lostNum > 0 && costNum > 0 ? `৳${Number(lostNum).toFixed(2)} × ৳${Number(effectiveRate).toFixed(2)} = ৳${costNum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          cost_display: costNum > 0 ? `৳${costNum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          _costNum: costNum,
        })
      }
    }
    return rows.sort((a, b) => {
      const cc = (a.company || '').localeCompare(b.company || '')
      if (cc !== 0) return cc
      return (a.periodLabel || '').localeCompare(b.periodLabel || '')
    })
  }, [companyCalculationTableRowsFromFull, companyChartBy, companyChartSeries, companyChartSeriesMonthlyResolved])

  const companyCalculationColumns = [
    { key: 'periodLabel', label: companyChartBy === 'monthly' ? 'Month' : 'Week', sortable: true },
    { key: 'company', label: 'Company', sortable: true },
    { key: 'members', label: 'Members', sortable: true },
    { key: 'shift_hours', label: 'Shift hours', sortable: true },
    { key: 'work_hours', label: 'Work hours', sortable: true },
    { key: 'lost_pct', label: 'Lost %', sortable: true },
    { key: 'lost_hours', label: 'Lost (hours)', sortable: true },
    { key: 'ctc_per_hour_display', label: 'Effective CTC per hour (BDT)', sortable: true, sortKey: '_ctc_per_hour' },
    { key: 'calculation_display', label: 'Calculation (Lost × Rate = Cost)', sortable: false, wrapText: true },
    { key: 'cost_display', label: 'Cost (BDT)', sortable: true, sortKey: '_costNum' },
  ]

  // Company table tab: calculation breakdown per (company, period, function) — shows Lost × CTC/hour = Cost per function
  const companyCalculationBreakdownRows = useMemo(() => {
    if (!companyTabData.length) return []
    const map = new Map() // key = "company|periodKey|function" -> { company, periodLabel, function, lost, ctc_per_hour, cost }
    for (const row of companyTabData) {
      const groupName = row.group || ''
      const dashIdx = groupName.indexOf(' - ')
      const company = dashIdx >= 0 ? groupName.slice(0, dashIdx).trim() : groupName
      const functionName = dashIdx >= 0 ? groupName.slice(dashIdx + 3).trim() : groupName
      if (!company || !functionName) continue
      const periodKey = companyChartBy === 'monthly'
        ? `${row.year}-${String(row.month).padStart(2, '0')}`
        : `${row.year}-${String(row.month).padStart(2, '0')}-${row.week_in_month || 0}`
      const periodLabel = companyChartBy === 'monthly'
        ? `${monthNames[row.month] || row.month} ${row.year}`
        : toWeekLabel(row)
      const key = `${company}|${periodKey}|${functionName}`
      const lostNum = Number(row.lost) || 0
      const rate = getRateForGroup(groupName)
      const costNum = rate != null ? lostNum * rate : 0
      if (!map.has(key)) {
        map.set(key, { company, periodLabel, function: functionName, lost: 0, ctc_per_hour: rate, cost: 0 })
      }
      const rec = map.get(key)
      rec.lost = Math.round((rec.lost + lostNum) * 100) / 100
      rec.cost = Math.round((rec.cost + costNum) * 100) / 100
    }
    const rows = []
    for (const r of map.values()) {
      const rate = r.ctc_per_hour
      rows.push({
        company: r.company,
        periodLabel: r.periodLabel,
        function: r.function,
        lost_hours: r.lost != null ? Number(r.lost).toFixed(2) : '—',
        _lost: r.lost,
        ctc_per_hour_display: rate != null ? Number(rate).toFixed(2) : '—',
        _ctc: rate,
        cost_display: r.cost > 0 ? `৳${Number(r.cost).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
        _cost: r.cost,
        calculation_display: rate != null && r.lost > 0 ? `${Number(r.lost).toFixed(2)} × ৳${Number(rate).toFixed(2)} = ৳${Number(r.cost).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
      })
    }
    return rows.sort((a, b) => {
      const cc = (a.company || '').localeCompare(b.company || '')
      if (cc !== 0) return cc
      const pc = (a.periodLabel || '').localeCompare(b.periodLabel || '')
      if (pc !== 0) return pc
      return (a.function || '').localeCompare(b.function || '')
    })
  }, [companyTabData, companyChartBy, getRateForGroup, ctcByFunction, ctcPerHour])

  const companyBreakdownColumns = [
    { key: 'company', label: 'Company', sortable: true },
    { key: 'periodLabel', label: companyChartBy === 'monthly' ? 'Month' : 'Week', sortable: true },
    { key: 'function', label: 'Function', sortable: true, wrapText: true },
    { key: 'lost_hours', label: 'Lost (hours)', sortable: true, sortKey: '_lost' },
    { key: 'ctc_per_hour_display', label: 'CTC per hour (BDT)', sortable: true, sortKey: '_ctc' },
    { key: 'calculation_display', label: 'Calculation (Lost × Rate = Cost)', sortable: false, wrapText: true },
    { key: 'cost_display', label: 'Cost (BDT)', sortable: true, sortKey: '_cost' },
  ]

  // Apply company filter for Company & Company table tabs (empty selectedCompanies = all)
  const companyFilterSet = useMemo(() => selectedCompanies.length > 0 ? new Set(selectedCompanies) : null, [selectedCompanies])
  const companyWiseTotalsFiltered = useMemo(() => {
    if (!companyFilterSet) return companyWiseTotalsForPeriod
    return companyWiseTotalsForPeriod.filter(c => companyFilterSet.has(c.companyName))
  }, [companyWiseTotalsForPeriod, companyFilterSet])
  const companyChartSeriesFiltered = useMemo(() => {
    if (!companyFilterSet) return companyChartSeries
    return companyChartSeries.filter(c => companyFilterSet.has(c.companyName))
  }, [companyChartSeries, companyFilterSet])
  const companyChartSeriesMonthlyFiltered = useMemo(() => {
    if (!companyFilterSet) return companyChartSeriesMonthlyResolved
    return companyChartSeriesMonthlyResolved.filter(c => companyFilterSet.has(c.companyName))
  }, [companyChartSeriesMonthlyResolved, companyFilterSet])
  const companyCalculationTableRowsFiltered = useMemo(() => {
    if (!companyFilterSet) return companyCalculationTableRows
    return companyCalculationTableRows.filter(r => companyFilterSet.has(r.company))
  }, [companyCalculationTableRows, companyFilterSet])

  const companyCalculationBreakdownRowsFiltered = useMemo(() => {
    if (!companyFilterSet) return companyCalculationBreakdownRows
    return companyCalculationBreakdownRows.filter(r => companyFilterSet.has(r.company))
  }, [companyCalculationBreakdownRows, companyFilterSet])

  // Verify work-hour lost consistency: sum of breakdown lost per (company, period) should match summary table lost
  const companyLostVerification = useMemo(() => {
    const byKey = new Map() // "company|periodLabel" -> sum of _lost from breakdown
    for (const r of companyCalculationBreakdownRowsFiltered) {
      const key = `${r.company}|${r.periodLabel}`
      const lost = Number(r._lost) || 0
      byKey.set(key, (byKey.get(key) || 0) + lost)
    }
    let ok = true
    const epsilon = 0.02
    for (const row of companyCalculationTableRowsFiltered) {
      const key = `${row.company}|${row.periodLabel}`
      const summaryLost = Number(row._lostNum) || 0
      const breakdownSum = byKey.get(key) ?? 0
      if (Math.abs(summaryLost - breakdownSum) > epsilon) {
        ok = false
        break
      }
    }
    return { ok, message: ok ? 'Breakdown lost hours match company summary.' : 'Breakdown and summary lost hours differ; check aggregation.' }
  }, [companyCalculationTableRowsFiltered, companyCalculationBreakdownRowsFiltered])

  const displayedGroups = allGroups.slice(0, visibleGroups)
  const hasMoreGroups = visibleGroups < allGroups.length

  // Flatten for calculation table: one row per (week, function, department). Cost uses function-wise rate.
  const calculationTableRows = useMemo(() => {
    if (!groupedData?.groups) return []
    const rows = []
    for (const groupKey of groupedData.groups.keys()) {
      const functionName = groupKey.split('|||')[0] || groupKey
      const rateUsed = getRateForGroup(functionName)
      const arr = groupedData.groups.get(groupKey) || []
      for (const r of arr) {
        const costNum = r.cost_bdt != null ? Number(r.cost_bdt) : 0
        const shiftHrs = r.shift_hours != null ? Number(r.shift_hours) : 0
        const workHrs = r.work_hours != null ? Number(r.work_hours) : 0
        rows.push({
          weekLabel: toWeekLabel(r),
          function: functionName,
          department: (r.department || '').trim(),
          members: r.members ?? 0,
          shift_hours: shiftHrs,
          work_hours: workHrs,
          lost_pct: r.lost_pct != null ? `${Number(r.lost_pct).toFixed(2)}%` : '—',
          lost_hours: r.lost != null ? Number(r.lost) : 0,
          ctc_per_hour: rateUsed != null ? rateUsed : '—',
          cost_display: costNum > 0 ? `৳${costNum.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
          _costNum: costNum,
        })
      }
    }
    return rows.sort((a, b) => {
      const fc = (a.function || '').localeCompare(b.function || '')
      if (fc !== 0) return fc
      const dc = (a.department || '').localeCompare(b.department || '')
      if (dc !== 0) return dc
      return (a.weekLabel || '').localeCompare(b.weekLabel || '')
    })
  }, [groupedData, ctcByFunction, ctcPerHour])

  const calculationColumns = [
    { key: 'weekLabel', label: 'Week', sortable: true },
    { key: 'function', label: 'Function', sortable: true, wrapText: true },
    { key: 'department', label: 'Department', sortable: true, wrapText: true },
    { key: 'members', label: 'Members', sortable: true },
    { key: 'shift_hours', label: 'Shift hours', sortable: true, sortKey: 'shift_hours' },
    { key: 'work_hours', label: 'Work hours', sortable: true, sortKey: 'work_hours' },
    { key: 'lost_pct', label: 'Lost %', sortable: true },
    { key: 'lost_hours', label: 'Lost (hours)', sortable: true, sortKey: 'lost_hours' },
    { key: 'ctc_per_hour', label: 'CTC Per Hour (BDT) – by function', sortable: true },
    { key: 'cost_display', label: 'Cost (BDT)', sortable: true, sortKey: '_costNum' },
  ]

  const getChartData = (group) => {
    if (departmentChartDataByGroup.size > 0) return departmentChartDataByGroup.get(group) || []
    return []
  }
  const getGroupLabel = (group) => groupedData?.groupLabels?.get(group) || group

  // Cost above the bar: visible label (bold, larger, with shadow)
  const CostLabelAboveBar = (props) => {
    const { x, y, width, value } = props
    if (x == null || y == null || value == null || (typeof value === 'number' && Number.isNaN(value))) return null
    const str = typeof value === 'number' ? value.toLocaleString('en-BD', { maximumFractionDigits: 0 }) : String(value)
    const cx = x + width / 2
    const labelY = y - 10
    return (
      <g>
        <text x={cx} y={labelY} textAnchor="middle" fill="#047857" fontSize={14} fontWeight="800" style={{ paintOrder: 'stroke', stroke: 'white', strokeWidth: 3 }}>
          ৳{str}
        </text>
      </g>
    )
  }

  const BarValueLabel = (props) => {
    const { x, y, width, height, value } = props
    if (x == null || y == null || width == null || height == null) return null
    return <text x={x + width / 2} y={y + height / 2} fill="#ffffff" fontSize={12} fontWeight="700" textAnchor="middle" dominantBaseline="middle">{value}</text>
  }
  const PercentLabelAbove = (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    const str = typeof value === 'number' ? Number(value).toFixed(2) : value
    return <text x={x} y={y - 8} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle">{str}%</text>
  }
  const HoursLabel = (props) => {
    const { x, y, value } = props
    if (x == null || y == null) return null
    const str = typeof value === 'number' ? Number(value).toFixed(2) : value
    return <text x={x} y={y + 24} fill="#000000" fontSize={12} fontWeight="700" textAnchor="middle">{str}h</text>
  }
  const isLoading = weeklyLoading || scopeFilter.isLoading
  const hasAnyData = filteredData.length > 0

  if (isLoading && !hasAnyData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading Lost Hours Cost Analysis data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Lost Hours Cost Analysis</h1>
      {!hasAnyCtcRate && (
        <div className="card p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm">
            Cost (BDT) is not shown because Average CTC per hour is not set per function. Set function-wise rates in <strong>Cost Settings</strong> to see cost on the chart.
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'company' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('company')}
        >
          Company
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'function' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('function')}
        >
          Function
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'department' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('department')}
        >
          Department
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'company_table' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('company_table')}
        >
          Company table
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'function_table' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('function_table')}
        >
          Function table
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'department_table' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('department_table')}
        >
          Department table
        </button>
      </div>

      {(activeTab === 'department' || activeTab === 'department_table') && (
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Months</h2>
              <p className="text-xs text-gray-500 mb-2">Default: latest month. Select one or more months to view department-wise data.</p>
              <div className="min-w-[240px]">
                <MultiSelectSearchable
                  id="department-months-filter"
                  label="Select months"
                  value={selectedMonthsDepartment.length > 0 ? selectedMonthsDepartment : (months.length > 0 ? [months[months.length - 1]] : [])}
                  onChange={setSelectedMonthsDepartment}
                  options={departmentMonthOptions}
                  placeholder="Select months"
                  className="min-w-[200px]"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center mt-2">
                <span className="text-sm text-gray-600">Quick select (toggle quarters):</span>
                {(['Q1', 'Q2', 'Q3', 'Q4']).map(q => {
                  const qMonths = QUARTER_MONTHS[q]
                  const availableInQ = months.filter(m => {
                    const [, monthNum] = m.split('-')
                    return qMonths.includes(parseInt(monthNum, 10))
                  })
                  const current = selectedMonthsDepartment.length > 0 ? selectedMonthsDepartment : (months.length > 0 ? [months[months.length - 1]] : [])
                  const allQSelected = availableInQ.length > 0 && availableInQ.every(m => current.includes(m))
                  const toggleQ = () => {
                    if (availableInQ.length === 0) return
                    if (allQSelected) {
                      setSelectedMonthsDepartment(current.filter(m => !availableInQ.includes(m)))
                    } else {
                      const combined = [...new Set([...current, ...availableInQ])].sort()
                      setSelectedMonthsDepartment(combined)
                    }
                  }
                  return (
                    <button
                      key={q}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${allQSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      onClick={toggleQ}
                      disabled={availableInQ.length === 0}
                      title={q === 'Q1' ? 'July, August, September (toggle)' : q === 'Q2' ? 'October, November, December (toggle)' : q === 'Q3' ? 'January, February, March (toggle)' : 'April, May, June (toggle)'}
                    >
                      {q}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Chart bars</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg font-medium ${departmentChartBy === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setDepartmentChartBy('weekly')}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-lg font-medium ${departmentChartBy === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  onClick={() => setDepartmentChartBy('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>
            <MultiSelectSearchable
              id="function-filter-whl-cost"
              label="Function"
              icon="lnr-briefcase"
              value={selectedFunctions}
              onChange={setSelectedFunctions}
              options={uniqueFunctionsForDepartment.map(f => ({ value: f, label: f }))}
              placeholder="All Functions"
              className="min-w-[200px]"
            />
            <MultiSelectSearchable
              id="department-filter-whl-cost"
              label="Department"
              icon="lnr-layers"
              value={selectedDepartments}
              onChange={setSelectedDepartments}
              options={uniqueDepartmentsForDepartment.map(d => ({ value: d, label: d }))}
              placeholder="All Departments"
              className="min-w-[200px]"
            />
          </div>
        </div>
      )}

      {isError && (
        <div className="card p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-semibold mb-2">Error Loading Data</p>
          <p className="text-red-600 text-sm">{error?.response?.data?.detail || error?.message || 'Failed to load data.'}</p>
        </div>
      )}

      {functionWiseTotals.length > 0 && activeTab === 'department' && (
        <div className="card p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Function-wise total cost (selected period)</h2>
          <p className="text-xs text-gray-500 mb-3">Total cost across all selected departments for each function.</p>
          <div className="flex flex-wrap gap-4">
            {functionWiseTotals.map(({ functionName, totalCost }) => (
              <div
                key={functionName}
                className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 min-w-[200px]"
              >
                <div className="text-sm font-medium text-gray-700 truncate" title={functionName}>{functionName}</div>
                <div className="text-lg font-bold text-emerald-800">
                  ৳{totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'department_table' && (
        <div className="card p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Department table</h2>
          <p className="text-xs text-gray-500 mb-3">Cost (BDT) = Lost (hours) × CTC per hour (function-wise from Cost Settings). One row per week, function, and department for the selected filters.</p>
          <DataTable columns={calculationColumns} rows={calculationTableRows} />
        </div>
      )}

      {activeTab === 'company_table' && (
        <div className="space-y-6">
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Company</h2>
            <p className="text-xs text-gray-500 mb-3">Filter by company. Leave empty to show all companies.</p>
            <div className="min-w-[240px]">
              <MultiSelectSearchable
                id="company-table-filter"
                label="Company"
                value={selectedCompanies}
                onChange={setSelectedCompanies}
                options={companyFilterOptions}
                placeholder="All companies"
                className="min-w-[200px]"
              />
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Months</h2>
            <p className="text-xs text-gray-500 mb-3">Select one or more months. Same selection as Company tab.</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px]">
                <MultiSelectSearchable
                  id="company-table-months"
                  label="Select months"
                  value={selectedMonthsCompany.length > 0 ? selectedMonthsCompany : (months.length > 0 ? [months[months.length - 1]] : [])}
                  onChange={setSelectedMonthsCompany}
                  options={companyMonthOptions}
                  placeholder="Select months"
                  className="min-w-[200px]"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600">Quick select (toggle quarters):</span>
                {(['Q1', 'Q2', 'Q3', 'Q4']).map(q => {
                  const qMonths = QUARTER_MONTHS[q]
                  const availableInQ = months.filter(m => {
                    const [, monthNum] = m.split('-')
                    return qMonths.includes(parseInt(monthNum, 10))
                  })
                  const current = selectedMonthsCompany.length > 0 ? selectedMonthsCompany : (months.length > 0 ? [months[months.length - 1]] : [])
                  const allQSelected = availableInQ.length > 0 && availableInQ.every(m => current.includes(m))
                  const toggleQ = () => {
                    if (availableInQ.length === 0) return
                    if (allQSelected) {
                      setSelectedMonthsCompany(current.filter(m => !availableInQ.includes(m)))
                    } else {
                      const combined = [...new Set([...current, ...availableInQ])].sort()
                      setSelectedMonthsCompany(combined)
                    }
                  }
                  return (
                    <button
                      key={q}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${allQSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      onClick={toggleQ}
                      disabled={availableInQ.length === 0}
                      title={q === 'Q1' ? 'July, August, September (toggle)' : q === 'Q2' ? 'October, November, December (toggle)' : q === 'Q3' ? 'January, February, March (toggle)' : 'April, May, June (toggle)'}
                    >
                      {q}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Chart bars</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${companyChartBy === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setCompanyChartBy('weekly')}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${companyChartBy === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setCompanyChartBy('monthly')}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Calculation breakdown (per function)</h2>
            <p className="text-xs text-gray-500 mb-3">
              One row per company, {companyChartBy === 'monthly' ? 'month' : 'week'}, and <strong>function</strong>. Shows Lost (hours), CTC per hour for that function (from Cost Settings), and Cost = Lost × CTC per hour. Sum of Cost across functions in a company/period equals the company total in the table below.
            </p>
            <DataTable columns={companyBreakdownColumns} rows={companyCalculationBreakdownRowsFiltered} />
            <p className={`text-xs mt-2 ${companyLostVerification.ok ? 'text-green-600' : 'text-amber-600'}`}>
              {companyLostVerification.ok ? '✓ ' : ''}{companyLostVerification.message}
            </p>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Company-wise summary table</h2>
            <p className="text-xs text-gray-500 mb-3">
              <strong>No, we do not use an average.</strong> We use <strong>each function’s own</strong> CTC per hour (from Cost Settings). Example: CIPLC Factory lost 10h at ৳200/h → ৳2,000; Bidding & Contract lost 5h at ৳297/h → ৳1,485; company total = ৳2,000 + ৳1,485 = ৳3,485. So: <strong>cost = (lost in function A × rate A) + (lost in function B × rate B) + …</strong> The “Effective CTC per hour” in the table is just total cost ÷ total lost (for display only). One row per {companyChartBy === 'monthly' ? 'month' : 'week'} and company.
            </p>
            <DataTable columns={companyCalculationColumns} rows={companyCalculationTableRowsFiltered} />
          </div>
        </div>
      )}

      {activeTab === 'function_table' && (
        <div className="space-y-6">
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Function</h2>
            <p className="text-xs text-gray-500 mb-3">Filter by function. Leave empty to show all functions.</p>
            <div className="min-w-[240px]">
              <MultiSelectSearchable
                id="function-table-filter"
                label="Function"
                value={selectedFunctionsForFunctionTab}
                onChange={setSelectedFunctionsForFunctionTab}
                options={functionFilterOptionsForFunctionTab}
                placeholder="All functions"
                className="min-w-[200px]"
              />
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Months</h2>
            <p className="text-xs text-gray-500 mb-3">Select one or more months. Same selection as Function tab.</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px]">
                <MultiSelectSearchable
                  id="function-table-months"
                  label="Select months"
                  value={selectedMonthsFunction.length > 0 ? selectedMonthsFunction : (months.length > 0 ? [months[months.length - 1]] : [])}
                  onChange={setSelectedMonthsFunction}
                  options={functionMonthOptions}
                  placeholder="Select months"
                  className="min-w-[200px]"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600">Quick select (toggle quarters):</span>
                {(['Q1', 'Q2', 'Q3', 'Q4']).map(q => {
                  const qMonths = QUARTER_MONTHS[q]
                  const availableInQ = months.filter(m => {
                    const [, monthNum] = m.split('-')
                    return qMonths.includes(parseInt(monthNum, 10))
                  })
                  const current = selectedMonthsFunction.length > 0 ? selectedMonthsFunction : (months.length > 0 ? [months[months.length - 1]] : [])
                  const allQSelected = availableInQ.length > 0 && availableInQ.every(m => current.includes(m))
                  const toggleQ = () => {
                    if (availableInQ.length === 0) return
                    if (allQSelected) {
                      setSelectedMonthsFunction(current.filter(m => !availableInQ.includes(m)))
                    } else {
                      const combined = [...new Set([...current, ...availableInQ])].sort()
                      setSelectedMonthsFunction(combined)
                    }
                  }
                  return (
                    <button
                      key={q}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${allQSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      onClick={toggleQ}
                      disabled={availableInQ.length === 0}
                      title={q === 'Q1' ? 'July, August, September (toggle)' : q === 'Q2' ? 'October, November, December (toggle)' : q === 'Q3' ? 'January, February, March (toggle)' : 'April, May, June (toggle)'}
                    >
                      {q}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Chart bars</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${functionChartBy === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setFunctionChartBy('weekly')}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${functionChartBy === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setFunctionChartBy('monthly')}
              >
                Monthly
              </button>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Calculation breakdown (per department)</h2>
            <p className="text-xs text-gray-500 mb-3">
              One row per function, {functionChartBy === 'monthly' ? 'month' : 'week'}, and <strong>department</strong>. Shows Lost (hours), CTC per hour for that function (from Cost Settings), and Cost = Lost × CTC per hour.
            </p>
            <DataTable columns={functionBreakdownColumns} rows={functionCalculationBreakdownRowsFiltered} />
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Function-wise summary table</h2>
            <p className="text-xs text-gray-500 mb-3">
              One row per {functionChartBy === 'monthly' ? 'month' : 'week'} and function. Cost = Lost (hours) × CTC per hour (from Cost Settings for that function).
            </p>
            <DataTable columns={functionCalculationColumns} rows={functionCalculationTableRowsFiltered} />
          </div>
        </div>
      )}

      {activeTab === 'function' && (
        <div className="space-y-6">
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Function</h2>
            <p className="text-xs text-gray-500 mb-3">Filter by function to show only selected functions. Leave empty to show all functions.</p>
            <div className="min-w-[240px]">
              <MultiSelectSearchable
                id="function-filter"
                label="Function"
                value={selectedFunctionsForFunctionTab}
                onChange={setSelectedFunctionsForFunctionTab}
                options={functionFilterOptionsForFunctionTab}
                placeholder="All functions"
                className="min-w-[200px]"
              />
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Months</h2>
            <p className="text-xs text-gray-500 mb-3">Default: latest month. Select one or more months to view function-wise data.</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px]">
                <MultiSelectSearchable
                  id="function-months"
                  label="Select months"
                  value={selectedMonthsFunction.length > 0 ? selectedMonthsFunction : (months.length > 0 ? [months[months.length - 1]] : [])}
                  onChange={setSelectedMonthsFunction}
                  options={functionMonthOptions}
                  placeholder="Select months"
                  className="min-w-[200px]"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600">Quick select (toggle quarters):</span>
                {(['Q1', 'Q2', 'Q3', 'Q4']).map(q => {
                  const qMonths = QUARTER_MONTHS[q]
                  const availableInQ = months.filter(m => {
                    const [, monthNum] = m.split('-')
                    return qMonths.includes(parseInt(monthNum, 10))
                  })
                  const current = selectedMonthsFunction.length > 0 ? selectedMonthsFunction : (months.length > 0 ? [months[months.length - 1]] : [])
                  const allQSelected = availableInQ.length > 0 && availableInQ.every(m => current.includes(m))
                  const toggleQ = () => {
                    if (availableInQ.length === 0) return
                    if (allQSelected) {
                      setSelectedMonthsFunction(current.filter(m => !availableInQ.includes(m)))
                    } else {
                      const combined = [...new Set([...current, ...availableInQ])].sort()
                      setSelectedMonthsFunction(combined)
                    }
                  }
                  return (
                    <button
                      key={q}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${allQSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      onClick={toggleQ}
                      disabled={availableInQ.length === 0}
                      title={q === 'Q1' ? 'July, August, September (toggle)' : q === 'Q2' ? 'October, November, December (toggle)' : q === 'Q3' ? 'January, February, March (toggle)' : 'April, May, June (toggle)'}
                    >
                      {q}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Chart bars</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${functionChartBy === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setFunctionChartBy('weekly')}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${functionChartBy === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setFunctionChartBy('monthly')}
              >
                Monthly
              </button>
            </div>
          </div>

          {functionWiseTotalsFiltered.length > 0 && (
            <div className="card p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Function-wise total cost (selected months)</h2>
              <p className="text-xs text-gray-500 mb-3">Total cost across all departments for each function.</p>
              <div className="flex flex-wrap gap-4">
                {functionWiseTotalsFiltered.map(({ functionName, totalCost }) => (
                  <div
                    key={functionName}
                    className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-2 min-w-[200px]"
                  >
                    <div className="text-sm font-medium text-gray-700 truncate" title={functionName}>{functionName}</div>
                    <div className="text-lg font-bold text-violet-800">
                      ৳{totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const series = functionChartBy === 'monthly' ? functionChartSeriesMonthlyFiltered : functionChartSeriesFiltered
            return series.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-gray-600">No function data for the selected months and function filter. Select months above, adjust Function filter, or ensure attendance data is loaded.</p>
              </div>
            ) : (
              series.map(({ functionName, data }, funcIdx) => {
                const maxCost = hasAnyCtcRate ? Math.max(...data.map(r => r.cost_bdt ?? 0).filter(Number), 1) : 1
                const totalCost = data.reduce((sum, r) => sum + (Number(r.cost_bdt) || 0), 0)
                const byLabel = functionChartBy === 'monthly' ? 'month' : 'week'
                const ctcRateForChart = getRateForGroup(functionName)
                return (
                  <div key={functionName} className="space-y-4">
                    <h2 className="text-xl font-semibold">{functionName}</h2>
                    <div className="card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="font-semibold text-gray-700">Work Hour Lost & Cost (BDT)</div>
                        {hasAnyCtcRate && (
                          <div className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            Period total: ৳{totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                      <div className="mb-2 text-sm text-gray-600">
                        <strong>CTC per hour (this function):</strong>{' '}
                        {ctcRateForChart != null ? `৳${Number(ctcRateForChart).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-amber-600">Not set in Cost Settings</span>}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">Cost is shown as labels above each bar. All departments under this function are aggregated by {byLabel}.</p>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <ComposedChart data={data} margin={{ top: 40, right: 60, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id={`gradient-function-${funcIdx}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.4}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                            <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                            <YAxis yAxisId="right" orientation="right" label={{ value: 'Lost % & Hours', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                            {hasAnyCtcRate && (
                              <YAxis yAxisId="cost" orientation="right" width={0} domain={[0, maxCost * 1.1]} hide />
                            )}
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const row = payload[0]?.payload
                                const costVal = row?.cost_bdt
                                return (
                                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                                    <div className="font-semibold text-gray-800 mb-1">{label}</div>
                                    {payload.map((p) => {
                                      const val = p.value
                                      const display = p.name === 'Cost (BDT)' && typeof val === 'number' ? `৳${Number(val).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (typeof val === 'number' ? Number(val).toFixed(2) : val)
                                      return (
                                        <div key={p.dataKey} className="flex justify-between gap-4">
                                          <span style={{ color: p.color }}>{p.name}:</span>
                                          <span>{display}{p.name === 'Work Hour Lost %' ? '%' : p.name === 'Work Hours Lost' ? 'h' : ''}</span>
                                        </div>
                                      )
                                    })}
                                    {hasAnyCtcRate && costVal != null && !payload.some(p => p.dataKey === 'cost_bdt') && (
                                      <div className="flex justify-between gap-4 border-t border-gray-100 mt-1 pt-1">
                                        <span className="text-emerald-600">Cost (BDT):</span>
                                        <span>৳{Number(costVal).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    )}
                                  </div>
                                )
                              }}
                              labelStyle={{ color: '#374151', fontWeight: 600 }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-function-${funcIdx})`} radius={[8, 8, 0, 0]}>
                              <LabelList content={BarValueLabel} />
                              {hasAnyCtcRate && (
                                <LabelList dataKey="cost_bdt" content={CostLabelAboveBar} position="top" />
                              )}
                            </Bar>
                            <Line yAxisId="right" type="monotone" dataKey="lost_pct" name="Work Hour Lost %" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }}>
                              <LabelList content={PercentLabelAbove} />
                            </Line>
                            <Line yAxisId="right" type="monotone" dataKey="lost" name="Work Hours Lost" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }}>
                              <LabelList content={HoursLabel} />
                            </Line>
                            {hasAnyCtcRate && (
                              <Line yAxisId="cost" type="monotone" dataKey="cost_bdt" name="Cost (BDT)" stroke="transparent" strokeWidth={0} dot={false} isAnimationActive={false} legendType="none" />
                            )}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )
              })
            )
          })()}
        </div>
      )}

      {activeTab === 'company' && (
        <div className="space-y-6">
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Company</h2>
            <p className="text-xs text-gray-500 mb-3">Filter by company. Leave empty to show all companies.</p>
            <div className="min-w-[240px]">
              <MultiSelectSearchable
                id="company-filter"
                label="Company"
                value={selectedCompanies}
                onChange={setSelectedCompanies}
                options={companyFilterOptions}
                placeholder="All companies"
                className="min-w-[200px]"
              />
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Months</h2>
            <p className="text-xs text-gray-500 mb-3">Default: latest month. Select one or more months to view company-wise data.</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px]">
                <MultiSelectSearchable
                  id="company-months"
                  label="Select months"
                  value={selectedMonthsCompany.length > 0 ? selectedMonthsCompany : (months.length > 0 ? [months[months.length - 1]] : [])}
                  onChange={setSelectedMonthsCompany}
                  options={companyMonthOptions}
                  placeholder="Select months"
                  className="min-w-[200px]"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-600">Quick select (toggle quarters):</span>
                {(['Q1', 'Q2', 'Q3', 'Q4']).map(q => {
                  const qMonths = QUARTER_MONTHS[q]
                  const availableInQ = months.filter(m => {
                    const [, monthNum] = m.split('-')
                    return qMonths.includes(parseInt(monthNum, 10))
                  })
                  const current = selectedMonthsCompany.length > 0 ? selectedMonthsCompany : (months.length > 0 ? [months[months.length - 1]] : [])
                  const allQSelected = availableInQ.length > 0 && availableInQ.every(m => current.includes(m))
                  const toggleQ = () => {
                    if (availableInQ.length === 0) return
                    if (allQSelected) {
                      setSelectedMonthsCompany(current.filter(m => !availableInQ.includes(m)))
                    } else {
                      const combined = [...new Set([...current, ...availableInQ])].sort()
                      setSelectedMonthsCompany(combined)
                    }
                  }
                  return (
                    <button
                      key={q}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${allQSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      onClick={toggleQ}
                      disabled={availableInQ.length === 0}
                      title={q === 'Q1' ? 'July, August, September (toggle)' : q === 'Q2' ? 'October, November, December (toggle)' : q === 'Q3' ? 'January, February, March (toggle)' : 'April, May, June (toggle)'}
                    >
                      {q}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Chart bars</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${companyChartBy === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setCompanyChartBy('weekly')}
              >
                Weekly
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg font-medium ${companyChartBy === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setCompanyChartBy('monthly')}
              >
                Monthly
              </button>
            </div>
          </div>

          {companyWiseTotalsFiltered.length > 0 && (
            <div className="card p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Company-wise total cost (selected months)</h2>
              <p className="text-xs text-gray-500 mb-3">Total cost across all functions for each company.</p>
              <div className="flex flex-wrap gap-4">
                {companyWiseTotalsFiltered.map(({ companyName, totalCost }) => (
                  <div
                    key={companyName}
                    className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-2 min-w-[200px]"
                  >
                    <div className="text-sm font-medium text-gray-700">{companyName}</div>
                    <div className="text-lg font-bold text-sky-800">
                      ৳{totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(() => {
            const series = companyChartBy === 'monthly' ? companyChartSeriesMonthlyFiltered : companyChartSeriesFiltered
            return series.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-gray-600">No company data for the selected months and company filter. Select months above, adjust Company filter, or ensure attendance data is loaded.</p>
              </div>
            ) : (
              series.map(({ companyName, data }, companyIdx) => {
                const maxCost = hasAnyCtcRate ? Math.max(...data.map(r => r.cost_bdt ?? 0).filter(Number), 1) : 1
                const totalCost = data.reduce((sum, r) => sum + (Number(r.cost_bdt) || 0), 0)
                const byLabel = companyChartBy === 'monthly' ? 'month' : 'week'
                return (
                  <div key={companyName} className="space-y-4">
                    <h2 className="text-xl font-semibold">{companyName}</h2>
                    <div className="card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="font-semibold text-gray-700">Work Hour Lost & Cost (BDT)</div>
                        {hasAnyCtcRate && (
                          <div className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            Period total: ৳{totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">Cost is shown as labels above each bar. All functions under this company are aggregated by {byLabel}. Values shown to 2 decimal places.</p>
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer>
                        <ComposedChart data={data} margin={{ top: 40, right: 60, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id={`gradient-company-${companyIdx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.4}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                          <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                          <YAxis yAxisId="right" orientation="right" label={{ value: 'Lost % & Hours', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                          {hasAnyCtcRate && (
                            <YAxis yAxisId="cost" orientation="right" width={0} domain={[0, maxCost * 1.1]} hide />
                          )}
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const row = payload[0]?.payload
                              const costVal = row?.cost_bdt
                              return (
                                <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                                  <div className="font-semibold text-gray-800 mb-1">{label}</div>
                                  {payload.map((p) => {
                                    const val = p.value
                                    const display = p.name === 'Cost (BDT)' && typeof val === 'number' ? `৳${Number(val).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (typeof val === 'number' ? Number(val).toFixed(2) : val)
                                    return (
                                      <div key={p.dataKey} className="flex justify-between gap-4">
                                        <span style={{ color: p.color }}>{p.name}:</span>
                                        <span>{display}{p.name === 'Work Hour Lost %' ? '%' : p.name === 'Work Hours Lost' ? 'h' : ''}</span>
                                      </div>
                                    )
                                  })}
                                  {hasAnyCtcRate && costVal != null && !payload.some(p => p.dataKey === 'cost_bdt') && (
                                    <div className="flex justify-between gap-4 border-t border-gray-100 mt-1 pt-1">
                                      <span className="text-emerald-600">Cost (BDT):</span>
                                      <span>৳{Number(costVal).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                  )}
                                </div>
                              )
                            }}
                            labelStyle={{ color: '#374151', fontWeight: 600 }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '10px' }} />
                          <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-company-${companyIdx})`} radius={[8, 8, 0, 0]}>
                            <LabelList content={BarValueLabel} />
                            {hasAnyCtcRate && (
                              <LabelList dataKey="cost_bdt" content={CostLabelAboveBar} position="top" />
                            )}
                          </Bar>
                          <Line yAxisId="right" type="monotone" dataKey="lost_pct" name="Work Hour Lost %" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }}>
                            <LabelList content={PercentLabelAbove} />
                          </Line>
                          <Line yAxisId="right" type="monotone" dataKey="lost" name="Work Hours Lost" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }}>
                            <LabelList content={HoursLabel} />
                          </Line>
                          {hasAnyCtcRate && (
                            <Line yAxisId="cost" type="monotone" dataKey="cost_bdt" name="Cost (BDT)" stroke="transparent" strokeWidth={0} dot={false} isAnimationActive={false} legendType="none" />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          )()}
        </div>
      )}

      {activeTab === 'department' && (allGroups.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-600">No data for the current filters. Try selecting a month or adjusting Function/Department.</p>
        </div>
      ) : (
        <>
          {displayedGroups.map((group, groupIdx) => {
            const chartData = getChartData(group)
            if (chartData.length === 0) return null
            const groupLabel = getGroupLabel(group)
            const groupName = group.split('|||')[0] || group
            const ctcRateForChart = getRateForGroup(groupName)
            const maxCost = hasAnyCtcRate ? Math.max(...chartData.map(r => r.cost_bdt ?? 0).filter(Number), 1) : 1
            const totalCost = chartData.reduce((sum, r) => sum + (Number(r.cost_bdt) || 0), 0)
            return (
              <div key={group} className="space-y-4">
                <h2 className="text-xl font-semibold">{groupLabel}</h2>
                <div className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="font-semibold text-gray-700">Work Hour Lost & Cost (BDT)</div>
                    {hasAnyCtcRate && (
                      <div className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        Selected period total: ৳{totalCost.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>
                  <div className="mb-2 text-sm text-gray-600">
                    <strong>Average CTC per employee per hour (this function):</strong>{' '}
                    {ctcRateForChart != null ? (
                      <>৳{Number(ctcRateForChart).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                    ) : (
                      <span className="text-amber-600">Not set in Cost Settings</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Cost is shown as labels above each bar and in the tooltip on hover. All departments under this function use this CTC rate.</p>
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={chartData} margin={{ top: 40, right: 60, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={`gradient-pink-cost-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#f472b6" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-45} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Lost % & Hours', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                        {hasAnyCtcRate && (
                          <YAxis yAxisId="cost" orientation="right" width={0} domain={[0, maxCost * 1.1]} hide />
                        )}
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const row = payload[0]?.payload
                            const costVal = row?.cost_bdt
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                                <div className="font-semibold text-gray-800 mb-1">{label}</div>
                                {payload.map((p) => (
                                  <div key={p.dataKey} className="flex justify-between gap-4">
                                    <span style={{ color: p.color }}>{p.name}:</span>
                                    <span>{p.name === 'Cost (BDT)' && typeof p.value === 'number' ? `৳${p.value.toLocaleString('en-BD', { minimumFractionDigits: 2 })}` : p.value}</span>
                                  </div>
                                ))}
                                {hasAnyCtcRate && costVal != null && !payload.some(p => p.dataKey === 'cost_bdt') && (
                                  <div className="flex justify-between gap-4 border-t border-gray-100 mt-1 pt-1">
                                    <span className="text-emerald-600">Cost (BDT):</span>
                                    <span>৳{Number(costVal).toLocaleString('en-BD', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                              </div>
                            )
                          }}
                          labelStyle={{ color: '#374151', fontWeight: 600 }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-pink-cost-${groupIdx})`} radius={[8, 8, 0, 0]}>
                          <LabelList content={BarValueLabel} />
                          {hasAnyCtcRate && (
                            <LabelList dataKey="cost_bdt" content={CostLabelAboveBar} position="top" />
                          )}
                        </Bar>
                        <Line yAxisId="right" type="monotone" dataKey="lost_pct" name="Work Hour Lost %" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }}>
                          <LabelList content={PercentLabelAbove} />
                        </Line>
                        <Line yAxisId="right" type="monotone" dataKey="lost" name="Work Hours Lost" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }}>
                          <LabelList content={HoursLabel} />
                        </Line>
                        {hasAnyCtcRate && (
                          <Line
                            yAxisId="cost"
                            type="monotone"
                            dataKey="cost_bdt"
                            name="Cost (BDT)"
                            stroke="transparent"
                            strokeWidth={0}
                            dot={false}
                            isAnimationActive={false}
                            legendType="none"
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )
          })}
          {hasMoreGroups && (
            <div className="flex justify-center gap-4 mt-6">
              <button
                type="button"
                onClick={() => setVisibleGroups(prev => Math.min(prev + 5, allGroups.length))}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Load More ({allGroups.length - visibleGroups} remaining)
              </button>
              <button
                type="button"
                onClick={() => setVisibleGroups(allGroups.length)}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
              >
                Show All
              </button>
            </div>
          )}
        </>
      ))}
    </div>
  )
}
