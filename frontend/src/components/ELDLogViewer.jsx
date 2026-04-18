import { useState } from 'react'

const STATUSES = [
  { key: 'OFF_DUTY',       label: '1. Off Duty',              short: 'OFF', color: '#6b7280', num: 1 },
  { key: 'SLEEPER_BERTH',  label: '2. Sleeper Berth',         short: 'SB',  color: '#6366f1', num: 2 },
  { key: 'DRIVING',        label: '3. Driving',               short: 'D',   color: '#16a34a', num: 3 },
  { key: 'ON_DUTY',        label: '4. On Duty (Not Driving)', short: 'ON',  color: '#f59e0b', num: 4 },
]

const HOURS = Array.from({ length: 25 }, (_, i) => i)
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

export default function ELDLogViewer({ logs, trip }) {
  const [activeDay, setActiveDay] = useState(0)

  if (!logs || logs.length === 0) return null

  const totals = logs.reduce((acc, d) => ({
    driving: acc.driving + (d.total_driving_hours || 0),
    onDuty: acc.onDuty + (d.total_on_duty_hours || 0),
    sleeper: acc.sleeper + (d.total_sleeper_hours || 0),
    offDuty: acc.offDuty + (d.total_off_duty_hours || 0),
    miles: acc.miles + (d.miles_driven || 0),
  }), { driving: 0, onDuty: 0, sleeper: 0, offDuty: 0, miles: 0 })

  return (
    <div className="space-y-6">
      {/* Total trip summary */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-bold text-gray-700 mb-3">Trip Totals — {logs.length} Day{logs.length > 1 ? 's' : ''}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <div><span className="font-semibold text-green-700">{fmtDurShort(totals.driving)}</span> <span className="text-gray-500">Driving</span></div>
          <div><span className="font-semibold text-amber-700">{fmtDurShort(totals.onDuty)}</span> <span className="text-gray-500">On Duty</span></div>
          <div><span className="font-semibold text-indigo-700">{fmtDurShort(totals.sleeper)}</span> <span className="text-gray-500">Sleeper</span></div>
          <div><span className="font-semibold text-gray-600">{fmtDurShort(totals.offDuty)}</span> <span className="text-gray-500">Off Duty</span></div>
          <div><span className="font-semibold text-blue-700">{totals.miles.toFixed(0)} mi</span> <span className="text-gray-500">Total Miles</span></div>
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

      {/* Official Log Sheet */}
      <DailyLogSheet day={logs[activeDay]} trip={trip} />
    </div>
  )
}


function DailyLogSheet({ day, trip }) {
  const totalHours = (day.total_driving_hours || 0) + (day.total_on_duty_hours || 0) +
                     (day.total_sleeper_hours || 0) + (day.total_off_duty_hours || 0)

  return (
    <div className="border-2 border-gray-800 rounded-lg overflow-hidden bg-white">
      {/* Title bar */}
      <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
        <span className="font-bold text-sm tracking-wide">DRIVER'S DAILY LOG</span>
        <span className="text-xs text-gray-300">U.S. DOT / FMCSA — 49 CFR 395</span>
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-800">
        <HeaderField label="Date" value={day.log_date} />
        <HeaderField label="Day" value={`Day ${day.day_number}`} />
        <HeaderField label="From" value={day.start_location || '—'} />
        <HeaderField label="To" value={day.end_location || '—'} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-gray-800">
        <HeaderField label="Total Miles Driving" value={`${day.miles_driven?.toFixed(0) || 0}`} />
        <HeaderField label="Carrier" value="Trip Planner ELD" />
        <HeaderField label="Vehicle Number" value="—" />
        <HeaderField label="24-Hour Period" value="Midnight to Midnight" />
      </div>

      {/* The 24-hour graph */}
      <div className="px-2 py-3 border-b border-gray-800">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 px-1">Graph Grid — Record of Duty Status</p>
        <div className="overflow-x-auto">
          <OfficialGrid events={day.events || []} logDate={day.log_date} />
        </div>
      </div>

      {/* Totals row */}
      <div className="border-b border-gray-800">
        <div className="grid grid-cols-5 text-center text-xs">
          <TotalCell label="Off Duty" value={fmtDur(day.total_off_duty_hours)} color="text-gray-700" />
          <TotalCell label="Sleeper Berth" value={fmtDur(day.total_sleeper_hours)} color="text-indigo-700" />
          <TotalCell label="Driving" value={fmtDur(day.total_driving_hours)} color="text-green-700" />
          <TotalCell label="On Duty" value={fmtDur(day.total_on_duty_hours)} color="text-amber-700" />
          <TotalCell label="Total" value={fmtDur(totalHours)} color="text-gray-900" bold />
        </div>
      </div>

      {/* Remarks / Events */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Remarks / Activity Log</p>
        <EventsTable events={day.events || []} />
      </div>
    </div>
  )
}


function HeaderField({ label, value }) {
  return (
    <div className="px-3 py-1.5 border-r border-gray-300 last:border-r-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  )
}

function TotalCell({ label, value, color, bold }) {
  return (
    <div className="py-2 border-r border-gray-300 last:border-r-0">
      <p className="text-[10px] text-gray-500 uppercase">{label}</p>
      <p className={`text-base ${bold ? 'font-black' : 'font-bold'} ${color}`}>{value}</p>
    </div>
  )
}


function OfficialGrid({ events, logDate }) {
  const gridWidth = 960
  const rowHeight = 36
  const labelWidth = 160
  const totalWidth = labelWidth + gridWidth
  const hourWidth = gridWidth / 24

  const dayStart = new Date(`${logDate}T00:00:00Z`).getTime()
  const dayEnd = dayStart + 24 * 3600 * 1000

  function timeToX(isoStr) {
    const t = new Date(isoStr).getTime()
    const clamped = Math.max(dayStart, Math.min(dayEnd, t))
    const frac = (clamped - dayStart) / (dayEnd - dayStart)
    return labelWidth + frac * gridWidth
  }

  const segments = events.map(ev => {
    const rowIdx = STATUS_INDEX[ev.status] ?? 0
    const x1 = timeToX(ev.start_time)
    const x2 = timeToX(ev.end_time)
    return { ...ev, rowIdx, x1, x2 }
  })

  const verticals = []
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1]
    const cur = segments[i]
    if (prev.rowIdx !== cur.rowIdx) {
      const x = cur.x1
      const yTop = Math.min(prev.rowIdx, cur.rowIdx) * rowHeight + rowHeight / 2
      const yBot = Math.max(prev.rowIdx, cur.rowIdx) * rowHeight + rowHeight / 2
      verticals.push({ x, yTop, yBot })
    }
  }

  const svgHeight = STATUSES.length * rowHeight

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${svgHeight + 28}`}
      className="w-full min-w-[800px]"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Background */}
      <rect x={0} y={0} width={totalWidth} height={svgHeight} fill="#fafafa" />

      {/* Hour columns and labels */}
      {HOURS.map(h => {
        const x = labelWidth + h * hourWidth
        const isMajor = h % 6 === 0
        return (
          <g key={h}>
            <line x1={x} y1={0} x2={x} y2={svgHeight} stroke={isMajor ? '#9ca3af' : '#e5e7eb'} strokeWidth={isMajor ? 1 : 0.5} />
            {/* 15-min sub-ticks */}
            {h < 24 && [1, 2, 3].map(q => {
              const sx = x + (q / 4) * hourWidth
              return <line key={q} x1={sx} y1={0} x2={sx} y2={svgHeight} stroke="#f3f4f6" strokeWidth={0.3} />
            })}
            {h < 24 && (
              <text x={x + hourWidth / 2} y={svgHeight + 16} textAnchor="middle" fontSize="10" fontWeight={isMajor ? '700' : '400'} fill={isMajor ? '#374151' : '#9ca3af'}>
                {h === 0 ? 'Mid' : h === 12 ? 'Noon' : h > 12 ? `${h - 12}` : `${h}`}
              </text>
            )}
            {h === 0 && <text x={x + hourWidth / 2} y={svgHeight + 26} textAnchor="middle" fontSize="7" fill="#9ca3af">AM</text>}
            {h === 12 && <text x={x + hourWidth / 2} y={svgHeight + 26} textAnchor="middle" fontSize="7" fill="#9ca3af">PM</text>}
          </g>
        )
      })}

      {/* Row labels + horizontal lines */}
      {STATUSES.map((s, i) => {
        const y = i * rowHeight
        return (
          <g key={s.key}>
            <rect x={0} y={y} width={labelWidth} height={rowHeight} fill={i % 2 === 0 ? '#f9fafb' : '#ffffff'} />
            <rect x={labelWidth} y={y} width={gridWidth} height={rowHeight} fill={i % 2 === 0 ? '#fafafa' : '#ffffff'} />
            <line x1={0} y1={y + rowHeight} x2={totalWidth} y2={y + rowHeight} stroke="#d1d5db" strokeWidth={0.5} />

            {/* Row number */}
            <text x={12} y={y + rowHeight / 2 + 1} fontSize="12" fontWeight="800" fill={s.color} dominantBaseline="middle">
              {s.num}.
            </text>
            {/* Row label */}
            <text x={30} y={y + rowHeight / 2 + 1} fontSize="11" fontWeight="600" fill="#374151" dominantBaseline="middle">
              {s.label.replace(/^\d+\.\s*/, '')}
            </text>
          </g>
        )
      })}

      {/* Border around grid area */}
      <rect x={labelWidth} y={0} width={gridWidth} height={svgHeight} fill="none" stroke="#9ca3af" strokeWidth={1} />

      {/* Status bars */}
      {segments.map((seg, i) => {
        const y = seg.rowIdx * rowHeight
        const w = Math.max(seg.x2 - seg.x1, 1)
        const statusCfg = STATUSES[seg.rowIdx]
        return (
          <g key={i}>
            {/* Horizontal line through the middle of the row */}
            <line
              x1={seg.x1}
              y1={y + rowHeight / 2}
              x2={seg.x1 + w}
              y2={y + rowHeight / 2}
              stroke={statusCfg.color}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {/* Subtle fill behind */}
            <rect
              x={seg.x1}
              y={y + 4}
              width={w}
              height={rowHeight - 8}
              rx={2}
              fill={statusCfg.color}
              opacity={0.12}
              style={{ cursor: 'pointer' }}
            >
              <title>{`${statusCfg.label}\n${fmtTimeFull(seg.start_time)} → ${fmtTimeFull(seg.end_time)}\nDuration: ${fmtDurShort(seg.duration_hours)}${seg.location ? `\nLocation: ${seg.location}` : ''}${seg.remarks ? `\n${seg.remarks}` : ''}`}</title>
            </rect>
          </g>
        )
      })}

      {/* Vertical connectors */}
      {verticals.map((v, i) => (
        <line
          key={`v${i}`}
          x1={v.x} y1={v.yTop}
          x2={v.x} y2={v.yBot}
          stroke="#1f2937"
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}


function EventsTable({ events }) {
  if (!events.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-300 text-gray-500 uppercase tracking-wider">
            <th className="text-left py-1.5 pr-3 font-semibold">Status</th>
            <th className="text-left py-1.5 pr-3 font-semibold">From</th>
            <th className="text-left py-1.5 pr-3 font-semibold">To</th>
            <th className="text-left py-1.5 pr-3 font-semibold">Duration</th>
            <th className="text-left py-1.5 pr-3 font-semibold">Location</th>
            <th className="text-left py-1.5 font-semibold">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const cfg = STATUSES.find(s => s.key === ev.status) || STATUSES[0]
            return (
              <tr key={ev.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-1 pr-3">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                    style={{ backgroundColor: cfg.color }}
                  >
                    {cfg.num}. {cfg.short}
                  </span>
                </td>
                <td className="py-1 pr-3 text-gray-700 font-mono">{fmtTimeFull(ev.start_time)}</td>
                <td className="py-1 pr-3 text-gray-700 font-mono">{fmtTimeFull(ev.end_time)}</td>
                <td className="py-1 pr-3 text-gray-700 font-semibold">{fmtDurShort(ev.duration_hours)}</td>
                <td className="py-1 pr-3 text-gray-600 max-w-[200px] truncate">{ev.location}</td>
                <td className="py-1 text-gray-500 max-w-[280px] truncate">{ev.remarks}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function fmtTimeFull(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
