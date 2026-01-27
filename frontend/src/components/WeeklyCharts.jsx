import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar, CartesianGrid, LabelList } from 'recharts'

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

export default function WeeklyCharts({ rows }) {
  const byGroup = useMemo(() => {
    const m = new Map()
           for (const r of rows) {
             const key = r.group || 'Unknown'
             if (!m.has(key)) m.set(key, [])
             m.get(key).push({ ...r, weekLabel: toWeekLabel(r) })
           }
    // Sort by year, month, week_in_month
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        if (a.month !== b.month) return a.month - b.month
        return (a.week_in_month || 0) - (b.week_in_month || 0)
      })
    }
    return m
  }, [rows])

  const groups = Array.from(byGroup.keys())
  const palette = ['#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#38bdf8']

  if (groups.length === 0) return <div className="text-sm text-gray-500">No data for charts.</div>

  const PercentLabel = (props) => {
    const { x, y, width, value } = props
    if (x == null || y == null || width == null) return null
    const cx = x + width / 2
    const cy = y - 5
    return <text x={cx} y={cy} fill="#000000" fontSize={11} fontWeight="600" textAnchor="middle">{value.toFixed(1)}%</text>
  }

  return (
    <div className="space-y-6">
      {/* On-Time % Chart */}
      <div className="card p-4">
        <div className="mb-4 font-semibold text-lg text-gray-800">Weekly On-Time Percentage</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g, idx) => (
            <div key={g} className="border rounded-lg p-3 bg-gray-50">
              <div className="mb-2 font-semibold text-sm text-gray-700">{g}</div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={byGroup.get(g)} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" angle={-45} textAnchor="end" height={80} />
                    <YAxis label={{ value: 'On-Time %', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                    <Legend />
                    <Bar dataKey="on_time_pct" name="On-Time %" fill={palette[idx % palette.length]} fillOpacity={0.7}>
                      <LabelList content={<PercentLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Work Hour Completion % Chart */}
      <div className="card p-4">
        <div className="mb-4 font-semibold text-lg text-gray-800">Weekly Work Hour Completion Percentage</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g, idx) => (
            <div key={g} className="border rounded-lg p-3 bg-gray-50">
              <div className="mb-2 font-semibold text-sm text-gray-700">{g}</div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={byGroup.get(g)} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" angle={-45} textAnchor="end" height={80} />
                    <YAxis label={{ value: 'Completion %', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                    <Legend />
                    <Bar dataKey="completion_pct" name="Completion %" fill="#34d399" fillOpacity={0.7}>
                      <LabelList content={<PercentLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Work Hour Lost % Chart */}
      <div className="card p-4">
        <div className="mb-4 font-semibold text-lg text-gray-800">Weekly Work Hour Lost Percentage</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g, idx) => (
            <div key={g} className="border rounded-lg p-3 bg-gray-50">
              <div className="mb-2 font-semibold text-sm text-gray-700">{g}</div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={byGroup.get(g)} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" angle={-45} textAnchor="end" height={80} />
                    <YAxis label={{ value: 'Lost %', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                    <Legend />
                    <Bar dataKey="lost_pct" name="Lost %" fill="#f87171" fillOpacity={0.7}>
                      <LabelList content={<PercentLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
