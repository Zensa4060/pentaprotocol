import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import redis
import json

GMAIL_USER = "you@pentaprotocol.com"
GMAIL_APP_PASSWORD = "xxxx xxxx xxxx xxxx"
OTP_EXPIRY = 600  # 10 minutes in seconds

# Redis to store OTPs temporarily
import os
r = redis.Redis.from_url(os.environ.get("redis://default:JdtCPiHGMBKSpXGakdrONjkqthgOpnQO@redis.railway.internal:6379"))

def generate_otp():
    return str(random.randint(100000, 999999))

def send_otp_email(to_email: str, otp: str, purpose: str):
    subjects = {
        "signup": "Verify your email - PentaProtocol",
        "forgot_password": "Reset your password - PentaProtocol",
        "change_password": "Confirm password change - PentaProtocol",
        "change_email": "Verify your new email - PentaProtocol",
    }

    msg = MIMEMultipart()
    msg["From"] = GMAIL_USER
    msg["To"] = to_email
    msg["Subject"] = subjects.get(purpose, "Your OTP - PentaProtocol")

    body = f"""
    Hi,

    Your OTP for {purpose.replace('_', ' ')} is:

    {otp}

    This code expires in 10 minutes.
    If you didn't request this, ignore this email.

    - PentaProtocol Team
    """
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_USER, to_email, msg.as_string())

def create_and_send_otp(email: str, purpose: str) -> bool:
    otp = generate_otp()
    key = f"otp:{purpose}:{email}"
    # Save OTP in Redis with expiry
    r.setex(key, OTP_EXPIRY, json.dumps({"otp": otp, "verified": False}))
    send_otp_email(email, otp, purpose)
    return True

def verify_otp(email: str, purpose: str, otp: str) -> bool:
    key = f"otp:{purpose}:{email}"
    data = r.get(key)
    if not data:
        return False  # expired or never sent
    data = json.loads(data)
    if data["otp"] == otp:
        r.delete(key)  # delete after successful verification
        return True
    return False