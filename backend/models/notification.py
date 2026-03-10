from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class Notification(BaseModel):
    managerId: Optional[str] = None
    ticketId: Optional[str] = None
    feedbackId: Optional[str] = None
    type: str                              # critical_alert | escalation | sla_breach | weekly_report
    title: str
    message: str
    urgency: str = "high"                  # low | medium | high | critical
    isRead: bool = False
    readAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)