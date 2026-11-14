import logging

from pymongo.errors import PyMongoError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """Use DRF's normal error handling, but never show raw MongoDB errors to users."""
    response = exception_handler(exc, context)
    if response is None and isinstance(exc, PyMongoError):
        logger.error("MongoDB error: %s", exc)  # full details only go to the server log
        return Response(
            {"error": "Database is temporarily unavailable. Please try again later."},
            status=503,
        )
    return response
