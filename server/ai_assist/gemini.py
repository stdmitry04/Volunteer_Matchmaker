import json
import hashlib
import logging

from django.conf import settings
from django.core.cache import cache
from google import genai

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a job posting assistant for a community help platform.
Given a single sentence describing a task someone needs help with, generate a structured job posting.

You MUST respond with valid JSON only, no markdown, no extra text. Use this exact schema:
{
  "title": "short job title (max 80 chars)",
  "description": "detailed 2-4 sentence description of the task, expectations, and any helpful context",
  "short_description": "one-line summary under 200 chars for a swipe card",
  "skill_tags": ["relevant", "skill", "tags"],
  "accessibility_flags": {
    "heavy_lifting": false,
    "standing_long": false,
    "driving_required": false,
    "outdoor_work": false
  },
  "suggested_time": "suggested time of day or duration if inferable, otherwise null",
  "suggested_location": "suggested location if inferable, otherwise null"
}

Rules:
- skill_tags: pick from common categories like Teaching, Programming, First Aid, Physical Labor, Driving, Cooking, Cleaning, Gardening, Photography, Graphic Design, Event Planning, Animal Care, Mechanical, Communication, Organization, Healthcare, Web Development, Marketing, Editing, Errands, Tutoring, Music, Childcare. Add new ones only if none fit.
- accessibility_flags: set to true only if the task clearly requires that physical ability.
- Be helpful and realistic. Infer reasonable details but don't fabricate specifics the user didn't mention."""


def _cache_key(text: str) -> str:
    h = hashlib.sha256(text.strip().lower().encode()).hexdigest()[:16]
    return f"gemini:enhance:{h}"


def enhance_job_description(user_input: str) -> dict:
    """Call Gemini to expand a short sentence into a structured job posting."""
    # Check cache
    key = _cache_key(user_input)
    cached = cache.get(key)
    if cached is not None:
        return cached

    api_key = getattr(settings, 'GEMINI_API_KEY', None)
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=f"{SYSTEM_PROMPT}\n\nUser input: {user_input}",
        config={
            'response_mime_type': 'application/json',
            'temperature': 0.7,
        },
    )

    text = response.text.strip()
    result = json.loads(text)

    # Validate expected keys
    required = {'title', 'description', 'short_description', 'skill_tags', 'accessibility_flags'}
    if not required.issubset(result.keys()):
        raise ValueError(f"Gemini response missing keys: {required - result.keys()}")

    # Cache for 1 hour
    cache.set(key, result, timeout=3600)

    return result
