from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from app.core.database import get_db_dep
from app.routers.auth import get_current_user
from bson import ObjectId
from datetime import datetime
import hmac, hashlib, os, aiohttp

router = APIRouter()

# ── Instamojo config ──────────────────────────────────────────────────────────
INSTAMOJO_API_KEY    = os.getenv("INSTAMOJO_API_KEY", "")
INSTAMOJO_AUTH_TOKEN = os.getenv("INSTAMOJO_AUTH_TOKEN", "")
INSTAMOJO_SALT       = os.getenv("INSTAMOJO_SALT", "")
IS_SANDBOX           = os.getenv("INSTAMOJO_SANDBOX", "true").lower() == "true"
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL          = os.getenv("BACKEND_URL", FRONTEND_URL)

INSTAMOJO_BASE = (
    "https://test.instamojo.com/api/1.1"
    if IS_SANDBOX
    else "https://www.instamojo.com/api/1.1"
)

def _get_headers() -> dict:
    """Build headers at request time so env vars are always fresh."""
    return {
        "X-Api-Key":    os.getenv("INSTAMOJO_API_KEY", ""),
        "X-Auth-Token": os.getenv("INSTAMOJO_AUTH_TOKEN", ""),
    }

# ── Package tables (prices in INR, same as frontend) ─────────────────────────
PACKAGES = {
    "starter": {"credits": 100,  "bonus": 0,   "price": 49},
    "plus":    {"credits": 500,  "bonus": 50,  "price": 199},
    "pro":     {"credits": 1000, "bonus": 150, "price": 349},
    "mega":    {"credits": 2000, "bonus": 400, "price": 599},
    "elite":   {"credits": 3000, "bonus": 600, "price": 799},
}
SHARD_PACKAGES = {
    "starter": {"shards": 100,  "bonus": 0,   "price": 25},
    "plus":    {"shards": 500,  "bonus": 50,  "price": 99},
    "pro":     {"shards": 1000, "bonus": 150, "price": 149},
    "mega":    {"shards": 2000, "bonus": 400, "price": 299},
    "elite":   {"shards": 3000, "bonus": 600, "price": 399},
}


async def _purchased_pack_ids_by_lane(db, user_id: str) -> dict[str, list[str]]:
    pc: set[str] = set()
    sh: set[str] = set()
    async for doc in db["payments"].find(
        {"user_id": user_id, "status": "paid"},
        {"package_id": 1, "currency_type": 1},
    ):
        pid = doc.get("package_id")
        if not pid:
            continue
        ct = doc.get("currency_type")
        if ct == "shards":
            sh.add(pid)
        else:
            pc.add(pid)
    return {"protocredits": sorted(pc), "shards": sorted(sh)}


# ── Purchased packs ───────────────────────────────────────────────────────────

@router.get("/purchased-packs")
async def get_purchased_packs(
    user_id: str = Depends(get_current_user),
    db=Depends(get_db_dep),
):
    return await _purchased_pack_ids_by_lane(db, user_id)


# ── Create Instamojo payment request ─────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    package_id:    str
    currency_type: str = "protocredits"
    buyer_name:    str = "Player"
    email:         str = ""
    phone:         str = "9999999999"

