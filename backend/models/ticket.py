from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class Ticket(BaseModel):
    ticketId: str
    feedbackId: Optional[str] = None
    patientId: str
    patientName: str
    department: str
    category: str
    severity: int                          # 1-5
    description: str
    status: str = "Open"                   # Open | In Progress | Resolved
    slaDeadline: Optional[datetime] = None
    slaBreached: bool = False
    assignedManagerId: Optional[str] = None
    assignedManagerName: Optional[str] = None
    resolutionNote: Optional[str] = None
    resolvedAt: Optional[datetime] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)