from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException


def user_object_id(user_id: str) -> ObjectId:
    try:
        return ObjectId(user_id)
    except InvalidId:
        raise HTTPException(400, "Invalid account identifier — please sign in again.")
