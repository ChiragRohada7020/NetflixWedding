import mimetypes
import os

import requests
from flask import Blueprint, Response, jsonify, redirect, request, stream_with_context
from flask_login import current_user, login_required, login_user, logout_user
from bson import ObjectId

from app import mongo
from app.models.comment import Comment
from app.models.episode import Episode
from app.models.photo import Photo
from app.models.program import Program
from app.models.wedding import Wedding
from app.models.user import User
from app.utils.face_client import FaceServiceError, search_faces
from app.utils.face_jobs import enqueue_face_index_job
from app.utils.telegram_media import TelegramMediaError, upload_photo_to_telegram

api_bp = Blueprint("api", __name__)


def _to_jsonable(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_jsonable(v) for k, v in value.items()}
    return value


def _can_view_wedding(wedding):
    if not wedding:
        return False
    return (wedding.get("access_level") or "private") == "public" or current_user.is_authenticated


def _absolute_media_url(media_path):
    if not media_path:
        return ""
    if media_path.startswith("http://") or media_path.startswith("https://"):
        return media_path
    base_url = (os.getenv("PUBLIC_BACKEND_URL") or request.host_url).strip().rstrip("/")
    return f"{base_url}/{media_path.lstrip('/')}"


@api_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@api_bp.route("/session", methods=["GET"])
def session_info():
    return jsonify(
        {
            "authenticated": bool(current_user.is_authenticated),
            "is_admin": bool(getattr(current_user, "is_admin", False)) if current_user.is_authenticated else False,
            "name": getattr(current_user, "name", "") if current_user.is_authenticated else "",
        }
    )

@api_bp.route("/session/login", methods=["POST"])
def session_login():
    payload = request.get_json(force=True) or {}
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    user_doc = User.get_by_email(email)
    if not user_doc:
      return jsonify({"error": "Invalid email or password"}), 401
    user = User.get_by_id(str(user_doc["_id"]))
    if not user or not user.check_password(password):
      return jsonify({"error": "Invalid email or password"}), 401
    if not bool(getattr(user, "is_admin", False)):
      return jsonify({"error": "Admin access required"}), 403
    login_user(user)
    return jsonify(
        {
            "authenticated": True,
            "is_admin": bool(getattr(user, "is_admin", False)),
            "name": getattr(user, "name", ""),
        }
    )

@api_bp.route("/session/logout", methods=["POST"])
def session_logout():
    if current_user.is_authenticated:
        logout_user()
    return jsonify({"authenticated": False})


@api_bp.route("/weddings", methods=["GET"])
def weddings():
    docs = Wedding.all()
    if not current_user.is_authenticated:
        docs = [w for w in docs if (w.get("access_level") or "private") == "public"]
    return jsonify(_to_jsonable(docs))


@api_bp.route("/weddings/<wedding_id>", methods=["GET"])
def wedding_detail(wedding_id):
    wedding = Wedding.get(wedding_id)
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(_to_jsonable(wedding))


@api_bp.route("/weddings/<wedding_id>/programs", methods=["GET"])
def wedding_programs(wedding_id):
    wedding = Wedding.get(wedding_id)
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(_to_jsonable(Program.by_wedding(wedding_id)))


@api_bp.route("/programs/<program_id>/episodes", methods=["GET"])
def program_episodes(program_id):
    program = Program.get(program_id)
    if not program:
        return jsonify({"error": "Program not found"}), 404
    wedding = Wedding.get(str(program.get("wedding_id")))
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(_to_jsonable(Episode.by_program(program_id)))


@api_bp.route("/episodes/<episode_id>", methods=["GET"])
def episode_detail(episode_id):
    episode = Episode.get(episode_id)
    if not episode:
        return jsonify({"error": "Episode not found"}), 404

    program = Program.get(str(episode.get("program_id")))
    if not program:
        return jsonify({"error": "Program not found"}), 404

    wedding = Wedding.get(str(program.get("wedding_id")))
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404

    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify(_to_jsonable(episode))


@api_bp.route("/episodes/<episode_id>/photos", methods=["GET", "POST"])
def episode_photos(episode_id):
    episode = Episode.get(episode_id)
    if not episode:
        return jsonify({"error": "Episode not found"}), 404

    program = Program.get(str(episode.get("program_id")))
    wedding = Wedding.get(str(program.get("wedding_id"))) if program else None
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "POST":
        if not current_user.is_authenticated:
            return jsonify({"error": "Login required"}), 401

        files = request.files.getlist("photos")
        if not files:
            files = request.files.getlist("photos[]")
        if not files:
            single_photo = request.files.get("photo")
            files = [single_photo] if single_photo else []
        if not files:
            return jsonify({"error": "Please choose at least one photo"}), 400

        existing_count = mongo.db.photos.count_documents({"episode_id": ObjectId(episode_id)})
        inserted = []
        for index, file_storage in enumerate(files):
            if not file_storage or not file_storage.filename:
                continue
            try:
                image_url = upload_photo_to_telegram(
                    file_storage,
                    caption=f"{episode.get('title') or 'Wedflix event'} photo",
                )
            except TelegramMediaError as exc:
                return jsonify({"error": f"Could not upload {file_storage.filename}: {exc}"}), 400

            doc = {
                "episode_id": ObjectId(episode_id),
                "url": image_url,
                "caption": "",
                "order": existing_count + index + 1,
                "uploaded_by": getattr(current_user, "name", "") or "",
            }
            result = mongo.db.photos.insert_one(doc)
            doc["_id"] = result.inserted_id
            enqueue_face_index_job(
                str(result.inserted_id),
                _absolute_media_url(image_url),
                episode_id=episode_id,
                wedding_id=str(wedding.get("_id")) if wedding else None,
            )
            inserted.append(Photo.serialize(doc))

        return jsonify(_to_jsonable(inserted)), 201

    return jsonify(_to_jsonable(Photo.by_episode(episode_id)))


