import json
import os
import re

import requests


DEFAULT_COPY = {
    "description": "A simple hello turned into a lifetime together. Through laughter, memories, and countless moments, their story found its way to forever.",
    "hero_kicker": "A WEDDING ORIGINAL",
    "invitation_title": "Wedding Invitation",
    "programs_section_title": "Wedding Programs",
    "hero_meta_one": "Celebration",
    "hero_meta_two": "Family",
    "hero_meta_three": "Romance",
}

DEFAULT_EQUIVALENTS = {
    "description": {
        DEFAULT_COPY["description"],
        "Turn your life moments into a personal streaming story with sections, episodes, and memories people can revisit anytime.",
        "Watch story sections, episodes, and cinematic memories on Wedflix.",
    },
    "hero_kicker": {"A WEDDING ORIGINAL", "A WEDFLIX ORIGINAL"},
    "invitation_title": {"Wedding Invitation", "#1 Love In Every Frame", "Story Highlight"},
    "programs_section_title": {"Wedding Programs", "The Celebration Series", "Story Series"},
    "hero_meta_one": {"Celebration"},
    "hero_meta_two": {"Family"},
    "hero_meta_three": {"Romance"},
}


def _clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _is_missing_or_default(field, value):
    cleaned = _clean(value)
    if not cleaned:
        return True
    return cleaned.lower() in {item.lower() for item in DEFAULT_EQUIVALENTS.get(field, set())}


def _fallback_copy(title):
    subject = _clean(title) or "This Story"
    title_lower = subject.lower()
    is_wedding = any(token in title_lower for token in ("wedding", "shaadi", "bride", "groom", "&"))
    if is_wedding:
        return {
            "description": f"{subject} brings love, laughter, rituals, and family memories together in one cinematic celebration.",
            "hero_kicker": "A WEDFLIX ORIGINAL",
            "invitation_title": "A Celebration To Remember",
            "programs_section_title": "The Celebration Series",
            "hero_meta_one": "Love",
            "hero_meta_two": "Family",
            "hero_meta_three": "Celebration",
        }
    return {
        "description": f"{subject} is a personal story of shared moments, familiar faces, and memories worth replaying.",
        "hero_kicker": "A WEDFLIX ORIGINAL",
        "invitation_title": "Moments Worth Replaying",
        "programs_section_title": "The Story Series",
        "hero_meta_one": "Memories",
        "hero_meta_two": "People",
        "hero_meta_three": "Moments",
    }


def _extract_json(text):
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


def _groq_copy(title):
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return {}

    model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip() or "llama-3.1-8b-instant"
    prompt = {
        "role": "user",
        "content": (
            "Create concise Netflix-style hero copy for a Wedflix story page from this title: "
            f"{_clean(title)!r}. Do not assume it is a wedding unless the title clearly says so. "
            "Return only JSON with keys description, hero_kicker, invitation_title, "
            "programs_section_title, hero_meta_one, hero_meta_two, hero_meta_three. "
            "description must be 18-28 words. hero_kicker max 4 words. "
            "invitation_title max 5 words. meta values must be one word each."
        ),
    }
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You write short, tasteful streaming-platform copy. Output strict JSON only.",
                },
                prompt,
            ],
            "temperature": 0.7,
            "max_tokens": 220,
            "response_format": {"type": "json_object"},
        },
        timeout=8,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return _extract_json(content)


def enrich_wedding_copy(payload, current=None):
    title = payload.get("couple_names") or (current or {}).get("couple_names") or "Wedflix Story"
    fields = [
        "description",
        "hero_kicker",
        "invitation_title",
        "programs_section_title",
        "hero_meta_one",
        "hero_meta_two",
        "hero_meta_three",
    ]
    missing_fields = [
        field for field in fields
        if _is_missing_or_default(field, payload.get(field))
    ]
    if not missing_fields:
        return payload

    try:
        generated = _groq_copy(title)
    except Exception:
        generated = {}
    generated = {**_fallback_copy(title), **{k: _clean(v) for k, v in generated.items() if _clean(v)}}

    enriched = {**payload}
    for field in missing_fields:
        value = _clean(generated.get(field))
        if value:
            enriched[field] = value
    return enriched
