from fastapi import APIRouter, Form, Response

from db.database import get_db

from services.feedback_service import process_feedback_submission
from services.survey_service import find_patient_by_phone, record_incoming_whatsapp_message

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])


@router.post("/webhook", status_code=204)
async def whatsapp_webhook(
    Body: str = Form(default=""),
    From: str = Form(default=""),
    ProfileName: str = Form(default=""),
    MessageSid: str = Form(default=""),
):
    message_body = Body.strip()
    from_phone = From.strip()
    if not message_body or not from_phone:
        return Response(status_code=204)

    patient = await find_patient_by_phone(from_phone)
    if not patient:
        return Response(status_code=204)

    await record_incoming_whatsapp_message(
        patient_id=patient["patientId"],
        from_phone=from_phone,
        body=message_body,
        message_sid=MessageSid or None,
        sender_name=ProfileName or None,
    )
    await process_feedback_submission(
        patient_id=patient["patientId"],
        patient_name=patient["name"],
        department=patient["department"],
        raw_text=message_body,
        source="whatsapp",
        source_message_sid=MessageSid or None,
    )
    return Response(status_code=204)


@router.post("/status", status_code=204)
async def whatsapp_status_callback(
    MessageSid: str = Form(default=""),
    MessageStatus: str = Form(default=""),
    To: str = Form(default=""),
    From: str = Form(default=""),
    ErrorCode: str = Form(default=""),
):
    db = get_db()
    payload = {
        "sid": MessageSid or None,
        "status": MessageStatus or None,
        "to": To or None,
        "from": From or None,
        "errorCode": ErrorCode or None,
    }
    print("📬 Twilio status callback", payload)

    if MessageSid:
        await db.patients.update_many(
            {"activeWorkflow.surveyMessageSid": MessageSid},
            {
                "$set": {
                    "activeWorkflow.twilioSurveyStatus.status": MessageStatus or None,
                    "activeWorkflow.twilioSurveyStatus.errorCode": ErrorCode or None,
                    "updatedAt": __import__("datetime").datetime.utcnow(),
                }
            },
        )

    return Response(status_code=204)