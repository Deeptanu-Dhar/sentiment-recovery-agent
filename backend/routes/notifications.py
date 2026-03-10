from fastapi import APIRouter
from datetime import datetime
from db.database import get_db

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("")
async def get_notifications():
    db = get_db()
    notifs = await db.notifications.find().sort("createdAt", -1).to_list(length=100)
    for n in notifs:
        n["_id"] = str(n["_id"])
    return notifs

@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str):
    from bson import ObjectId
    db = get_db()
    await db.notifications.update_one(
        {"_id": ObjectId(notif_id)},
        {"$set": {"isRead": True, "readAt": datetime.utcnow()}}
    )
    return {"success": True}

@router.patch("/read-all")
async def mark_all_read():
    db = get_db()
    await db.notifications.update_many(
        {"isRead": False},
        {"$set": {"isRead": True, "readAt": datetime.utcnow()}}
    )
    return {"success": True}