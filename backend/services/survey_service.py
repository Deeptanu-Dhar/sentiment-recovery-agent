from datetime import datetime
import re
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from db.database import get_db, get_settings
from services.twilio_service import normalize_phone_number, send_whatsapp_message


def _build_message_event(
    direction: str,
    message_type: str,
    body: str,
    phone: str,
    twilio_sid: str | None = None,
    status: str | None = None,
    sender_name: str | None = None,
) -> dict[str, Any]:
    return {
        "direction": direction,
        "type": message_type,
        "body": body,
        "phone": phone,
        "senderName": sender_name,
        "twilioSid": twilio_sid,
        "status": status,
        "createdAt": datetime.utcnow(),
    }


def _compose_survey_message(patient_name: str, department: str, hospital_name: str) -> str:
    return (
        f"Hello {patient_name}, this is the care team at {hospital_name}. "
        f"We hope you are settling in well after your visit to {department}. "
        "When you have a moment, please reply here with your feedback about your care, staff, billing, or any issue you would like us to review."
    )


def _compose_review_nudge_message(patient_name: str, hospital_name: str, review_link: str) -> str:
    return (
        f"Hello {patient_name}, thank you for your kind feedback about {hospital_name}. "
        "We are glad your experience was positive. "
        f"If you would like to share a short public review, you can do so here: {review_link}"
    )


def _finalize_resolution_message(message: str, contact_name: str, hospital_name: str) -> str:
    normalized_message = re.sub(r"\s+", " ", (message or "").strip())
    if not normalized_message:
        normalized_message = (
            f"Thank you for sharing your feedback. We are reviewing your concern and will follow up shortly. "
            f"Your point of contact is {contact_name}."
        )

    if contact_name and contact_name.lower() not in normalized_message.lower():
        normalized_message = f"{normalized_message} Your point of contact is {contact_name}."

    signoff_candidates = [
        f"Regards, {hospital_name}",
        hospital_name,
        "Hospital Management Team",
    ]
    if not any(candidate.lower() in normalized_message.lower() for candidate in signoff_candidates if candidate):
        normalized_message = f"{normalized_message} Regards, {hospital_name}"

    return normalized_message.strip()


def _patient_match_sort_key(patient: dict[str, Any]) -> tuple[int, datetime, datetime, datetime]:
    workflow = patient.get("activeWorkflow") or {}
    status = str(workflow.get("status") or "")
    status_priority = {
        "survey_sent": 5,
        "response_received": 4,
        "analysis_complete": 3,
        "resolution_sent": 2,
        "positive_follow_up_sent": 1,
    }.get(status, 0)
    workflow_started = workflow.get("startedAt") or datetime.min
    survey_sent_at = patient.get("surveySentAt") or datetime.min
    updated_at = patient.get("updatedAt") or datetime.min
    return (status_priority, workflow_started, survey_sent_at, updated_at)


async def find_patient_by_phone(phone: str) -> dict[str, Any] | None:
    db = get_db()
    normalized = normalize_phone_number(phone)
    matches = await db.patients.find(
        {
            "$or": [
                {"phone": normalized},
                {"whatsappNumber": normalized},
                {"phone": phone},
                {"whatsappNumber": phone},
            ]
        }
    ).to_list(length=50)
    if not matches:
        return None

    matches.sort(key=_patient_match_sort_key, reverse=True)
    selected = matches[0]

    if len(matches) > 1:
        print(
            "📲 WhatsApp inbound matched multiple patients",
            {
                "phone": normalized,
                "selectedPatientId": selected.get("patientId"),
                "selectedWorkflow": (selected.get("activeWorkflow") or {}).get("runId"),
                "candidates": [
                    {
                        "patientId": match.get("patientId"),
                        "workflowRunId": (match.get("activeWorkflow") or {}).get("runId"),
                        "workflowStatus": (match.get("activeWorkflow") or {}).get("status"),
                        "surveySentAt": match.get("surveySentAt"),
                    }
                    for match in matches[:5]
                ],
            },
        )

    return selected


async def record_incoming_whatsapp_message(
    patient_id: str,
    from_phone: str,
    body: str,
    message_sid: str | None = None,
    sender_name: str | None = None,
) -> dict[str, Any]:
    db = get_db()
    patient = await db.patients.find_one({"patientId": patient_id})
    normalized_phone = normalize_phone_number(from_phone)
    received_at = datetime.utcnow()
    event = _build_message_event(
        direction="inbound",
        message_type="patient_feedback",
        body=body,
        phone=normalized_phone,
        twilio_sid=message_sid,
        status="received",
        sender_name=sender_name,
    )

    await db.patients.update_one(
        {"patientId": patient_id},
        {
            "$set": {
                "surveyStatus": "responded",
                "surveyResponse": body,
                "surveyRespondedAt": received_at,
                "whatsappNumber": normalized_phone,
                "activeWorkflow.status": "response_received",
                "activeWorkflow.responseReceivedAt": received_at,
                "activeWorkflow.lastInboundMessageSid": message_sid,
                "updatedAt": received_at,
            },
            "$push": {"whatsappMessages": event},
        },
    )
    return event


