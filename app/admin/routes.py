import os
from bson import ObjectId
import json
from flask import Blueprint, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app import mongo
from app.models.episode import Episode
from app.models.invitation_program import InvitationProgram
from app.models.program import Program
from app.models.wedding import Wedding
from app.utils.decorators import admin_required
from app.utils.groq_copy import enrich_wedding_copy
from app.utils.media import normalize_image_url
from app.utils.plans import can_edit_wedding, can_manage_wedding, is_developer, limit_error, public_access_allowed
from app.utils.telegram_media import TelegramMediaError, upload_file_to_telegram, upload_photo_to_telegram
from app.utils.video import youtube_embed_url

admin_bp = Blueprint("admin", __name__)


@admin_bp.errorhandler(TelegramMediaError)
def handle_telegram_media_error(exc):
    return _form_error(str(exc), 400) or redirect(url_for("admin.home"))


def _safe_int(value, default=0):
    try:
        return int((value or "").strip())
    except (TypeError, ValueError, AttributeError):
        return default


def _selected_wedding_id():
    return (request.args.get("wedding_id") or "").strip()


def _selected_program_id():
    return (request.args.get("program_id") or "").strip()


def _is_fetch_form():
    return request.headers.get("X-Wedflix-Fetch") == "1"


def _form_success(message, **payload):
    if _is_fetch_form():
        return jsonify({"status": "ok", "message": message, **payload})
    flash(message, "success")
    return None


def _form_error(message, status_code=400):
    if _is_fetch_form():
        return jsonify({"error": message}), status_code
    flash(message, "error")
    return None


def _resolve_music_url(form_name="music_url", file_name="music_file", existing=""):
    file_storage = request.files.get(file_name)
    if file_storage and file_storage.filename:
        uploaded = upload_file_to_telegram(
            file_storage,
            caption=(request.form.get("title") or request.form.get("couple_names") or "Wedflix music").strip(),
        )
        if uploaded:
            return uploaded

    if form_name in request.form:
        return (request.form.get(form_name) or "").strip()
    return existing or ""

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


def _clean_section_key(value, default="main"):
    key = str(value or default).strip().lower()
    key = "".join(ch if (ch.isalnum() or ch in {"_", "-"}) else "_" for ch in key)
    return key or default


def _form_text(name, default=""):
    if name in request.form:
        return str(request.form.get(name) or "").strip()
    return default


def _parse_venue_blocks(raw_value):
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
        title = str(item.get("title") or item.get("heading") or "").strip()
        body = str(item.get("body") or item.get("description") or "").strip()
        meta = str(item.get("meta") or item.get("time") or "").strip()
        address = str(item.get("address") or "").strip()
        if not any([title, body, meta, address]):
            continue
        key = str(item.get("key") or item.get("id") or f"venue_{i+1}").strip().lower()
        key = "".join(ch if (ch.isalnum() or ch in {"_", "-"}) else "_" for ch in key)
        cleaned.append({
            "key": key or f"venue_{i+1}",
            "title": title or f"Detail {i + 1}",
            "meta": meta,
            "body": body,
            "address": address,
        })
    return cleaned


def _resolve_image_url(form_name, file_name, existing=""):
    file_storage = request.files.get(file_name)
    if file_storage and file_storage.filename:
        uploaded = upload_photo_to_telegram(
            file_storage,
            caption=(request.form.get("title") or request.form.get("couple_names") or "Wedflix thumbnail").strip(),
        )
        if uploaded:
            return uploaded

    direct = (request.form.get(form_name) or "").strip()
    if direct:
        return normalize_image_url(direct)
    if existing:
        return existing
    return normalize_image_url("")


def _resolve_episode_video(existing=None):
    existing = existing or {}
    youtube_url = (request.form.get("youtube_url") or "").strip()

    if youtube_url:
        return {
            "video_provider": "youtube",
            "youtube_url": youtube_url,
            "video_url": "",
            "embed_url": youtube_embed_url(youtube_url),
        }

    return {
        "video_provider": "",
        "youtube_url": "",
        "video_url": "",
        "embed_url": "",
    }


