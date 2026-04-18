import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const STOP_COLORS = {
  pickup: '#16a34a',
  dropoff: '#dc2626',
  fuel: '#f59e0b',
  rest: '#6366f1',
  break: '#8b5cf6',
}

const STOP_LABELS = {
  pickup: 'P',
  dropoff: 'D',
  fuel: 'F',
  rest: 'R',
  break: 'B',
}

function circleIcon(color, label) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      width:28px;height:28px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:11px;font-weight:700;
      border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

const startIcon = L.divIcon({
  className: '',
  html: `<div style="
    background:#3b82f6;
    width:32px;height:32px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-size:13px;font-weight:700;
    border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);
  ">S</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
})

export default function MapView({ trip }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const map = L.map(containerRef.current, {
      center: [trip.current_lat || 39.8, trip.current_lng || -98.5],
      zoom: 5,
      scrollWheelZoom: true,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    // Route line
    if (trip.route_geometry?.coordinates?.length) {
      const latLngs = trip.route_geometry.coordinates.map(([lng, lat]) => [lat, lng])
      const polyline = L.polyline(latLngs, {
        color: '#4f46e5',
        weight: 4,
        opacity: 0.8,
      }).addTo(map)
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] })
    }

    // Origin marker
    if (trip.current_lat && trip.current_lng) {
      L.marker([trip.current_lat, trip.current_lng], { icon: startIcon })
        .bindPopup(`<strong>Start</strong><br/>${trip.current_location}`)
        .addTo(map)
    }

    // Stop markers
    if (trip.stops) {
      trip.stops.forEach(stop => {
        if (!stop.lat || !stop.lng) return
        const color = STOP_COLORS[stop.stop_type] || '#6b7280'
        const label = STOP_LABELS[stop.stop_type] || '?'
        const typeName = stop.stop_type.charAt(0).toUpperCase() + stop.stop_type.slice(1)

        L.marker([stop.lat, stop.lng], { icon: circleIcon(color, label) })
          .bindPopup(
            `<strong>${typeName}</strong><br/>${stop.location_name}<br/><span style="font-size:12px;color:#666">${stop.duration_hours}h &middot; ${stop.cumulative_miles?.toFixed(0)} mi</span>`
          )
          .addTo(map)
      })
    }

    return () => map.remove()
  }, [trip])

  return <div ref={containerRef} className="h-96 w-full" />
}
