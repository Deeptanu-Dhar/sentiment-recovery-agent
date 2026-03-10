from collections import Counter
import json
import re

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from db.database import get_settings

settings = get_settings()
client = genai.Client(api_key=settings.GEMINI_API_KEY)

MODEL_NAME = "gemini-3-flash-preview"
JSON_RESPONSE_CONFIG = types.GenerateContentConfig(
    temperature=0.2,
    response_mime_type="application/json",
)

COMMUNICATION_STANDARDS = """
Follow these communication standards in every field you generate:
- Clarity and simplicity: use plain, concise, jargon-free language.
- Empathy and professionalism: be polite, calm, and respectful, especially for complaints.
- Accuracy: ground every claim in the provided text and context only; do not invent facts.
- Safety: do not provide medical advice, diagnosis, or treatment guidance.
- Privacy: do not ask for or reveal sensitive personal, financial, or health details beyond the provided context.
- Consistency: use the allowed labels and formats exactly as requested.
- Cultural sensitivity: avoid language that could feel biased, dismissive, or culturally specific.
- Actionability: when writing patient-facing text, include a clear next step when relevant.
""".strip()

POSITIVE_KEYWORDS = {
    "good",
    "great",
    "excellent",
    "kind",
    "attentive",
    "helpful",
    "smooth",
    "clean",
    "comfortable",
    "professional",
    "supportive",
    "thank",
    "glad",
    "appreciate",
}

NEGATIVE_KEYWORDS = {
    "delay",
    "late",
    "wait",
    "waiting",
    "confusing",
    "confused",
    "rude",
    "dirty",
    "unclean",
    "bad",
    "poor",
    "issue",
    "problem",
    "billing",
    "charge",
    "charged",
    "broken",
    "noise",
    "cold",
    "slow",
}

CATEGORY_KEYWORDS = {
    "Staff Behavior": ["staff", "nurse", "doctor", "rude", "behavior", "attitude", "helpful", "polite"],
    "Wait Time": ["wait", "delay", "queue", "queued", "slow", "hours", "hour", "late", "discharge took"],
    "Cleanliness": ["clean", "dirty", "unclean", "hygiene", "washroom", "toilet", "bed sheet"],
    "Billing Error": ["bill", "billing", "charge", "charged", "payment", "refund", "invoice", "desk"],
    "Facilities": ["room", "ward", "bed", "ac", "air conditioning", "lift", "elevator", "noise", "facility"],
    "Food Quality": ["food", "meal", "breakfast", "lunch", "dinner", "taste"],
}


