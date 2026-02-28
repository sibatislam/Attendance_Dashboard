import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { getOnTime } from '../lib/api'

// Balloon positions (percent) and colors; popDelay is assigned randomly when celebration starts
const BALLOON_BASE = [
  { id: 1, left: '8%', top: '10%', color: '#ef4444', colorLight: '#f87171' },
  { id: 2, left: '22%', top: '6%', color: '#3b82f6', colorLight: '#60a5fa' },
  { id: 3, left: '38%', top: '12%', color: '#22c55e', colorLight: '#4ade80' },
  { id: 4, left: '72%', top: '8%', color: '#eab308', colorLight: '#facc15' },
  { id: 5, left: '88%', top: '14%', color: '#ec4899', colorLight: '#f472b6' },
]
const POP_DELAYS = [0, 0.35, 0.7, 1.05, 1.4]
function shufflePopDelays() {
  const delays = [...POP_DELAYS]
  for (let i = delays.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[delays[i], delays[j]] = [delays[j], delays[i]]
  }
  return delays
}
// Particle burst: (dx, dy in px) and optional rotation for variety
const PARTICLE_DIRS = [
  { x: 0, y: -60 }, { x: 44, y: -44 }, { x: 60, y: 0 }, { x: 44, y: 44 },
  { x: 0, y: 60 }, { x: -44, y: 44 }, { x: -60, y: 0 }, { x: -44, y: -44 },
]

// Wrapper that adds pop-phase class to the balloon after delay so CSS can run the pop animation
function BalloonWithPop({ balloon, children }) {
  const [popped, setPopped] = useState(false)
  useEffect(() => {
    const ms = (balloon.popDelay + 1.5) * 1000
    const t = setTimeout(() => setPopped(true), ms)
    return () => clearTimeout(t)
  }, [balloon.popDelay])
  return (
    <div
      className={`balloon-wrap absolute w-20 h-28 ${popped ? 'balloon-pop-phase' : ''}`}
      style={{ left: balloon.left, top: balloon.top }}
    >
      {children}
    </div>
  )
}

const INTRO_STATEMENT = 'This system exists to provide clarity and visibility — so we can self-correct early, work fairly, and uphold shared professional standards.'

