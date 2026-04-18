import { useState } from 'react'

const STATUSES = [
  { key: 'OFF_DUTY',       label: 'Off Duty',     short: 'OFF', color: '#6b7280' },
  { key: 'SLEEPER_BERTH',  label: 'Sleeper Berth', short: 'SB',  color: '#6366f1' },
  { key: 'DRIVING',        label: 'Driving',       short: 'D',   color: '#16a34a' },
  { key: 'ON_DUTY',        label: 'On Duty (Not Driving)', short: 'ON',  color: '#f59e0b' },
]

const HOURS = Array.from({ length: 25 }, (_, i) => i)
const STATUS_INDEX = Object.fromEntries(STATUSES.map((s, i) => [s.key, i]))

function fmtDur(h) {
  if (!h) return '0m'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

export default function ELDLogViewer({ logs }) {
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
    <div className="space-y-5">
      {/* Total trip summary */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <h4 className="text-sm font-bold text-gray-700 mb-3">Total Trip Summary ({logs.length} day{logs.length > 1 ? 's' : ''})</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MiniStat label="Total Driving" value={fmtDur(totals.driving)} color="text-green-700" />
          <MiniStat label="Total On Duty" value={fmtDur(totals.onDuty)} color="text-amber-700" />
          <MiniStat label="Total Sleeper" value={fmtDur(totals.sleeper)} color="text-indigo-700" />
          <MiniStat label="Total Off Duty" value={fmtDur(totals.offDuty)} color="text-gray-600" />
          <MiniStat label="Total Miles" value={`${totals.miles.toFixed(0)} mi`} color="text-blue-700" />
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

      <DayLog day={logs[activeDay]} />
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <p className={`text-base font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function DayLog({ day }) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-700">Day {day.day_number} — {day.log_date}</h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Driving" value={fmtDur(day.total_driving_hours)} color="text-green-700" bg="bg-green-50" />
        <StatCard label="On Duty" value={fmtDur(day.total_on_duty_hours)} color="text-amber-700" bg="bg-amber-50" />
        <StatCard label="Sleeper Berth" value={fmtDur(day.total_sleeper_hours)} color="text-indigo-700" bg="bg-indigo-50" />
        <StatCard label="Off Duty" value={fmtDur(day.total_off_duty_hours)} color="text-gray-700" bg="bg-gray-50" />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{day.start_location}</span>
        <span>{day.miles_driven?.toFixed(0)} miles driven</span>
        <span>{day.end_location}</span>
      </div>

      <div className="overflow-x-auto">
        <ELDGrid events={day.events || []} logDate={day.log_date} />
      </div>

      <EventsTable events={day.events || []} />
    </div>
  )
}

function StatCard({ label, value, color, bg }) {
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function ELDGrid({ events, logDate }) {
  const gridWidth = 960
  const rowHeight = 32
  const labelWidth = 90
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
      viewBox={`0 0 ${totalWidth} ${svgHeight + 24}`}
      className="w-full min-w-[700px]"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {HOURS.map(h => {
        const x = labelWidth + h * hourWidth
        return (
          <g key={h}>
            <line x1={x} y1={0} x2={x} y2={svgHeight} stroke="#e5e7eb" strokeWidth={h % 6 === 0 ? 1.5 : 0.5} />
            {h < 24 && (
              <text x={x + hourWidth / 2} y={svgHeight + 14} textAnchor="middle" fontSize="9" fill="#9ca3af">
                {h === 0 ? 'M' : h === 12 ? 'N' : h > 12 ? `${h - 12}p` : `${h}a`}
              </text>
            )}
          </g>
        )
      })}

      {STATUSES.map((s, i) => {
        const y = i * rowHeight
        return (
          <g key={s.key}>
            <rect x={0} y={y} width={totalWidth} height={rowHeight} fill={i % 2 === 0 ? '#fafafa' : '#ffffff'} />
            <line x1={labelWidth} y1={y + rowHeight} x2={totalWidth} y2={y + rowHeight} stroke="#e5e7eb" strokeWidth={0.5} />
            <text x={8} y={y + rowHeight / 2 + 4} fontSize="10" fontWeight="600" fill="#6b7280">
              {s.short}
            </text>
          </g>
        )
      })}

      {segments.map((seg, i) => {
        const y = seg.rowIdx * rowHeight + 6
        const w = Math.max(seg.x2 - seg.x1, 1)
        const statusCfg = STATUSES[seg.rowIdx]
        return (
          <rect
            key={i}
            x={seg.x1}
            y={y}
            width={w}
            height={rowHeight - 12}
            rx={3}
            fill={statusCfg.color}
            opacity={0.85}
            style={{ cursor: 'pointer' }}
          >
            <title>{`${statusCfg.label}\n${fmtTimeFull(seg.start_time)} → ${fmtTimeFull(seg.end_time)}\nDuration: ${fmtDur(seg.duration_hours)}\n${seg.location ? `Location: ${seg.location}` : ''}${seg.remarks ? `\n${seg.remarks}` : ''}`}</title>
          </rect>
        )
      })}

      {verticals.map((v, i) => (
        <line
          key={`v${i}`}
          x1={v.x} y1={v.yTop}
          x2={v.x} y2={v.yBot}
          stroke="#374151"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  )
}

function EventsTable({ events }) {
  if (!events.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
            <th className="text-left py-2 pr-4 font-medium">Status</th>
            <th className="text-left py-2 pr-4 font-medium">Start</th>
            <th className="text-left py-2 pr-4 font-medium">End</th>
            <th className="text-left py-2 pr-4 font-medium">Duration</th>
            <th className="text-left py-2 pr-4 font-medium">Location</th>
            <th className="text-left py-2 font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const cfg = STATUSES.find(s => s.key === ev.status) || STATUSES[0]
            return (
              <tr key={ev.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-1.5 pr-4">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: cfg.color }}
                  >
                    {cfg.short}
                  </span>
                </td>
                <td className="py-1.5 pr-4 text-gray-700">{fmtTimeFull(ev.start_time)}</td>
                <td className="py-1.5 pr-4 text-gray-700">{fmtTimeFull(ev.end_time)}</td>
                <td className="py-1.5 pr-4 text-gray-700">{fmtDur(ev.duration_hours)}</td>
                <td className="py-1.5 pr-4 text-gray-600 max-w-[250px] truncate">{ev.location}</td>
                <td className="py-1.5 text-gray-500 max-w-[300px] truncate">{ev.remarks}</td>
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