def _parse_json_response(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return json.loads(text)


def _contains_phrase(text: str, phrase: str) -> bool:
    return phrase in text


def _count_keyword_hits(text: str, keywords: set[str]) -> int:
    return sum(1 for keyword in keywords if _contains_phrase(text, keyword))


def _extract_entities(text: str, category: str) -> list[str]:
    entities: list[str] = []

    if category == "Wait Time":
        if any(word in text for word in ["discharge", "checkout"]):
            entities.append("discharge delay")
        if any(word in text for word in ["family", "update", "communication"]):
            entities.append("lack of updates")
        if not entities:
            entities.append("long wait time")
    elif category == "Billing Error":
        if "confus" in text:
            entities.append("confusing billing")
        if any(word in text for word in ["charge", "charged", "bill", "billing"]):
            entities.append("billing issue")
    elif category == "Staff Behavior":
        if any(word in text for word in ["rude", "attitude"]):
            entities.append("staff attitude")
        if any(word in text for word in ["nurse", "doctor", "staff"]):
            entities.append("staff interaction")
    elif category == "Cleanliness":
        entities.append("cleanliness concern")
    elif category == "Facilities":
        entities.append("facility issue")
    elif category == "Food Quality":
        entities.append("food quality")

    if not entities and any(word in text for word in ["communication", "clear", "unclear"]):
        entities.append("unclear communication")

    deduped_entities: list[str] = []
    for entity in entities:
        if entity not in deduped_entities:
            deduped_entities.append(entity)
    return deduped_entities


def _detect_category(text: str) -> tuple[str, list[str]]:
    scores: dict[str, int] = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        scores[category] = sum(1 for keyword in keywords if _contains_phrase(text, keyword))

    best_category = max(scores.items(), key=lambda item: item[1])[0]
    if scores[best_category] <= 0:
        positive_hits = _count_keyword_hits(text, POSITIVE_KEYWORDS)
        category = "General Positive" if positive_hits > 0 else "General Neutral"
        return category, []

    return best_category, _extract_entities(text, best_category)


def _build_summary(sentiment: str, category: str, entities: list[str]) -> str:
    if sentiment == "Positive":
        return "The patient shared positive feedback about their overall hospital experience."
    if entities:
        issue_text = ", ".join(entities[:2])
        return f"The patient reported {issue_text} related to {category.lower()}."
    if sentiment == "Neutral":
        return "The patient described a mixed experience that needs follow-up."
    return f"The patient reported a concern related to {category.lower()}."


def _build_resolution_message(
    sentiment: str,
    patient_name: str,
    hospital_name: str,
    contact_name: str,
    entities: list[str],
    category: str,
) -> str:
    if sentiment == "Positive":
        return (
            f"Hello {patient_name}, thank you for your kind feedback about your experience with {hospital_name}. "
            f"We are glad your visit went smoothly. Regards, {hospital_name}"
        )

    issue_text = ", ".join(entities[:2]) if entities else category.lower()
    if sentiment == "Neutral":
        return (
            f"Hello {patient_name}, thank you for sharing your feedback. We noted your concern about {issue_text}. "
            f"Your point of contact is {contact_name}, and we will review this promptly. Regards, {hospital_name}"
        )

    return (
        f"Hello {patient_name}, thank you for sharing your experience. We are sorry about the issue with {issue_text}. "
        f"Your point of contact is {contact_name}, and we are reviewing this promptly. Regards, {hospital_name}"
    )


def _fallback_analyze_feedback(
    raw_text: str,
    patient_name: str,
    department: str,
    hospital_name: str,
    contact_name: str,
) -> dict:
    del department
    normalized_text = raw_text.lower().strip()
    positive_hits = _count_keyword_hits(normalized_text, POSITIVE_KEYWORDS)
    negative_hits = _count_keyword_hits(normalized_text, NEGATIVE_KEYWORDS)
    category, entities = _detect_category(normalized_text)

    mixed_cues = ["but", "however", "overall", "could have", "could've"]
    is_mixed = any(cue in normalized_text for cue in mixed_cues)

    if negative_hits == 0 and positive_hits > 0 and not is_mixed:
        sentiment = "Positive"
        sentiment_score = 0.8
        severity = 1
        category = "General Positive"
        entities = []
    elif negative_hits > 0 and positive_hits > 0:
        sentiment = "Negative" if negative_hits >= positive_hits else "Neutral"
        sentiment_score = -0.35 if sentiment == "Negative" else -0.1
        severity = 3 if sentiment == "Negative" else 2
    elif negative_hits > 0:
        sentiment = "Negative"
        sentiment_score = -0.6 if negative_hits > 1 else -0.35
        severity = 3 if negative_hits < 3 else 4
    else:
        sentiment = "Neutral"
        sentiment_score = 0.0
        severity = 2
        if category == "General Positive":
            category = "General Neutral"

    return {
        "sentiment": sentiment,
        "sentimentScore": sentiment_score,
        "severity": severity,
        "category": category,
        "complaintEntities": entities,
        "summary": _build_summary(sentiment, category, entities),
        "resolutionMessage": _build_resolution_message(
            sentiment,
            patient_name,
            hospital_name,
            contact_name,
            entities,
            category,
        ),
        "analysisSource": "fallback",
    }


def _fallback_weekly_summary(feedback_list: list) -> dict:
    category_counts = Counter(
        item.get("category")
        for item in feedback_list
        if item.get("category") and item.get("category") not in {"General Positive", "General Neutral"}
    )

    department_counts: dict[str, Counter[str]] = {}
    for item in feedback_list:
        department = item.get("department") or "Unknown"
        category = item.get("category") or "General Neutral"
        if department not in department_counts:
            department_counts[department] = Counter()
        department_counts[department][category] += 1

    top_categories = [
        {"category": category, "count": count}
        for category, count in category_counts.most_common(3)
    ]

    department_risk_summary = []
    for department, counts in department_counts.items():
        top_category, top_count = counts.most_common(1)[0]
        if top_count >= 4:
            risk_level = "Critical"
        elif top_count >= 3:
            risk_level = "High"
        elif top_count >= 2:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        department_risk_summary.append(
            {
                "department": department,
                "riskLevel": risk_level,
                "mainIssue": f"Most feedback this week pointed to {top_category.lower()} concerns.",
            }
        )

    if top_categories:
        overall_insight = (
            f"The most common complaint category this week was {top_categories[0]['category'].lower()}. "
            "Departments with repeated complaints should be reviewed first. "
            "Positive and neutral feedback should still be used to confirm what is working well."
        )
    else:
        overall_insight = (
            "Most feedback this week was positive or neutral. "
            "There are no strong repeat complaint patterns in the sampled feedback. "
            "Continue monitoring for changes in department-level trends."
        )

    return {
        "topComplaintCategories": top_categories,
        "departmentRiskSummary": department_risk_summary,
        "overallInsight": overall_insight,
        "recommendedActions": [
            "Review the top complaint categories with department leads.",
            "Follow up on repeated service-recovery issues within 24 hours.",
            "Coach frontline teams on clearer patient communication during discharge.",
        ],
        "analysisSource": "fallback",
    }


def _is_retryable_gemini_error(exc: Exception) -> bool:
    message = str(exc)
    return "RESOURCE_EXHAUSTED" in message or "429" in message


def _generate_json(prompt: str) -> dict:
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=JSON_RESPONSE_CONFIG,
    )
    text = response.text.strip()  # type: ignore
    return _parse_json_response(text)