@admin_bp.route("/")
@login_required
@admin_required
def home():
    weddings = Wedding.all()
    if not is_developer():
        weddings = [w for w in weddings if can_manage_wedding(w)]
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
    plan_error = limit_error("wedding")
    if plan_error:
        error_response = _form_error(plan_error, 403)
        if error_response:
            return error_response
        return redirect(url_for("admin.home"))
    access_level = (request.form.get("access_level") or "private").strip().lower()
    if access_level not in {"public", "private"}:
        access_level = "private"
    if access_level == "public" and not public_access_allowed():
        access_level = "private"
    payload = {
        "couple_names": request.form.get("couple_names"),
        "wedding_date": request.form.get("wedding_date"),
        "wedding_time": (request.form.get("wedding_time") or "").strip(),
        "hero_video_url": request.form.get("hero_video_url"),
        "description": request.form.get("description"),
        "venue_name": request.form.get("venue_name"),
        "event_address": request.form.get("event_address"),
        "venue_eyebrow": (request.form.get("venue_eyebrow") or "You're Invited To").strip(),
        "venue_script": (request.form.get("venue_script") or "the wedding of").strip(),
        "venue_section_label": (request.form.get("venue_section_label") or "Our Venue").strip(),
        "venue_map_location": (request.form.get("venue_map_location") or request.form.get("event_address") or "").strip(),
        "venue_description": (request.form.get("venue_description") or "").strip(),
        "venue_image": _resolve_image_url("venue_image", "venue_image_file"),
        "invitation_bg_image": _resolve_image_url("invitation_bg_image", "invitation_bg_image_file"),
        "profile_image": _resolve_image_url("profile_image", "profile_image_file"),
        "music_url": _resolve_music_url("music_url", "music_file"),
        "invitation_music_url": _resolve_music_url("invitation_music_url", "invitation_music_file"),
        "access_level": access_level,
        "show_on_demo_home": request.form.get("show_on_demo_home") in {"1", "true", "on", "yes"} if is_developer() else False,
        "premium_experience_enabled": request.form.get("premium_experience_enabled") in {"1", "true", "on", "yes"},
        "hero_kicker": _form_text("hero_kicker", "A WEDDING ORIGINAL"),
        "hero_badge_top": _form_text("hero_badge_top", "TOP"),
        "hero_badge_bottom": _form_text("hero_badge_bottom", "10"),
        "hero_meta_one": _form_text("hero_meta_one", "Celebration"),
        "hero_meta_two": _form_text("hero_meta_two", "Family"),
        "hero_meta_three": _form_text("hero_meta_three", "Romance"),
        "invitation_title": (request.form.get("invitation_title") or "Wedding Invitation").strip(),
        "programs_section_title": (request.form.get("programs_section_title") or "Wedding Programs").strip(),
        "invite_envelope_label": _form_text("invite_envelope_label", "Wedding Invitation"),
        "invite_venue_label": _form_text("invite_venue_label", "Venue"),
        "invite_map_label": _form_text("invite_map_label", "Open Map"),
        "invite_scratch_label": _form_text("invite_scratch_label", "Scratch to reveal"),
        "invite_fun_kicker": _form_text("invite_fun_kicker", "Join The Celebration"),
        "invite_fun_title": _form_text("invite_fun_title", "Celebrate With Us"),
        "invite_fun_intro": _form_text("invite_fun_intro", "A few fun questions before the big day."),
        "invite_guess_title": _form_text("invite_guess_title", "Make a Guess"),
        "invite_guess_question": _form_text("invite_guess_question", "Who will get emotional first?"),
        "invite_reason_question": _form_text("invite_reason_question", "Why are you coming?"),
        "invite_notes_title": _form_text("invite_notes_title", "Leave Us a Note"),
        "invite_notes_prompt": _form_text("invite_notes_prompt", "Share a wish or memory."),
        "invite_note_placeholder": _form_text("invite_note_placeholder", "Write something from the heart..."),
        "invite_send_label": _form_text("invite_send_label", "Send Love"),
        "invite_hashtag_label": _form_text("invite_hashtag_label", "Forever begins here"),
        "invite_story_button_label": _form_text("invite_story_button_label", "See Their Wedflix Story"),
        "invite_main_kicker": _form_text("invite_main_kicker", "Main Invitation"),
        "invite_main_title": _form_text("invite_main_title", "The Wedding of Ashwin & Tisha"),
        "invite_groom_name": _form_text("invite_groom_name", "Ashwin"),
        "invite_groom_details": _form_text("invite_groom_details", "S/o Late Mrs. Reshma & Late Mr. Mahesh Pinjani"),
        "invite_groom_guardian": _form_text("invite_groom_guardian", "Guardian: Smt. Bhavika & Shri Manojkumar Pinjani"),
        "invite_bride_name": _form_text("invite_bride_name", "Tisha"),
        "invite_bride_details": _form_text("invite_bride_details", "D/o Smt. Jaya & Late Shri Dhiraj Ratnani"),
        "invite_residence_title": _form_text("invite_residence_title", "Residence Address"),
        "invite_residence_line_one": _form_text("invite_residence_line_one", "Lal Keshav Niwas"),
        "invite_residence_line_two": _form_text("invite_residence_line_two", "Sindhi Colony, Pachora"),
        "invite_by_title": _form_text("invite_by_title", "Regards"),
        "invite_by_line_one": _form_text("invite_by_line_one", "Mr. Manoj Lalchand Pinjani"),
        "invite_by_line_two": _form_text("invite_by_line_two", "& All Pinjani Family"),
        "invite_by_line_three": _form_text("invite_by_line_three", "Friends & Relatives"),
        "invite_by_line_four": _form_text("invite_by_line_four", ""),
        "custom_sections": _parse_custom_sections(request.form.get("custom_sections_json")),
        "venue_blocks": (
            _parse_venue_blocks(request.form.get("venue_blocks_json"))
            if "venue_blocks_json" in request.form
            else []
        ),
        "custom_section_label": (request.form.get("custom_section_label") or "").strip(),
        "owner_user_id": str(current_user.id),
    }
    payload = enrich_wedding_copy(payload)
    payload["public_slug"] = Wedding.unique_public_slug(payload.get("couple_names") or "wedding")
    wedding_id = Wedding.create(payload)
    success_response = _form_success(
        "Wedding created",
        wedding_id=str(wedding_id),
        public_slug=payload["public_slug"],
        public_home_path=f"/p/{payload['public_slug']}",
    )
    if success_response:
        return success_response
    return redirect(url_for("admin.home"))


