import { Routes, Route } from 'react-router-dom'
import InputPage from './pages/InputPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21a.75.75 0 0 0 .75-.75v-3.75a3 3 0 0 0-3-3h-1.5L15 5.25H9.75L7.5 9H3.375A1.125 1.125 0 0 0 2.25 10.125V14.25" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Trip Planner</h1>
            <p className="text-xs text-gray-500">ELD Log Generator</p>
          </div>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<InputPage />} />
          <Route path="/trip/:tripId" element={<DashboardPage />} />
        </Routes>
      </main>
    </div>
  )
}
