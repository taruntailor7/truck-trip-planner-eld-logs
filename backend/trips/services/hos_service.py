"""HOS (Hours of Service) calculation engine.

Implements the simplified FMCSA property-carrying driver rules:
  - Max 11 hours driving per shift
  - 14-hour on-duty window from start of shift
  - Mandatory 30-minute break after 8 consecutive hours of driving
  - 10-hour off-duty (sleeper berth) reset between shifts
  - 70 hours / 8-day rolling cycle limit
  - Pickup = 1 hr ON DUTY, Dropoff = 1 hr ON DUTY
  - Fuel stop = 30 min ON DUTY
"""

import logging
from datetime import timedelta

from django.utils import timezone

from ..models import Stop

logger = logging.getLogger(__name__)

MAX_DRIVE_HOURS = 11.0
MAX_WINDOW_HOURS = 14.0
BREAK_AFTER_HOURS = 8.0
MANDATORY_BREAK_HOURS = 0.5
OFF_DUTY_RESET_HOURS = 10.0
CYCLE_LIMIT_HOURS = 70.0
AVG_SPEED_MPH = 55.0
PICKUP_DURATION_HOURS = 1.0
DROPOFF_DURATION_HOURS = 1.0
FUEL_DURATION_HOURS = 0.5


def calculate_hos_schedule(trip):
    """Build a time-accurate schedule of driving segments and stops, enforcing HOS."""
    existing_stops = list(trip.stops.order_by("sequence_order"))
    if not existing_stops:
        return

    total_miles = trip.total_distance_miles or 0
    if total_miles == 0:
        return

    now = timezone.now()
    schedule = _build_schedule(trip, existing_stops, now)

    trip.stops.all().delete()
    Stop.objects.bulk_create(schedule)

    if schedule:
        trip.estimated_arrival = schedule[-1].departure_time
        trip.save(update_fields=["estimated_arrival"])

    logger.info(
        "HOS schedule for trip %s: %d stops, ETA %s",
        trip.id, len(schedule), trip.estimated_arrival,
    )


def _build_schedule(trip, existing_stops, start_time):
    """Core scheduling loop that enforces all HOS constraints."""
    schedule: list[Stop] = []
    seq = 1
    clock = start_time

    drive_hours_today = 0.0
    window_start = clock
    drive_since_break = 0.0
    cycle_used = trip.current_cycle_used or 0.0

    miles_covered = 0.0

    sorted_stops = sorted(existing_stops, key=lambda s: s.cumulative_miles)

    for stop in sorted_stops:
        miles_to_stop = stop.cumulative_miles - miles_covered
        if miles_to_stop < 0:
            miles_to_stop = 0
        drive_time_to_stop = miles_to_stop / AVG_SPEED_MPH if miles_to_stop > 0 else 0

        clock, drive_hours_today, window_start, drive_since_break, cycle_used, miles_covered, seq = (
            _drive_segment(
                trip=trip,
                schedule=schedule,
                clock=clock,
                drive_hours_needed=drive_time_to_stop,
                miles_start=miles_covered,
                miles_end=stop.cumulative_miles,
                drive_hours_today=drive_hours_today,
                window_start=window_start,
                drive_since_break=drive_since_break,
                cycle_used=cycle_used,
                seq=seq,
                total_miles=trip.total_distance_miles,
            )
        )

        miles_covered = stop.cumulative_miles

        if stop.stop_type == Stop.StopType.PICKUP:
            duration = PICKUP_DURATION_HOURS
        elif stop.stop_type == Stop.StopType.DROPOFF:
            duration = DROPOFF_DURATION_HOURS
        elif stop.stop_type == Stop.StopType.FUEL:
            duration = FUEL_DURATION_HOURS
        else:
            duration = stop.duration_hours

        on_duty_hours = duration
        window_elapsed = (clock - window_start).total_seconds() / 3600
        if window_elapsed + on_duty_hours > MAX_WINDOW_HOURS:
            clock, drive_hours_today, window_start, drive_since_break, cycle_used, seq = (
                _insert_reset(trip, schedule, clock, stop.location_name, stop.lat, stop.lng, round(miles_covered, 1), seq)
            )

        if cycle_used + on_duty_hours > CYCLE_LIMIT_HOURS:
            clock, drive_hours_today, window_start, drive_since_break, cycle_used, seq = (
                _insert_reset(trip, schedule, clock, stop.location_name, stop.lat, stop.lng, round(miles_covered, 1), seq)
            )

        arrival = clock
        departure = clock + timedelta(hours=duration)

        schedule.append(
            Stop(
                trip=trip,
                stop_type=stop.stop_type,
                location_name=stop.location_name,
                lat=stop.lat,
                lng=stop.lng,
                sequence_order=seq,
                arrival_time=arrival,
                departure_time=departure,
                duration_hours=duration,
                cumulative_miles=round(miles_covered, 1),
            )
        )
        seq += 1
        clock = departure

        cycle_used += on_duty_hours

    return schedule


