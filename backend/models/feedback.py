from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Feedback(BaseModel):
    patientId: str
    patientName: str
    department: str
    rawText: str
    source: str = "website"
    sourceMessageSid: Optional[str] = None

    # Gemini analysis results
    sentiment: Optional[str] = None        # Positive | Neutral | Negative
    sentimentScore: Optional[float] = None
    severity: Optional[int] = None         # 1-5
    category: Optional[str] = None
    complaintEntities: Optional[List[str]] = []
    summary: Optional[str] = None
    resolutionMessage: Optional[str] = None

    resolutionMessageSent: bool = False
    resolutionSentAt: Optional[datetime] = None
    reviewNudgeSent: bool = False
    managerNotified: bool = False
    ticketId: Optional[str] = None

    submittedAt: datetime = Field(default_factory=datetime.utcnow)
    createdAt: datetime = Field(default_factory=datetime.utcnow)