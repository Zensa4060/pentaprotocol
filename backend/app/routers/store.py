from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.core.database import get_db_dep
from app.routers.auth import get_current_user, require_legal_accepted
from app.core import security_audit as audit
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
import logging
import re
import random
import time

logger = logging.getLogger("pentaprotocol.store")

router = APIRouter()

# ── Package tables (prices in INR) ───────────────────────────────────────────
#
# The only payment path after Phase 3 trim-down is the operator-verified
# UPI / bank-QR flow. Users scan the posted QR, submit their bank UTR here
# through ``/upi-submit``, and ops manually verifies + credits the account
# (outside this file). Keeping these tables as the canonical source of
# truth for amount + package mapping means the manual-credit tooling and
# this submission endpoint agree on what each pack is worth.

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
    """Return the packs the user has ever purchased.

    Reads the legacy ``payments`` collection so that historical rows
    from earlier gateway integrations still count for 'already owned'
    UI state. Current UPI flow writes to ``upi_payments`` instead;
    the ops approval tool is responsible for mirroring a row into
    ``payments`` if first-purchase bonus tracking matters.
    """
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


@router.get("/purchased-packs")
async def get_purchased_packs(
    user_id: str = Depends(get_current_user),
    db=Depends(get_db_dep),
):
    return await _purchased_pack_ids_by_lane(db, user_id)


# ── UPI / bank-QR payment submission ─────────────────────────────────────────
#
# The user scans the posted QR, pays with any UPI app, and returns to the
# store with a bank reference number (UTR — 6–22 digits depending on bank).
# We record the submission as ``pending`` here; an ops-side tool then
# cross-checks against the bank settlement report and credits manually.
#
# The duplicate-UTR check is the core anti-fraud guard on this endpoint:
# two accounts cannot claim the same UTR.

class UpiSubmitRequest(BaseModel):
    utr: str = Field(min_length=6, max_length=64)
    amount: float = Field(gt=0)
    package_id: str = Field(min_length=2, max_length=32)
    currency_type: str = Field(default="protocredits", max_length=16)