@admin_bp.route("/weddings/<wedding_id>/update", methods=["POST"])
@login_required
@admin_required
def update_wedding(wedding_id):
    current = Wedding.get(wedding_id) or {}
    if not can_edit_wedding(current):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    access_level = (request.form.get("access_level") or current.get("access_level") or "private").strip().lower()
    if access_level not in {"public", "private"}:
        access_level = "private"
    if access_level == "public" and not public_access_allowed():
        access_level = "private"
    payload = {
        "couple_names": (request.form.get("couple_names") or "").strip(),
        "wedding_date": (request.form.get("wedding_date") or "").strip(),
        "wedding_time": (request.form.get("wedding_time") or current.get("wedding_time") or "").strip(),
        "hero_video_url": (request.form.get("hero_video_url") or "").strip(),
        "description": (request.form.get("description") or "").strip(),
        "venue_name": (request.form.get("venue_name") or current.get("venue_name") or "").strip(),
        "event_address": (request.form.get("event_address") or current.get("event_address") or "").strip(),
        "venue_eyebrow": (request.form.get("venue_eyebrow") or current.get("venue_eyebrow") or "You're Invited To").strip(),
        "venue_script": (request.form.get("venue_script") or current.get("venue_script") or "the wedding of").strip(),
        "venue_section_label": (request.form.get("venue_section_label") or current.get("venue_section_label") or "Our Venue").strip(),
        "venue_map_location": (
            request.form.get("venue_map_location")
            or request.form.get("event_address")
            or current.get("venue_map_location")
            or current.get("event_address")
            or ""
        ).strip(),
        "venue_description": (request.form.get("venue_description") or current.get("venue_description") or "").strip(),
        "venue_image": _resolve_image_url("venue_image", "venue_image_file", current.get("venue_image", "")),
        "invitation_bg_image": _resolve_image_url("invitation_bg_image", "invitation_bg_image_file", current.get("invitation_bg_image", "")),
        "profile_image": _resolve_image_url("profile_image", "profile_image_file", current.get("profile_image", "")),
        "music_url": _resolve_music_url("music_url", "music_file", current.get("music_url", "")),
        "invitation_music_url": _resolve_music_url("invitation_music_url", "invitation_music_file", current.get("invitation_music_url", "")),
        "access_level": access_level,
        "show_on_demo_home": (
            request.form.get("show_on_demo_home") in {"1", "true", "on", "yes"}
            if is_developer()
            else bool(current.get("show_on_demo_home"))
        ),
        "premium_experience_enabled": request.form.get("premium_experience_enabled") in {"1", "true", "on", "yes"},
        "hero_kicker": _form_text("hero_kicker", current.get("hero_kicker") or "A WEDDING ORIGINAL"),
        "hero_badge_top": _form_text("hero_badge_top", current.get("hero_badge_top") or "TOP"),
        "hero_badge_bottom": _form_text("hero_badge_bottom", current.get("hero_badge_bottom") or "10"),
        "hero_meta_one": _form_text("hero_meta_one", current.get("hero_meta_one") or "Celebration"),
        "hero_meta_two": _form_text("hero_meta_two", current.get("hero_meta_two") or "Family"),
        "hero_meta_three": _form_text("hero_meta_three", current.get("hero_meta_three") or "Romance"),
        "invitation_title": (request.form.get("invitation_title") or current.get("invitation_title") or "Wedding Invitation").strip(),
        "programs_section_title": (request.form.get("programs_section_title") or current.get("programs_section_title") or "Wedding Programs").strip(),
        "invite_envelope_label": _form_text("invite_envelope_label", current.get("invite_envelope_label") or "Wedding Invitation"),
        "invite_venue_label": _form_text("invite_venue_label", current.get("invite_venue_label") or "Venue"),
        "invite_map_label": _form_text("invite_map_label", current.get("invite_map_label") or "Open Map"),
        "invite_scratch_label": _form_text("invite_scratch_label", current.get("invite_scratch_label") or "Scratch to reveal"),
        "invite_fun_kicker": _form_text("invite_fun_kicker", current.get("invite_fun_kicker") or "Join The Celebration"),
        "invite_fun_title": _form_text("invite_fun_title", current.get("invite_fun_title") or "Celebrate With Us"),
        "invite_fun_intro": _form_text("invite_fun_intro", current.get("invite_fun_intro") or "A few fun questions before the big day."),
        "invite_guess_title": _form_text("invite_guess_title", current.get("invite_guess_title") or "Make a Guess"),
        "invite_guess_question": _form_text("invite_guess_question", current.get("invite_guess_question") or "Who will get emotional first?"),
        "invite_reason_question": _form_text("invite_reason_question", current.get("invite_reason_question") or "Why are you coming?"),
        "invite_notes_title": _form_text("invite_notes_title", current.get("invite_notes_title") or "Leave Us a Note"),
        "invite_notes_prompt": _form_text("invite_notes_prompt", current.get("invite_notes_prompt") or "Share a wish or memory."),
        "invite_note_placeholder": _form_text("invite_note_placeholder", current.get("invite_note_placeholder") or "Write something from the heart..."),
        "invite_send_label": _form_text("invite_send_label", current.get("invite_send_label") or "Send Love"),
        "invite_hashtag_label": _form_text("invite_hashtag_label", current.get("invite_hashtag_label") or "Forever begins here"),
        "invite_story_button_label": _form_text("invite_story_button_label", current.get("invite_story_button_label") or "See Their Wedflix Story"),
        "invite_main_kicker": _form_text("invite_main_kicker", current.get("invite_main_kicker") or "Main Invitation"),
        "invite_main_title": _form_text("invite_main_title", current.get("invite_main_title") or "The Wedding of Ashwin & Tisha"),
        "invite_groom_name": _form_text("invite_groom_name", current.get("invite_groom_name") or "Ashwin"),
        "invite_groom_details": _form_text("invite_groom_details", current.get("invite_groom_details") or "S/o Late Mrs. Reshma & Late Mr. Mahesh Pinjani"),
        "invite_groom_guardian": _form_text("invite_groom_guardian", current.get("invite_groom_guardian") or "Guardian: Smt. Bhavika & Shri Manojkumar Pinjani"),
        "invite_bride_name": _form_text("invite_bride_name", current.get("invite_bride_name") or "Tisha"),
        "invite_bride_details": _form_text("invite_bride_details", current.get("invite_bride_details") or "D/o Smt. Jaya & Late Shri Dhiraj Ratnani"),
        "invite_residence_title": _form_text("invite_residence_title", current.get("invite_residence_title") or "Residence Address"),
        "invite_residence_line_one": _form_text("invite_residence_line_one", current.get("invite_residence_line_one") or "Lal Keshav Niwas"),
        "invite_residence_line_two": _form_text("invite_residence_line_two", current.get("invite_residence_line_two") or "Sindhi Colony, Pachora"),
        "invite_by_title": _form_text("invite_by_title", current.get("invite_by_title") or "Regards"),
        "invite_by_line_one": _form_text("invite_by_line_one", current.get("invite_by_line_one") or "Mr. Manoj Lalchand Pinjani"),
        "invite_by_line_two": _form_text("invite_by_line_two", current.get("invite_by_line_two") or "& All Pinjani Family"),
        "invite_by_line_three": _form_text("invite_by_line_three", current.get("invite_by_line_three") or "Friends & Relatives"),
        "invite_by_line_four": _form_text("invite_by_line_four", current.get("invite_by_line_four") or ""),
        "custom_sections": (
            _parse_custom_sections(request.form.get("custom_sections_json"))
            if "custom_sections_json" in request.form
            else current.get("custom_sections", [])
        ),
        "venue_blocks": (
            _parse_venue_blocks(request.form.get("venue_blocks_json"))
            if "venue_blocks_json" in request.form
            else current.get("venue_blocks", [])
        ),
        "custom_section_label": (
            (request.form.get("custom_section_label") or "").strip()
            if "custom_section_label" in request.form
            else (current.get("custom_section_label") or "").strip()
        ),
    }
    payload = enrich_wedding_copy(payload, current)
    payload["public_slug"] = current.get("public_slug") or Wedding.unique_public_slug(payload.get("couple_names") or "wedding", exclude_id=wedding_id)
    mongo.db.weddings.update_one({"_id": ObjectId(wedding_id)}, {"$set": payload})
    success_response = _form_success(
        "Wedding updated",
        wedding_id=wedding_id,
        public_slug=payload["public_slug"],
        public_home_path=f"/p/{payload['public_slug']}",
    )
    if success_response:
        return success_response
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/weddings/<wedding_id>/delete", methods=["POST"])
@login_required
@admin_required
def delete_wedding(wedding_id):
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
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
        mongo.db.photos.delete_many({"program_id": {"$in": program_ids}})
        mongo.db.programs.delete_many({"_id": {"$in": program_ids}})
    mongo.db.invitation_programs.delete_many({"wedding_id": wid})
    mongo.db.weddings.delete_one({"_id": wid})

    success_response = _form_success("Wedding profile deleted")
    if success_response:
        return success_response
    return redirect(url_for("admin.home"))


