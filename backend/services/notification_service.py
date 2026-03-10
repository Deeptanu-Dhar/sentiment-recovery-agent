# services/notification_service.py
from datetime import datetime
from db.database import get_db

# Simulated tool: notify_duty_manager(manager_id, ticket_id, urgency)
async def notify_duty_manager(ticket_id: str, urgency: str, title: str, message: str) -> dict:
    db = get_db()

    # Find the on-duty manager
    manager = await db.managers.find_one({"role": "Duty Manager", "isOnDuty": True})
    manager_id = str(manager["_id"]) if manager else None
    manager_name = manager["name"] if manager else "Duty Manager"

    print(f"🚨 [SIMULATED] Push alert → {manager_name} | Ticket: {ticket_id} | Urgency: {urgency}")

    notification = {
        "managerId": manager_id,
        "managerName": manager_name,
        "ticketId": ticket_id,
        "type": "critical_alert",
        "title": title,
        "message": message,
        "urgency": urgency,
        "isRead": False,
        "readAt": None,
        "createdAt": datetime.utcnow(),
    }
    result = await db.notifications.insert_one(notification)
    notification["_id"] = str(result.inserted_id)
    return notification


async def create_notification(ticket_id: str, feedback_id: str, title: str,
                               message: str, urgency: str, notif_type: str) -> dict:
    db = get_db()
    notification = {
        "ticketId": ticket_id,
        "feedbackId": feedback_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "urgency": urgency,
        "isRead": False,
        "readAt": None,
        "createdAt": datetime.utcnow(),
    }
    result = await db.notifications.insert_one(notification)
    notification["_id"] = str(result.inserted_id)
    return notification