from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.core.database import get_db_dep
from .auth import get_current_user
from bson import ObjectId
import os, aiohttp, base64, json

router = APIRouter()

# ── Config ────────────────────────────────────────────────────────────────────
PAYPAL_CLIENT_ID     = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
IS_SANDBOX           = os.getenv("PAYPAL_SANDBOX", "false").lower() == "true"
FRONTEND_URL         = os.getenv("FRONTEND_URL", "https://pentaprotocol.com")

PAYPAL_BASE = (
    "https://api-m.sandbox.paypal.com"
    if IS_SANDBOX
    else "https://api-m.paypal.com"
)

# ── USD prices (PayPal is international / USD) ───────────────────────────────
# Approx USD prices for each package
PACKAGES_USD = {
    "starter": {"credits": 100,  "bonus": 0,   "price": "0.99"},
    "plus":    {"credits": 500,  "bonus": 50,  "price": "2.99"},
    "pro":     {"credits": 1000, "bonus": 150, "price": "4.99"},
    "mega":    {"credits": 2000, "bonus": 400, "price": "7.99"},
    "elite":   {"credits": 3000, "bonus": 600, "price": "9.99"},
}
SHARD_PACKAGES_USD = {
    "starter": {"shards": 100,  "bonus": 0,   "price": "0.49"},
    "plus":    {"shards": 500,  "bonus": 50,  "price": "1.49"},
    "pro":     {"shards": 1000, "bonus": 150, "price": "1.99"},
    "mega":    {"shards": 2000, "bonus": 400, "price": "3.99"},
    "elite":   {"shards": 3000, "bonus": 600, "price": "4.99"},
}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_access_token() -> str:
    """Exchange client credentials for a PayPal access token."""
    credentials = base64.b64encode(
        f"{os.getenv('PAYPAL_CLIENT_ID')}:{os.getenv('PAYPAL_CLIENT_SECRET')}".encode()
    ).decode()

    connector = aiohttp.TCPConnector(family=2)  # Force IPv4 for Railway
    async with aiohttp.ClientSession(connector=connector) as session:
        async with session.post(
            f"{PAYPAL_BASE}/v1/oauth2/token",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type":  "application/x-www-form-urlencoded",
            },
            data="grant_type=client_credentials",
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            data = await resp.json()

    if "access_token" not in data:
        raise HTTPException(status_code=500, detail=f"PayPal auth failed: {data}")
    return data["access_token"]


async def _paypal_post(path: str, payload: dict, token: str) -> dict:
    connector = aiohttp.TCPConnector(family=2)
    async with aiohttp.ClientSession(connector=connector) as session:
        async with session.post(
            f"{PAYPAL_BASE}{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type":  "application/json",
            },
            json=payload,
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            return await resp.json()


# ── Create PayPal Order ───────────────────────────────────────────────────────

class CreatePayPalOrderRequest(BaseModel):
    package_id:    str
    currency_type: str = "protocredits"