async def analyze_feedback(
    raw_text: str,
    patient_name: str,
    department: str,
    hospital_name: str,
    contact_name: str,
) -> dict:
    prompt = f"""
You are a hospital patient feedback analyzer for a sentiment-driven service recovery workflow.
Your output is used for real-time complaint triage, CRM ticket creation, and a patient WhatsApp follow-up.
Return ONLY one valid JSON object with no extra text, no markdown, and no code blocks.

Workflow context from the project brief:
- Feedback is collected immediately after payment/discharge.
- Negative feedback should support a closed-loop service recovery action within 5 minutes.
- Negative feedback can trigger a CRM ticket, a duty-manager alert, and a personalized resolution message.
- Positive feedback can trigger a thank-you and review nudge.

{COMMUNICATION_STANDARDS}

General rules:
- Base every field only on the patient feedback and the provided context.
- Do not invent incidents, timelines, departments, people, or promises.
- Do not include medical advice or ask the patient for more personal details.
- If the feedback is mixed, choose the dominant sentiment and reflect the main operational issue.
- Keep complaint entities short and concrete.
- Keep summary and patient-facing language easy to understand for a general audience.

Patient Name: {patient_name}
Department: {department}
Hospital Name: {hospital_name}
Preferred Point of Contact for follow-up: {contact_name}
Feedback: "{raw_text}"

Return exactly this JSON structure:
{{
  "sentiment": "Positive or Neutral or Negative",
  "sentimentScore": 0.0,
  "severity": 1,
  "category": "Staff Behavior",
  "complaintEntities": ["entity1", "entity2"],
  "summary": "one sentence summary",
  "resolutionMessage": "personalized message to patient"
}}

Category must be one of: Staff Behavior, Wait Time, Cleanliness, Billing Error, Facilities, Food Quality, General Positive, General Neutral

Field rules:
- sentiment must be exactly one of: Positive, Neutral, Negative
- sentimentScore must be a number from -1.0 to 1.0
  - Negative values for negative feedback
  - Around 0 for neutral feedback
  - Positive values for positive feedback
- severity must be an integer from 1 to 5
- complaintEntities must contain short issue phrases grounded in the feedback text; return an empty list when no specific issue is stated
- summary must be one sentence, under 22 words, plain language, suitable for CRM use, and must not include the patient name

Severity rules:
- 1 = positive feedback or no service issue
- 2 = neutral feedback or a minor inconvenience with low urgency
- 3 = moderate complaint that needs follow-up
- 4 = serious complaint needing urgent service recovery
- 5 = critical safety, legal, or severe service failure concern

Category mapping rules:
- Use General Positive for appreciative or satisfied feedback with no complaint
- Use General Neutral for mixed or non-committal feedback without a clear complaint category
- Use the most specific category available when a clear complaint exists

resolutionMessage rules:
- Write a final patient-facing WhatsApp message in plain text only
- Acknowledge the specific issue when there is one; do not send a generic apology
- Show empathy and professionalism without admitting negligence or making legal commitments
- Include one clear next step or follow-up action when sentiment is Neutral or Negative
- When a point of contact is mentioned, use this exact name: {contact_name}
- Mention the hospital as {hospital_name} when a hospital name is needed
- For Positive sentiment, do not mention the point of contact, internal review, or escalation
- For Neutral or Negative sentiment, mention the point of contact no more than once
- Prefer natural, human phrasing over scripted customer-service wording
- Limit apologies to one brief sentence when needed
- Avoid boilerplate phrases such as "we value your feedback," "has been notified," "will be shared with the team," or "we will use your comments to improve"
- For Neutral or Negative sentiment, prefer "Your point of contact is {contact_name}" over passive internal-process language
- For Positive sentiment, focus on appreciation and warmth; avoid mentioning internal handoffs or review steps
- Do not ask for private data, documents, payments, or medical information
- Do not include markdown, bullet points, or emojis
- Keep it under 90 words
- Close with: Regards, {hospital_name}

Sentiment-specific resolutionMessage guidance:
- Positive: brief thank-you message with appreciation, no complaint handling language
- Neutral: acknowledge the concern or mixed experience and note a follow-up step
- Negative: acknowledge the complaint clearly, apologize appropriately, and state that the concern will be reviewed promptly
"""
    try:
        analysis = _generate_json(prompt)
        analysis.setdefault("analysisSource", "gemini")
        return analysis
    except genai_errors.ClientError as exc:
        if not _is_retryable_gemini_error(exc):
            raise
        print("⚠️ Gemini unavailable, using fallback feedback analysis", {"error": str(exc)})
        return _fallback_analyze_feedback(raw_text, patient_name, department, hospital_name, contact_name)
    except Exception as exc:
        if not _is_retryable_gemini_error(exc):
            raise
        print("⚠️ Gemini unavailable, using fallback feedback analysis", {"error": str(exc)})
        return _fallback_analyze_feedback(raw_text, patient_name, department, hospital_name, contact_name)


