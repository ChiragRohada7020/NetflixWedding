from bson import ObjectId
import json
from flask import Blueprint, current_app, flash, redirect, render_template, request, url_for
from flask_login import login_required

from app import mongo
from app.models.episode import Episode
from app.models.program import Program
from app.models.wedding import Wedding
from app.utils.decorators import admin_required
from app.utils.media import normalize_image_url
from app.utils.uploads import save_uploaded_image
from app.utils.video import youtube_embed_url

admin_bp = Blueprint("admin", __name__)


def _safe_int(value, default=0):
    try:
        return int((value or "").strip())
    except (TypeError, ValueError, AttributeError):
        return default


def _selected_wedding_id():
    return (request.args.get("wedding_id") or "").strip()


def _selected_program_id():
    return (request.args.get("program_id") or "").strip()


def _resolve_music_url(form_name="music_url", file_name="music_file"):
    direct = (request.form.get(form_name) or "").strip()
    return direct

def _parse_custom_sections(raw_value):
    raw = (raw_value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    cleaned = []
    for i, item in enumerate(parsed):
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("title") or "").strip()
        key = str(item.get("key") or f"custom_{i+1}").strip().lower()
        if not label:
            continue
        key = "".join(ch if (ch.isalnum() or ch in {"_", "-"}) else "_" for ch in key)
        if not key:
            key = f"custom_{i+1}"
        cleaned.append({"key": key, "label": label})
    return cleaned


def _resolve_image_url(form_name, file_name, existing=""):
    direct = (request.form.get(form_name) or "").strip()
    if direct:
        return normalize_image_url(direct)
    uploaded = save_uploaded_image(request.files.get(file_name), current_app.config.get("UPLOAD_FOLDER", "app/static/uploads"))
    if uploaded:
        return uploaded
    if existing:
        return existing
    return normalize_image_url("")


@admin_bp.route("/")
@login_required
@admin_required
def home():
    weddings = Wedding.all()
    selected_wedding_id = _selected_wedding_id()
    selected_program_id = _selected_program_id()

    selected_wedding = None
    programs = []
    selected_program = None
    if selected_wedding_id:
        selected_wedding = Wedding.get(selected_wedding_id)
        if selected_wedding:
            programs = Program.by_wedding(selected_wedding_id)
            if selected_program_id:
                selected_program = next((p for p in programs if p.get("_id") == selected_program_id), None)
            if not selected_program and programs:
                selected_program = programs[0]
                selected_program_id = selected_program.get("_id", "")

    episodes = []
    if selected_program_id:
        episodes = [
            Episode.serialize(e)
            for e in mongo.db.episodes.find({"program_id": ObjectId(selected_program_id)}).sort("order", 1)
        ]

    return render_template(
        "admin/home.html",
        weddings=weddings,
        selected_wedding=selected_wedding,
        selected_wedding_id=selected_wedding_id,
        selected_program=selected_program,
        selected_program_id=selected_program_id,
        programs=programs,
        episodes=episodes,
    )


@admin_bp.route("/weddings/create", methods=["POST"])
@login_required
@admin_required
def create_wedding():
    access_level = (request.form.get("access_level") or "private").strip().lower()
    if access_level not in {"public", "private"}:
        access_level = "private"
    payload = {
        "couple_names": request.form.get("couple_names"),
        "wedding_date": request.form.get("wedding_date"),
        "hero_video_url": request.form.get("hero_video_url"),
        "description": request.form.get("description"),
        "venue_name": request.form.get("venue_name"),
        "event_address": request.form.get("event_address"),
        "profile_image": _resolve_image_url("profile_image", "profile_image_file"),
        "music_url": _resolve_music_url("music_url", "music_file"),
        "access_level": access_level,
        "invitation_title": (request.form.get("invitation_title") or "Wedding Invitation").strip(),
        "programs_section_title": (request.form.get("programs_section_title") or "Wedding Programs").strip(),
        "custom_sections": _parse_custom_sections(request.form.get("custom_sections_json")),
        "custom_section_label": (request.form.get("custom_section_label") or "My Custom Box").strip(),
    }
    Wedding.create(payload)
    flash("Wedding created", "success")
    return redirect(url_for("admin.home"))


