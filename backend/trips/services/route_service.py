"""Route service – OpenRouteService integration and fuel stop calculation.

Handles:
  1. Geocoding addresses to coordinates via ORS Geocode (Pelias)
  2. Fetching the driving route (current → pickup → dropoff) from ORS Directions
  3. Computing fuel stops every ~1000 miles along the route
  4. Persisting route data and stops on the Trip model
"""

import logging
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from ..models import Stop

logger = logging.getLogger(__name__)

ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv"
ORS_REVERSE_URL = "https://api.openrouteservice.org/geocode/reverse"

FUEL_STOP_INTERVAL_MILES = 1000
FUEL_STOP_DURATION_HOURS = 0.5
AVG_SPEED_MPH = 55


def _get_token():
    token = settings.ORS_API_KEY
    if not token:
        raise ValueError(
            "ORS_API_KEY is not set. Add it to your .env file. "
            "Get a free key at https://openrouteservice.org/dev/#/signup"
        )
    return token


def _geocode(address: str) -> tuple[float, float]:
    """Return (longitude, latitude) for a given address string."""
    resp = requests.get(
        ORS_GEOCODE_URL,
        params={
            "api_key": _get_token(),
            "text": address,
            "size": 1,
            "boundary.country": "US",
        },
        timeout=10,
    )
    resp.raise_for_status()
    features = resp.json().get("features", [])
    if not features:
        raise ValueError(f"Could not geocode address: {address}")
    lng, lat = features[0]["geometry"]["coordinates"]
    return lng, lat


