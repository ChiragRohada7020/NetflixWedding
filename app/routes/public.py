from flask import Blueprint, render_template
from flask_login import current_user

from app.models.wedding import Wedding
from app.utils.video import youtube_embed_url

public_bp = Blueprint("public", __name__)


@public_bp.route("/")
def landing():
    weddings = Wedding.all()
    if not current_user.is_authenticated:
        weddings = [w for w in weddings if (w.get("access_level") or "private") == "public"]

    featured = weddings[0] if weddings else None
    page_music_url = ""
    if featured:
        featured["hero_embed_url"] = youtube_embed_url(featured.get("hero_video_url"))
        page_music_url = featured.get("music_url", "")
    else:
        featured = {
            "couple_names": "Your Story, Streamed Forever",
            "wedding_date": "Create cinematic memories",
            "hero_embed_url": "https://www.youtube.com/embed/1Rc_XnSk-Ew",
        }
    return render_template(
        "public/landing.html",
        featured=featured,
        weddings=weddings,
        page_music_url=page_music_url,
    )