@router.post("/upi-submit")
async def upi_submit(
    req: UpiSubmitRequest,
    user_id: str = Depends(require_legal_accepted),
    db=Depends(get_db_dep),
):
    utr = req.utr.strip()
    if not utr or len(utr) < 6:
        raise HTTPException(status_code=400, detail="Invalid UTR.")

    currency_type = (req.currency_type or "protocredits").lower()
    package_table = SHARD_PACKAGES if currency_type == "shards" else PACKAGES
    pkg = package_table.get(req.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package.")

    # Server-side amount check — user-submitted amount must match the
    # canonical package price. The real verification happens when ops
    # compares to the bank statement, but rejecting obvious mismatches
    # now keeps the pending queue clean.
    if abs(float(req.amount) - float(pkg["price"])) > 0.5:
        audit.log_event(
            event_type=audit.EVENT_PAYMENT_FAIL,
            severity=audit.SEVERITY_WARN,
            user_id=user_id,
            meta={
                "gateway":  "upi",
                "reason":   "amount_mismatch",
                "expected": pkg["price"],
                "got":      req.amount,
                "package":  req.package_id,
            },
        )
        raise HTTPException(status_code=400, detail="Amount does not match package price.")

    existing = await db["upi_payments"].find_one({"utr": utr})
    if existing:
        raise HTTPException(status_code=400, detail="This UTR has already been submitted.")

    await db["upi_payments"].insert_one({
        "user_id":       user_id,
        "utr":           utr,
        "amount":        req.amount,
        "package_id":    req.package_id,
        "currency_type": currency_type,
        "status":        "pending",
        "created_at":    datetime.utcnow(),
    })

    audit.log_event(
        event_type=audit.EVENT_PAYMENT_START,
        user_id=user_id,
        meta={
            "gateway":       "upi",
            "package_id":    req.package_id,
            "currency_type": currency_type,
            "amount":        req.amount,
        },
    )

    return {"message": "Payment submitted for verification. Credits will be added within a few hours."}


# ── Cosmetic item purchase (pure in-game currency — no gateway) ──────────────

class PurchaseItemRequest(BaseModel):
    item_id: str = Field(min_length=2, max_length=64)
    price: int = Field(ge=0, le=50000)
    shard_price: int = Field(default=0, ge=0, le=50000)


_ITEM_PRICE_OVERRIDES: dict[str, tuple[int, int]] = {
    # ── Banners ──────────────────────────────────────────────────────────────
    "digital_rain":    (499, 0),
    "lightsaber_duel": (499, 0),
    "arcade":          (499, 0),
    "hyperdrive":      (499, 0),
    "northern_lights": (499, 0),
    "void_collapse":   (499, 0),
    "lava_flow":       (499, 0),
    "particle_web":    (499, 0),
    "ink_drop":        (499, 0),
    "thunder_storm":   (499, 0),
    "neon_pulse":      (499, 0),
    "deep_sea":        (499, 0),
    "prismatic_light": (499, 0),
    "sand_dunes":      (499, 0),
    "ember_phoenix":   (499, 0),
    "crystal_cave":    (499, 0),
    "hacker_terminal": (499, 0),
    "tidal_surge":     (499, 0),
    "solar_wind":      (499, 0),
    "lava_lamp":       (499, 0),
    "theme_space": (2099, 700),
    "theme_pixel": (2099, 700),
    "space_grid": (900, 300),
    "pixel_grid": (900, 300),
    "coin_bundle_wraith_king": (299, 50),
}


def _item_display_name(item_id: str) -> str:
    return item_id.replace("_", " ").title()


def _canonical_item_price(item_id: str) -> tuple[int, int]:
    if item_id in _ITEM_PRICE_OVERRIDES:
        return _ITEM_PRICE_OVERRIDES[item_id]
    if item_id.endswith("_grid"):
        return (1599, 0)
    if item_id.startswith("piece_"):
        return (599, 0)
    return (-1, -1)


# ── Daily store rotation (server-enforced) ───────────────────────────────────
#
# The store features a small, randomly-selected set of cosmetics that rotates
# every 24h: 1 theme, 2 boards, 2 banners. The selection is deterministic per
# UTC day (seeded by the day index) so every client — web and the rotation
# endpoint and the purchase gate — agrees without any stored state. Items NOT
# in the current rotation cannot be purchased (see ``purchase_item``); they are
# still browsable in the frontend's display-only "All Skins" gallery.

ROTATION_PERIOD_SECONDS = 86_400

# Purchasable pools (item ids only). Mirror of the frontend catalog.
_ROTATION_THEME_POOL: list[str] = ["theme_space", "theme_pixel"]
_ROTATION_BOARD_POOL: list[str] = [
    "red_grid", "ice_grid", "glacier_grid", "bloodmoon_grid", "egypt_grid",
    "synthwave_grid", "matrix_grid", "arcane_grid", "bio_grid", "forge_grid",
    "void_grid", "space_grid", "pixel_grid", "tokyo_grid",
]
_ROTATION_BANNER_POOL: list[str] = [
    "digital_rain", "lightsaber_duel", "arcade", "hyperdrive", "northern_lights",
    "void_collapse", "lava_flow", "particle_web", "ink_drop", "thunder_storm",
    "neon_pulse", "deep_sea", "prismatic_light", "sand_dunes", "ember_phoenix",
    "crystal_cave", "hacker_terminal", "tidal_surge", "solar_wind", "lava_lamp",
]

# Pairings used to expand a rotated item into the full set of ids a purchase of
# that item legitimately touches. Theme bundles buy {theme + board}; board
# bundles buy {board + piece}.
_THEME_BOARD: dict[str, str] = {
    "theme_space": "space_grid",
    "theme_pixel": "pixel_grid",
}
_BOARD_PIECE: dict[str, str] = {
    "red_grid":       "piece_flame_skull",
    "ice_grid":       "piece_snowflake_shard",
    "glacier_grid":   "piece_glacier_shard",
    "bloodmoon_grid": "piece_bloodmoon_sigils",
    "egypt_grid":     "piece_egypt_sigils",
    "synthwave_grid": "piece_synthwave_sigils",
    "matrix_grid":    "piece_matrix_sigils",
    "arcane_grid":    "piece_arcane_sigils",
    "bio_grid":       "piece_bio_sigils",
    "forge_grid":     "piece_forge_sigils",
    "void_grid":      "piece_void_sigils",
    "space_grid":     "piece_space_sigils",
    "pixel_grid":     "piece_pixel_sigils",
    "tokyo_grid":     "piece_tokyo_sigils",
}


def _current_rotation(now: float | None = None) -> dict:
    """Deterministic per-UTC-day rotation: 1 theme, 2 boards, 2 banners."""
    epoch = int(now if now is not None else time.time())
    day_index = epoch // ROTATION_PERIOD_SECONDS
    rng = random.Random(day_index)
    theme = rng.choice(_ROTATION_THEME_POOL)
    boards = rng.sample(_ROTATION_BOARD_POOL, 2)
    banners = rng.sample(_ROTATION_BANNER_POOL, 2)
    expires_epoch = (day_index + 1) * ROTATION_PERIOD_SECONDS
    return {
        "theme": theme,
        "boards": boards,
        "banners": banners,
        "expires_epoch": expires_epoch,
    }


def _rotation_allowed_item_ids(rot: dict) -> set[str]:
    """Every item id purchasable under the given rotation (incl. paired pieces)."""
    allowed: set[str] = set()
    theme = rot["theme"]
    allowed.add(theme)
    board_for_theme = _THEME_BOARD.get(theme)
    if board_for_theme:
        allowed.add(board_for_theme)
        piece = _BOARD_PIECE.get(board_for_theme)
        if piece:
            allowed.add(piece)
    for board in rot["boards"]:
        allowed.add(board)
        piece = _BOARD_PIECE.get(board)
        if piece:
            allowed.add(piece)
    for banner in rot["banners"]:
        allowed.add(banner)
    return allowed


@router.get("/rotation")
async def store_rotation():
    rot = _current_rotation()
    return {
        "theme": rot["theme"],
        "boards": rot["boards"],
        "banners": rot["banners"],
        "expires_at": datetime.utcfromtimestamp(rot["expires_epoch"]).isoformat() + "Z",
    }


@router.post("/purchase-item")
async def purchase_item(
    req: PurchaseItemRequest,
    user_id: str = Depends(require_legal_accepted),
    db=Depends(get_db_dep),
):
    if not re.fullmatch(r"[a-z0-9_]{2,64}", req.item_id):
        raise HTTPException(status_code=400, detail="Malformed item id.")
    canonical_price, canonical_shards = _canonical_item_price(req.item_id)
    if canonical_price < 0:
        raise HTTPException(status_code=400, detail="Unknown item id.")
    if req.price != canonical_price or req.shard_price != canonical_shards:
        raise HTTPException(status_code=400, detail="Invalid price for item.")
    # Only items in the current 24h store rotation may be purchased. Free
    # bot-reward claims use the dedicated /api/profile/claim-* endpoints and
    # are unaffected by this gate.
    if req.item_id not in _rotation_allowed_item_ids(_current_rotation()):
        raise HTTPException(status_code=400, detail="Item not available in the current store rotation.")
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Malformed user id.")
    user = await db["users"].find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if (user.get("protocredits") or 0) < req.price:
        raise HTTPException(status_code=400, detail="Insufficient ProtoCredits.")
    if (user.get("shards") or 0) < req.shard_price:
        raise HTTPException(status_code=400, detail="Insufficient PentaShards.")

    if req.item_id in (user.get("purchased_items") or []):
        raise HTTPException(status_code=400, detail="Item already owned.")

    await db["users"].update_one(
        {"_id": oid},
        {
            "$inc":      {"protocredits": -req.price, "shards": -req.shard_price},
            "$addToSet": {"purchased_items": req.item_id},
        }
    )

    purchased_at = datetime.utcnow()
    item_name = _item_display_name(req.item_id)
    ledger_base = {
        "user_id": user_id,
        "item_id": req.item_id,
        "item_name": item_name,
        "purchased_at": purchased_at,
        "source": "in-game-store",
    }
    if req.price > 0:
        await db["store_purchases"].insert_one({
            **ledger_base,
            "currency_type": "protocredits",
            "amount_spent": req.price,
        })
    if req.shard_price > 0:
        await db["store_purchases"].insert_one({
            **ledger_base,
            "currency_type": "shards",
            "amount_spent": req.shard_price,
        })

    return {"ok": True}