async def send_survey(patient_id: str) -> dict:
    db = get_db()
    settings = get_settings()
    patient = await db.patients.find_one({"patientId": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    phone = patient.get("whatsappNumber") or patient.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Patient phone number is required for WhatsApp survey")

    normalized_phone = normalize_phone_number(phone)
    workflow_run_id = f"WF-{uuid4().hex[:12]}"
    message = _compose_survey_message(patient["name"], patient["department"], settings.HOSPITAL_NAME)
    delivery = await send_whatsapp_message(normalized_phone, message)
    event = _build_message_event(
        direction="outbound",
        message_type="survey_request",
        body=message,
        phone=normalized_phone,
        twilio_sid=delivery.get("sid"),
        status=delivery.get("status"),
    )

    await db.patients.update_one(
        {"patientId": patient_id},
        {
            "$set": {
                "surveyStatus": "sent",
                "surveyUrl": None,
                "surveySentAt": datetime.utcnow(),
                "surveyResponse": None,
                "surveyRespondedAt": None,
                "surveyChannel": "whatsapp",
                "surveyRequestMessage": message,
                "whatsappNumber": normalized_phone,
                "whatsappMessages": [event],
                "latestFeedbackId": None,
                "latestFeedbackAt": None,
                "latestSentiment": None,
                "latestSeverity": None,
                "latestCategory": None,
                "lastResolutionMessage": None,
                "lastFollowUpMessage": None,
                "activeWorkflow": {
                    "runId": workflow_run_id,
                    "status": "survey_sent",
                    "channel": "whatsapp",
                    "startedAt": datetime.utcnow(),
                    "surveyMessageSid": delivery.get("sid"),
                    "responseReceivedAt": None,
                    "feedbackId": None,
                },
                "updatedAt": datetime.utcnow(),
            },
        },
    )
    return {
        "sent": True,
        "patientId": patient_id,
        "phone": normalized_phone,
        "message": message,
        "messageSid": delivery.get("sid"),
        "status": delivery.get("status"),
        "errorCode": delivery.get("errorCode"),
        "errorMessage": delivery.get("errorMessage"),
        "channel": "whatsapp",
        "workflowRunId": workflow_run_id,
    }


async def get_survey_response(patient_id: str) -> dict:
    db = get_db()
    patient = await db.patients.find_one({"patientId": patient_id})
    if not patient or not patient.get("surveyResponse"):
        return {"patientId": patient_id, "response": None, "hasResponse": False}
    return {
        "patientId": patient_id,
        "response": patient["surveyResponse"],
        "hasResponse": True,
        "respondedAt": patient.get("surveyRespondedAt"),
    }


async def send_resolution_message(patient_id: str, contact_name: str, message: str) -> dict:
    db = get_db()
    settings = get_settings()
    patient = await db.patients.find_one({"patientId": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    phone = patient.get("whatsappNumber") or patient.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Patient phone number is required for WhatsApp resolution")

    normalized_phone = normalize_phone_number(phone)
    final_message = _finalize_resolution_message(message, contact_name, settings.HOSPITAL_NAME)
    delivery = await send_whatsapp_message(normalized_phone, final_message)
    event = _build_message_event(
        direction="outbound",
        message_type="resolution",
        body=final_message,
        phone=normalized_phone,
        twilio_sid=delivery.get("sid"),
        status=delivery.get("status"),
        sender_name=contact_name,
    )

    await db.patients.update_one(
        {"patientId": patient_id},
        {
            "$set": {
                "lastResolutionMessage": final_message,
                "activeWorkflow.status": "resolution_sent",
                "activeWorkflow.resolutionSentAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
            },
            "$push": {"whatsappMessages": event},
        },
    )
    return {
        "sent": True,
        "patientId": patient_id,
        "contact": contact_name,
        "messageSid": delivery.get("sid"),
        "status": delivery.get("status"),
        "errorCode": delivery.get("errorCode"),
        "errorMessage": delivery.get("errorMessage"),
    }


async def send_review_nudge(patient_id: str, patient_name: str) -> dict:
    db = get_db()
    settings = get_settings()
    patient = await db.patients.find_one({"patientId": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    phone = patient.get("whatsappNumber") or patient.get("phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Patient phone number is required for WhatsApp follow-up")

    normalized_phone = normalize_phone_number(phone)
    review_link = "https://g.page/r/hospital-google-review-link"
    message = _compose_review_nudge_message(patient_name, settings.HOSPITAL_NAME, review_link)
    delivery = await send_whatsapp_message(normalized_phone, message)
    event = _build_message_event(
        direction="outbound",
        message_type="positive_follow_up",
        body=message,
        phone=normalized_phone,
        twilio_sid=delivery.get("sid"),
        status=delivery.get("status"),
    )

    await db.patients.update_one(
        {"patientId": patient_id},
        {
            "$set": {
                "lastFollowUpMessage": message,
                "activeWorkflow.status": "positive_follow_up_sent",
                "activeWorkflow.followUpSentAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow(),
            },
            "$push": {"whatsappMessages": event},
        },
    )
    return {
        "sent": True,
        "patientId": patient_id,
        "reviewLink": review_link,
        "messageSid": delivery.get("sid"),
        "status": delivery.get("status"),
        "errorCode": delivery.get("errorCode"),
        "errorMessage": delivery.get("errorMessage"),
    }