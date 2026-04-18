from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Trip
from .serializers import TripCreateSerializer, TripLogsSerializer, TripSerializer
from .services.eld_service import generate_eld_logs
from .services.hos_service import calculate_hos_schedule
from .services.route_service import generate_route


@api_view(["POST"])
def create_trip(request):
    serializer = TripCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    trip = serializer.save()

    try:
        generate_route(trip)
        calculate_hos_schedule(trip)
        generate_eld_logs(trip)
    except Exception as exc:
        trip.delete()
        return Response(
            {"error": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    trip.refresh_from_db()
    return Response(TripSerializer(trip).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
def get_trip(request, trip_id):
    try:
        trip = Trip.objects.prefetch_related("stops").get(pk=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response(TripSerializer(trip).data)


@api_view(["GET"])
def get_trip_logs(request, trip_id):
    try:
        trip = Trip.objects.get(pk=trip_id)
    except Trip.DoesNotExist:
        return Response({"error": "Trip not found"}, status=status.HTTP_404_NOT_FOUND)

    log_days = trip.log_days.prefetch_related("events").all()
    data = {
        "trip_id": trip.id,
        "total_days": log_days.count(),
        "logs": log_days,
    }
    return Response(TripLogsSerializer(data).data)
