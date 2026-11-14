from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def health_check(request):
    """Simple endpoint to confirm the API is running."""
    return Response({"message": "MithaiMart API is working", "status": "success"})
