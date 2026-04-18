from django.contrib import admin

from .models import LogDay, LogEvent, Stop, Trip


class StopInline(admin.TabularInline):
    model = Stop
    extra = 0


class LogEventInline(admin.TabularInline):
    model = LogEvent
    extra = 0


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ["id", "current_location", "dropoff_location", "total_distance_miles", "created_at"]
    inlines = [StopInline]


@admin.register(LogDay)
class LogDayAdmin(admin.ModelAdmin):
    list_display = ["id", "trip", "log_date", "day_number", "total_driving_hours"]
    inlines = [LogEventInline]
