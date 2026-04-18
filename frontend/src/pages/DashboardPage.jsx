import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTrip, getTripLogs } from '../api/tripApi'
import MapView from '../components/MapView'
import TripSummary from '../components/TripSummary'
import ELDLogViewer from '../components/ELDLogViewer'

export default function DashboardPage() {
  const { tripId } = useParams()
  const [trip, setTrip] = useState(null)
  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [tripData, logsData] = await Promise.all([
          getTrip(tripId),
          getTripLogs(tripId),
        ])
        if (!cancelled) {
          setTrip(tripData)
          setLogs(logsData)
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tripId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading trip data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Trip</h2>
          <p className="text-red-600 text-sm">{error}</p>
          <Link to="/" className="inline-block mt-4 text-indigo-600 hover:text-indigo-800 font-medium text-sm">
            &larr; Back to Trip Planner
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">&larr; New Trip</Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">Trip Dashboard</h2>
          <p className="text-sm text-gray-500">
            {trip.current_location} &rarr; {trip.pickup_location} &rarr; {trip.dropoff_location}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{trip.total_distance_miles?.toFixed(0)} mi</p>
          <p className="text-sm text-gray-500">Total Distance</p>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <MapView trip={trip} />
      </div>

      {/* Trip Summary */}
      <TripSummary trip={trip} />

      {/* ELD Logs */}
      {logs && logs.logs && logs.logs.length > 0 && (
        <div className="bg-white rounded-2xl shadow border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">ELD Daily Logs <span className="text-sm font-normal text-gray-400">(Electronic Logging Device)</span></h3>
          <p className="text-sm text-gray-500 mb-4">{logs.total_days} day{logs.total_days > 1 ? 's' : ''} of logs generated</p>
          <ELDLogViewer logs={logs.logs} trip={trip} />
        </div>
      )}
    </div>
  )
}
