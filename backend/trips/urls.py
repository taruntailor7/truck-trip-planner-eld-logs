from django.urls import path

from . import views

urlpatterns = [
    path("trips/", views.create_trip, name="create-trip"),
    path("trips/<int:trip_id>/", views.get_trip, name="get-trip"),
    path("trips/<int:trip_id>/logs/", views.get_trip_logs, name="get-trip-logs"),
]