async def generate_weekly_summary(feedback_list: list) -> dict:
    prompt = f"""
You are a hospital analytics AI preparing a weekly service recovery summary.
Return ONLY one valid JSON object, with no markdown and no code blocks.

Purpose of the report:
- Show weekly sentiment trends.
- Surface the top complaint categories.
- Highlight department-level risk.
- Recommend concrete operational actions.

{COMMUNICATION_STANDARDS}

Analytics rules:
- Use only the provided feedback data.
- Do not invent statistics, departments, or trends that are not supported by the input.
- Do not mention patient names or any personally identifying information.
- Keep insights concise, operational, and suitable for hospital leadership.
- Recommended actions must be practical, specific, and non-medical.

Feedbacks:
{json.dumps(feedback_list, indent=2, default=str)}

Return exactly:
{{
  "topComplaintCategories": [{{"category": "...", "count": 0}}],
  "departmentRiskSummary": [{{"department": "...", "riskLevel": "Low or Medium or High or Critical", "mainIssue": "..."}}],
  "overallInsight": "2-3 sentence insight about this week",
  "recommendedActions": ["action1", "action2", "action3"]
}}

Output rules:
- topComplaintCategories should be ordered from highest to lowest count
- departmentRiskSummary should include concise operational risk reasoning in mainIssue
- riskLevel must be exactly one of: Low, Medium, High, Critical
- overallInsight must be 2 to 3 sentences in plain language
- recommendedActions should contain 3 to 5 actions, each starting with a strong verb
- If the same complaint pattern appears repeatedly in one department, reflect that in the risk summary or actions
"""
    try:
        summary = _generate_json(prompt)
        summary.setdefault("analysisSource", "gemini")
        return summary
    except genai_errors.ClientError as exc:
        if not _is_retryable_gemini_error(exc):
            raise
        print("⚠️ Gemini unavailable, using fallback weekly summary", {"error": str(exc)})
        return _fallback_weekly_summary(feedback_list)
    except Exception as exc:
        if not _is_retryable_gemini_error(exc):
            raise
        print("⚠️ Gemini unavailable, using fallback weekly summary", {"error": str(exc)})
        return _fallback_weekly_summary(feedback_list)
