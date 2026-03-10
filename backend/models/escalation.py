from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class Escalation(BaseModel):
    department: str
    category: str
    occurrenceCount: int
    weekStart: datetime
    escalatedTo: Optional[str] = None     # manager _id
    summaryReport: Optional[str] = None
    status: str = "pending"               # pending | sent | acknowledged
    sentAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)