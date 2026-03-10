from fastapi import APIRouter
from db.database import get_db

router = APIRouter(prefix="/api/heatmap", tags=["Heatmap"])

RISK_LEVELS = {0: "None", 1: "Low", 2: "Medium", 3: "High", 4: "Critical", 5: "Critical"}

@router.get("")
async def get_heatmap():
    db = get_db()
    pipeline = [
        {"$group": {
            "_id": "$department",
            "totalFeedback": {"$sum": 1},
            "negativeCount": {"$sum": {"$cond": [{"$eq": ["$sentiment", "Negative"]}, 1, 0]}},
            "avgSeverity": {"$avg": "$severity"},
        }}
    ]
    results = await db.feedbacks.aggregate(pipeline).to_list(length=50)
    heatmap = []
    for r in results:
        avg_sev = round(r["avgSeverity"] or 0)
        heatmap.append({
            "department": r["_id"],
            "totalFeedback": r["totalFeedback"],
            "negativeCount": r["negativeCount"],
            "avgSeverity": round(r["avgSeverity"] or 0, 2),
            "riskLevel": RISK_LEVELS.get(avg_sev, "None"),
        })
    return heatmap