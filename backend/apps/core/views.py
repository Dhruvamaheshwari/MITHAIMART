from django.db import connection
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health_check(request):
    """Report API liveness and database connectivity."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database = "ok"
    except Exception:
        database = "unavailable"

    http_status = status.HTTP_200_OK if database == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response(
        {
            "status": "ok" if database == "ok" else "degraded",
            "service": "mithaimart-api",
            "database": database,
        },
        status=http_status,
    )