@router.post("/create-order")
async def create_order(
    req: CreateOrderRequest,
    user_id: str = Depends(get_current_user),
):
    currency_type  = (req.currency_type or "protocredits").lower()
    package_table  = SHARD_PACKAGES if currency_type == "shards" else PACKAGES
    pkg            = package_table.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    label = f"{req.package_id.upper()} {'PentaShards' if currency_type == 'shards' else 'ProtoCredits'}"
    purpose = f"{label} [ref:{req.package_id}_{currency_type}] [uid:{user_id}]"

    payload = {
        "purpose":                purpose,
        "amount":                 str(pkg["price"]),
        "buyer_name":             req.buyer_name,
        "email":                  req.email,
        "phone":                  req.phone,
        "send_email":             False,
        "send_sms":               False,
        "allow_repeated_payments": True,
        "redirect_url":           f"{FRONTEND_URL}/payment/callback",
        "webhook":                f"{BACKEND_URL}/api/store/webhook",
    }

    try:
        connector = aiohttp.TCPConnector(family=2)
        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.post(
                f"{INSTAMOJO_BASE}/payment-requests/",
                data=payload,
                headers=_get_headers(),
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                data = await resp.json()
    except Exception as e:
        import traceback
        print("INSTAMOJO CREATE-ORDER ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Payment gateway error: {str(e)}")

    if not data.get("success"):
        print("INSTAMOJO RESPONSE:", data)
        raise HTTPException(
            status_code=400,
            detail=data.get("message", "Failed to create payment request"),
        )

    pr = data["payment_request"]
    return {
        "payment_request_id": pr["id"],
        "redirect_url":       pr["longurl"],
    }


# ── Verify payment (called by frontend after redirect back) ───────────────────

class VerifyPaymentRequest(BaseModel):
    payment_id:         str
    payment_request_id: str
    payment_status:     str

@router.post("/verify-payment")
async def verify_payment(
    req: VerifyPaymentRequest,
    user_id: str = Depends(get_current_user),
    db=Depends(get_db_dep),
):
    if req.payment_status != "Credit":
        raise HTTPException(status_code=400, detail="Payment not completed.")

    connector = aiohttp.TCPConnector(family=2)
    async with aiohttp.ClientSession(connector=connector) as session:
        async with session.get(
            f"{INSTAMOJO_BASE}/payment-requests/{req.payment_request_id}/{req.payment_id}/",
            headers=_get_headers(),
            timeout=aiohttp.ClientTimeout(total=15),
        ) as resp:
            data = await resp.json()
    if not data.get("success"):
        raise HTTPException(status_code=400, detail="Could not verify payment with Instamojo.")

    payment = data["payment_request"]["payment"]
    if payment.get("status") != "Credit":
        raise HTTPException(status_code=400, detail="Payment not confirmed by Instamojo.")

    purpose = data["payment_request"].get("purpose", "")
    package_id, currency_type = _parse_purpose(purpose)
    if not package_id:
        raise HTTPException(status_code=400, detail="Could not parse package from payment.")

    return await _credit_user(
        db=db,
        user_id=user_id,
        payment_id=req.payment_id,
        payment_request_id=req.payment_request_id,
        package_id=package_id,
        currency_type=currency_type,
    )


# ── Webhook (Instamojo POSTs here after every payment) ───────────────────────

@router.post("/webhook")
async def instamojo_webhook(request: Request, db=Depends(get_db_dep)):
    form = await request.form()
    data = dict(form)

    mac_provided = data.get("mac")
    if not mac_provided:
        raise HTTPException(status_code=400, detail="Missing MAC")

    if not _verify_mac(data, mac_provided):
        raise HTTPException(status_code=403, detail="Invalid MAC signature")

    if data.get("status") != "Credit":
        return {"status": "ignored"}

    payment_id         = data.get("payment_id", "")
    payment_request_id = data.get("payment_request_id", "")
    purpose            = data.get("purpose", "")

    existing = await db["payments"].find_one({"payment_id": payment_id, "status": "paid"})
    if existing:
        return {"status": "already_processed"}

    package_id, currency_type = _parse_purpose(purpose)
    if not package_id:
        return {"status": "unknown_package"}

    user_id = _parse_uid(purpose)
    if not user_id:
        return {"status": "unknown_user"}

    await _credit_user(
        db=db,
        user_id=user_id,
        payment_id=payment_id,
        payment_request_id=payment_request_id,
        package_id=package_id,
        currency_type=currency_type,
    )

    return {"status": "ok"}


# ── UPI / QR Code Payment Submission ─────────────────────────────────────────

class UpiSubmitRequest(BaseModel):
    utr:           str
    amount:        float
    package_id:    str
    currency_type: str = "protocredits"

@router.post("/upi-submit")
async def upi_submit(
    req: UpiSubmitRequest,
    user_id: str = Depends(get_current_user),
    db=Depends(get_db_dep),
):
    if not req.utr or len(req.utr.strip()) < 6:
        raise HTTPException(status_code=400, detail="Invalid UTR.")

    package_table = SHARD_PACKAGES if req.currency_type == "shards" else PACKAGES
    pkg = package_table.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    # Prevent duplicate UTR submissions
    existing = await db["upi_payments"].find_one({"utr": req.utr.strip()})
    if existing:
        raise HTTPException(status_code=400, detail="This UTR has already been submitted.")

    await db["upi_payments"].insert_one({
        "user_id":       user_id,
        "utr":           req.utr.strip(),
        "amount":        req.amount,
        "package_id":    req.package_id,
        "currency_type": req.currency_type,
        "status":        "pending",
        "created_at":    datetime.utcnow(),
    })

    return {"message": "Payment submitted for verification. Credits will be added within a few hours."}


# ── Purchase Cosmetic Item ────────────────────────────────────────────────────

class PurchaseItemRequest(BaseModel):
    item_id:     str
    price:       int
    shard_price: int = 0

@router.post("/purchase-item")
async def purchase_item(
    req: PurchaseItemRequest,
    user_id: str = Depends(get_current_user),
    db=Depends(get_db_dep),
):
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if (user.get("protocredits") or 0) < req.price:
        raise HTTPException(status_code=400, detail="Insufficient ProtoCredits.")
    if (user.get("shards") or 0) < req.shard_price:
        raise HTTPException(status_code=400, detail="Insufficient PentaShards.")

    if req.item_id in (user.get("purchased_items") or []):
        raise HTTPException(status_code=400, detail="Item already owned.")

    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$inc":      {"protocredits": -req.price, "shards": -req.shard_price},
            "$addToSet": {"purchased_items": req.item_id},
        }
    )

    return {"ok": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _verify_mac(data: dict, mac_provided: str) -> bool:
    mac_data = {k: v for k, v in data.items() if k != "mac"}
    sorted_values = "|".join(
        str(v) for _, v in sorted(mac_data.items(), key=lambda x: x[0].lower())
    )
    mac_calculated = hmac.new(
        INSTAMOJO_SALT.encode("utf-8"),
        sorted_values.encode("utf-8"),
        hashlib.sha1,
    ).hexdigest()
    return hmac.compare_digest(mac_calculated, mac_provided)


def _parse_purpose(purpose: str):
    import re
    match = re.search(r"\[ref:([a-z]+)_(protocredits|shards)\]", purpose)
    if match:
        return match.group(1), match.group(2)
    return None, "protocredits"


def _parse_uid(purpose: str):
    import re
    match = re.search(r"\[uid:([^\]]+)\]", purpose)
    return match.group(1) if match else None


async def _credit_user(
    db, user_id: str, payment_id: str, payment_request_id: str,
    package_id: str, currency_type: str,
):
    package_table = SHARD_PACKAGES if currency_type == "shards" else PACKAGES
    pkg = package_table.get(package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    base  = pkg.get("credits") if currency_type == "protocredits" else pkg.get("shards")
    bonus = pkg.get("bonus") or 0

    if currency_type == "shards":
        prior = await db["payments"].count_documents({
            "user_id": user_id, "package_id": package_id,
            "currency_type": "shards", "status": "paid",
        })
    else:
        prior = await db["payments"].count_documents({
            "user_id": user_id, "package_id": package_id,
            "status": "paid",
            "$or": [
                {"currency_type": "protocredits"},
                {"currency_type": {"$exists": False}},
            ],
        })

    bonus_applied  = bonus > 0 and prior == 0
    amount_to_add  = base + (bonus if bonus_applied else 0)
    inc_field      = "protocredits" if currency_type == "protocredits" else "shards"

    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {inc_field: amount_to_add}},
    )

    await db["payments"].insert_one({
        "payment_id":         payment_id,
        "payment_request_id": payment_request_id,
        "user_id":            user_id,
        "package_id":         package_id,
        "currency_type":      currency_type,
        "amount_added":       amount_to_add,
        "bonus_applied":      bonus_applied,
        "status":             "paid",
    })

    if currency_type == "shards":
        return {"success": True, "shards_added": amount_to_add, "bonus_applied": bonus_applied}
    return {"success": True, "credits_added": amount_to_add, "bonus_applied": bonus_applied}