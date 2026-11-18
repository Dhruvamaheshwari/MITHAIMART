from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class TolerantJWTAuthentication(JWTAuthentication):
    """Default login check for the public APIs (product list, categories, health...).

    A logged-in CUSTOMER also sends a token, but it is a different kind of token than the admin one.
    The strict admin check would answer "401 invalid token" and break the public pages for every
    logged-in customer. So here a token that is not a valid admin token simply means "not an admin"
    and the request goes on as an ordinary visitor.

    This is safe because the admin APIs do not use this class: they use the strict JWTAuthentication
    (see admin_view in apps/accounts/admin_views.py), and write actions still need a real staff user.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:  # includes InvalidToken
            return None