def _drive_segment(
    trip, schedule, clock, drive_hours_needed, miles_start, miles_end,
    drive_hours_today, window_start, drive_since_break, cycle_used,
    seq, total_miles,
):
    """Consume driving time in chunks, inserting breaks/resets as needed."""
    remaining_drive = drive_hours_needed
    total_drive_for_segment = drive_hours_needed
    current_miles = miles_start

    while remaining_drive > 0.001:
        available_before_break = BREAK_AFTER_HOURS - drive_since_break
        available_before_limit = MAX_DRIVE_HOURS - drive_hours_today
        window_elapsed = (clock - window_start).total_seconds() / 3600
        available_before_window = MAX_WINDOW_HOURS - window_elapsed
        available_before_cycle = CYCLE_LIMIT_HOURS - cycle_used

        if available_before_limit <= 0 or available_before_window <= 0 or available_before_cycle <= 0:
            clock, drive_hours_today, window_start, drive_since_break, cycle_used, seq = (
                _insert_reset(trip, schedule, clock, "En Route", 0, 0, round(current_miles, 1), seq)
            )
            continue

        chunk = min(
            remaining_drive,
            available_before_break,
            available_before_limit,
            max(available_before_window, 0),
            max(available_before_cycle, 0),
        )
        chunk = max(chunk, 0)

        if chunk <= 0:
            clock, drive_hours_today, window_start, drive_since_break, cycle_used, seq = (
                _insert_reset(trip, schedule, clock, "En Route", 0, 0, round(current_miles, 1), seq)
            )
            continue

        chunk_miles = (chunk / total_drive_for_segment) * (miles_end - miles_start) if total_drive_for_segment > 0 else 0
        current_miles += chunk_miles

        clock += timedelta(hours=chunk)
        drive_hours_today += chunk
        drive_since_break += chunk
        cycle_used += chunk
        remaining_drive -= chunk

        if drive_since_break >= BREAK_AFTER_HOURS and remaining_drive > 0.001:
            clock, seq = _insert_break(trip, schedule, clock, round(current_miles, 1), seq)
            drive_since_break = 0.0

    return clock, drive_hours_today, window_start, drive_since_break, cycle_used, current_miles, seq


def _insert_break(trip, schedule, clock, cumulative_miles, seq):
    """Insert a mandatory 30-minute break."""
    arrival = clock
    departure = clock + timedelta(hours=MANDATORY_BREAK_HOURS)
    schedule.append(
        Stop(
            trip=trip,
            stop_type=Stop.StopType.BREAK,
            location_name="Mandatory 30-min Break",
            lat=0,
            lng=0,
            sequence_order=seq,
            arrival_time=arrival,
            departure_time=departure,
            duration_hours=MANDATORY_BREAK_HOURS,
            cumulative_miles=cumulative_miles,
        )
    )
    return departure, seq + 1


def _insert_reset(trip, schedule, clock, near_name, lat, lng, cumulative_miles, seq):
    """Insert a 10-hour off-duty reset (sleeper berth)."""
    arrival = clock
    departure = clock + timedelta(hours=OFF_DUTY_RESET_HOURS)

    schedule.append(
        Stop(
            trip=trip,
            stop_type=Stop.StopType.REST,
            location_name=f"10-Hour Reset near {near_name}",
            lat=lat,
            lng=lng,
            sequence_order=seq,
            arrival_time=arrival,
            departure_time=departure,
            duration_hours=OFF_DUTY_RESET_HOURS,
            cumulative_miles=cumulative_miles,
        )
    )

    new_clock = departure
    drive_hours_today = 0.0
    window_start = new_clock
    drive_since_break = 0.0
    cycle_used = 0.0

    return new_clock, drive_hours_today, window_start, drive_since_break, cycle_used, seq + 1