@admin_bp.route("/weddings/<wedding_id>/update", methods=["POST"])
@login_required
@admin_required
def update_wedding(wedding_id):
    current = Wedding.get(wedding_id) or {}
    access_level = (request.form.get("access_level") or current.get("access_level") or "private").strip().lower()
    if access_level not in {"public", "private"}:
        access_level = "private"
    payload = {
        "couple_names": (request.form.get("couple_names") or "").strip(),
        "wedding_date": (request.form.get("wedding_date") or "").strip(),
        "hero_video_url": (request.form.get("hero_video_url") or "").strip(),
        "description": (request.form.get("description") or "").strip(),
        "venue_name": (request.form.get("venue_name") or "").strip(),
        "event_address": (request.form.get("event_address") or "").strip(),
        "profile_image": _resolve_image_url("profile_image", "profile_image_file", current.get("profile_image", "")),
        "music_url": _resolve_music_url("music_url", "music_file"),
        "access_level": access_level,
        "invitation_title": (request.form.get("invitation_title") or current.get("invitation_title") or "Wedding Invitation").strip(),
        "programs_section_title": (request.form.get("programs_section_title") or current.get("programs_section_title") or "Wedding Programs").strip(),
        "custom_sections": _parse_custom_sections(request.form.get("custom_sections_json")),
        "custom_section_label": (request.form.get("custom_section_label") or current.get("custom_section_label") or "My Custom Box").strip(),
    }
    mongo.db.weddings.update_one({"_id": ObjectId(wedding_id)}, {"$set": payload})
    flash("Wedding updated", "success")
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/weddings/<wedding_id>/delete", methods=["POST"])
@login_required
@admin_required
def delete_wedding(wedding_id):
    wid = ObjectId(wedding_id)
    program_ids = [p["_id"] for p in mongo.db.programs.find({"wedding_id": wid}, {"_id": 1})]
    episode_ids = []
    if program_ids:
        episode_ids = [e["_id"] for e in mongo.db.episodes.find({"program_id": {"$in": program_ids}}, {"_id": 1})]

    if episode_ids:
        mongo.db.comments.delete_many({"episode_id": {"$in": episode_ids}})
        mongo.db.photos.delete_many({"episode_id": {"$in": episode_ids}})
        mongo.db.episodes.delete_many({"_id": {"$in": episode_ids}})
    if program_ids:
        mongo.db.programs.delete_many({"_id": {"$in": program_ids}})
    mongo.db.weddings.delete_one({"_id": wid})

    flash("Wedding profile deleted", "success")
    return redirect(url_for("admin.home"))


@admin_bp.route("/programs/create", methods=["POST"])
@login_required
@admin_required
def create_program():
    wedding_id = request.form.get("wedding_id")
    section_key = (request.form.get("section_key") or "main").strip().lower()
    if section_key not in {"main", "custom"}:
        section_key = "main"
    payload = {
        "wedding_id": ObjectId(wedding_id),
        "section_key": section_key,
        "title": request.form.get("title"),
        "thumbnail": _resolve_image_url("thumbnail", "thumbnail_file"),
        "hero_video_url": (request.form.get("hero_video_url") or "").strip(),
        "hero_embed_url": youtube_embed_url(request.form.get("hero_video_url")),
        "event_date": (request.form.get("event_date") or "").strip(),
        "event_time": (request.form.get("event_time") or "").strip(),
        "venue_name": (request.form.get("venue_name") or "").strip(),
        "event_address": (request.form.get("event_address") or "").strip(),
        "music_url": _resolve_music_url("music_url", "music_file"),
        "order": _safe_int(request.form.get("order"), 0),
    }
    Program.create(payload)
    flash("Program created", "success")
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/programs/<program_id>/update", methods=["POST"])
@login_required
@admin_required
def update_program(program_id):
    program = Program.get(program_id)
    wedding_id = str(program.get("wedding_id")) if program else ""
    section_key = (request.form.get("section_key") or (program or {}).get("section_key") or "main").strip().lower()
    if section_key not in {"main", "custom"}:
        section_key = "main"
    payload = {
        "section_key": section_key,
        "title": (request.form.get("title") or "").strip(),
        "thumbnail": _resolve_image_url("thumbnail", "thumbnail_file", (program or {}).get("thumbnail", "")),
        "hero_video_url": (request.form.get("hero_video_url") or "").strip(),
        "hero_embed_url": youtube_embed_url(request.form.get("hero_video_url")),
        "event_date": (request.form.get("event_date") or "").strip(),
        "event_time": (request.form.get("event_time") or "").strip(),
        "venue_name": (request.form.get("venue_name") or "").strip(),
        "event_address": (request.form.get("event_address") or "").strip(),
        "music_url": _resolve_music_url("music_url", "music_file"),
        "order": _safe_int(request.form.get("order"), 0),
    }
    mongo.db.programs.update_one({"_id": ObjectId(program_id)}, {"$set": payload})
    flash("Program updated", "success")
    return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))