@api_bp.route("/photos/face-search", methods=["POST"])
def photo_face_search():
    wedding_id = (request.form.get("wedding_id") or "").strip()
    wedding = Wedding.get(wedding_id) if wedding_id else None
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401

    reference = request.files.get("photo") or request.files.get("reference")
    if not reference:
        return jsonify({"error": "Please choose a clear selfie or face photo."}), 400

    try:
        result = search_faces(reference, wedding_id=wedding_id)
    except FaceServiceError as exc:
        return jsonify({"error": str(exc)}), 503

    match_ids = []
    for match in result.get("matches") or []:
        try:
            match_ids.append(ObjectId(match.get("photo_id")))
        except Exception:
            continue
    photos = list(mongo.db.photos.find({"_id": {"$in": match_ids}})) if match_ids else []
    by_id = {str(photo["_id"]): Photo.serialize(photo) for photo in photos}
    ordered_photos = [by_id[str(photo_id)] for photo_id in match_ids if str(photo_id) in by_id]

    return jsonify(
        _to_jsonable(
            {
                "matches": result.get("matches") or [],
                "photos": ordered_photos,
                "face_count": result.get("face_count", 0),
            }
        )
    )


@api_bp.route("/photos/<photo_id>", methods=["PATCH", "DELETE"])
def photo_detail(photo_id):
    if not current_user.is_authenticated:
        return jsonify({"error": "Login required"}), 401

    try:
        photo_object_id = ObjectId(photo_id)
    except Exception:
        return jsonify({"error": "Photo not found"}), 404

    photo = mongo.db.photos.find_one({"_id": photo_object_id})
    if not photo:
        return jsonify({"error": "Photo not found"}), 404

    episode = Episode.get(str(photo.get("episode_id")))
    if not episode:
        return jsonify({"error": "Episode not found"}), 404

    if request.method == "DELETE":
        mongo.db.photos.delete_one({"_id": photo_object_id})
        return jsonify({"ok": True})

    payload = request.get_json(silent=True) or {}
    update = {}
    if "caption" in payload:
        update["caption"] = (payload.get("caption") or "").strip()[:160]
    if "order" in payload:
        try:
            update["order"] = int(payload.get("order"))
        except (TypeError, ValueError):
            return jsonify({"error": "Order must be a number"}), 400

    if update:
        mongo.db.photos.update_one({"_id": photo_object_id}, {"$set": update})

    updated = mongo.db.photos.find_one({"_id": photo_object_id})
    return jsonify(_to_jsonable(Photo.serialize(updated)))


@api_bp.route("/episodes/<episode_id>/comments", methods=["GET", "POST"])
def episode_comments(episode_id):
    episode = Episode.get(episode_id)
    if not episode:
        return jsonify({"error": "Episode not found"}), 404

    program = Program.get(str(episode.get("program_id")))
    wedding = Wedding.get(str(program.get("wedding_id"))) if program else None
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401

    if request.method == "GET":
        return jsonify(_to_jsonable(Comment.by_episode(episode_id)))

    if not current_user.is_authenticated:
        return jsonify({"error": "Login required"}), 401

    payload = request.get_json(force=True)
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400

    Comment.add(episode_id=episode_id, user_name=current_user.name, text=text)
    return jsonify({"status": "ok"}), 201


@api_bp.route("/episodes/<episode_id>/like", methods=["POST"])
@login_required
def like_episode(episode_id):
    return jsonify({"status": "ok", "episode_id": episode_id})


@api_bp.route("/media/telegram/<path:file_id>", methods=["GET"])
def telegram_media(file_id):
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        return jsonify({"error": "Telegram media storage is not configured"}), 503

    response = requests.get(
        f"https://api.telegram.org/bot{token}/getFile",
        params={"file_id": file_id},
        timeout=20,
    )
    payload = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    if not response.ok or not payload.get("ok"):
        return jsonify({"error": payload.get("description") or "Telegram file lookup failed"}), 502

    file_path = (payload.get("result") or {}).get("file_path")
    if not file_path:
        return jsonify({"error": "Telegram file path missing"}), 502

    file_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
    if request.args.get("download") != "1":
        return redirect(file_url, code=302)

    file_response = requests.get(file_url, stream=True, timeout=(20, 120))
    if not file_response.ok:
        return jsonify({"error": "Telegram file download failed"}), 502

    content_type = file_response.headers.get("content-type") or mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    return Response(
        stream_with_context(file_response.iter_content(chunk_size=1024 * 64)),
        content_type=content_type,
        headers={
            "Cache-Control": "private, max-age=300",
            "Content-Disposition": f'attachment; filename="{os.path.basename(file_path) or "wedflix-photo"}"',
        },
    )
