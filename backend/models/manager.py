from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Manager(BaseModel):
    managerId: str
    name: str
    role: str = "Duty Manager"             # Duty Manager | Department Head
    department: Optional[str] = None       # None = all departments
    phone: str
    email: Optional[str] = None
    notificationPreference: List[str] = ["push"]
    isOnDuty: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)