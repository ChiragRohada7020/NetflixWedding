from urllib.parse import quote

from flask import Blueprint, render_template
from flask_login import current_user

from app.models.program import Program
from app.models.wedding import Wedding
from app.utils.video import youtube_embed_url

public_bp = Blueprint("public", __name__)


def _placeholder_image(label):
    text = " ".join((label or "Wedflix").split()[:2]).strip() or "Wedflix"
    initials = "".join(part[0] for part in text.split() if part[:1]).upper()[:2] or "W"
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="{text}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#1a1a1a" />
          <stop offset="100%" stop-color="#050505" />
        </linearGradient>
        <linearGradient id="glow" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#e50914" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#e50914" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#bg)" />
      <circle cx="650" cy="92" r="126" fill="url(#glow)" />
      <circle cx="118" cy="360" r="140" fill="url(#glow)" />
      <text x="56" y="300" fill="#ffffff" font-size="92" font-family="Georgia, 'Times New Roman', serif" font-weight="700">{initials}</text>
      <text x="56" y="372" fill="#9ca3af" font-size="28" font-family="Arial, sans-serif">Wedflix</text>
    </svg>
    """
    return f"data:image/svg+xml;charset=UTF-8,{quote(svg)}"


def _card_image(item, fallback_label):
    return item.get("thumbnail") or item.get("profile_image") or _placeholder_image(fallback_label)


def _build_program_card(program, wedding):
    wedding_id = str(wedding.get("_id"))
    program_id = program.get("_id")
    href = f"/weddings/{wedding_id}/programs/{program_id}"
    title = program.get("title") or wedding.get("couple_names") or "Untitled Story"
    subtitle = program.get("event_date") or program.get("event_time") or wedding.get("wedding_date") or wedding.get("venue_name") or ""
    return {
        "href": href,
        "image": _card_image(program, title or wedding.get("couple_names") or "Wedflix"),
        "title": title,
        "subtitle": subtitle,
        "wedding_label": wedding.get("couple_names") or "Wedflix",
    }


def _build_wedding_card(wedding):
    wedding_id = str(wedding.get("_id") or "")
    title = wedding.get("couple_names") or "Untitled Story"
    subtitle = wedding.get("wedding_date") or wedding.get("venue_name") or ""
    return {
        "href": f"/weddings/{wedding_id}" if wedding_id else "#home",
        "image": _card_image(wedding, title),
        "title": title,
        "subtitle": subtitle,
        "wedding_label": wedding.get("couple_names") or "Wedflix",
    }


@public_bp.route("/")
def landing():
    weddings = Wedding.all()
    if not current_user.is_authenticated:
        weddings = [w for w in weddings if (w.get("access_level") or "private") == "public"]

    featured = weddings[0] if weddings else None
    page_music_url = ""
    catalog_cards = []
    hero_play_url = "#seasons"
    hero_info_url = "#our-films"
    if featured:
        featured_programs = Program.by_wedding(featured["_id"])
        featured["hero_embed_url"] = youtube_embed_url(featured.get("hero_video_url"))
        featured["hero_image"] = _card_image(featured, featured.get("couple_names") or "Wedflix")
        page_music_url = featured.get("music_url", "")
        if featured_programs:
            first_program = featured_programs[0]
            hero_play_url = f"/weddings/{featured['_id']}/programs/{first_program['_id']}"
            hero_info_url = f"/weddings/{featured['_id']}"
            for program in featured_programs:
                catalog_cards.append(_build_program_card(program, featured))
        else:
            hero_play_url = f"/weddings/{featured['_id']}"
            hero_info_url = f"/weddings/{featured['_id']}"
    else:
        featured = {
            "couple_names": "Your Story, Streamed Forever",
            "wedding_date": "Create cinematic memories",
            "hero_embed_url": "https://www.youtube.com/embed/1Rc_XnSk-Ew",
            "hero_image": _placeholder_image("Your Story, Streamed Forever"),
        }
    for wedding in weddings[1:] if featured else weddings:
        programs = Program.by_wedding(wedding["_id"])
        if programs:
            for program in programs:
                catalog_cards.append(_build_program_card(program, wedding))
        else:
            catalog_cards.append(_build_wedding_card(wedding))

    if not catalog_cards and featured:
        catalog_cards.append(_build_wedding_card(featured))

    def take_cards(start, size=4):
        if not catalog_cards:
            return []
        chunk = catalog_cards[start : start + size]
        if len(chunk) < size:
            chunk.extend(catalog_cards[: size - len(chunk)])
        return chunk[:size]

    home_rows = [
        {
            "id": "seasons",
            "title": "The Celebration Series",
            "cards": take_cards(0),
        },
        {
            "id": "our-films",
            "title": "OUR FILM",
            "cards": take_cards(4),
        },
        {
            "id": "little-moments",
            "title": "Little Moments",
            "cards": take_cards(8),
        },
    ]
    return render_template(
        "public/landing.html",
        featured=featured,
        weddings=weddings,
        page_music_url=page_music_url,
        home_rows=home_rows,
        hero_play_url=hero_play_url,
        hero_info_url=hero_info_url,
        home_page=True,
    )