const CIPLC_CATEGORIES = [
  {
    key: 'roleModels',
    title: 'Attendance Role Models (≥ 93%)',
    minPct: 93,
    maxPct: 101,
    statement: 'Consistently strong attendance reflecting disciplined planning, reliability, and leadership by example.',
    lmActionTitle: 'LM Action – Protect & Share',
    lmActions: [
      'Thank the team openly (Thank You notes, during meeting, via email, etc.).',
      'Ask the team to share one practical habit that helps them arrive on time.',
      "Encourage team to uphold the position of 'Attendance Role Models'.",
    ],
    borderColor: 'border-green-500',
    bgClass: 'bg-gradient-to-br from-green-50 to-emerald-50',
    icon: '🎉',
    iconAnim: 'icon-bounce',
  },
  {
    key: 'buildingConsistency',
    title: 'Building Consistency (90% – 92.9%)',
    minPct: 90,
    maxPct: 93,
    statement: 'Attendance levels show overall consistency at team level, with opportunity to strengthen through small, shared adjustments.',
    lmActionTitle: 'LM Action – Push Gently Over the Line',
    lmActions: [
      'Review patterns briefly with the team (e.g. weekly patterns).',
      'Ask the team to share one practical habit that helps them arrive on time.',
      'Ask the team to share one challenge impacting on-time attendance.',
      'Inspire team to aim to reach Attendance Role Model level (93%+) next cycle.',
    ],
    borderColor: 'border-emerald-500',
    bgClass: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    icon: '📈',
    iconAnim: 'icon-float',
  },
  {
    key: 'onTheRise',
    title: 'On the Rise (85% – 89.9% and improving)',
    minPct: 85,
    maxPct: 90,
    statement: 'Attendance levels are close to the desired range, with clear opportunity to move into consistent reliability.',
    lmActionTitle: 'LM Action',
    lmActions: [
      'Direct employees to review their own attendance and impact on function attendance via the Attendance Software/HRIS.',
      'Ask the team to share ideas on how we can improve (practical habits) to arrive on time.',
      'Reconfirm expectations and agree on a clear next target: 90%+ for the next review period.',
    ],
    borderColor: 'border-amber-500',
    bgClass: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    icon: '⚙️',
    iconAnim: 'icon-spin-slow',
  },
  {
    key: 'attentionNeeded',
    title: 'Attention Needed (80% – 84.9%)',
    minPct: 80,
    maxPct: 85,
    statement: 'Early signs of inconsistency where timely review and small adjustments can prevent further decline.',
    lmActionTitle: 'LM Action',
    lmActions: [
      'Direct employees to review their own attendance and impact on function attendance via the Attendance Software/HRIS.',
      'Ask the team what is getting in the way (planning, workload, coordination).',
      'Agree on one corrective step to try and review progress next week/month.',
    ],
    borderColor: 'border-orange-500',
    bgClass: 'bg-gradient-to-br from-orange-50 to-amber-50',
    icon: '⚠️',
    iconAnim: 'icon-pulse',
  },
  {
    key: 'realignReset',
    title: 'Realign and Reset (< 80%)',
    minPct: 0,
    maxPct: 80,
    statement: 'Attendance levels indicate a need for focused attention to restore consistency and shared accountability.',
    lmActionTitle: 'LM Action',
    lmActions: [
      'Hold a focused conversation with the team to clarify impact and expectations.',
      'Explain why attendance matters for fairness towards our colleagues and delivery.',
      'Agree on clear, time-bound corrective actions and review progress weekly until stability is restored.',
    ],
    borderColor: 'border-red-500',
    bgClass: 'bg-gradient-to-br from-red-50 to-rose-50',
    icon: '🔴',
    iconAnim: 'icon-pulse',
  },
]

