import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

export async function createTrip(data) {
  const res = await api.post('/trips/', data)
  return res.data
}

export async function getTrip(tripId) {
  const res = await api.get(`/trips/${tripId}/`)
  return res.data
}

export async function getTripLogs(tripId) {
  const res = await api.get(`/trips/${tripId}/logs/`)
  return res.data
}
