import logging
import json
import google.generativeai as genai
from typing import Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY is not set. Gemini features will be disabled.")

async def generate_dispatch_instructions(decision: Dict[str, Any]) -> Dict[str, str]:
    """
    Calls Gemini to generate a plain English driver instruction and explanation.
    """
    if not settings.GEMINI_API_KEY:
        return {
            "driver_instruction": "Proceed with the newly assigned optimized route.",
            "judge_explanation": "Gemini API key missing. Auto-rerouting executed via OR-Tools."
        }

    prompt = f"""
You are an AI supply chain dispatcher. A vehicle routing optimization has just occurred.

Details of the decision:
Vehicle ID: {decision.get('vehicle_id')}
Reason: {decision.get('reason_description')}
Old ETA: {decision.get('old_eta_min')} mins | New ETA: {decision.get('new_eta_min')} mins (Saved: {decision.get('eta_delta_min')} mins)

Provide your response strictly as a JSON object with two keys:
1. "driver_instruction": A short, clear message to the driver (max 2 sentences).
2. "judge_explanation": An analytical explanation of why this reroute was beneficial (max 3 sentences).
"""
    try:
        model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
        response = await model.generate_content_async(prompt)
        result = json.loads(response.text)
        return {
            "driver_instruction": result.get("driver_instruction", "Route updated."),
            "judge_explanation": result.get("judge_explanation", "Optimization completed.")
        }
    except Exception as e:
        logger.error(f"Error calling Gemini: {e}")
        return {
            "driver_instruction": "Proceed with updated route.",
            "judge_explanation": f"System optimization executed. (Gemini error: {str(e)})"
        }