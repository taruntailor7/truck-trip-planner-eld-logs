"""ELD (Electronic Logging Device) log generator.

Takes a Trip with its HOS-scheduled stops and produces:
  - LogDay records (one per calendar day the trip spans)
  - LogEvent records (status segments within each day)

Status mapping:
  - Driving segments       → DRIVING
  - Pickup / Dropoff / Fuel → ON_DUTY (not driving)
  - 30-min mandatory break → OFF_DUTY
  - 10-hr off-duty reset   → SLEEPER_BERTH
  - Gaps / remaining time   → OFF_DUTY
"""

import logging
from collections import defaultdict
from datetime import datetime, time, timedelta

from django.utils import timezone

from ..models import LogDay, LogEvent, Stop

logger = logging.getLogger(__name__)


def generate_eld_logs(trip):
    """Main entry point: build daily logs from the trip's stop schedule."""
    stops = list(trip.stops.order_by("sequence_order"))
    if not stops:
        return

    trip.log_days.all().delete()

    raw_events = _build_raw_events(trip, stops)
    if not raw_events:
        return

    days_map = _split_into_days(raw_events)

    day_number = 1
    log_days = []
    log_events = []

    for log_date in sorted(days_map.keys()):
        day_events = days_map[log_date]
        day_events = _fill_gaps(day_events, log_date)

        totals = _calc_totals(day_events)

        first_loc = day_events[0]["location"] if day_events else ""
        last_loc = day_events[-1]["location"] if day_events else ""

        log_day = LogDay(
            trip=trip,
            log_date=log_date,
            day_number=day_number,
            total_driving_hours=round(totals["DRIVING"], 2),
            total_on_duty_hours=round(totals["ON_DUTY"], 2),
            total_off_duty_hours=round(totals["OFF_DUTY"], 2),
            total_sleeper_hours=round(totals["SLEEPER_BERTH"], 2),
            miles_driven=round(totals["miles"], 1),
            start_location=first_loc,
            end_location=last_loc,
        )
        log_days.append(log_day)
        day_number += 1

    LogDay.objects.bulk_create(log_days)

    day_lookup = {ld.log_date: ld for ld in LogDay.objects.filter(trip=trip)}

    for log_date in sorted(days_map.keys()):
        day_events = days_map[log_date]
        day_events = _fill_gaps(day_events, log_date)
        log_day = day_lookup[log_date]

        for ev in day_events:
            if ev["start"] >= ev["end"]:
                continue
            log_events.append(
                LogEvent(
                    log_day=log_day,
                    status=ev["status"],
                    start_time=ev["start"],
                    end_time=ev["end"],
                    duration_hours=round(
                        (ev["end"] - ev["start"]).total_seconds() / 3600, 2
                    ),
                    location=ev["location"],
                    remarks=ev.get("remarks", ""),
                )
            )

    LogEvent.objects.bulk_create(log_events)
    logger.info(
        "ELD logs for trip %s: %d days, %d events",
        trip.id, len(log_days), len(log_events),
    )


def _build_raw_events(trip, stops):
    """Convert the ordered stop list into a flat list of timed status events."""
    events = []
    total_miles = trip.total_distance_miles or 0

    for i, stop in enumerate(stops):
        if i == 0:
            drive_start = trip.created_at
            from_location = trip.current_location
            prev_miles = 0
        else:
            drive_start = stops[i - 1].departure_time
            from_location = stops[i - 1].location_name
            prev_miles = stops[i - 1].cumulative_miles or 0

        if stop.arrival_time > drive_start:
            drive_miles = max((stop.cumulative_miles or 0) - prev_miles, 0)

            events.append({
                "status": LogEvent.Status.DRIVING,
                "start": drive_start,
                "end": stop.arrival_time,
                "location": from_location,
                "remarks": f"Driving: {from_location} → {stop.location_name}" + (f" ({drive_miles:.0f} mi)" if drive_miles > 0 else ""),
                "miles": drive_miles,
            })

        status = _stop_type_to_status(stop.stop_type)
        remarks = _stop_type_to_remarks(stop.stop_type, stop.location_name)

        events.append({
            "status": status,
            "start": stop.arrival_time,
            "end": stop.departure_time,
            "location": stop.location_name,
            "remarks": remarks,
            "miles": 0,
        })

    return events