@admin_bp.route("/programs/<program_id>/delete", methods=["POST"])
@login_required
@admin_required
def delete_program(program_id):
    program = Program.get(program_id)
    wedding_id = str(program.get("wedding_id")) if program else ""
    pid = ObjectId(program_id)
    episode_ids = [e["_id"] for e in mongo.db.episodes.find({"program_id": pid}, {"_id": 1})]
    if episode_ids:
        mongo.db.comments.delete_many({"episode_id": {"$in": episode_ids}})
        mongo.db.photos.delete_many({"episode_id": {"$in": episode_ids}})
    mongo.db.episodes.delete_many({"program_id": pid})
    mongo.db.programs.delete_one({"_id": pid})
    flash("Program deleted", "success")
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/episodes/create", methods=["POST"])
@login_required
@admin_required
def create_episode():
    program_id = request.form.get("program_id")

    program = Program.get(program_id)
    wedding_id = str(program.get("wedding_id")) if program else ""

    payload = {
        "program_id": ObjectId(program_id),
        "season_number": _safe_int(request.form.get("season_number"), 1),
        "title": request.form.get("title"),
        "description": request.form.get("description"),
        "youtube_url": request.form.get("youtube_url"),
        "embed_url": youtube_embed_url(request.form.get("youtube_url")),
        "order": _safe_int(request.form.get("order"), 0),
        "thumbnail": _resolve_image_url("thumbnail", "thumbnail_file"),
    }
    Episode.create(payload)
    flash("Moment added", "success")
    return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))


@admin_bp.route("/episodes/<episode_id>/update", methods=["POST"])
@login_required
@admin_required
def update_episode(episode_id):
    ep = Episode.get(episode_id)
    program_id = str(ep.get("program_id")) if ep else ""
    wedding_id = ""
    if program_id:
        program = Program.get(program_id)
        if program:
            wedding_id = str(program.get("wedding_id"))

    youtube_url = (request.form.get("youtube_url") or "").strip()
    payload = {
        "season_number": _safe_int(request.form.get("season_number"), 1),
        "title": (request.form.get("title") or "").strip(),
        "description": (request.form.get("description") or "").strip(),
        "youtube_url": youtube_url,
        "embed_url": youtube_embed_url(youtube_url),
        "order": _safe_int(request.form.get("order"), 0),
        "thumbnail": _resolve_image_url("thumbnail", "thumbnail_file", (ep or {}).get("thumbnail", "")),
    }
    mongo.db.episodes.update_one({"_id": ObjectId(episode_id)}, {"$set": payload})
    flash("Moment updated", "success")
    return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))


@admin_bp.route("/episodes/<episode_id>/delete", methods=["POST"])
@login_required
@admin_required
def delete_episode(episode_id):
    ep = mongo.db.episodes.find_one({"_id": ObjectId(episode_id)})
    wedding_id = ""
    program_id = ""
    if ep:
        program_id = str(ep.get("program_id"))
        program = Program.get(program_id)
        if program:
            wedding_id = str(program.get("wedding_id"))

    mongo.db.episodes.delete_one({"_id": ObjectId(episode_id)})
    flash("Episode deleted", "success")
    return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))

