import logging
import threading
from datetime import datetime, timezone
from django.conf import settings
from django.core.mail import send_mail
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.pdf_catalog import generate_catalog_pdf
from config.mongodb import get_db

logger = logging.getLogger(__name__)


@api_view(["GET"])
def health_check(request):
    """Simple endpoint to confirm the API is running."""
    return Response({"message": "MithaiMart API is working", "status": "success"})


def _dispatch_smtp_email(admin_subject, admin_body, from_email, admin_recipient, customer_email, customer_name, query_subject):
    """Sends notification to store admin and auto-acknowledgment to customer in background thread."""
    try:
        # Check if email credentials are set or backend is configured
        send_mail(
            subject=admin_subject,
            message=admin_body,
            from_email=from_email,
            recipient_list=[admin_recipient],
            fail_silently=False,
        )
        logger.info(f"Contact email sent successfully to {admin_recipient}")
    except Exception as smtp_err:
        logger.warning(f"SMTP notification delivery error: {smtp_err}")

    # Customer acknowledgment email
    if customer_email and "@" in customer_email:
        try:
            ack_subject = "We received your message • MithaiMart Sweets & Savouries"
            ack_body = f"""Dear {customer_name},

Thank you for reaching out to MithaiMart! We have received your inquiry regarding "{query_subject or 'our delicacies'}".

Our sweet artisans and support team are reviewing your message and will get back to you shortly.

If your inquiry is urgent regarding an active courier order, you can also reach us via phone/WhatsApp at +91 98765 43210.

Warm regards,
The MithaiMart Family
Handcrafted with 100% Pure Desi Ghee Since 1957
www.mithaimart.com
"""
            send_mail(
                subject=ack_subject,
                message=ack_body,
                from_email=from_email,
                recipient_list=[customer_email],
                fail_silently=True,
            )
        except Exception as e:
            logger.warning(f"SMTP customer ack error: {e}")


@api_view(["POST"])
@permission_classes([AllowAny])
def contact_us(request):
    """Handles Contact Us submissions, records in MongoDB, and dispatches SMTP emails."""
    data = request.data if isinstance(request.data, dict) else {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip()
    phone = str(data.get("phone", "")).strip()
    subject = str(data.get("subject", "")).strip()
    message = str(data.get("message", "")).strip()

    errors = {}
    if not name:
        errors["name"] = "Please enter your name."
    if not email or "@" not in email:
        errors["email"] = "Please enter a valid email address."
    if not message:
        errors["message"] = "Please enter your message."

    if errors:
        return Response({"error": "Invalid data.", "details": errors}, status=status.HTTP_400_BAD_REQUEST)

    now = datetime.now(timezone.utc)

    # 1. Save message to MongoDB
    db = get_db()
    contact_doc = {
        "name": name,
        "email": email,
        "phone": phone,
        "subject": subject or "General Inquiry",
        "message": message,
        "created_at": now,
        "is_read": False,
    }

    try:
        inserted = db.contact_messages.insert_one(contact_doc)
        contact_id = str(inserted.inserted_id)
    except Exception as e:
        logger.error(f"Failed to record contact message in MongoDB: {e}")
        contact_id = None

    # 2. Dispatch via SMTP asynchronously
    admin_recipient = getattr(settings, "CONTACT_RECIPIENT_EMAIL", "contact@mithaimart.com")
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "MithaiMart <noreply@mithaimart.com>")

    email_subject = f"[MithaiMart Contact] {subject or 'New Query from ' + name}"
    email_body = f"""You have received a new customer inquiry from MithaiMart website:

Name: {name}
Email: {email}
Phone: {phone if phone else 'Not provided'}
Subject: {subject if subject else 'General Inquiry'}
Received: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}

--------------------------------------------------
Customer Message:
{message}
--------------------------------------------------

You can reply directly to the customer at: {email}
"""

    # Dispatch in daemon thread so response returns instantly
    smtp_thread = threading.Thread(
        target=_dispatch_smtp_email,
        args=(email_subject, email_body, from_email, admin_recipient, email, name, subject),
        daemon=True,
    )
    smtp_thread.start()

    return Response({
        "status": "success",
        "message": "Thank you! Your message has been sent successfully. Our team will contact you shortly.",
        "reference_id": contact_id,
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def download_catalog_pdf_view(request):
    """Generates and downloads the full MithaiMart sweets and savouries PDF catalog."""
    try:
        pdf_bytes = generate_catalog_pdf()
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="MithaiMart-Sweets-Catalog.pdf"'
        return response
    except Exception as e:
        logger.exception(f"Failed to generate catalog PDF: {e}")
        return Response({"error": "Failed to generate catalog PDF."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
