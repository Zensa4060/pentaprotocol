import bcrypt
from jose import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
ALGORITHM  = "HS256"
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is required")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# Default JWT lifetime — 12 hours. This is the interim mitigation for
# security-review finding F-03 ("JWT and 2FA device token stored in
# localStorage"): until we migrate session tokens to HttpOnly cookies,
# we shorten the window during which a leaked JWT is useful to an
# attacker. The previous default was 2880 minutes (48 hours).
#
# Operators can still override via the ACCESS_TOKEN_EXPIRE_MINUTES
# environment variable if a longer session is desired (e.g. for
# integration / load-test environments). 12 hours balances usability
# (users rarely need to re-auth during a single day's session) with
# meaningfully reducing the blast radius of a stolen token.
DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 720  # 12 hours

def create_access_token(data: dict, *, sid: str | None = None) -> str:
    expire = datetime.utcnow() + timedelta(
        minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES))
    )
    payload = {**data, "exp": expire}
    if sid:
        payload["sid"] = sid
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])