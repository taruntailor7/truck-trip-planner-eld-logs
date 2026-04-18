import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTrip } from '../api/tripApi'

const INITIAL = {
  current_location: '',
  pickup_location: '',
  dropoff_location: '',
  current_cycle_used: '',
}

export default function InputPage() {
  const [form, setForm] = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  function onChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = {
        ...form,
        current_cycle_used: parseFloat(form.current_cycle_used) || 0,
      }
      const trip = await createTrip(payload)
      navigate(`/trip/${trip.id}`)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { name: 'current_location', label: 'Current Location', placeholder: 'e.g. Denver, CO', icon: locationIcon },
    { name: 'pickup_location', label: 'Pickup Location', placeholder: 'e.g. Kansas City, MO', icon: pickupIcon },
    { name: 'dropoff_location', label: 'Dropoff Location', placeholder: 'e.g. Chicago, IL', icon: dropoffIcon },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900">Plan Your Trip</h2>
        <p className="mt-2 text-gray-500">
          Enter your trip details to generate a route, HOS-compliant schedule, and ELD logs.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6">
        {fields.map(f => (
          <div key={f.name}>
            <label htmlFor={f.name} className="block text-sm font-semibold text-gray-700 mb-1.5">
              {f.label}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                {f.icon}
              </div>
              <input
                id={f.name}
                name={f.name}
                type="text"
                required
                value={form[f.name]}
                onChange={onChange}
                placeholder={f.placeholder}
                className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>
          </div>
        ))}

        <div>
          <label htmlFor="current_cycle_used" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Current Cycle Used (hours)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {clockIcon}
            </div>
            <input
              id="current_cycle_used"
              name="current_cycle_used"
              type="number"
              min="0"
              max="70"
              step="0.5"
              required
              value={form.current_cycle_used}
              onChange={onChange}
              placeholder="e.g. 20"
              className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">Hours already used in the current 70-hour / 8-day cycle (0–70)</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-lg shadow transition cursor-pointer disabled:cursor-wait"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating Trip Plan...
            </span>
          ) : 'Generate Trip Plan'}
        </button>
      </form>

      <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-800 mb-3">HOS Rules Applied</h3>
        <ul className="space-y-1.5 text-sm text-gray-600">
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">&#x2713;</span> Max 11 hours driving per shift</li>
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">&#x2713;</span> 14-hour on-duty window</li>
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">&#x2713;</span> 30-minute break after 8 hours driving</li>
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">&#x2713;</span> 70 hours / 8-day rolling limit</li>
          <li className="flex items-start gap-2"><span className="text-indigo-500 mt-0.5">&#x2713;</span> 10-hour off-duty reset</li>
        </ul>
      </div>
    </div>
  )
}

const locationIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
)
const pickupIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
  </svg>
)
const dropoffIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 4.5-15 15m0 0h11.25m-11.25 0V8.25" />
  </svg>
)
const clockIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)
