import { useState } from 'react'

/* ─── Shared constants ─── */
const STATUSES = [
  { key: 'OFF_DUTY',      label: 'Off Duty',              short: 'OFF', color: '#6b7280', accent: 'bg-gray-100  text-gray-700  border-gray-200' },
  { key: 'SLEEPER_BERTH', label: 'Sleeper Berth',         short: 'SB',  color: '#6366f1', accent: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'DRIVING',       label: 'Driving',               short: 'D',   color: '#16a34a', accent: 'bg-green-50  text-green-700  border-green-200' },
  { key: 'ON_DUTY',       label: 'On Duty (Not Driving)', short: 'ON',  color: '#f59e0b', accent: 'bg-amber-50  text-amber-700  border-amber-200' },
]
const STATUS_INDEX = Object.fromEntries(STATUSES.map((s, i) => [s.key, i]))

function fmtDur(h) {
  if (!h && h !== 0) return '0:00'
  const hrs = Math.floor(Math.abs(h))
  const mins = Math.round((Math.abs(h) - hrs) * 60)
  return `${hrs}:${mins.toString().padStart(2, '0')}`
}

function fmtDurShort(h) {
  if (!h) return '0m'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

function fmtTimeFull(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtTimeShort(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}


/* ════════════════════════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════════════════════════ */
export default function ELDLogViewer({ logs, trip }) {
  const [activeDay, setActiveDay] = useState(0)
  const [viewMode, setViewMode] = useState('modern') // 'modern' | 'official'

  if (!logs || logs.length === 0) return null

  const totals = logs.reduce((acc, d) => ({
    driving: acc.driving + (d.total_driving_hours || 0),
    onDuty: acc.onDuty + (d.total_on_duty_hours || 0),
    sleeper: acc.sleeper + (d.total_sleeper_hours || 0),
    offDuty: acc.offDuty + (d.total_off_duty_hours || 0),
    miles: acc.miles + (d.miles_driven || 0),
  }), { driving: 0, onDuty: 0, sleeper: 0, offDuty: 0, miles: 0 })

  return (
    <div className="space-y-5">
      {/* Trip summary */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-700">Trip Totals — {logs.length} Day{logs.length > 1 ? 's' : ''}</h4>
          {/* View toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode('modern')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'modern'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Modern View
            </button>
            <button
              onClick={() => setViewMode('official')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === 'official'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Standard Daily Log
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <TripStat value={fmtDurShort(totals.driving)} label="Driving" color="text-green-700" />
          <TripStat value={fmtDurShort(totals.onDuty)} label="On Duty" color="text-amber-700" />
          <TripStat value={fmtDurShort(totals.sleeper)} label="Sleeper" color="text-indigo-700" />
          <TripStat value={fmtDurShort(totals.offDuty)} label="Off Duty" color="text-gray-600" />
          <TripStat value={`${totals.miles.toFixed(0)} mi`} label="Total Miles" color="text-blue-700" />
        </div>
      </div>

      {/* Day tabs */}
      {logs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {logs.map((day, i) => (
            <button
              key={day.id || i}
              onClick={() => setActiveDay(i)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition cursor-pointer ${
                activeDay === i
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Day {day.day_number} — {day.log_date}
            </button>
          ))}
        </div>
      )}

      {/* Conditional view */}
      {viewMode === 'modern'
        ? <ModernDayLog day={logs[activeDay]} />
        : <OfficialDailyLog day={logs[activeDay]} />
      }
    </div>
  )
}

function TripStat({ value, label, color }) {
  return (
    <div>
      <span className={`font-semibold ${color}`}>{value}</span>{' '}
      <span className="text-gray-500">{label}</span>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════════
   MODERN VIEW (default) — colorful, interactive, easy to read
   ════════════════════════════════════════════════════════════════ */
function ModernDayLog({ day }) {
  return (
    <div className="space-y-4">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Day {day.day_number} — {day.log_date}</h4>
        <span className="text-xs text-gray-400">{day.miles_driven?.toFixed(0)} miles driven</span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Driving" value={fmtDurShort(day.total_driving_hours)} icon="🚛" color="text-green-700" bg="bg-green-50" border="border-green-100" />
        <StatCard label="On Duty" value={fmtDurShort(day.total_on_duty_hours)} icon="📋" color="text-amber-700" bg="bg-amber-50" border="border-amber-100" />
        <StatCard label="Sleeper Berth" value={fmtDurShort(day.total_sleeper_hours)} icon="🛏️" color="text-indigo-700" bg="bg-indigo-50" border="border-indigo-100" />
        <StatCard label="Off Duty" value={fmtDurShort(day.total_off_duty_hours)} icon="☕" color="text-gray-700" bg="bg-gray-50" border="border-gray-100" />
      </div>

      {/* Location bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>{day.start_location}</span>
        </div>
        <div className="flex-1 mx-3 border-t border-dashed border-gray-300" />
        <div className="flex items-center gap-1.5">
          <span>{day.end_location}</span>
          <span className="w-2 h-2 rounded-full bg-red-500" />
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <ModernGrid events={day.events || []} logDate={day.log_date} />
      </div>

      {/* Timeline */}
      <ModernTimeline events={day.events || []} />
    </div>
  )
}

function StatCard({ label, value, icon, color, bg, border }) {
  return (
    <div className={`rounded-xl p-3 ${bg} border ${border}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className={`text-lg font-bold ${color}`}>{value}</p>
          <p className="text-[11px] text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

function ModernGrid({ events, logDate }) {
  const gridWidth = 960
  const rowHeight = 36
  const labelWidth = 120
  const totalWidth = labelWidth + gridWidth
  const hourWidth = gridWidth / 24

  const dayStart = new Date(`${logDate}T00:00:00Z`).getTime()
  const dayEnd = dayStart + 24 * 3600 * 1000

  function timeToX(isoStr) {
    const t = new Date(isoStr).getTime()
    const clamped = Math.max(dayStart, Math.min(dayEnd, t))
    return labelWidth + ((clamped - dayStart) / (dayEnd - dayStart)) * gridWidth
  }

  const segments = events.map(ev => {
    const rowIdx = STATUS_INDEX[ev.status] ?? 0
    return { ...ev, rowIdx, x1: timeToX(ev.start_time), x2: timeToX(ev.end_time) }
  })

  const verticals = []
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1], cur = segments[i]
    if (prev.rowIdx !== cur.rowIdx) {
      verticals.push({
        x: cur.x1,
        yTop: Math.min(prev.rowIdx, cur.rowIdx) * rowHeight + rowHeight / 2,
        yBot: Math.max(prev.rowIdx, cur.rowIdx) * rowHeight + rowHeight / 2,
      })
    }
  }

  const svgHeight = STATUSES.length * rowHeight

  return (
    <svg viewBox={`0 0 ${totalWidth} ${svgHeight + 26}`} className="w-full min-w-[700px]" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Background + grid lines */}
      <rect x={0} y={0} width={totalWidth} height={svgHeight} fill="#fafafa" rx={0} />

      {/* Hour columns */}
      {Array.from({ length: 25 }, (_, h) => {
        const x = labelWidth + h * hourWidth
        const isMajor = h % 6 === 0
        return (
          <g key={h}>
            <line x1={x} y1={0} x2={x} y2={svgHeight} stroke={isMajor ? '#d1d5db' : '#f3f4f6'} strokeWidth={isMajor ? 1 : 0.5} />
            {h < 24 && (
              <text x={x + hourWidth / 2} y={svgHeight + 15} textAnchor="middle" fontSize="9" fontWeight={isMajor ? '700' : '400'} fill={isMajor ? '#374151' : '#9ca3af'}>
                {h === 0 ? 'Mid' : h === 12 ? 'Noon' : h > 12 ? `${h - 12}p` : `${h}a`}
              </text>
            )}
          </g>
        )
      })}

      {/* Rows */}
      {STATUSES.map((s, i) => {
        const y = i * rowHeight
        return (
          <g key={s.key}>
            <rect x={0} y={y} width={labelWidth} height={rowHeight} fill={i % 2 === 0 ? '#f9fafb' : '#fff'} />
            <rect x={labelWidth} y={y} width={gridWidth} height={rowHeight} fill={i % 2 === 0 ? '#fafafa' : '#fff'} />
            <line x1={0} y1={y + rowHeight} x2={totalWidth} y2={y + rowHeight} stroke="#e5e7eb" strokeWidth={0.5} />
            {/* Color dot + label */}
            <circle cx={14} cy={y + rowHeight / 2} r={4} fill={s.color} />
            <text x={24} y={y + rowHeight / 2 + 1} fontSize="10" fontWeight="600" fill="#374151" dominantBaseline="middle">
              {s.short} — {s.label.replace(/\(Not Driving\)/, '').trim()}
            </text>
          </g>
        )
      })}

      {/* Border */}
      <rect x={labelWidth} y={0} width={gridWidth} height={svgHeight} fill="none" stroke="#d1d5db" strokeWidth={1} />

      {/* Status bars */}
      {segments.map((seg, i) => {
        const y = seg.rowIdx * rowHeight
        const w = Math.max(seg.x2 - seg.x1, 1)
        const cfg = STATUSES[seg.rowIdx]
        return (
          <g key={i}>
            <rect x={seg.x1} y={y + 5} width={w} height={rowHeight - 10} rx={4} fill={cfg.color} opacity={0.2} />
            <line x1={seg.x1} y1={y + rowHeight / 2} x2={seg.x1 + w} y2={y + rowHeight / 2} stroke={cfg.color} strokeWidth={3} strokeLinecap="round" />
            <rect x={seg.x1} y={y + 2} width={w} height={rowHeight - 4} fill="transparent" style={{ cursor: 'pointer' }}>
              <title>{`${cfg.label}\n${fmtTimeFull(seg.start_time)} → ${fmtTimeFull(seg.end_time)}\nDuration: ${fmtDurShort(seg.duration_hours)}${seg.location ? `\nLocation: ${seg.location}` : ''}${seg.remarks ? `\n${seg.remarks}` : ''}`}</title>
            </rect>
          </g>
        )
      })}

      {/* Vertical connectors */}
      {verticals.map((v, i) => (
        <line key={`v${i}`} x1={v.x} y1={v.yTop} x2={v.x} y2={v.yBot} stroke="#374151" strokeWidth={2} />
      ))}
    </svg>
  )
}

function ModernTimeline({ events }) {
  if (!events.length) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity Timeline</p>
      <div className="grid gap-1.5">
        {events.map((ev, i) => {
          const idx = STATUS_INDEX[ev.status] ?? 0
          const cfg = STATUSES[idx]
          const isSmall = (ev.duration_hours || 0) < 0.1
          if (isSmall) return null

          return (
            <div key={ev.id || i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition text-xs">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: cfg.color }}>
                {cfg.short}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{cfg.label}</span>
                  <span className="text-gray-400">·</span>
                  <span className="font-medium text-gray-600">{fmtDurShort(ev.duration_hours)}</span>
                </div>
                {ev.location && <p className="text-gray-500 truncate">{ev.location}</p>}
              </div>
              <div className="text-right shrink-0 text-gray-500 font-mono">
                <p>{fmtTimeShort(ev.start_time)}</p>
                <p>{fmtTimeShort(ev.end_time)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


/* ════════════════════════════════════════════════════════════════
   OFFICIAL VIEW — matches the FMCSA Daily Driver's Log form
   ════════════════════════════════════════════════════════════════ */
function OfficialDailyLog({ day }) {
  const dateParts = day.log_date ? day.log_date.split('-') : ['', '', '']
  const rowTotals = [
    day.total_off_duty_hours || 0,
    day.total_sleeper_hours || 0,
    day.total_driving_hours || 0,
    day.total_on_duty_hours || 0,
  ]
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0)

  return (
    <div className="border-2 border-black bg-white overflow-hidden">
      {/* Title */}
      <div className="border-b-2 border-black px-4 py-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-black tracking-tight">Drivers Daily Log</p>
          <p className="text-[10px] text-gray-500">(24 hours)</p>
        </div>
        <div className="flex gap-6 items-end text-sm">
          <DateField value={dateParts[1]} label="month" />
          <span className="font-bold">/</span>
          <DateField value={dateParts[2]} label="day" />
          <span className="font-bold">/</span>
          <DateField value={dateParts[0]} label="year" />
        </div>
        <div className="text-[9px] text-gray-500 text-right">
          <p>Original — File at home terminal.</p>
          <p>Duplicate — Driver retains in his/her possession for 8 days.</p>
        </div>
      </div>

      {/* From / To */}
      <div className="grid grid-cols-2 border-b border-black">
        <OfficialField label="From:" value={day.start_location || '—'} />
        <OfficialField label="To:" value={day.end_location || '—'} />
      </div>

      {/* Miles, Carrier */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-black">
        <OfficialBox label="Total Miles Driving Today" value={day.miles_driven?.toFixed(0) || '0'} />
        <OfficialBox label="Total Mileage Today" value={day.miles_driven?.toFixed(0) || '0'} />
        <OfficialBox label="Name of Carrier or Carriers" value="Trip Planner ELD" span2 />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-black">
        <OfficialBox label="Truck/Tractor and Trailer Numbers" value="—" />
        <OfficialBox label="License Plate(s)/State" value="—" />
        <OfficialBox label="Main Office Address" value="—" />
        <OfficialBox label="Home Terminal Address" value="—" />
      </div>

      {/* Grid */}
      <div className="border-b-2 border-black overflow-x-auto">
        <OfficialGrid events={day.events || []} logDate={day.log_date} rowTotals={rowTotals} />
      </div>

      {/* Remarks */}
      <div className="border-b border-black">
        <div className="px-3 py-1 border-b border-black bg-gray-50">
          <p className="text-xs font-bold">Remarks</p>
        </div>
        <div className="px-3 py-2 min-h-[50px]">
          {events_to_remarks(day.events || [])}
        </div>
      </div>

      {/* Shipping */}
      <div className="border-b border-black px-3 py-2">
        <p className="text-[10px] font-bold mb-0.5">Shipping Documents:</p>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div><span className="text-gray-500">DVL or Manifest No. — </span><span className="font-medium">N/A</span></div>
          <div><span className="text-gray-500">Shipper & Commodity — </span><span className="font-medium">General Freight</span></div>
        </div>
      </div>

      {/* Recap */}
      <div className="px-3 py-2">
        <p className="text-[10px] font-bold mb-1">Recap:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <RecapBox label="On duty hours today" value={fmtDur((day.total_driving_hours || 0) + (day.total_on_duty_hours || 0))} />
          <RecapBox label="Total hours (lines 3 & 4)" value={fmtDur((day.total_driving_hours || 0) + (day.total_on_duty_hours || 0))} />
          <RecapBox label="70 Hours / 8 Day" value={`Driving: ${fmtDur(day.total_driving_hours || 0)}`} />
          <RecapBox label="Total (24h)" value={fmtDur(grandTotal)} bold />
        </div>
        <p className="text-[8px] text-gray-400 mt-1 italic">
          Enter name of place you reported and where released from work and when and where each change of duty occurred. Use time standard of home terminal.
        </p>
      </div>
    </div>
  )
}

function DateField({ value, label }) {
  return (
    <div className="text-center border-b border-black px-3">
      <span className="font-bold">{value}</span>
      <p className="text-[8px] text-gray-400">({label})</p>
    </div>
  )
}

function OfficialField({ label, value }) {
  return (
    <div className="px-3 py-1.5 border-r border-black last:border-r-0">
      <span className="text-[10px] font-bold text-gray-600">{label} </span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  )
}

function OfficialBox({ label, value, span2 }) {
  return (
    <div className={`px-3 py-1 border-r border-black last:border-r-0 ${span2 ? 'col-span-2' : ''}`}>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[8px] text-gray-500 uppercase">{label}</p>
    </div>
  )
}

function RecapBox({ label, value, bold }) {
  return (
    <div className="border border-black p-1.5">
      <p className="text-gray-500 font-medium">{label}</p>
      <p className={`text-sm ${bold ? 'font-black' : 'font-bold'}`}>{value}</p>
    </div>
  )
}

function events_to_remarks(events) {
  const items = events
    .filter(ev => ev.remarks && ev.remarks.trim())
    .map((ev, i) => (
      <p key={i} className="text-[10px] text-gray-700">
        <span className="font-semibold">{fmtTimeFull(ev.start_time)}</span> — {ev.remarks}
      </p>
    ))

  if (items.length === 0) return <p className="text-[10px] text-gray-400 italic">No remarks for this day.</p>
  return <div className="space-y-0.5">{items}</div>
}


/* ─── Official Grid (FMCSA-style) ─── */
function OfficialGrid({ events, logDate, rowTotals }) {
  const gridWidth = 960
  const rowHeight = 40
  const labelWidth = 100
  const totalColWidth = 50
  const totalWidth = labelWidth + gridWidth + totalColWidth
  const hourWidth = gridWidth / 24
  const OFFICIAL_LABELS = ['Off Duty', 'Sleeper\nBerth', 'Driving', 'On Duty\n(not driving)']

  const dayStart = new Date(`${logDate}T00:00:00Z`).getTime()
  const dayEnd = dayStart + 24 * 3600 * 1000

  function timeToX(isoStr) {
    const t = new Date(isoStr).getTime()
    const clamped = Math.max(dayStart, Math.min(dayEnd, t))
    return labelWidth + ((clamped - dayStart) / (dayEnd - dayStart)) * gridWidth
  }

  const segments = events.map(ev => {
    const rowIdx = STATUS_INDEX[ev.status] ?? 0
    return { ...ev, rowIdx, x1: timeToX(ev.start_time), x2: timeToX(ev.end_time) }
  })

  const verticals = []
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1], cur = segments[i]
    if (prev.rowIdx !== cur.rowIdx) {
      verticals.push({
        x: cur.x1,
        yTop: Math.min(prev.rowIdx, cur.rowIdx) * rowHeight + rowHeight / 2,
        yBot: Math.max(prev.rowIdx, cur.rowIdx) * rowHeight + rowHeight / 2,
      })
    }
  }

  const svgHeight = 4 * rowHeight
  const headerH = 24

  return (
    <svg viewBox={`0 0 ${totalWidth} ${svgHeight + headerH}`} className="w-full min-w-[750px]" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
      {/* Header */}
      <rect x={labelWidth} y={0} width={gridWidth + totalColWidth} height={headerH} fill="#1f2937" />
      <text x={labelWidth + 2} y={10} fontSize="7" fontWeight="700" fill="white">Mid-</text>
      <text x={labelWidth + 2} y={19} fontSize="7" fontWeight="700" fill="white">night</text>
      {[1,2,3,4,5,6,7,8,9,10,11].map(h => (
        <text key={`a${h}`} x={labelWidth + h * hourWidth + hourWidth / 2} y={15} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">{h}</text>
      ))}
      <text x={labelWidth + 12 * hourWidth + hourWidth / 2} y={15} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">Noon</text>
      {[1,2,3,4,5,6,7,8,9,10,11].map(h => (
        <text key={`p${h}`} x={labelWidth + (12 + h) * hourWidth + hourWidth / 2} y={15} textAnchor="middle" fontSize="9" fontWeight="700" fill="white">{h}</text>
      ))}
      <text x={labelWidth + gridWidth - 2} y={10} textAnchor="end" fontSize="7" fontWeight="700" fill="white">Mid-</text>
      <text x={labelWidth + gridWidth - 2} y={19} textAnchor="end" fontSize="7" fontWeight="700" fill="white">night</text>
      <text x={labelWidth + gridWidth + totalColWidth / 2} y={10} textAnchor="middle" fontSize="7" fontWeight="700" fill="white">Total</text>
      <text x={labelWidth + gridWidth + totalColWidth / 2} y={19} textAnchor="middle" fontSize="7" fontWeight="700" fill="white">Hours</text>

      {/* Rows */}
      {OFFICIAL_LABELS.map((lbl, i) => {
        const y = headerH + i * rowHeight
        const lines = lbl.split('\n')
        return (
          <g key={i}>
            <rect x={0} y={y} width={labelWidth} height={rowHeight} fill="#fff" stroke="#000" strokeWidth={0.5} />
            <rect x={labelWidth} y={y} width={gridWidth} height={rowHeight} fill="#fff" stroke="#000" strokeWidth={0.5} />
            <rect x={labelWidth + gridWidth} y={y} width={totalColWidth} height={rowHeight} fill="#fff" stroke="#000" strokeWidth={0.5} />

            <text x={8} y={y + (lines.length > 1 ? 14 : rowHeight / 2 + 1)} fontSize="9" fontWeight="700" fill="#1f2937" dominantBaseline={lines.length > 1 ? 'auto' : 'middle'}>
              {i + 1}. {lines[0]}
            </text>
            {lines.length > 1 && <text x={18} y={y + 26} fontSize="9" fontWeight="700" fill="#1f2937">{lines[1]}</text>}

            {/* Tick marks */}
            {Array.from({ length: 24 }, (_, h) => (
              <g key={h}>
                <line x1={labelWidth + h * hourWidth} y1={y} x2={labelWidth + h * hourWidth} y2={y + rowHeight} stroke="#000" strokeWidth={h % 6 === 0 ? 1.5 : 0.5} />
                {[1, 2, 3].map(q => {
                  const tx = labelWidth + h * hourWidth + (q / 4) * hourWidth
                  const tickLen = q === 2 ? rowHeight * 0.5 : rowHeight * 0.3
                  return <line key={q} x1={tx} y1={y + rowHeight - tickLen} x2={tx} y2={y + rowHeight} stroke="#000" strokeWidth={0.3} />
                })}
              </g>
            ))}
            <line x1={labelWidth + gridWidth} y1={y} x2={labelWidth + gridWidth} y2={y + rowHeight} stroke="#000" strokeWidth={1.5} />

            <text x={labelWidth + gridWidth + totalColWidth / 2} y={y + rowHeight / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#1f2937">
              {fmtDur(rowTotals[i])}
            </text>
          </g>
        )
      })}

      {/* Status lines */}
      {segments.map((seg, i) => {
        const y = headerH + seg.rowIdx * rowHeight
        const w = Math.max(seg.x2 - seg.x1, 1)
        return (
          <g key={i}>
            <line x1={seg.x1} y1={y + rowHeight / 2} x2={seg.x1 + w} y2={y + rowHeight / 2} stroke="#000" strokeWidth={3} />
            <rect x={seg.x1} y={y + 2} width={w} height={rowHeight - 4} fill="transparent" style={{ cursor: 'pointer' }}>
              <title>{`${STATUSES[seg.rowIdx].label}\n${fmtTimeFull(seg.start_time)} → ${fmtTimeFull(seg.end_time)}\nDuration: ${fmtDurShort(seg.duration_hours)}${seg.location ? `\nLocation: ${seg.location}` : ''}${seg.remarks ? `\n${seg.remarks}` : ''}`}</title>
            </rect>
          </g>
        )
      })}

      {/* Vertical connectors */}
      {verticals.map((v, i) => (
        <line key={`v${i}`} x1={v.x} y1={headerH + v.yTop} x2={v.x} y2={headerH + v.yBot} stroke="#000" strokeWidth={3} />
      ))}

      <rect x={labelWidth} y={headerH} width={gridWidth} height={svgHeight} fill="none" stroke="#000" strokeWidth={2} />
    </svg>
  )
}
