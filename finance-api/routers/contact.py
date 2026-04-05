"""
routers/contact.py — Public contact form endpoint.

Endpoints:
    POST /contact   → Submit a contact form message

No authentication required — this is called from the public landing page.
Submissions are logged to the contact_submissions table and two emails are
sent via AWS SES:
  1. A confirmation to the user.
  2. A notification to the owner (CONTACT_TO_EMAIL).
"""

import os
import re

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from supabase import Client

from middleware.auth import get_supabase_client

router = APIRouter(prefix="/contact", tags=["contact"])

_VALID_SUBJECTS = {"Feature Request", "Bug Report", "Support", "Other"}  # mirrors frontend CONTACT_SUBJECTS
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str

    @field_validator("name", "email", "subject", "message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Field must not be blank.")
        return v.strip()

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address.")
        return v.lower()

    @field_validator("subject")
    @classmethod
    def valid_subject(cls, v: str) -> str:
        if v not in _VALID_SUBJECTS:
            raise ValueError(f"subject must be one of: {', '.join(sorted(_VALID_SUBJECTS))}")
        return v


# ---------------------------------------------------------------------------
# SES helper
# ---------------------------------------------------------------------------

def _ses_client():
    return boto3.client(
        "ses",
        region_name=os.environ["AWS_REGION"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def _send_confirmation(ses, payload: ContactRequest) -> None:
    """Send a receipt confirmation to the person who submitted the form."""
    from_email = os.environ["SES_FROM_EMAIL"]
    ses.send_email(
        Source=from_email,
        Destination={"ToAddresses": [payload.email]},
        Message={
            "Subject": {"Data": "We received your message — BudgIt Buddy"},
            "Body": {
                "Text": {
                    "Data": "\n".join([
                        f"Hi {payload.name},",
                        "",
                        "Thanks for reaching out! We've received your message and will get back to you as soon as possible.",
                        "",
                        "--- Your submission ---",
                        f"Subject: {payload.subject}",
                        f"Message: {payload.message}",
                        "----------------------",
                        "",
                        "Best,",
                        "The BudgIt Buddy Team",
                    ]),
                },
                "Html": {
                    "Data": f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:32px 24px;">
  <h2 style="color:#67e7a9;margin-bottom:4px;">BudgIt Buddy</h2>
  <p style="color:#888;font-size:13px;margin-top:0;">We've got your message</p>
  <p>Hi <strong>{payload.name}</strong>,</p>
  <p>Thanks for reaching out! We've received your message and will get back to you as soon as possible.</p>
  <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:24px 0;">
    <p style="margin:0 0 8px;font-size:13px;color:#555;"><strong>Subject:</strong> {payload.subject}</p>
    <p style="margin:0;font-size:13px;color:#555;"><strong>Message:</strong><br>{payload.message.replace(chr(10), '<br>')}</p>
  </div>
  <p style="font-size:13px;color:#888;">Best,<br>The BudgIt Buddy Team</p>
</body>
</html>""",
                },
            },
        },
    )


def _send_owner_notification(ses, payload: ContactRequest) -> None:
    """Send submission details to the owner. Reply-To is set to the user's email."""
    from_email = os.environ["SES_FROM_EMAIL"]
    to_email   = os.environ["CONTACT_TO_EMAIL"]
    ses.send_email(
        Source=from_email,
        ReplyToAddresses=[payload.email],
        Destination={"ToAddresses": [to_email]},
        Message={
            "Subject": {"Data": f"[Contact Form] {payload.subject} — from {payload.name}"},
            "Body": {
                "Text": {
                    "Data": "\n".join([
                        "New contact form submission",
                        "",
                        f"Name:    {payload.name}",
                        f"Email:   {payload.email}",
                        f"Subject: {payload.subject}",
                        "",
                        "Message:",
                        payload.message,
                    ]),
                },
                "Html": {
                    "Data": f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:32px 24px;">
  <h3 style="margin-bottom:4px;">New Contact Form Submission</h3>
  <p style="color:#888;font-size:13px;margin-top:0;">BudgIt Buddy</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <tr><td style="padding:6px 0;color:#555;width:80px;"><strong>Name</strong></td><td style="padding:6px 0;">{payload.name}</td></tr>
    <tr><td style="padding:6px 0;color:#555;"><strong>Email</strong></td><td style="padding:6px 0;"><a href="mailto:{payload.email}">{payload.email}</a></td></tr>
    <tr><td style="padding:6px 0;color:#555;"><strong>Subject</strong></td><td style="padding:6px 0;">{payload.subject}</td></tr>
  </table>
  <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0;font-size:14px;">{payload.message.replace(chr(10), '<br>')}</p>
  </div>
</body>
</html>""",
                },
            },
        },
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/", status_code=status.HTTP_200_OK)
def submit_contact(
    payload: ContactRequest,
    request: Request,
    supabase: Client = Depends(get_supabase_client),
):
    """
    Submit a contact form message.

    Logs the submission to contact_submissions and sends two emails via SES:
    a confirmation to the user and a notification to the owner.
    """
    ip = request.client.host if request.client else None

    # Log to DB first — if SES fails we still have the submission
    supabase.table("contact_submissions").insert({
        "name":       payload.name,
        "email":      payload.email,
        "subject":    payload.subject,
        "message":    payload.message,
        "ip_address": ip,
    }).execute()

    # Send emails
    try:
        ses = _ses_client()
        _send_confirmation(ses, payload)
        _send_owner_notification(ses, payload)
    except (BotoCoreError, ClientError) as exc:
        # Submission is already logged; don't fail the request, just log the error
        import logging
        logging.getLogger(__name__).error("[contact] SES send failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Message saved but email delivery failed. We'll still get back to you.",
        )

    return {"success": True}
