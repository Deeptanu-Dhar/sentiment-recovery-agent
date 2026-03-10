from datetime import datetime, timedelta
from db.database import get_db

async def check_and_escalate(department: str, category: str):
    db = get_db()
    week_start = datetime.utcnow() - timedelta(days=7)

    count = await db.tickets.count_documents({
        "department": department,
        "category": category,
        "createdAt": {"$gte": week_start}
    })

    if count > 3:
        existing = await db.escalations.find_one({
            "department": department,
            "category": category,
            "weekStart": {"$gte": week_start}
        })
        if not existing:
            escalation = {
                "department": department,
                "category": category,
                "occurrenceCount": count,
                "weekStart": week_start,
                "summaryReport": f"{count} complaints about '{category}' in {department} this week. Immediate review required.",
                "status": "sent",
                "sentAt": datetime.utcnow(),
                "createdAt": datetime.utcnow(),
            }
            await db.escalations.insert_one(escalation)

            # Also create a notification for it
            await db.notifications.insert_one({
                "type": "escalation",
                "title": f"🚨 Escalation: {department} — {category}",
                "message": f"{count} patients complained about '{category}' in {department} this week. Auto-escalated to Department Head.",
                "urgency": "critical",
                "isRead": False,
                "readAt": None,
                "createdAt": datetime.utcnow(),
            })
            print(f"🚨 Escalation triggered: {department} / {category} ({count} times)")