@router.post("/create-order")
async def create_paypal_order(
    req: CreatePayPalOrderRequest,
    user_id: str = Depends(get_current_user),
):
    currency_type = (req.currency_type or "protocredits").lower()
    table = SHARD_PACKAGES_USD if currency_type == "shards" else PACKAGES_USD
    pkg   = table.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    label = f"{req.package_id.upper()} {'PentaShards' if currency_type == 'shards' else 'ProtoCredits'}"

    try:
        token = await _get_access_token()
        data  = await _paypal_post("/v2/checkout/orders", {
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id":  f"{req.package_id}_{currency_type}_{user_id}",
                "description":   f"PentaProtocol — {label}",
                "amount": {
                    "currency_code": "USD",
                    "value":         pkg["price"],
                },
            }],
            "payment_source": {
                "paypal": {
                    "experience_context": {
                        "brand_name":   "PentaProtocol",
                        "landing_page": "LOGIN",
                        "user_action":  "PAY_NOW",
                        "return_url":   f"{FRONTEND_URL}/payment/paypal/callback",
                        "cancel_url":   f"{FRONTEND_URL}/payment/paypal/cancel",
                    }
                }
            }
        }, token)
    except Exception as e:
        import traceback
        print("PAYPAL CREATE-ORDER ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"PayPal error: {str(e)}")

    if data.get("name") == "INVALID_REQUEST" or "id" not in data:
        print("PAYPAL RESPONSE:", data)
        raise HTTPException(status_code=400, detail=data.get("message", "PayPal order creation failed"))

    # Find the approve URL from HATEOAS links
    approve_url = next(
        (l["href"] for l in data.get("links", []) if l["rel"] == "payer-action"),
        None
    )

    return {
        "order_id":    data["id"],
        "approve_url": approve_url,
    }


# ── Capture PayPal Order (called after user approves) ────────────────────────

class CapturePayPalOrderRequest(BaseModel):
    order_id:      str
    package_id:    str
    currency_type: str = "protocredits"

@router.post("/capture-order")
async def capture_paypal_order(
    req: CapturePayPalOrderRequest,
    user_id: str = Depends(get_current_user),
    db=Depends(get_db_dep),
):
    # Check not already processed
    existing = await db["payments"].find_one({"order_id": req.order_id, "status": "paid"})
    if existing:
        raise HTTPException(status_code=400, detail="Order already processed.")

    try:
        token = await _get_access_token()
        data  = await _paypal_post(f"/v2/checkout/orders/{req.order_id}/capture", {}, token)
    except Exception as e:
        import traceback
        print("PAYPAL CAPTURE ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"PayPal capture error: {str(e)}")

    if data.get("status") != "COMPLETED":
        print("PAYPAL CAPTURE RESPONSE:", data)
        raise HTTPException(status_code=400, detail="Payment not completed.")

    # Extract amount paid
    try:
        amount_paid = data["purchase_units"][0]["payments"]["captures"][0]["amount"]["value"]
    except (KeyError, IndexError):
        amount_paid = "0"

    # Credit the user
    return await _credit_user(
        db=db,
        user_id=user_id,
        order_id=req.order_id,
        package_id=req.package_id,
        currency_type=req.currency_type,
        amount_paid=amount_paid,
        gateway="paypal",
    )


# ── Credit helper (shared logic) ─────────────────────────────────────────────

async def _credit_user(
    db, user_id: str, order_id: str,
    package_id: str, currency_type: str,
    amount_paid: str = "0", gateway: str = "paypal",
):
    table = SHARD_PACKAGES_USD if currency_type == "shards" else PACKAGES_USD
    pkg   = table.get(package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    base  = pkg.get("credits") if currency_type == "protocredits" else pkg.get("shards")
    bonus = pkg.get("bonus") or 0

    # Bonus only on first purchase of this pack
    if currency_type == "shards":
        prior = await db["payments"].count_documents({
            "user_id": user_id, "package_id": package_id,
            "currency_type": "shards", "status": "paid", "gateway": gateway,
        })
    else:
        prior = await db["payments"].count_documents({
            "user_id": user_id, "package_id": package_id,
            "status": "paid", "gateway": gateway,
            "$or": [
                {"currency_type": "protocredits"},
                {"currency_type": {"$exists": False}},
            ],
        })

    bonus_applied = bonus > 0 and prior == 0
    amount_to_add = base + (bonus if bonus_applied else 0)
    inc_field     = "protocredits" if currency_type == "protocredits" else "shards"

    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {inc_field: amount_to_add}},
    )

    await db["payments"].insert_one({
        "order_id":      order_id,
        "user_id":       user_id,
        "package_id":    package_id,
        "currency_type": currency_type,
        "amount_paid":   amount_paid,
        "amount_added":  amount_to_add,
        "bonus_applied": bonus_applied,
        "gateway":       gateway,
        "status":        "paid",
    })

    if currency_type == "shards":
        return {"success": True, "shards_added": amount_to_add, "bonus_applied": bonus_applied}
    return {"success": True, "credits_added": amount_to_add, "bonus_applied": bonus_applied}