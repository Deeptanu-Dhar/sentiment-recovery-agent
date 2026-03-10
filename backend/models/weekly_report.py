from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class DepartmentScore(BaseModel):
    department: str
    totalFeedback: int
    negativeCount: int
    avgSeverity: float
    riskLevel: str                         # None | Low | Medium | High | Critical

class WeeklyReport(BaseModel):
    weekStart: datetime
    weekEnd: datetime
    generatedAt: datetime = Field(default_factory=datetime.utcnow)
    totalFeedback: int = 0
    sentimentBreakdown: Dict[str, int] = {"positive": 0, "neutral": 0, "negative": 0}
    avgSeverity: float = 0.0
    topComplaintCategories: List[Dict] = []
    departmentScores: List[DepartmentScore] = []
    resolutionRate: float = 0.0
    slaBreachCount: int = 0
    escalations: List[str] = []
    overallInsight: Optional[str] = None
    recommendedActions: List[str] = []