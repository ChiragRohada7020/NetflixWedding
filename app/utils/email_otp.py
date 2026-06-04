import hashlib
import os
import random
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage


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
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL", username).strip()
    from_name = os.getenv("SMTP_FROM_NAME", "Wedflix").strip()
    use_ssl = os.getenv("SMTP_USE_SSL", "0") == "1"

    if not host or not from_email:
        return False

    greeting = f"Hi {name}," if name else "Hi,"
    message = EmailMessage()
    message["Subject"] = "Your Wedflix signup code"
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                greeting,
                "",
                f"Your Wedflix signup OTP is {otp}.",
                f"It expires in {OTP_TTL_MINUTES} minutes.",
                "",
                "If you did not request this, you can ignore this email.",
            ]
        )
    )

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