@admin_bp.route("/programs/create", methods=["POST"])
@login_required
@admin_required
def create_program():
    wedding_id = request.form.get("wedding_id")
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    plan_error = limit_error("program")
    if plan_error:
        return _form_error(plan_error, 403) or redirect(url_for("admin.home", wedding_id=wedding_id))
    section_key = _clean_section_key(request.form.get("section_key"), "main")
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
        "event_sections": _parse_custom_sections(request.form.get("event_sections_json")),
        "order": _safe_int(request.form.get("order"), 0),
    }
    program_id = Program.create(payload)
    flash("Program created", "success")
    success_response = _form_success("Program created", wedding_id=wedding_id, program_id=str(program_id))
    if success_response:
        return success_response
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/invitation-programs/create", methods=["POST"])
@login_required
@admin_required
def create_invitation_program():
    wedding_id = request.form.get("wedding_id")
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    section_key = _clean_section_key(request.form.get("section_key"), "invitation")
    existing_count = mongo.db.invitation_programs.count_documents({"wedding_id": ObjectId(wedding_id)})
    payload = {
        "wedding_id": ObjectId(wedding_id),
        "section_key": section_key,
        "title": request.form.get("title"),
        "description": (request.form.get("description") or "").strip(),
        "thumbnail": _resolve_image_url("thumbnail", "thumbnail_file"),
        "event_date": (request.form.get("event_date") or "").strip(),
        "event_time": (request.form.get("event_time") or "").strip(),
        "venue_name": (request.form.get("venue_name") or "").strip(),
        "event_address": (request.form.get("event_address") or "").strip(),
        "music_url": _resolve_music_url("music_url", "music_file"),
        "order": _safe_int(request.form.get("order"), existing_count + 1),
    }
    program_id = InvitationProgram.create(payload)
    success_response = _form_success("Invitation program created", wedding_id=wedding_id, program_id=str(program_id))
    if success_response:
        return success_response
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/invitation-programs/<program_id>/update", methods=["POST"])
@login_required
@admin_required
def update_invitation_program(program_id):
    program = InvitationProgram.get(program_id)
    wedding_id = str(program.get("wedding_id")) if program else ""
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    section_key = _clean_section_key(request.form.get("section_key") or (program or {}).get("section_key"), "invitation")
    payload = {
        "section_key": section_key,
        "title": (request.form.get("title") or "").strip(),
        "description": (request.form.get("description") or "").strip(),
        "thumbnail": _resolve_image_url("thumbnail", "thumbnail_file", (program or {}).get("thumbnail", "")),
        "event_date": (request.form.get("event_date") or "").strip(),
        "event_time": (request.form.get("event_time") or "").strip(),
        "venue_name": (request.form.get("venue_name") or "").strip(),
        "event_address": (request.form.get("event_address") or "").strip(),
        "music_url": _resolve_music_url("music_url", "music_file", (program or {}).get("music_url", "")),
        "order": _safe_int(request.form.get("order"), (program or {}).get("order", 0)),
    }
    mongo.db.invitation_programs.update_one({"_id": ObjectId(program_id)}, {"$set": payload})
    success_response = _form_success("Invitation program updated", wedding_id=wedding_id, program_id=program_id)
    if success_response:
        return success_response
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/invitation-programs/<program_id>/delete", methods=["POST"])
@login_required
@admin_required
def delete_invitation_program(program_id):
    program = InvitationProgram.get(program_id)
    wedding_id = str(program.get("wedding_id")) if program else ""
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    mongo.db.invitation_programs.delete_one({"_id": ObjectId(program_id)})
    success_response = _form_success("Invitation program deleted", wedding_id=wedding_id)
    if success_response:
        return success_response
    return redirect(url_for("admin.home", wedding_id=wedding_id))


