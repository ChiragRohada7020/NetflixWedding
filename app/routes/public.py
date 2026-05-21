from datetime import datetime, timezone
import os
from urllib.parse import quote

from flask import Blueprint, Response, render_template, request
from flask_login import current_user

from app.models.episode import Episode
from app.models.program import Program
from app.models.wedding import Wedding
from app.utils.video import youtube_embed_url

public_bp = Blueprint("public", __name__)


def _absolute_url(path):
    return request.url_root.rstrip("/") + path


def _public_image_url(candidate):
    if isinstance(candidate, str) and candidate.startswith(("http://", "https://")):
        return candidate
    if isinstance(candidate, str) and candidate.startswith("/"):
        return _absolute_url(candidate)
    return _absolute_url("/favicon.svg")


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
        title=f"{featured.get('couple_names') if featured else 'Wedflix'} | Wedflix",
        og_title=f"{featured.get('couple_names') if featured else 'Wedflix'} | Wedflix",
        meta_description=(
            (featured.get("description") if featured else None)
            or "Wedflix is a cinematic wedding streaming platform featuring wedding stories, programs, and episodes."
        ),
        canonical_url=_absolute_url("/"),
        og_image=_public_image_url(featured.get("profile_image") if featured else None),
        og_type="website",
    )


@public_bp.route("/site")
def site():
    contact_phone = os.getenv("WEDFLIX_CONTACT_PHONE", "+91 98765 43210")
    contact_email = os.getenv("WEDFLIX_CONTACT_EMAIL", "hello@wedflix.space")
    whatsapp_url = os.getenv("WEDFLIX_WHATSAPP_URL", "https://wa.me/919876543210")
    instagram_handle = os.getenv("WEDFLIX_INSTAGRAM_HANDLE", "@wed_flixx")
    instagram_url = os.getenv("WEDFLIX_INSTAGRAM_URL", "https://www.instagram.com/wed_flixx/")

    sections = [
        {
            "title": "Wedding Films",
            "copy": "Cinematic hero edits, emotional highlight reels, and family-first storytelling that keeps every blessing, tear, and laugh close.",
        },
        {
            "title": "Programs & Events",
            "copy": "Separate beautiful pages for Haldi, Mehendi, Sangeet, Pithi, Bhaat, Sehra Bandi, Baraat, Sakhar Puda, Antarpat, Mangalashtak, Nikaah, Anand Karaj, Church Vows, Varmala, Pheras, Bidaai, Reception, and every moment in between.",
        },
        {
            "title": "Guest Memories",
            "copy": "Photos, comments, and memories organized so both sides of the family can relive the celebration together.",
        },
        {
            "title": "Private or Public",
            "copy": "Keep your wedding private with protected access or open selected stories to the world with public pages.",
        },
    ]

    features = [
        "Netflix-inspired visual design",
        "Mobile-first experience",
        "Fast loading public pages",
        "SEO-friendly structure",
        "Music, video, and gallery support",
        "Admin tools for easy updates",
    ]

    reviews = [
        {
            "name": "Rohit & Neha Ahuja",
            "handle": "Sindhi family wedding",
            "quote": "It felt like the whole Sindhi family was sitting together again. From the sehra bandi to the dhol, every chacha, bua, and cousin found a moment that felt like ours.",
            "image": "https://images.unsplash.com/photo-1525338078858-d762b5e32f2c?auto=format&fit=crop&w=900&q=80",
        },
        {
            "name": "Kritika & Harsh Khandelwal",
            "handle": "Marwadi family wedding",
            "quote": "Our Marwadi rituals were shown with so much warmth. The mehendi, bhaat, pithi, pheras, and bidaai all felt emotional without losing the family masti.",
            "image": "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80",
        },
        {
            "name": "Aarohi & Nikhil Deshmukh",
            "handle": "Marathi family wedding",
            "quote": "Our Marathi wedding felt complete on Wedflix. The sakhar puda, antarpat, mangalashtak, varmala, and every family blessing were shown with so much respect.",
            "image": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80",
        },
        {
            "name": "Families Across Traditions",
            "handle": "Indian wedding celebrations",
            "quote": "Every community has its own way of making a wedding special. Wedflix gave our rituals, prayers, family entries, and reception moments a premium place to shine.",
            "image": "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=900&q=80",
        },
    ]

    return render_template(
        "public/site.html",
        title="Wedflix | Wedding Website Design, Films & Memories",
        og_title="Wedflix | Wedding Website Design, Films & Memories",
        meta_description="Wedflix builds premium wedding websites with cinematic visuals, films, programs, memories, and contact-ready pages.",
        canonical_url=_absolute_url("/site"),
        og_image=_public_image_url("/favicon.svg"),
        og_type="website",
        contact_phone=contact_phone,
        contact_email=contact_email,
        whatsapp_url=whatsapp_url,
        instagram_handle=instagram_handle,
        instagram_url=instagram_url,
        sections=sections,
        features=features,
        reviews=reviews,
    )


@public_bp.route("/robots.txt")
def robots_txt():
    body = "\n".join(
        [
            "User-agent: *",
            "Allow: /",
            "Allow: /weddings/",
            "Allow: /weddings/*",
            "Sitemap: " + _absolute_url("/sitemap.xml"),
            "",
        ]
    )
    return Response(body, mimetype="text/plain")


@public_bp.route("/sitemap.xml")
def sitemap_xml():
    urls = [
        _absolute_url("/"),
        _absolute_url("/weddings"),
        _absolute_url("/site"),
    ]

    weddings = Wedding.all()
    public_weddings = [w for w in weddings if (w.get("access_level") or "private") == "public"]
    for wedding in public_weddings:
        wedding_id = str(wedding.get("_id"))
        urls.append(_absolute_url(f"/weddings/{wedding_id}"))
        for program in Program.by_wedding(wedding_id):
            program_id = str(program.get("_id"))
            urls.append(_absolute_url(f"/weddings/{wedding_id}/programs/{program_id}"))

    # Include episode detail URLs for public content.
    for wedding in public_weddings:
        wedding_id = str(wedding.get("_id"))
        for program in Program.by_wedding(wedding_id):
            program_id = str(program.get("_id"))
            for episode in Episode.by_program(program_id):
                episode_id = str(episode.get("_id"))
                urls.append(_absolute_url(f"/weddings/{wedding_id}/programs/{program_id}/episodes/{episode_id}"))

    seen = set()
    unique_urls = []
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        unique_urls.append(url)

    lastmod = datetime.now(timezone.utc).date().isoformat()
    xml = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in unique_urls:
        xml.append("  <url>")
        xml.append(f"    <loc>{url}</loc>")
        xml.append(f"    <lastmod>{lastmod}</lastmod>")
        xml.append("  </url>")
    xml.append("</urlset>")
    return Response("\n".join(xml), mimetype="application/xml")