def _stop_type_to_status(stop_type):
    mapping = {
        Stop.StopType.PICKUP: LogEvent.Status.ON_DUTY,
        Stop.StopType.DROPOFF: LogEvent.Status.ON_DUTY,
        Stop.StopType.FUEL: LogEvent.Status.ON_DUTY,
        Stop.StopType.BREAK: LogEvent.Status.OFF_DUTY,
        Stop.StopType.REST: LogEvent.Status.SLEEPER_BERTH,
    }
    return mapping.get(stop_type, LogEvent.Status.OFF_DUTY)


def _stop_type_to_remarks(stop_type, location):
    mapping = {
        Stop.StopType.PICKUP: f"Pickup at {location}",
        Stop.StopType.DROPOFF: f"Dropoff at {location}",
        Stop.StopType.FUEL: f"Fuel stop at {location}",
        Stop.StopType.BREAK: "Mandatory 30-min break",
        Stop.StopType.REST: "10-hour off-duty reset",
    }
    return mapping.get(stop_type, "")


def _split_into_days(events):
    """Split events across calendar day boundaries (midnight UTC)."""
    days_map = defaultdict(list)

    for ev in events:
        current_start = ev["start"]
        ev_end = ev["end"]

        while current_start < ev_end:
            day_date = current_start.date()
            next_midnight = timezone.make_aware(
                datetime.combine(day_date + timedelta(days=1), time.min)
            )
            segment_end = min(ev_end, next_midnight)

            if current_start < segment_end:
                days_map[day_date].append({
                    "status": ev["status"],
                    "start": current_start,
                    "end": segment_end,
                    "location": ev["location"],
                    "remarks": ev.get("remarks", ""),
                    "miles": ev.get("miles", 0) * (
                        (segment_end - current_start).total_seconds()
                        / max((ev_end - ev["start"]).total_seconds(), 1)
                    ),
                })

            current_start = segment_end

    return days_map


def _fill_gaps(day_events, log_date):
    """Fill any unaccounted time in the 24-hour day with OFF_DUTY."""
    if not day_events:
        return day_events

    day_start = timezone.make_aware(datetime.combine(log_date, time.min))
    day_end = day_start + timedelta(days=1)

    sorted_events = sorted(day_events, key=lambda e: e["start"])
    filled = []

    cursor = max(day_start, sorted_events[0]["start"])

    if sorted_events[0]["start"] > day_start:
        filled.append({
            "status": LogEvent.Status.OFF_DUTY,
            "start": day_start,
            "end": sorted_events[0]["start"],
            "location": sorted_events[0]["location"],
            "remarks": "",
            "miles": 0,
        })

    for ev in sorted_events:
        if ev["start"] > cursor:
            filled.append({
                "status": LogEvent.Status.OFF_DUTY,
                "start": cursor,
                "end": ev["start"],
                "location": ev["location"],
                "remarks": "",
                "miles": 0,
            })
        filled.append(ev)
        cursor = max(cursor, ev["end"])

    if cursor < day_end:
        last_loc = sorted_events[-1]["location"] if sorted_events else ""
        filled.append({
            "status": LogEvent.Status.OFF_DUTY,
            "start": cursor,
            "end": day_end,
            "location": last_loc,
            "remarks": "",
            "miles": 0,
        })

    return filled


def _calc_totals(day_events):
    totals = {"DRIVING": 0, "ON_DUTY": 0, "OFF_DUTY": 0, "SLEEPER_BERTH": 0, "miles": 0}
    for ev in day_events:
        hours = (ev["end"] - ev["start"]).total_seconds() / 3600
        status_key = ev["status"]
        if status_key in totals:
            totals[status_key] += hours
        totals["miles"] += ev.get("miles", 0)
    return totals
