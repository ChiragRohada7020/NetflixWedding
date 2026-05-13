from flask import Blueprint, render_template, request
from flask_login import current_user
from bson import ObjectId

from app import mongo
from app.models.wedding import Wedding
from app.utils.video import youtube_embed_url

public_bp = Blueprint("public", __name__)


@public_bp.route("/")
def landing():
    weddings = Wedding.all()
    if not current_user.is_authenticated:
        weddings = [w for w in weddings if (w.get("access_level") or "private") == "public"]

    featured = weddings[0] if weddings else None
    q = (request.args.get("q") or "").strip()
    event_results = []
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
    if q:
        wedding_ids = [ObjectId(w["_id"]) for w in weddings if w.get("_id")]
        program_query = {"wedding_id": {"$in": wedding_ids}} if wedding_ids else {"_id": None}
        programs = list(mongo.db.programs.find(program_query, {"_id": 1, "title": 1, "wedding_id": 1}))
        program_map = {str(p["_id"]): p for p in programs}
        episode_query = {
            "program_id": {"$in": [p["_id"] for p in programs]} if programs else {"$in": []},
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
            ],
        }
        episodes = list(mongo.db.episodes.find(episode_query).sort("order", 1).limit(30))
        wedding_map = {w["_id"]: w for w in weddings}
        for e in episodes:
            pid = str(e.get("program_id"))
            program = program_map.get(pid)
            if not program:
                continue
            wid = str(program.get("wedding_id"))
            wedding = wedding_map.get(wid)
            if not wedding:
                continue
            event_results.append(
                {
                    "wedding_id": wid,
                    "program_id": pid,
                    "episode_id": str(e.get("_id")),
                    "title": e.get("title") or "Untitled Event",
                    "program_title": program.get("title") or "Program",
                    "wedding_title": wedding.get("couple_names") or "Wedding",
                    "thumbnail": e.get("thumbnail") or "https://picsum.photos/seed/search-event/800/450",
                }
            )

    return render_template(
        "public/landing.html",
        featured=featured,
        weddings=weddings,
        page_music_url=page_music_url,
        q=q,
        event_results=event_results,
    )
