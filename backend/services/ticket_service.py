from datetime import datetime, timedelta
from db.database import get_db
from bson import ObjectId

async def create_ticket(feedback_id: str, patient_id: str, patient_name: str,
                        department: str, category: str, severity: int, description: str) -> dict:
    db = get_db()
    ticket = {
        "ticketId": f"TKT-{int(datetime.utcnow().timestamp())}",
        "feedbackId": feedback_id,
        "patientId": patient_id,
        "patientName": patient_name,
        "department": department,
        "category": category,
        "severity": severity,
        "description": description,
        "status": "Open",
        "slaDeadline": datetime.utcnow() + timedelta(minutes=15),
        "slaBreached": False,
        "assignedManagerId": None,
        "assignedManagerName": None,
        "resolutionNote": None,
        "resolvedAt": None,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    result = await db.tickets.insert_one(ticket)
    ticket["_id"] = str(result.inserted_id)
    return ticket


async def check_sla_breaches():
    db = get_db()
    now = datetime.utcnow()
    result = await db.tickets.update_many(
        {"status": {"$ne": "Resolved"}, "slaDeadline": {"$lt": now}, "slaBreached": False},
        {"$set": {"slaBreached": True, "updatedAt": now}}
    )
    return result.modified_count