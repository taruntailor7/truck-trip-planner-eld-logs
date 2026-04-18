const TYPE_CONFIG = {
  start:   { label: 'Start',           bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500' },
  pickup:  { label: 'Pickup (Loading)', bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500' },
  dropoff: { label: 'Dropoff (Unloading)', bg: 'bg-red-50', text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500' },
  fuel:    { label: 'Fuel Stop',        bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500' },
  rest:    { label: 'Sleeper Berth Reset', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  break:   { label: 'Mandatory Break',  bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
}

const STOP_REASON = {
  pickup:  'Loading cargo — 1 hour on duty',
  dropoff: 'Unloading cargo — 1 hour on duty',
  fuel:    'Refueling — 30 min on duty',
  rest:    'HOS requires 10-hour off-duty reset before next shift',
  break:   'HOS requires 30-min break after 8 hours of driving',
}

function fmt(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtDuration(hours) {
  if (!hours) return ''
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function TripSummary({ trip }) {
  const stops = trip.stops || []

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-1">Trip Plan</h3>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 mb-5">
        <span>{trip.total_distance_miles?.toFixed(0)} miles total</span>
        <span>{fmtDuration(trip.total_duration_hours)} driving time</span>
        {trip.estimated_arrival && (
          <span>ETA: {fmt(trip.estimated_arrival)}</span>
        )}
      </div>

      <div className="relative">
        <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-200" />

        <ol className="space-y-3">
          {/* Start */}
          <li className="relative pl-10">
            <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full ring-2 ring-white bg-blue-500" />
            <div className="rounded-lg border p-3 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Start</span>
                <span className="text-xs text-gray-500">0 mi</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{trip.current_location}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmt(trip.created_at)} — Trip begins</p>
            </div>
          </li>

          {stops.map((stop, i) => {
            const cfg = TYPE_CONFIG[stop.stop_type] || TYPE_CONFIG.rest
            const reason = STOP_REASON[stop.stop_type] || ''
            const prevMiles = i === 0 ? 0 : (stops[i - 1]?.cumulative_miles || 0)
            const legMiles = Math.max(0, (stop.cumulative_miles || 0) - prevMiles)

            return (
              <li key={stop.id || i}>
                {/* Driving segment before this stop */}
                {legMiles > 0 && (
                  <div className="relative pl-10 mb-3">
                    <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full ring-2 ring-white bg-gray-300" />
                    <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21a.75.75 0 0 0 .75-.75v-3.75a3 3 0 0 0-3-3h-1.5L15 5.25H9.75L7.5 9H3.375A1.125 1.125 0 0 0 2.25 10.125V14.25" />
                      </svg>
                      <span>Drive {legMiles.toFixed(0)} miles — {fmtDuration(legMiles / 55)}</span>
                    </div>
                  </div>
                )}

                {/* The stop itself */}
                <div className="relative pl-10">
                  <div className={`absolute left-2 top-1.5 w-3 h-3 rounded-full ring-2 ring-white ${cfg.dot}`} />
                  <div className={`rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-500">{stop.cumulative_miles?.toFixed(0)} mi</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{stop.location_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmt(stop.arrival_time)} → {fmt(stop.departure_time)} — {fmtDuration(stop.duration_hours)}
                    </p>
                    {reason && (
                      <p className="text-xs text-gray-400 mt-1 italic">{reason}</p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
