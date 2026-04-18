from django.db import models


class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    current_lat = models.FloatField(null=True, blank=True)
    current_lng = models.FloatField(null=True, blank=True)

    pickup_location = models.CharField(max_length=255)
    pickup_lat = models.FloatField(null=True, blank=True)
    pickup_lng = models.FloatField(null=True, blank=True)

    dropoff_location = models.CharField(max_length=255)
    dropoff_lat = models.FloatField(null=True, blank=True)
    dropoff_lng = models.FloatField(null=True, blank=True)

    current_cycle_used = models.FloatField(
        help_text="Hours already used in the current 70-hour/8-day cycle"
    )

    total_distance_miles = models.FloatField(null=True, blank=True)
    total_duration_hours = models.FloatField(null=True, blank=True)
    route_geometry = models.JSONField(
        null=True, blank=True,
        help_text="GeoJSON LineString geometry from routing API",
    )
    estimated_arrival = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Trip {self.id}: {self.current_location} → {self.dropoff_location}"


class Stop(models.Model):
    class StopType(models.TextChoices):
        PICKUP = "pickup", "Pickup"
        DROPOFF = "dropoff", "Dropoff"
        FUEL = "fuel", "Fuel"
        REST = "rest", "Rest"
        BREAK = "break", "Break"

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="stops")
    stop_type = models.CharField(max_length=10, choices=StopType.choices)
    location_name = models.CharField(max_length=255)
    lat = models.FloatField()
    lng = models.FloatField()
    sequence_order = models.IntegerField()
    arrival_time = models.DateTimeField()
    departure_time = models.DateTimeField()
    duration_hours = models.FloatField()
    cumulative_miles = models.FloatField(default=0)

    class Meta:
        ordering = ["sequence_order"]

    def __str__(self):
        return f"{self.get_stop_type_display()} at {self.location_name}"


class LogDay(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name="log_days")
    log_date = models.DateField()
    day_number = models.IntegerField()
    total_driving_hours = models.FloatField(default=0)
    total_on_duty_hours = models.FloatField(default=0)
    total_off_duty_hours = models.FloatField(default=0)
    total_sleeper_hours = models.FloatField(default=0)
    miles_driven = models.FloatField(default=0)
    start_location = models.CharField(max_length=255, blank=True, default="")
    end_location = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["day_number"]

    def __str__(self):
        return f"Day {self.day_number} – {self.log_date}"


class LogEvent(models.Model):
    class Status(models.TextChoices):
        OFF_DUTY = "OFF_DUTY", "Off Duty"
        SLEEPER_BERTH = "SLEEPER_BERTH", "Sleeper Berth"
        DRIVING = "DRIVING", "Driving"
        ON_DUTY = "ON_DUTY", "On Duty (Not Driving)"

    log_day = models.ForeignKey(LogDay, on_delete=models.CASCADE, related_name="events")
    status = models.CharField(max_length=15, choices=Status.choices)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    duration_hours = models.FloatField()
    location = models.CharField(max_length=255, blank=True, default="")
    remarks = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["start_time"]

    def __str__(self):
        return f"{self.get_status_display()} {self.start_time:%H:%M}–{self.end_time:%H:%M}"
