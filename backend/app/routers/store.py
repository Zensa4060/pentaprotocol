from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.database import get_db_dep
from app.routers.auth import get_current_user
from bson import ObjectId
import razorpay
import hmac, hashlib, os

router = APIRouter()

client = razorpay.Client(auth=(
    os.getenv("RAZORPAY_KEY_ID"),
    os.getenv("RAZORPAY_KEY_SECRET"),
))

PACKAGES = {
    "starter": {"credits": 100,  "bonus": 0,   "price": 4900},
    "plus":    {"credits": 500,  "bonus": 50,  "price": 19900},
    "pro":     {"credits": 1000, "bonus": 150, "price": 34900},
    "mega":    {"credits": 2000, "bonus": 400, "price": 59900},
    "elite":   {"credits": 3000, "bonus": 600, "price": 79900},
}
SHARD_PACKAGES = {
    "starter": {"shards": 100,  "bonus": 0,   "price": 2500},
    "plus":    {"shards": 500,  "bonus": 50,  "price": 9900},
    "pro":     {"shards": 1000, "bonus": 150, "price": 14900},
    "mega":    {"shards": 2000, "bonus": 400, "price": 29900},
    "elite":   {"shards": 3000, "bonus": 600, "price": 39900},
}


async def _purchased_pack_ids_by_lane(db, user_id: str) -> dict[str, list[str]]:
    """Package IDs this user has already paid for, per currency lane (matches verify-payment logic)."""
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
        elif ct == "protocredits" or ct is None:
            pc.add(pid)
    return {"protocredits": sorted(pc), "shards": sorted(sh)}


# ── Create Order ─────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    package_id: str
    currency_type: str = "protocredits"  # protocredits | shards

@router.get("/purchased-packs")
async def get_purchased_packs(user_id: str = Depends(get_current_user), db=Depends(get_db_dep)):
    """Which store packs this account has already bought (PC vs PS separate). Used to hide bonus UI."""
    return await _purchased_pack_ids_by_lane(db, user_id)


@router.post("/create-order")
async def create_order(req: CreateOrderRequest, user_id: str = Depends(get_current_user)):
    currency_type = (req.currency_type or "protocredits").lower()
    package_table = SHARD_PACKAGES if currency_type == "shards" else PACKAGES
    pkg = package_table.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    order = client.order.create({
        "amount":   pkg["price"],
        "currency": "INR",
        "receipt":  f"{user_id}_{req.package_id}",
        "notes": {
            "user_id":    user_id,
            "package_id": req.package_id,
            "currency_type": currency_type,
        }
    })

    return {
        "order_id": order["id"],
        "amount":   order["amount"],
        "currency": order["currency"],
        "key_id":   os.getenv("RAZORPAY_KEY_ID"),
    }

# ── Verify Payment ───────────────────────────────────────────────────────────

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id:   str
    razorpay_payment_id: str
    razorpay_signature:  str
    package_id:          str
    currency_type:       str = "protocredits"  # protocredits | shards

@router.post("/verify-payment")
async def verify_payment(
    req: VerifyPaymentRequest,
    user_id: str = Depends(get_current_user),
    db=Depends(get_db_dep),
):
    """Credit the wallet after Razorpay success.

    Bonus (if any) applies only on the first *paid* completion of that exact
    product: same ``package_id`` (starter / plus / pro / mega / elite) and same
    ``currency_type`` (``protocredits`` vs ``shards``). Re-buying e.g. PLUS
    PentaShards (500+50 @ ₹99) drops the +50 on later buys; other packs keep
    their own first-time bonus until each has been bought once in that lane.
    """
    secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="Payment secret not configured.")

    body = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected = hmac.new(
        secret.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()

    if expected != req.razorpay_signature:
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    existing = await db["payments"].find_one({"order_id": req.razorpay_order_id})
    if existing:
        raise HTTPException(status_code=400, detail="Order already processed.")

    currency_type = (req.currency_type or "protocredits").lower()
    package_table = SHARD_PACKAGES if currency_type == "shards" else PACKAGES
    pkg = package_table.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    base = pkg.get("credits") if currency_type == "protocredits" else pkg.get("shards")
    bonus = pkg.get("bonus") or 0
    # One bonus per (package_id, currency lane). Shards always keyed by currency_type.
    # ProtoCredits: also count legacy rows with no currency_type (pre–dual-currency store).
    if currency_type == "shards":
        prior_paid = await db["payments"].count_documents({
            "user_id": user_id,
            "package_id": req.package_id,
            "currency_type": "shards",
            "status": "paid",
        })
    else:
        prior_paid = await db["payments"].count_documents({
            "user_id": user_id,
            "package_id": req.package_id,
            "status": "paid",
            "$or": [
                {"currency_type": "protocredits"},
                {"currency_type": {"$exists": False}},
            ],
        })
    bonus_applied = bonus > 0 and prior_paid == 0
    amount_to_add = base + (bonus if bonus_applied else 0)

    inc_field = "protocredits" if currency_type == "protocredits" else "shards"
    await db["users"].update_one({"_id": ObjectId(user_id)}, {"$inc": {inc_field: amount_to_add}})

    await db["payments"].insert_one({
        "order_id":   req.razorpay_order_id,
        "payment_id": req.razorpay_payment_id,
        "user_id":    user_id,
        "package_id": req.package_id,
        "currency_type": currency_type,
        "amount_added": amount_to_add,
        "bonus_applied": bonus_applied,
        "status":     "paid",
    })

    if currency_type == "shards":
        return {"success": True, "shards_added": amount_to_add, "bonus_applied": bonus_applied}
    return {"success": True, "credits_added": amount_to_add, "bonus_applied": bonus_applied}


# ── Purchase Cosmetic Item ───────────────────────────────────────────────────

class PurchaseItemRequest(BaseModel):
    item_id: str
    price:   int
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