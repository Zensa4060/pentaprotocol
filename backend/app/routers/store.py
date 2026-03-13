from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.database import get_db
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
    "pro":     {"credits": 1200, "bonus": 200, "price": 39900},
    "elite":   {"credits": 3000, "bonus": 600, "price": 79900},
}

# ── Create Order ─────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    package_id: str

@router.post("/create-order")
async def create_order(req: CreateOrderRequest, user_id: str = Depends(get_current_user)):
    pkg = PACKAGES.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    order = client.order.create({
        "amount":   pkg["price"],
        "currency": "INR",
        "receipt":  f"{user_id}_{req.package_id}",
        "notes": {
            "user_id":    user_id,
            "package_id": req.package_id,
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

@router.post("/verify-payment")
async def verify_payment(req: VerifyPaymentRequest, user_id: str = Depends(get_current_user), db=Depends(get_db)):
    # 1. Verify signature
    secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="Payment secret not configured.")

    body = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"

    # ✅ BUG FIX 1: was hmac.new(...) which doesn't exist — correct is hmac.new via hmac.new
    # Python's hmac module uses hmac.new() — but the correct modern API is:
    expected = hmac.new(
        secret.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()

    if expected != req.razorpay_signature:
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    # 2. Check order not already fulfilled (prevent double-credit)
    # ✅ BUG FIX 2: db is a Motor async client — must use `await` and async methods
    existing = await db["payments"].find_one({"order_id": req.razorpay_order_id})
    if existing:
        raise HTTPException(status_code=400, detail="Order already processed.")

    # 3. Get package
    pkg = PACKAGES.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    credits_to_add = pkg["credits"] + pkg["bonus"]

    # 4. Add credits to user
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$inc": {"protocredits": credits_to_add}}
    )

    # 5. Record payment so it can't be replayed
    await db["payments"].insert_one({
        "order_id":   req.razorpay_order_id,
        "payment_id": req.razorpay_payment_id,
        "user_id":    user_id,
        "package_id": req.package_id,
        "credits":    credits_to_add,
        "status":     "paid",
    })

    return {"success": True, "credits_added": credits_to_add}


# ── Purchase Cosmetic Item ───────────────────────────────────────────────────

class PurchaseItemRequest(BaseModel):
    item_id: str
    price:   int

@router.post("/purchase-item")
async def purchase_item(req: PurchaseItemRequest, user_id: str = Depends(get_current_user), db=Depends(get_db)):
    # ✅ BUG FIX 2 (same): all db calls need await for async Motor driver
    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if (user.get("protocredits") or 0) < req.price:
        raise HTTPException(status_code=400, detail="Insufficient ProtoCredits.")

    if req.item_id in (user.get("purchased_items") or []):
        raise HTTPException(status_code=400, detail="Item already owned.")

    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$inc":      {"protocredits": -req.price},
            "$addToSet": {"purchased_items": req.item_id},
        }
    )

    return {"ok": True}