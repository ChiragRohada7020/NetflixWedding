import hashlib
import os
import random
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import requests


OTP_TTL_MINUTES = int(os.getenv("WEDFLIX_OTP_TTL_MINUTES", "10"))


def generate_otp():
    return f"{random.SystemRandom().randint(0, 999999):06d}"


def hash_otp(email, otp):
    secret = os.getenv("SECRET_KEY", "change-me")
    value = f"{email.lower()}:{otp}:{secret}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def otp_expires_at():
    return datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)


def send_signup_otp(email, otp, name=""):
    return send_otp_email(email, otp, name=name, purpose="signup")


def send_password_reset_otp(email, otp, name=""):
    return send_otp_email(email, otp, name=name, purpose="password_reset")


def email_delivery_configured():
    return bool(_brevo_configured() or _resend_configured() or _smtp_configured())


def email_delivery_summary():
    brevo_from = os.getenv("BREVO_FROM_EMAIL", "").strip()
    resend_from = os.getenv("RESEND_FROM_EMAIL", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_from = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip()
    provider = "brevo" if _brevo_configured() else "resend" if _resend_configured() else "smtp" if _smtp_configured() else "none"
    return {
        "configured": email_delivery_configured(),
        "provider": provider,
        "brevo_configured": _brevo_configured(),
        "resend_configured": _resend_configured(),
        "smtp_configured": _smtp_configured(),
        "smtp_host": os.getenv("SMTP_HOST", "").strip() or "(missing)",
        "smtp_port": os.getenv("SMTP_PORT", "587").strip(),
        "from_email": brevo_from or resend_from or smtp_from or "(missing)",
    }


def _brevo_configured():
    return bool(os.getenv("BREVO_API_KEY", "").strip() and os.getenv("BREVO_FROM_EMAIL", "").strip())


def _resend_configured():
    return bool(os.getenv("RESEND_API_KEY", "").strip() and os.getenv("RESEND_FROM_EMAIL", "").strip())


def _smtp_configured():
    username = os.getenv("SMTP_USER", "").strip()
    return bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM_EMAIL", username).strip())


def send_otp_email(email, otp, name="", purpose="signup"):
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    brevo_api_key = os.getenv("BREVO_API_KEY", "").strip()
    brevo_from_email = os.getenv("BREVO_FROM_EMAIL", "").strip()
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    resend_from_email = os.getenv("RESEND_FROM_EMAIL", "").strip()
    from_email = brevo_from_email or resend_from_email or os.getenv("SMTP_FROM_EMAIL", username).strip()
    from_name = os.getenv("BREVO_FROM_NAME", os.getenv("RESEND_FROM_NAME", os.getenv("SMTP_FROM_NAME", "Wedflix"))).strip()
    use_ssl = os.getenv("SMTP_USE_SSL", "0") == "1"

    if not _brevo_configured() and not _resend_configured() and not _smtp_configured():
        return False

    heading = "Confirm your Wedflix signup" if purpose == "signup" else "Reset your Wedflix password"
    subheading = (
        "Your personal streaming space is almost ready."
        if purpose == "signup"
        else "Use this code to set a new password for your account."
    )
    preview = f"Your Wedflix OTP is {otp}. It expires in {OTP_TTL_MINUTES} minutes."
    greeting = f"Hi {name}," if name else "Hi,"
    message = EmailMessage()
    message["Subject"] = "Your Wedflix verification code"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = email
    message["X-Priority"] = "1"
    message.set_content(
        "\n".join(
            [
                greeting,
                "",
                heading,
                "",
                preview,
                "",
                subheading,
                "",
                "Wedflix turns your stories into a Netflix-like experience for the people you choose.",
                "",
                "Keep this code private. Wedflix will never ask for it outside the login screen.",
            ]
        )
    )
    message.add_alternative(
        f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;">{preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#080808;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111111;border:1px solid #2a2a2a;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;background:linear-gradient(135deg,#120708,#26090c 52%,#080808);">
                <div style="font-size:34px;line-height:1;font-weight:900;letter-spacing:1px;color:#e50914;">WEDFLIX</div>
                <p style="margin:14px 0 0;color:#f4f4f4;font-size:15px;">{subheading}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <p style="margin:0 0 10px;color:#cfcfcf;font-size:15px;">{greeting}</p>
                <h1 style="margin:0 0 18px;color:#ffffff;font-size:26px;line-height:1.2;">{heading}</h1>
                <p style="margin:0 0 18px;color:#d8d8d8;font-size:15px;line-height:1.6;">Enter this verification code in Wedflix to continue.</p>
                <div style="margin:24px 0;padding:18px 20px;background:#000000;border:1px solid #3a3a3a;border-radius:14px;text-align:center;">
                  <div style="font-size:38px;letter-spacing:10px;font-weight:800;color:#ffffff;">{otp}</div>
                </div>
                <p style="margin:0 0 18px;color:#b8b8b8;font-size:14px;line-height:1.6;">This code expires in <strong style="color:#ffffff;">{OTP_TTL_MINUTES} minutes</strong>. Keep it private; Wedflix will never ask for it outside the login screen.</p>
                <p style="margin:0;color:#777;font-size:13px;line-height:1.5;">If you did not request this, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#0b0b0b;border-top:1px solid #242424;color:#777;font-size:12px;">
                Wedflix - your life, stories, and memories in a private streaming experience.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""",
        subtype="html",
    )

    if brevo_api_key and brevo_from_email:
        html_body = message.get_body(("html",)).get_content()
        text_body = message.get_body(("plain",)).get_content()
        response = requests.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": brevo_api_key, "Content-Type": "application/json"},
            json={
                "sender": {"name": from_name, "email": brevo_from_email},
                "to": [{"email": email}],
                "subject": message["Subject"],
                "textContent": text_body,
                "htmlContent": html_body,
            },
            timeout=20,
        )
        response.raise_for_status()
        return True

    if resend_api_key and resend_from_email:
        html_body = message.get_body(("html",)).get_content()
        text_body = message.get_body(("plain",)).get_content()
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {resend_api_key}", "Content-Type": "application/json"},
            json={
                "from": f"{from_name} <{resend_from_email}>",
                "to": [email],
                "subject": message["Subject"],
                "text": text_body,
                "html": html_body,
            },
            timeout=20,
        )
        response.raise_for_status()
        return True

    if use_ssl:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=20) as server:
            if username and password:
                server.login(username, password)
            server.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.starttls(context=ssl.create_default_context())
            if username and password:
                server.login(username, password)
            server.send_message(message)
    return True
