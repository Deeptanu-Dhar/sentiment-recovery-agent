from datetime import datetime, timedelta
from db.database import get_db
from services.gemini_service import generate_weekly_summary

async def generate_weekly_report() -> dict:
    db = get_db()
    week_start = datetime.utcnow() - timedelta(days=7)

    feedbacks = await db.feedbacks.find(
        {"submittedAt": {"$gte": week_start}}
    ).to_list(length=500)

    total = len(feedbacks)
    sentiment_breakdown = {"positive": 0, "neutral": 0, "negative": 0}
    severity_sum = 0

    for f in feedbacks:
        s = (f.get("sentiment") or "").lower()
        if s in sentiment_breakdown:
            sentiment_breakdown[s] += 1
        severity_sum += f.get("severity") or 0

    avg_severity = round(severity_sum / total, 2) if total else 0

    # Tickets stats
    total_tickets = await db.tickets.count_documents({"createdAt": {"$gte": week_start}})
    resolved = await db.tickets.count_documents({"createdAt": {"$gte": week_start}, "status": "Resolved"})
    breached = await db.tickets.count_documents({"createdAt": {"$gte": week_start}, "slaBreached": True})
    resolution_rate = round(resolved / total_tickets, 2) if total_tickets else 0

    # Gemini summary
    feed_sample = [{"department": f.get("department"), "sentiment": f.get("sentiment"),
                    "category": f.get("category"), "summary": f.get("summary")} for f in feedbacks]
    gemini_summary = await generate_weekly_summary(feed_sample) if feed_sample else {}

    report = {
        "weekStart": week_start,
        "weekEnd": datetime.utcnow(),
        "generatedAt": datetime.utcnow(),
        "totalFeedback": total,
        "sentimentBreakdown": sentiment_breakdown,
        "avgSeverity": avg_severity,
        "resolutionRate": resolution_rate,
        "slaBreachCount": breached,
        "topComplaintCategories": gemini_summary.get("topComplaintCategories", []),
        "overallInsight": gemini_summary.get("overallInsight", ""),
        "recommendedActions": gemini_summary.get("recommendedActions", []),
        "escalations": [],
    }

    await db.weekly_reports.insert_one(report)
    return report