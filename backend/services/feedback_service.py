from datetime import datetime
from typing import Any

from bson import ObjectId

from db.database import get_db, get_settings
from services.escalation_service import check_and_escalate
from services.gemini_service import analyze_feedback
from services.notification_service import notify_duty_manager
from services.survey_service import send_resolution_message, send_review_nudge
from services.ticket_service import create_ticket
from services.websocket_service import manager as ws_manager


def _build_existing_response(existing_feedback: dict[str, Any]) -> dict[str, Any]:
    return {
        "success": True,
        "feedbackId": str(existing_feedback["_id"]),
        "analysis": {
            "sentiment": existing_feedback.get("sentiment"),
            "sentimentScore": existing_feedback.get("sentimentScore"),
            "severity": existing_feedback.get("severity"),
            "category": existing_feedback.get("category"),
            "complaintEntities": existing_feedback.get("complaintEntities", []),
            "summary": existing_feedback.get("summary"),
            "resolutionMessage": existing_feedback.get("resolutionMessage"),
        },
        "step2_sentiment": existing_feedback.get("sentiment"),
        "step3_ticketCreated": existing_feedback.get("ticketId"),
        "step3_managerNotified": existing_feedback.get("managerNotified", False),
        "step4_resolutionSent": existing_feedback.get("resolutionMessageSent", False),
        "step5_reviewNudgeSent": existing_feedback.get("reviewNudgeSent", False),
        "duplicate": True,
    }


async def process_feedback_submission(
    patient_id: str,
    patient_name: str,
    department: str,
    raw_text: str,
    source: str = "website",
    source_message_sid: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    settings = get_settings()
    patient = await db.patients.find_one({"patientId": patient_id})
    active_workflow = patient.get("activeWorkflow", {}) if patient else {}
    workflow_run_id = active_workflow.get("runId")

    if source_message_sid:
        existing_feedback = await db.feedbacks.find_one({"sourceMessageSid": source_message_sid})
        if existing_feedback:
            return _build_existing_response(existing_feedback)

    manager_doc = await db.managers.find_one({"role": "Duty Manager", "isOnDuty": True})
    contact_name = manager_doc["name"] if manager_doc else "Patient Experience Desk"

    analysis = await analyze_feedback(
        raw_text,
        patient_name,
        department,
        settings.HOSPITAL_NAME,
        contact_name,
    )
    now = datetime.utcnow()
    feedback_doc: dict[str, Any] = {
        "patientId": patient_id,
        "patientName": patient_name,
        "department": department,
        "rawText": raw_text,
        "source": source,
        "sourceMessageSid": source_message_sid,
        "workflowRunId": workflow_run_id,
        **analysis,
        "resolutionMessageSent": False,
        "reviewNudgeSent": False,
        "managerNotified": False,
        "ticketId": None,
        "submittedAt": now,
        "createdAt": now,
    }
    result = await db.feedbacks.insert_one(feedback_doc)
    feedback_id = str(result.inserted_id)

    await db.patients.update_one(
        {"patientId": patient_id},
        {
            "$set": {
                "surveyStatus": "responded",
                "surveyResponse": raw_text,
                "surveyRespondedAt": now,
                "latestFeedbackId": feedback_id,
                "latestFeedbackAt": now,
                "latestSentiment": analysis["sentiment"],
                "latestSeverity": analysis["severity"],
                "latestCategory": analysis["category"],
                "activeWorkflow.status": "analysis_complete",
                "activeWorkflow.feedbackId": feedback_id,
                "activeWorkflow.feedbackReceivedAt": now,
                "updatedAt": now,
            }
        },
    )

    ticket = None
    notification = None
    resolution = None
    nudge = None

    if analysis["sentiment"] == "Negative":
        ticket = await create_ticket(
            feedback_id=feedback_id,
            patient_id=patient_id,
            patient_name=patient_name,
            department=department,
            category=analysis["category"],
            severity=analysis["severity"],
            description=analysis["summary"],
        )

        notification = await notify_duty_manager(
            ticket_id=ticket["ticketId"],
            urgency="critical" if analysis["severity"] == 5 else "high",
            title=f"Critical Complaint - {department}",
            message=(
                f"Patient {patient_name} reported {analysis['category']}. "
                f"Severity: {analysis['severity']}/5. "
                f"\"{analysis['summary']}\". Respond within 15 minutes."
            ),
        )

        resolution = await send_resolution_message(
            patient_id=patient_id,
            contact_name=contact_name,
            message=analysis["resolutionMessage"],
        )
        await check_and_escalate(department, analysis["category"])
    elif analysis["sentiment"] == "Positive":
        nudge = await send_review_nudge(patient_id, patient_name)
    else:
        resolution = await send_resolution_message(
            patient_id=patient_id,
            contact_name=contact_name,
            message=analysis["resolutionMessage"],
        )

    await db.feedbacks.update_one(
        {"_id": ObjectId(feedback_id)},
        {
            "$set": {
                "ticketId": ticket["ticketId"] if ticket else None,
                "managerNotified": notification is not None,
                "resolutionMessageSent": resolution is not None,
                "reviewNudgeSent": nudge is not None,
                "updatedAt": datetime.utcnow(),
            }
        },
    )

    await db.patients.update_one(
        {"patientId": patient_id},
        {
            "$set": {
                "activeWorkflow.ticketId": ticket["ticketId"] if ticket else None,
                "activeWorkflow.sentiment": analysis["sentiment"],
                "activeWorkflow.severity": analysis["severity"],
                "activeWorkflow.category": analysis["category"],
                "updatedAt": datetime.utcnow(),
            }
        },
    )

    await ws_manager.broadcast(
        {
            "event": "new_feedback",
            "feedbackId": feedback_id,
            "patientId": patient_id,
            "sentiment": analysis["sentiment"],
            "severity": analysis["severity"],
            "department": department,
            "category": analysis["category"],
        }
    )
    await ws_manager.broadcast(
        {
            "event": "patient_workflow_updated",
            "patientId": patient_id,
            "surveyStatus": "responded",
            "feedbackId": feedback_id,
        }
    )

    return {
        "success": True,
        "feedbackId": feedback_id,
        "analysis": analysis,
        "step2_sentiment": analysis["sentiment"],
        "step3_ticketCreated": ticket["ticketId"] if ticket else None,
        "step3_managerNotified": notification is not None,
        "step4_resolutionSent": resolution is not None,
        "step5_reviewNudgeSent": nudge is not None,
    }