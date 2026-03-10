from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from db.database import get_db

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])

class UpdateTicketRequest(BaseModel):
    status: str
    resolutionNote: Optional[str] = None

@router.get("")
async def get_tickets(status: Optional[str] = None):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    tickets = await db.tickets.find(query).sort("createdAt", -1).to_list(length=200)
    for t in tickets:
        t["_id"] = str(t["_id"])
    return tickets

@router.patch("/{ticket_id}")
async def update_ticket(ticket_id: str, body: UpdateTicketRequest):
    db = get_db()
    update = {"status": body.status, "updatedAt": datetime.utcnow()}
    if body.status == "Resolved":
        update["resolvedAt"] = datetime.utcnow()
    if body.resolutionNote:
        update["resolutionNote"] = body.resolutionNote
    await db.tickets.update_one({"ticketId": ticket_id}, {"$set": update})
    return {"success": True}