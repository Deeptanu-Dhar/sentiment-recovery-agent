import re
from typing import Any

from fastapi import HTTPException
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from db.database import get_settings


TWILIO_ERROR_EXPLANATIONS = {
    63007: "Twilio could not find a WhatsApp channel for the configured From address. This usually means the sender number in your env does not belong to your Twilio WhatsApp sandbox or approved sender.",
    63015: "Twilio WhatsApp sandbox can only send messages to numbers that have joined your sandbox. The recipient must send the sandbox join code shown in your Twilio Console before delivery will work.",
}


def describe_twilio_error(error_code: int | None, error_message: str | None) -> str | None:
    if error_message:
        return error_message
    if error_code in TWILIO_ERROR_EXPLANATIONS:
        return TWILIO_ERROR_EXPLANATIONS[error_code]
    return None


def normalize_phone_number(phone: str) -> str:
    raw_phone = (phone or "").strip()
    if raw_phone.startswith("whatsapp:"):
        raw_phone = raw_phone.split(":", 1)[1]

    digits = re.sub(r"[^\d+]", "", raw_phone)
    if digits.startswith("00"):
        digits = f"+{digits[2:]}"
    if digits and not digits.startswith("+"):
        digits = f"+{digits}"
    return digits


def to_whatsapp_address(phone: str) -> str:
    normalized_phone = normalize_phone_number(phone)
    if not normalized_phone:
        raise HTTPException(status_code=400, detail="A valid phone number is required for WhatsApp delivery")
    return f"whatsapp:{normalized_phone}"


async def send_whatsapp_message(to_phone: str, body: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=500, detail="Twilio WhatsApp credentials are not configured")

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    from_address = settings.TWILIO_WHATSAPP_FROM
    to_address = to_whatsapp_address(to_phone)

    try:
        message = client.messages.create(
            from_=from_address,
            to=to_address,
            body=body,
        )
    except TwilioRestException as exc:
        print(
            "❌ Twilio WhatsApp send failed",
            {
                "from": from_address,
                "to": to_address,
                "status": exc.status,
                "code": exc.code,
                "msg": exc.msg,
                "uri": exc.uri,
                "explanation": describe_twilio_error(exc.code, exc.msg),
            },
        )
        raise HTTPException(
            status_code=502,
            detail=f"Twilio WhatsApp send failed: {exc.msg}",
        )

    print(
        "📲 Twilio WhatsApp send",
        {
            "from": from_address,
            "to": to_address,
            "sid": message.sid,
            "status": message.status,
            "errorCode": getattr(message, "error_code", None),
            "errorMessage": getattr(message, "error_message", None),
            "explanation": describe_twilio_error(getattr(message, "error_code", None), getattr(message, "error_message", None)),
        },
    )

    return {
        "sid": message.sid,
        "status": message.status,
        "to": message.to,
        "from": message.from_,
        "errorCode": getattr(message, "error_code", None),
        "errorMessage": getattr(message, "error_message", None),
        "explanation": describe_twilio_error(getattr(message, "error_code", None), getattr(message, "error_message", None)),
    }


async def fetch_whatsapp_message_status(message_sid: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=500, detail="Twilio WhatsApp credentials are not configured")

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    try:
        message = client.messages(message_sid).fetch()
    except TwilioRestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Twilio WhatsApp status fetch failed: {exc.msg}",
        )

    status_payload = {
        "sid": message.sid,
        "status": message.status,
        "to": message.to,
        "from": message.from_,
        "errorCode": getattr(message, "error_code", None),
        "errorMessage": getattr(message, "error_message", None),
        "dateCreated": str(message.date_created) if getattr(message, "date_created", None) else None,
        "dateSent": str(message.date_sent) if getattr(message, "date_sent", None) else None,
        "direction": getattr(message, "direction", None),
        "explanation": describe_twilio_error(getattr(message, "error_code", None), getattr(message, "error_message", None)),
    }

    return status_payload