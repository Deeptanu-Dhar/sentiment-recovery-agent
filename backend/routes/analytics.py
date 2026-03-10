from fastapi import APIRouter
from db.database import get_db
from services.report_service import generate_weekly_report

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@router.get("/weekly")
async def get_weekly_report():
    report = await generate_weekly_report()
    if "_id" in report:
        report["_id"] = str(report["_id"])
    return report

@router.get("/summary")
async def get_summary():
    db = get_db()
    total_feedback = await db.feedbacks.count_documents({})
    open_tickets = await db.tickets.count_documents({"status": "Open"})
    critical_alerts = await db.notifications.count_documents({"urgency": {"$in": ["critical", "high"]}, "isRead": False})

    pipeline = [{"$group": {"_id": None, "avgSeverity": {"$avg": "$severity"}}}]
    sev_result = await db.feedbacks.aggregate(pipeline).to_list(1)
    avg_severity = round(sev_result[0]["avgSeverity"], 2) if sev_result else 0

    sentiment_pipeline = [{"$group": {"_id": "$sentiment", "count": {"$sum": 1}}}]
    sentiments = await db.feedbacks.aggregate(sentiment_pipeline).to_list(10)
    sentiment_map = {s["_id"]: s["count"] for s in sentiments if s["_id"]}

    category_pipeline = [
        {"$match": {"sentiment": "Negative"}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 5}
    ]
    categories = await db.feedbacks.aggregate(category_pipeline).to_list(5)

    return {
        "totalFeedback": total_feedback,
        "openTickets": open_tickets,
        "criticalAlerts": critical_alerts,
        "avgSeverity": avg_severity,
        "sentimentDistribution": sentiment_map,
        "topCategories": [{"category": c["_id"], "count": c["count"]} for c in categories],
    }