@admin_bp.route("/programs/<program_id>/update", methods=["POST"])
@login_required
@admin_required
def update_program(program_id):
    program = Program.get(program_id)
    wedding_id = str(program.get("wedding_id")) if program else ""
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    section_key = _clean_section_key(request.form.get("section_key") or (program or {}).get("section_key"), "main")
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
        "music_url": _resolve_music_url("music_url", "music_file", (program or {}).get("music_url", "")),
        "event_sections": (
            _parse_custom_sections(request.form.get("event_sections_json"))
            if "event_sections_json" in request.form
            else (program or {}).get("event_sections", [])
        ),
        "order": _safe_int(request.form.get("order"), 0),
    }
    mongo.db.programs.update_one({"_id": ObjectId(program_id)}, {"$set": payload})
    success_response = _form_success("Program updated", wedding_id=wedding_id, program_id=program_id)
    if success_response:
        return success_response
    return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))

@admin_bp.route("/programs/<program_id>/delete", methods=["POST"])
@login_required
@admin_required
def delete_program(program_id):
    program = Program.get(program_id)
    wedding_id = str(program.get("wedding_id")) if program else ""
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    pid = ObjectId(program_id)
    episode_ids = [e["_id"] for e in mongo.db.episodes.find({"program_id": pid}, {"_id": 1})]
    if episode_ids:
        mongo.db.comments.delete_many({"episode_id": {"$in": episode_ids}})
        mongo.db.photos.delete_many({"episode_id": {"$in": episode_ids}})
    mongo.db.photos.delete_many({"program_id": pid})
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
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))
    plan_error = limit_error("episode", program_id=program_id)
    if plan_error:
        return _form_error(plan_error, 403) or redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))

    payload = {
        "program_id": ObjectId(program_id),
        "section_key": _clean_section_key(request.form.get("section_key"), "main"),
        "season_number": _safe_int(request.form.get("season_number"), 1),
        "title": request.form.get("title"),
        "description": request.form.get("description"),
        "order": _safe_int(request.form.get("order"), 0),
        "music_url": _resolve_music_url("music_url", "music_file"),
        **_resolve_episode_video(),
    }
    try:
        payload["thumbnail"] = _resolve_image_url("thumbnail", "thumbnail_file")
    except TelegramMediaError as exc:
        error_response = _form_error(str(exc), 400)
        if error_response:
            return error_response
        return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))
    Episode.create(payload)
    success_response = _form_success("Moment added", wedding_id=wedding_id, program_id=program_id)
    if success_response:
        return success_response
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
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))

    payload = {
        "section_key": _clean_section_key(request.form.get("section_key") or (ep or {}).get("section_key"), "main"),
        "season_number": _safe_int(request.form.get("season_number"), 1),
        "title": (request.form.get("title") or "").strip(),
        "description": (request.form.get("description") or "").strip(),
        "order": _safe_int(request.form.get("order"), 0),
        "music_url": _resolve_music_url("music_url", "music_file", (ep or {}).get("music_url", "")),
        **_resolve_episode_video(ep),
    }
    try:
        payload["thumbnail"] = _resolve_image_url("thumbnail", "thumbnail_file", (ep or {}).get("thumbnail", ""))
    except TelegramMediaError as exc:
        error_response = _form_error(str(exc), 400)
        if error_response:
            return error_response
        return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))
    mongo.db.episodes.update_one({"_id": ObjectId(episode_id)}, {"$set": payload})
    success_response = _form_success("Moment updated", wedding_id=wedding_id, program_id=program_id, episode_id=episode_id)
    if success_response:
        return success_response
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
    if not can_edit_wedding(Wedding.get(wedding_id)):
        return _form_error("Unauthorized", 403) or redirect(url_for("admin.home"))

    mongo.db.episodes.delete_one({"_id": ObjectId(episode_id)})
    success_response = _form_success("Episode deleted", wedding_id=wedding_id, program_id=program_id, episode_id=episode_id)
    if success_response:
        return success_response
    return redirect(url_for("admin.home", wedding_id=wedding_id, program_id=program_id))

