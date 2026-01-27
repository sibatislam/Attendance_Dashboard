import { useState, useEffect, useRef, memo } from 'react'
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Legend, Bar, Line, CartesianGrid, LabelList } from 'recharts'

const LazyChartGroup = memo(({ 
  group, 
  groupIdx, 
  chartData, 
  BarValueLabel, 
  PercentLabel, 
  PercentLabelAbove,
  SLPercentLabel,
  CLPercentLabel,
  APercentLabel,
  setGroupRef 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            // Once visible, stop observing
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '200px', // Start loading 200px before visible
        threshold: 0.01
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      if (observer) observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="space-y-4 mb-8">
      <div ref={el => setGroupRef(group, el)}>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{group}</h2>

        {!isVisible ? (
          // Placeholder while not visible
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card p-6 h-96 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p className="text-sm text-gray-500">Loading chart...</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Actual charts when visible
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* On Time % Chart */}
            <div className="card p-4">
              <h3 className="text-md font-semibold text-gray-700 mb-3">On Time %</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData.onTime} margin={{ top: 30, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id={`gradient-blue-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.6}/>
                    </linearGradient>
                    <filter id={`shadow-${groupIdx}`}>
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'On Time %', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-blue-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-${groupIdx})`}>
                    <LabelList content={BarValueLabel} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="on_time_pct" name="On Time %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                    <LabelList content={PercentLabel} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Work Hour Completion Chart */}
            <div className="card p-4">
              <h3 className="text-md font-semibold text-gray-700 mb-3">Work Hour Completion</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData.workHour} margin={{ top: 30, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id={`gradient-green-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.6}/>
                    </linearGradient>
                    <filter id={`shadow-green-${groupIdx}`}>
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Completion %', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-green-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-green-${groupIdx})`}>
                    <LabelList content={BarValueLabel} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="completion_pct" name="Completion %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                    <LabelList content={PercentLabel} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Work Hour Lost Chart */}
            <div className="card p-4">
              <h3 className="text-md font-semibold text-gray-700 mb-3">Work Hour Lost</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData.workHourLost} margin={{ top: 30, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id={`gradient-pink-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#f472b6" stopOpacity={0.6}/>
                    </linearGradient>
                    <filter id={`shadow-pink-${groupIdx}`}>
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#ec4899" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Lost % & Hours', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-pink-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-pink-${groupIdx})`}>
                    <LabelList content={BarValueLabel} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="lost_pct" name="Work Hour Lost %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                    <LabelList content={PercentLabelAbove} />
                  </Line>
                  <Line yAxisId="right" type="monotone" dataKey="lost_hrs" name="Hours Lost" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6 }}>
                    <LabelList position="bottom" style={{ fill: '#6366f1', fontSize: 10, fontWeight: 600 }} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Leave Analysis Chart */}
            <div className="card p-4">
              <h3 className="text-md font-semibold text-gray-700 mb-3">Leave Analysis Adjacent to Weekend and Holiday</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData.leaveAnalysis} margin={{ top: 30, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id={`gradient-purple-${groupIdx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.6}/>
                    </linearGradient>
                    <filter id={`shadow-purple-${groupIdx}`}>
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.3"/>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="left" label={{ value: 'Members', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'SL%, CL% & A%', angle: -90, position: 'insideRight', style: { fill: '#6b7280' } }} domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#d1d5db' }} />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} labelStyle={{ color: '#374151', fontWeight: 600 }} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar yAxisId="left" dataKey="members" name="Members" fill={`url(#gradient-purple-${groupIdx})`} radius={[8, 8, 0, 0]} filter={`url(#shadow-purple-${groupIdx})`}>
                    <LabelList content={BarValueLabel} />
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="sl_pct" name="SL %" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                    <LabelList content={SLPercentLabel} />
                  </Line>
                  <Line yAxisId="right" type="monotone" dataKey="cl_pct" name="CL %" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                    <LabelList content={CLPercentLabel} />
                  </Line>
                  <Line yAxisId="right" type="monotone" dataKey="a_pct" name="A %" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 5, strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 7 }}>
                    <LabelList content={APercentLabel} />
                  </Line>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

LazyChartGroup.displayName = 'LazyChartGroup'

export default LazyChartGroup