def _get_directions(coords_list: list[tuple[float, float]]) -> dict:
    """Fetch driving directions between ordered waypoints via ORS.

    coords_list: [(lng, lat), …]
    Uses POST body format as required by ORS for >2 waypoints.
    """
    resp = requests.post(
        ORS_DIRECTIONS_URL,
        json={
            "coordinates": [[lng, lat] for lng, lat in coords_list],
        },
        headers={
            "Authorization": _get_token(),
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        detail = resp.json().get("error", {})
        msg = detail.get("message", resp.text) if isinstance(detail, dict) else str(detail)
        raise ValueError(f"Route API error: {msg}")
    data = resp.json()
    if not data.get("routes"):
        raise ValueError("No route found between the given locations.")
    return data


def _interpolate_point_on_route(geometry_coords, target_fraction):
    """Return the approximate [lng, lat] at a given fraction (0-1) along the route."""
    if target_fraction <= 0:
        return geometry_coords[0]
    if target_fraction >= 1:
        return geometry_coords[-1]

    total = 0
    segments = []
    for i in range(len(geometry_coords) - 1):
        dx = geometry_coords[i + 1][0] - geometry_coords[i][0]
        dy = geometry_coords[i + 1][1] - geometry_coords[i][1]
        seg_len = (dx**2 + dy**2) ** 0.5
        segments.append(seg_len)
        total += seg_len

    target_dist = target_fraction * total
    cumulative = 0
    for i, seg_len in enumerate(segments):
        if cumulative + seg_len >= target_dist:
            frac = (target_dist - cumulative) / seg_len if seg_len else 0
            lng = geometry_coords[i][0] + frac * (
                geometry_coords[i + 1][0] - geometry_coords[i][0]
            )
            lat = geometry_coords[i][1] + frac * (
                geometry_coords[i + 1][1] - geometry_coords[i][1]
            )
            return [lng, lat]
        cumulative += seg_len

    return geometry_coords[-1]


def _reverse_geocode_approx(lng, lat):
    """Best-effort reverse geocode via ORS; returns a readable place name."""
    try:
        resp = requests.get(
            ORS_REVERSE_URL,
            params={
                "api_key": _get_token(),
                "point.lon": lng,
                "point.lat": lat,
                "size": 1,
            },
            timeout=10,
        )
        resp.raise_for_status()
        features = resp.json().get("features", [])
        if features:
            props = features[0].get("properties", {})
            label = props.get("label", "")
            if label:
                return label
    except Exception:
        pass
    return f"{lat:.2f}, {lng:.2f}"


def generate_route(trip):
    """Main entry point: geocode, fetch route, create stops, update trip."""
    now = timezone.now()

    cur_lng, cur_lat = _geocode(trip.current_location)
    pu_lng, pu_lat = _geocode(trip.pickup_location)
    do_lng, do_lat = _geocode(trip.dropoff_location)

    trip.current_lat, trip.current_lng = cur_lat, cur_lng
    trip.pickup_lat, trip.pickup_lng = pu_lat, pu_lng
    trip.dropoff_lat, trip.dropoff_lng = do_lat, do_lng

    directions = _get_directions(
        [(cur_lng, cur_lat), (pu_lng, pu_lat), (do_lng, do_lat)]
    )
    route = directions["routes"][0]
    summary = route["summary"]
    total_meters = summary["distance"]
    total_seconds = summary["duration"]

    # ORS returns geometry as an encoded polyline by default,
    # or as GeoJSON if requested. We decode or store accordingly.
    geometry = route.get("geometry")
    decoded_coords = _decode_polyline(geometry) if isinstance(geometry, str) else geometry.get("coordinates", [])

    geojson_geometry = {
        "type": "LineString",
        "coordinates": decoded_coords,
    }

    total_miles = total_meters / 1609.344
    total_hours = total_seconds / 3600

    trip.total_distance_miles = round(total_miles, 1)
    trip.total_duration_hours = round(total_hours, 1)
    trip.route_geometry = geojson_geometry
    trip.estimated_arrival = now + timedelta(hours=total_hours * 1.4)
    trip.save()

    # Compute leg distances from segments
    segments = route.get("segments", [])
    leg1_miles = segments[0]["distance"] / 1609.344 if len(segments) > 0 else total_miles / 2

    stops_to_create = []
    seq = 1

    # Pickup stop
    pickup_arrival = now + timedelta(hours=leg1_miles / AVG_SPEED_MPH)
    stops_to_create.append(
        Stop(
            trip=trip,
            stop_type=Stop.StopType.PICKUP,
            location_name=trip.pickup_location,
            lat=pu_lat,
            lng=pu_lng,
            sequence_order=seq,
            arrival_time=pickup_arrival,
            departure_time=pickup_arrival + timedelta(hours=1),
            duration_hours=1.0,
            cumulative_miles=round(leg1_miles, 1),
        )
    )
    seq += 1

    # Fuel stops every ~1000 miles
    fuel_mile = FUEL_STOP_INTERVAL_MILES
    while fuel_mile < total_miles:
        fraction = fuel_mile / total_miles
        point = _interpolate_point_on_route(decoded_coords, fraction)
        fuel_lng, fuel_lat = point[0], point[1]
        loc_name = _reverse_geocode_approx(fuel_lng, fuel_lat)

        hours_to_here = fuel_mile / AVG_SPEED_MPH
        fuel_arrival = now + timedelta(hours=hours_to_here)
        stops_to_create.append(
            Stop(
                trip=trip,
                stop_type=Stop.StopType.FUEL,
                location_name=loc_name,
                lat=fuel_lat,
                lng=fuel_lng,
                sequence_order=seq,
                arrival_time=fuel_arrival,
                departure_time=fuel_arrival + timedelta(hours=FUEL_STOP_DURATION_HOURS),
                duration_hours=FUEL_STOP_DURATION_HOURS,
                cumulative_miles=round(fuel_mile, 1),
            )
        )
        seq += 1
        fuel_mile += FUEL_STOP_INTERVAL_MILES

    # Dropoff stop
    dropoff_arrival = now + timedelta(hours=total_miles / AVG_SPEED_MPH)
    stops_to_create.append(
        Stop(
            trip=trip,
            stop_type=Stop.StopType.DROPOFF,
            location_name=trip.dropoff_location,
            lat=do_lat,
            lng=do_lng,
            sequence_order=seq,
            arrival_time=dropoff_arrival,
            departure_time=dropoff_arrival + timedelta(hours=1),
            duration_hours=1.0,
            cumulative_miles=round(total_miles, 1),
        )
    )

    Stop.objects.bulk_create(stops_to_create)
    logger.info("Route generated for trip %s: %.1f miles, %d stops", trip.id, total_miles, len(stops_to_create))


def _decode_polyline(encoded: str) -> list[list[float]]:
    """Decode a Google-style encoded polyline into [[lng, lat], …] coordinates."""
    coords = []
    idx = 0
    lat = 0
    lng = 0
    while idx < len(encoded):
        # Latitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[idx]) - 63
            idx += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lat += (~(result >> 1) if result & 1 else result >> 1)

        # Longitude
        shift = 0
        result = 0
        while True:
            b = ord(encoded[idx]) - 63
            idx += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lng += (~(result >> 1) if result & 1 else result >> 1)

        coords.append([lng / 1e5, lat / 1e5])

    return coords
