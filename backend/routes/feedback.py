# routes/feedback.py
from fastapi import APIRouter
from pydantic import BaseModel
from db.database import get_db
from services.feedback_service import process_feedback_submission

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])

class FeedbackRequest(BaseModel):
    patientId: str
    patientName: str
    department: str
    rawText: str

@router.post("/submit")
async def submit_feedback(body: FeedbackRequest):
    return await process_feedback_submission(
        patient_id=body.patientId,
        patient_name=body.patientName,
        department=body.department,
        raw_text=body.rawText,
        source="website",
    )

@router.get("/list")
async def list_feedbacks(limit: int = 50):
    db = get_db()
    feedbacks = await db.feedbacks.find().sort("createdAt", -1).to_list(length=limit)
    for f in feedbacks:
        f["_id"] = str(f["_id"])
    return feedbacks