function toMonthLabel(m) {
  if (!m) return ''
  const match = String(m).match(/(20\d{2})-(\d{2})/)
  if (!match) return String(m)
  const year = match[1]
  const month = parseInt(match[2], 10)
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${names[month - 1]} ${year}`
}

export default function AttendanceRecognitionPage() {
  const [selectedMonth, setSelectedMonth] = useState('')
  const [showBalloonCelebration, setShowBalloonCelebration] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const hasCelebrated = useRef(false)
  const pdfContentRef = useRef(null)

  const { data = [], isLoading, isError, error } = useQuery({
    queryKey: ['kpi', 'function'],
    queryFn: () => getOnTime('function'),
    retry: 0,
  })

  const months = useMemo(() => Array.from(new Set(data.map(r => r.month))).sort().reverse(), [data])

  const effectiveMonthKey = selectedMonth || months[0]
  const monthRows = useMemo(() => {
    if (!effectiveMonthKey) return []
    return data.filter(r => r.month === effectiveMonthKey)
  }, [data, effectiveMonthKey])

  const bucketed = useMemo(() => {
    const result = {}
    CIPLC_CATEGORIES.forEach(cat => {
      result[cat.key] = []
    })
    monthRows.forEach(r => {
      const pct = typeof r.on_time_pct === 'number' ? r.on_time_pct : parseFloat(r.on_time_pct) || 0
      const label = r.group || ''
      const pctStr = pct.toFixed(1)
      for (const cat of CIPLC_CATEGORIES) {
        if (pct >= cat.minPct && pct < cat.maxPct) {
          result[cat.key].push({ label, pct: pctStr })
          break
        }
      }
    })
    return result
  }, [monthRows])

  // Run balloon celebration once when data first loads; hide after 5s
  useEffect(() => {
    if (!effectiveMonthKey || months.length === 0 || hasCelebrated.current) return
    hasCelebrated.current = true
    setShowBalloonCelebration(true)
    const t = setTimeout(() => setShowBalloonCelebration(false), 5000)
    return () => clearTimeout(t)
  }, [effectiveMonthKey, months.length])

  // Random pop order: assign shuffled delays when celebration is shown (stable for that run)
  const balloonsWithRandomPop = useMemo(() => {
    if (!showBalloonCelebration) return []
    const delays = shufflePopDelays()
    return BALLOON_BASE.map((b, i) => ({ ...b, popDelay: delays[i] }))
  }, [showBalloonCelebration])

  const handleExportPdf = async () => {
    const el = pdfContentRef.current
    if (!el || exportingPdf) return
    setExportingPdf(true)
    try {
      // Force visibility for capture: override opacity-0 and gradient text so html2canvas sees content
      el.classList.add('pdf-capture-visible')
      const prevWidth = el.style.width
      const prevMinWidth = el.style.minWidth
      el.style.width = `${Math.max(el.scrollWidth, 800)}px`
      el.style.minWidth = '800px'
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })
      el.classList.remove('pdf-capture-visible')
      el.style.width = prevWidth
      el.style.minWidth = prevMinWidth
      const imgData = canvas.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const aspect = canvas.height / canvas.width
      let w = pageW
      let h = pageW * aspect
      if (h > pageH) {
        h = pageH
        w = pageH / aspect
      }
      const x = (pageW - w) / 2
      const y = (pageH - h) / 2
      pdf.addImage(imgData, 'PNG', x, y, w, h)
      const monthLabel = toMonthLabel(effectiveMonthKey) || 'Report'
      pdf.save(`Attendance-Recognition-${monthLabel.replace(/\s+/g, '-')}.pdf`)
    } catch (e) {
      console.error('PDF export failed:', e)
      el?.classList?.remove('pdf-capture-visible')
      if (el) {
        el.style.width = ''
        el.style.minWidth = ''
      }
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-6 attendance-recognition-page">
      <style>{`
        @keyframes celebrate-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .attendance-recognition-page .celebrate-in,
        .attendance-recognition-page .celebrate-card {
          animation: celebrate-fade-up 0.6s ease-out both;
        }
        @keyframes icon-bounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-6px) scale(1.1); }
        }
        @keyframes icon-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes icon-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.9; }
        }
        @keyframes icon-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .attendance-recognition-page .icon-bounce {
          display: inline-block;
          animation: icon-bounce 1.2s ease-in-out infinite;
        }
        .attendance-recognition-page .icon-float {
          display: inline-block;
          animation: icon-float 2s ease-in-out infinite;
        }
        .attendance-recognition-page .icon-pulse {
          display: inline-block;
          animation: icon-pulse 1.5s ease-in-out infinite;
        }
        .attendance-recognition-page .icon-spin-slow {
          display: inline-block;
          animation: icon-spin-slow 4s linear infinite;
        }
        /* Balloon: gentle float/sway like real balloons, then pop; particles burst with rotation */
        @keyframes balloon-sway {
          0%, 100% { transform: translateY(0) rotate(-3deg) scale(1); }
          20% { transform: translateY(-6px) rotate(2deg) scale(1.02); }
          40% { transform: translateY(-3px) rotate(3deg) scale(0.98); }
          60% { transform: translateY(-8px) rotate(-2deg) scale(1.02); }
          80% { transform: translateY(-4px) rotate(1deg) scale(1); }
        }
        @keyframes balloon-pop {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
          25% { transform: translateY(-6px) scale(1.2) rotate(3deg); opacity: 1; filter: brightness(1.15); }
          50% { transform: translateY(-12px) scale(1.5) rotate(-2deg); opacity: 0.85; filter: brightness(1.1); }
          100% { transform: translateY(-24px) scale(2) rotate(8deg); opacity: 0; filter: brightness(1); }
        }
        @keyframes particle-burst {
          0% { transform: translate(0, 0) scale(0) rotate(0deg); opacity: 0; }
          10% { opacity: 1; transform: translate(0, 0) scale(1.3) rotate(0deg); }
          100% { transform: translate(var(--px), var(--py)) scale(1) rotate(var(--rot, 0deg)); opacity: 0; }
        }
        .balloon-celebration .balloon-wrap {
          animation: balloon-sway 2s ease-in-out infinite;
        }
        .balloon-celebration .balloon-wrap.balloon-pop-phase {
          animation: balloon-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .balloon-celebration .particle {
          animation: particle-burst 0.85s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }
        /* Force visibility when capturing for PDF (opacity-0 and bg-clip-text break html2canvas) */
        .pdf-capture-visible,
        .pdf-capture-visible * {
          opacity: 1 !important;
          animation: none !important;
        }
        .pdf-capture-visible [class*="bg-clip-text"] {
          color: #4f46e5 !important;
          -webkit-text-fill-color: #4f46e5 !important;
          background: none !important;
        }
        .pdf-capture-visible [data-pdf-hide] {
          display: none !important;
        }
      `}</style>

      {/* Balloon pop celebration - real balloon shapes (teardrop + knot + string), then pop with particles */}
      {showBalloonCelebration && (
        <div className="balloon-celebration fixed inset-0 pointer-events-none z-40 overflow-hidden" aria-hidden>
          {balloonsWithRandomPop.map((b) => (
            <BalloonWithPop key={b.id} balloon={b}>
              <svg
                className="balloon-svg absolute inset-0 w-full h-full drop-shadow-lg"
                viewBox="0 0 80 110"
                fill="none"
                style={{ animationDelay: `${b.popDelay}s` }}
              >
                <defs>
                  <linearGradient id={`balloon-grad-${b.id}`} x1="25%" y1="0%" x2="55%" y2="45%">
                    <stop offset="0%" stopColor={b.colorLight} />
                    <stop offset="70%" stopColor={b.color} />
                    <stop offset="100%" stopColor={b.color} />
                  </linearGradient>
                  <filter id={`balloon-shadow-${b.id}`}>
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity="0.3" />
                  </filter>
                </defs>
                {/* Real balloon: teardrop body (rounded top, tapered to knot) */}
                <path
                  d="M 40 6 C 58 6 68 22 66 42 C 64 62 52 82 40 88 C 28 82 16 62 14 42 C 12 22 22 6 40 6 Z"
                  fill={`url(#balloon-grad-${b.id})`}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.8"
                  filter={`url(#balloon-shadow-${b.id})`}
                />
                {/* Soft highlight (like light reflection on latex) */}
                <ellipse cx="32" cy="26" rx="9" ry="12" fill="rgba(255,255,255,0.4)" />
                {/* Knot (tied neck of balloon – small teardrop blob) */}
                <ellipse cx="40" cy="87" rx="5" ry="4" fill={b.color} stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
                {/* Short string hanging down from knot */}
                <path
                  d="M 40 91 L 40 106"
                  stroke="rgba(0,0,0,0.25)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </svg>
              {PARTICLE_DIRS.map((d, i) => (
                <div
                  key={i}
                  className="particle absolute left-1/2 top-1/2 w-2.5 h-2.5 rounded-full"
                  style={{
                    '--px': `${d.x}px`,
                    '--py': `${d.y}px`,
                    '--rot': `${(i - 4) * 45}deg`,
                    marginLeft: '-5px',
                    marginTop: '-5px',
                    animationDelay: `${b.popDelay + 1.5}s`,
                    backgroundColor: ['#fbbf24', '#f59e0b', '#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'][i % 7],
                    border: '1px solid rgba(255,255,255,0.7)',
                    boxShadow: '0 0 4px rgba(0,0,0,0.1)',
                  }}
                />
              ))}
            </BalloonWithPop>
          ))}
        </div>
      )}

      <div ref={pdfContentRef} className="space-y-6">
      <div className="celebrate-in opacity-0 rounded-xl p-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/50" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          Attendance and Punctuality Recognition
        </h2>
        <p className="text-gray-600 mt-1">Celebrate strong performers and focus improvement where it matters.</p>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-4 celebrate-in opacity-0 rounded-xl border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50" style={{ animationDelay: '0.2s' }}>
        <label className="text-sm font-medium text-gray-700">Month</label>
        <select
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={effectiveMonthKey || ''}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          <option value="">Select month</option>
          {months.map(m => (
            <option key={m} value={m}>{toMonthLabel(m)}</option>
          ))}
        </select>
        <button
          type="button"
          data-pdf-hide
          onClick={handleExportPdf}
          disabled={exportingPdf || isLoading || isError || !effectiveMonthKey || monthRows.length === 0}
          className="ml-auto px-4 py-2 rounded-lg border-2 border-indigo-300 bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {exportingPdf ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export as PDF
            </>
          )}
        </button>
      </div>

      {isLoading && <div className="card p-6 text-center text-gray-500">Loading...</div>}
      {isError && (
        <div className="card p-4 text-red-600">
          {error?.response?.data?.detail || error?.message || 'Failed to load data.'}
        </div>
      )}

      {!isLoading && !isError && months.length === 0 && (
        <div className="card p-6 text-center text-gray-500">No attendance data yet. Upload files to see recognition results.</div>
      )}

      {!isLoading && !isError && effectiveMonthKey && (
        <>
          <h2 className="text-xl font-bold text-gray-800 celebrate-in opacity-0 mb-6" style={{ animationDelay: '0.25s' }}>{INTRO_STATEMENT}</h2>

          <div className="space-y-6">
            {CIPLC_CATEGORIES.map((cat, idx) => (
              <div
                key={cat.key}
                className={`card p-5 rounded-xl border-l-4 ${cat.borderColor} ${cat.bgClass || ''} celebrate-card opacity-0 shadow-md`}
                style={{ animationDelay: `${0.45 + idx * 0.1}s` }}
              >
                <h4 className="flex items-center gap-3 text-lg font-bold text-gray-800 mb-2">
                  <span className={`text-3xl ${cat.iconAnim || ''}`} role="img" aria-hidden>{cat.icon}</span>
                  {cat.title}
                </h4>
                <p className="text-gray-700 text-sm mb-4 italic">{cat.statement}</p>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Functions in this category</p>
                  {bucketed[cat.key].length === 0 ? (
                    <p className="text-gray-500 text-sm">None this month</p>
                  ) : (
                    <ul className="space-y-1">
                      {bucketed[cat.key].map((item, i) => (
                        <li key={i} className="flex gap-2 text-gray-700 text-sm">
                          <span className="shrink-0">•</span>
                          <span><strong>{item.label}</strong> – {item.pct}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg p-3 bg-white/60 border border-gray-200/80">
                  <p className="text-sm font-semibold text-gray-800 mb-2">{cat.lmActionTitle}</p>
                  <ul className="space-y-1.5 text-gray-700 text-sm">
                    {cat.lmActions.map((action, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-blue-600 shrink-0 font-bold">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white relative overflow-hidden celebrate-card opacity-0 shadow-xl border-2 border-indigo-400/30" style={{ animationDelay: '0.95s' }}>
            <span className="absolute top-2 left-4 text-5xl text-white/30 font-serif leading-none">"</span>
            <span className="absolute bottom-2 right-4 text-5xl text-white/30 font-serif leading-none">"</span>
            <p className="text-xl md:text-2xl font-medium text-center px-8 py-4 relative z-10">
              Being on time is a clear sign of <strong className="text-amber-200">accountability</strong> and <strong className="text-amber-200">respect</strong>, and it makes our teams stronger.
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
