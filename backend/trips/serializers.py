from rest_framework import serializers

from .models import LogDay, LogEvent, Stop, Trip


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = [
            "id",
            "stop_type",
            "location_name",
            "lat",
            "lng",
            "sequence_order",
            "arrival_time",
            "departure_time",
            "duration_hours",
            "cumulative_miles",
        ]


class TripSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id",
            "current_location",
            "current_lat",
            "current_lng",
            "pickup_location",
            "pickup_lat",
            "pickup_lng",
            "dropoff_location",
            "dropoff_lat",
            "dropoff_lng",
            "current_cycle_used",
            "total_distance_miles",
            "total_duration_hours",
            "route_geometry",
            "estimated_arrival",
            "stops",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "current_lat",
            "current_lng",
            "pickup_lat",
            "pickup_lng",
            "dropoff_lat",
            "dropoff_lng",
            "total_distance_miles",
            "total_duration_hours",
            "route_geometry",
            "estimated_arrival",
            "created_at",
        ]


class TripCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            "current_location",
            "pickup_location",
            "dropoff_location",
            "current_cycle_used",
        ]


class LogEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogEvent
        fields = [
            "id",
            "status",
            "start_time",
            "end_time",
            "duration_hours",
            "location",
            "remarks",
        ]


class LogDaySerializer(serializers.ModelSerializer):
    events = LogEventSerializer(many=True, read_only=True)

    class Meta:
        model = LogDay
        fields = [
            "id",
            "log_date",
            "day_number",
            "total_driving_hours",
            "total_on_duty_hours",
            "total_off_duty_hours",
            "total_sleeper_hours",
            "miles_driven",
            "start_location",
            "end_location",
            "events",
        ]


class TripLogsSerializer(serializers.Serializer):
    trip_id = serializers.IntegerField()
    total_days = serializers.IntegerField()
    logs = LogDaySerializer(many=True)
