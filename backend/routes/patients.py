# routes/patients.py
from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime
from db.database import get_db
from services.survey_service import send_survey
from services.twilio_service import fetch_whatsapp_message_status
from services.websocket_service import manager as ws_manager

router = APIRouter(prefix="/api/patients", tags=["Patients"])

class BillingUpdateRequest(BaseModel):
    billingStatus: str   # Paid | Discharged
    phone: str | None = None

# STEP 1 — when billing status → Paid, auto-trigger survey
@router.patch("/{patient_id}/billing")
async def update_billing_status(patient_id: str, body: BillingUpdateRequest):
    db = get_db()
    patient = await db.patients.find_one({"patientId": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    update_fields = {"billingStatus": body.billingStatus, "updatedAt": datetime.utcnow()}
    if body.phone:
        update_fields["phone"] = body.phone
        update_fields["whatsappNumber"] = body.phone

    await db.patients.update_one(
        {"patientId": patient_id},
        {"$set": update_fields}
    )

    result = {"patientId": patient_id, "billingStatus": body.billingStatus, "surveySent": False}

    # Auto-trigger survey when marked Paid/Discharged
    if body.billingStatus in ["Paid", "Discharged"]:
        survey_result = await send_survey(patient_id)
        result["surveySent"] = True
        result["surveyChannel"] = survey_result["channel"]
        result["surveyPhone"] = survey_result["phone"]
        result["surveyMessageSid"] = survey_result["messageSid"]
        result["surveyDeliveryStatus"] = survey_result.get("status")
        result["surveyDeliveryErrorCode"] = survey_result.get("errorCode")
        result["surveyDeliveryErrorMessage"] = survey_result.get("errorMessage")
        await ws_manager.broadcast(
            {
                "event": "patient_workflow_updated",
                "patientId": patient_id,
                "surveyStatus": "sent",
                "billingStatus": body.billingStatus,
            }
        )

    return result

@router.get("")
async def get_patients():
    db = get_db()
    patients = await db.patients.find().to_list(length=100)
    for p in patients:
        p["_id"] = str(p["_id"])
    return patients

# Simulated tool: get_discharged_patients(date)
@router.get("/discharged")
async def get_discharged_patients(date: str = None): # type: ignore
    db = get_db()
    query = {"billingStatus": {"$in": ["Paid", "Discharged"]}}
    patients = await db.patients.find(query).to_list(length=100)
    for p in patients:
        p["_id"] = str(p["_id"])
    return patients


@router.get("/{patient_id}/workflow")
async def get_patient_workflow(patient_id: str):
    db = get_db()
    patient = await db.patients.find_one({"patientId": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    feedback = None
    active_workflow = patient.get("activeWorkflow") or {}
    workflow_run_id = active_workflow.get("runId")
    twilio_survey_status = None
    latest_feedback_id = patient.get("latestFeedbackId")
    if latest_feedback_id and workflow_run_id:
        try:
            feedback = await db.feedbacks.find_one({"_id": ObjectId(latest_feedback_id), "workflowRunId": workflow_run_id})
        except Exception:
            feedback = await db.feedbacks.find_one({"patientId": patient_id, "workflowRunId": workflow_run_id}, sort=[("createdAt", -1)])
    elif workflow_run_id:
        feedback = await db.feedbacks.find_one({"patientId": patient_id, "workflowRunId": workflow_run_id}, sort=[("createdAt", -1)])

    ticket = None
    if feedback and feedback.get("ticketId"):
        ticket = await db.tickets.find_one({"ticketId": feedback["ticketId"]})

    survey_message_sid = active_workflow.get("surveyMessageSid")
    if survey_message_sid:
        try:
            twilio_survey_status = await fetch_whatsapp_message_status(survey_message_sid)
            await db.patients.update_one(
                {"patientId": patient_id},
                {
                    "$set": {
                        "activeWorkflow.twilioSurveyStatus": twilio_survey_status,
                        "updatedAt": datetime.utcnow(),
                    }
                },
            )
            active_workflow["twilioSurveyStatus"] = twilio_survey_status
        except Exception as exc:
            active_workflow["twilioSurveyStatusError"] = str(exc)

    if "_id" in patient:
        patient["_id"] = str(patient["_id"])
    if feedback and "_id" in feedback:
        feedback["_id"] = str(feedback["_id"])
    if ticket and "_id" in ticket:
        ticket["_id"] = str(ticket["_id"])

    return jsonable_encoder(
        {
            "patient": patient,
            "activeWorkflow": active_workflow,
            "latestFeedback": feedback,
            "latestTicket": ticket,
            "twilioSurveyStatus": twilio_survey_status,
        }
    )