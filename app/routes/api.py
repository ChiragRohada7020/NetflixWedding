import mimetypes
import os

import requests
from flask import Blueprint, Response, jsonify, request, stream_with_context
from flask_login import current_user, login_required, login_user, logout_user
from bson import ObjectId

from app import mongo
from app.models.comment import Comment
from app.models.episode import Episode
from app.models.photo import Photo
from app.models.program import Program
from app.models.wedding import Wedding
from app.models.user import User
from app.utils.google_drive import GoogleDriveImportError, download_drive_images
from app.utils.plans import (
    DEFAULT_PLAN_ID,
    can_manage_wedding,
    can_view_wedding,
    drive_import_allowed,
    ensure_default_plan,
    get_current_plan,
    is_developer,
    limit_error,
    normalize_plan,
    owned_wedding_ids,
    usage_for_user,
)
from app.utils.telegram_media import TelegramMediaError, upload_bytes_to_telegram, upload_photo_to_telegram

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
    return can_view_wedding(wedding)


def _json_user(doc):
    if not doc:
        return None
    user_wedding_ids = [str(item) for item in doc.get("wedding_ids", [])]
    owned_weddings = list(mongo.db.weddings.find({"owner_user_id": str(doc["_id"])}).sort("couple_names", 1))
    if user_wedding_ids:
        linked_weddings = list(mongo.db.weddings.find({"_id": {"$in": [ObjectId(item) for item in user_wedding_ids if ObjectId.is_valid(item)]}}))
        by_id = {str(wedding.get("_id")): wedding for wedding in owned_weddings}
        by_id.update({str(wedding.get("_id")): wedding for wedding in linked_weddings})
        owned_weddings = list(by_id.values())
    return {
        "_id": str(doc["_id"]),
        "name": doc.get("name") or "",
        "email": doc.get("email") or "",
        "role": doc.get("role") or "admin",
        "plan_id": doc.get("plan_id") or DEFAULT_PLAN_ID,
        "status": doc.get("status") or "active",
        "phone": doc.get("phone") or "",
        "details": doc.get("details") or {},
        "usage": usage_for_user(doc),
        "wedding_ids": user_wedding_ids,
        "weddings": [
            {
                "_id": str(wedding.get("_id")),
                "couple_names": wedding.get("couple_names") or "Untitled Wedding",
                "wedding_date": wedding.get("wedding_date") or "",
                "access_level": wedding.get("access_level") or "private",
                "show_on_demo_home": bool(wedding.get("show_on_demo_home")),
                "public_slug": wedding.get("public_slug") or "",
            }
            for wedding in owned_weddings
        ],
    }


@api_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@api_bp.route("/session", methods=["GET"])
def session_info():
    current_user_doc = User.get_by_email(getattr(current_user, "email", "")) if current_user.is_authenticated else None
    is_active = bool(getattr(current_user, "is_active", True)) if current_user.is_authenticated else False
    return jsonify(
        {
            "authenticated": bool(current_user.is_authenticated and is_active),
            "is_admin": bool(getattr(current_user, "is_admin", False) and is_active) if current_user.is_authenticated else False,
            "is_developer": bool(getattr(current_user, "is_developer", False) and is_active) if current_user.is_authenticated else False,
            "name": getattr(current_user, "name", "") if current_user.is_authenticated else "",
            "email": getattr(current_user, "email", "") if current_user.is_authenticated else "",
            "plan": _to_jsonable(get_current_plan()) if current_user.is_authenticated else None,
            "usage": _to_jsonable(usage_for_user(current_user_doc)) if current_user_doc else None,
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
    if (user_doc.get("status") or "active") != "active":
      return jsonify({"error": "This account is not active"}), 403
    user = User.get_by_id(str(user_doc["_id"]))
    if not user or not user.check_password(password):
      return jsonify({"error": "Invalid email or password"}), 401
    if bool(getattr(user, "is_developer", False)):
      return jsonify({"error": "Use the developer login."}), 403
    if not bool(getattr(user, "is_admin", False)):
      return jsonify({"error": "Admin access required"}), 403
    login_user(user)
    return jsonify(
        {
            "authenticated": True,
            "is_admin": bool(getattr(user, "is_admin", False)),
            "is_developer": False,
            "name": getattr(user, "name", ""),
        }
    )


@api_bp.route("/developer/login", methods=["POST"])
def developer_login():
    payload = request.get_json(force=True) or {}
    email = (payload.get("email") or "").strip()
    password = payload.get("password") or ""
    user_doc = User.get_by_email(email)
    if not user_doc:
        return jsonify({"error": "Invalid developer credentials"}), 401
    if (user_doc.get("status") or "active") != "active":
        return jsonify({"error": "This developer account is not active"}), 403
    user = User.get_by_id(str(user_doc["_id"]))
    if not user or not user.check_password(password) or not bool(getattr(user, "is_developer", False)):
        return jsonify({"error": "Invalid developer credentials"}), 401
    login_user(user)
    return jsonify({"authenticated": True, "is_admin": True, "is_developer": True, "name": getattr(user, "name", "")})


@api_bp.route("/session/signup", methods=["POST"])
def session_signup():
    payload = request.get_json(force=True) or {}
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = (payload.get("phone") or "").strip()
    password = payload.get("password") or ""
    details = {
        "business_name": (payload.get("business_name") or "").strip(),
        "city": (payload.get("city") or "").strip(),
        "purpose": (payload.get("purpose") or "").strip(),
    }
    if not name or not email or not phone or not password:
        return jsonify({"error": "Name, phone, email, and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if User.get_by_email(email):
        return jsonify({"error": "An account already exists with this email."}), 400
    ensure_default_plan()
    created_id = User.create(
        name=name,
        email=email,
        password=password,
        role="admin",
        plan_id=DEFAULT_PLAN_ID,
        status="active",
        phone=phone,
        details=details,
    )
    user = User.get_by_id(created_id)
    login_user(user)
    return jsonify({"authenticated": True, "is_admin": True, "is_developer": False, "name": user.name}), 201

@api_bp.route("/session/logout", methods=["POST"])
def session_logout():
    if current_user.is_authenticated:
        logout_user()
    return jsonify({"authenticated": False})


@api_bp.route("/weddings", methods=["GET"])
def weddings():
    docs = Wedding.all()
    if not current_user.is_authenticated:
        docs = [
            w for w in docs
            if (w.get("access_level") or "private") == "public" and bool(w.get("show_on_demo_home"))
        ]
    elif not is_developer():
        owned_ids = {str(item) for item in owned_wedding_ids()}
        docs = [w for w in docs if str(w.get("_id")) in owned_ids]
    return jsonify(_to_jsonable(docs))


@api_bp.route("/weddings/<wedding_id>", methods=["GET"])
def wedding_detail(wedding_id):
    wedding = Wedding.get(wedding_id)
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(_to_jsonable(wedding))


@api_bp.route("/public-weddings/<public_slug>", methods=["GET"])
def public_wedding_detail(public_slug):
    public_slug = (public_slug or "").strip().lower()
    wedding = Wedding.get_by_public_slug(public_slug)
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if (wedding.get("access_level") or "private") != "public" and not _can_view_wedding(wedding):
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


@api_bp.route("/programs/<program_id>/photos", methods=["GET"])
def program_photos(program_id):
    program = Program.get(program_id)
    if not program:
        return jsonify({"error": "Program not found"}), 404

    wedding = Wedding.get(str(program.get("wedding_id")))
    if not wedding:
        return jsonify({"error": "Wedding not found"}), 404
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401

    episodes = Episode.by_program(program_id)
    if not episodes:
        return jsonify([])

    episode_title_by_id = {str(episode.get("_id")): episode.get("title") or "Event" for episode in episodes}
    episode_ids = [ObjectId(episode_id) for episode_id in episode_title_by_id.keys()]
    photos = list(
        mongo.db.photos.find({"episode_id": {"$in": episode_ids}}).sort([("order", 1), ("_id", 1)])
    )
    serialized = []
    for photo in photos:
        item = Photo.serialize(photo)
        item["episode_title"] = episode_title_by_id.get(str(photo.get("episode_id")), "Event")
        serialized.append(item)
    return jsonify(_to_jsonable(serialized))


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
        if not can_manage_wedding(wedding):
            return jsonify({"error": "Unauthorized"}), 401

        files = request.files.getlist("photos")
        if not files:
            files = request.files.getlist("photos[]")
        if not files:
            single_photo = request.files.get("photo")
            files = [single_photo] if single_photo else []
        if not files:
            return jsonify({"error": "Please choose at least one photo"}), 400
        plan_error = limit_error("photo", add=len(files))
        if plan_error:
            return jsonify({"error": plan_error}), 403

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
            inserted.append(Photo.serialize(doc))

        return jsonify(_to_jsonable(inserted)), 201

    return jsonify(_to_jsonable(Photo.by_episode(episode_id)))


@api_bp.route("/episodes/<episode_id>/photos/import-drive", methods=["POST"])
def import_episode_drive_photos(episode_id):
    if not current_user.is_authenticated:
        return jsonify({"error": "Login required"}), 401

    episode = Episode.get(episode_id)
    if not episode:
        return jsonify({"error": "Episode not found"}), 404

    program = Program.get(str(episode.get("program_id")))
    wedding = Wedding.get(str(program.get("wedding_id"))) if program else None
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401
    if not can_manage_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401
    if not drive_import_allowed():
        return jsonify({"error": "Your plan does not include Google Drive import."}), 403

    payload = request.get_json(silent=True) or {}
    drive_link = (payload.get("drive_url") or payload.get("drive_link") or "").strip()
    if not drive_link:
        return jsonify({"error": "Please paste a Google Drive file or folder link."}), 400

    try:
        drive_images = download_drive_images(drive_link)
    except GoogleDriveImportError as exc:
        return jsonify({"error": str(exc)}), 400
    plan_error = limit_error("photo", add=len(drive_images))
    if plan_error:
        return jsonify({"error": plan_error}), 403

    existing_count = mongo.db.photos.count_documents({"episode_id": ObjectId(episode_id)})
    inserted = []
    for index, image in enumerate(drive_images):
        try:
            image_url = upload_bytes_to_telegram(
                image["filename"],
                image["content"],
                image.get("mimetype") or "application/octet-stream",
                caption=f"{episode.get('title') or 'Wedflix event'} photo",
            )
        except TelegramMediaError as exc:
            return jsonify({"error": f"Could not import {image.get('filename') or 'Drive photo'}: {exc}"}), 400

        doc = {
            "episode_id": ObjectId(episode_id),
            "url": image_url,
            "caption": "",
            "order": existing_count + index + 1,
            "uploaded_by": getattr(current_user, "name", "") or "",
            "source": "google_drive",
        }
        result = mongo.db.photos.insert_one(doc)
        doc["_id"] = result.inserted_id
        inserted.append(Photo.serialize(doc))

    return jsonify({"imported": len(inserted), "photos": _to_jsonable(inserted)}), 201


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


def _developer_required():
    return current_user.is_authenticated and bool(getattr(current_user, "is_developer", False)) and bool(getattr(current_user, "is_active", True))


@api_bp.route("/developer/plans", methods=["GET", "POST"])
def developer_plans():
    if not _developer_required():
        return jsonify({"error": "Developer access required"}), 403
    ensure_default_plan()
    if request.method == "POST":
        payload = request.get_json(force=True) or {}
        plan_id = (payload.get("plan_id") or payload.get("name") or "").strip().lower().replace(" ", "-")
        if not plan_id:
            return jsonify({"error": "Plan id is required."}), 400
        plan = normalize_plan({
            "plan_id": plan_id,
            "name": (payload.get("name") or plan_id.title()).strip(),
            "description": (payload.get("description") or "").strip(),
            "limits": payload.get("limits") or {},
            "features": payload.get("features") or {},
            "active": payload.get("active", True),
        })
        mongo.db.plans.update_one({"plan_id": plan_id}, {"$set": plan}, upsert=True)
        return jsonify(plan), 201
    plans = [normalize_plan(doc) for doc in mongo.db.plans.find().sort("name", 1)]
    return jsonify(_to_jsonable(plans))


@api_bp.route("/developer/overview", methods=["GET"])
def developer_overview():
    if not _developer_required():
        return jsonify({"error": "Developer access required"}), 403
    ensure_default_plan()
    users = list(mongo.db.users.find())
    weddings = mongo.db.weddings.count_documents({})
    programs = mongo.db.programs.count_documents({})
    episodes = mongo.db.episodes.count_documents({})
    photos = mongo.db.photos.count_documents({})
    active_users = sum(1 for user in users if (user.get("status") or "active") == "active")
    plan_counts = {}
    role_counts = {}
    for user in users:
        plan_counts[user.get("plan_id") or DEFAULT_PLAN_ID] = plan_counts.get(user.get("plan_id") or DEFAULT_PLAN_ID, 0) + 1
        role_counts[user.get("role") or "admin"] = role_counts.get(user.get("role") or "admin", 0) + 1
    recent_users = [_json_user(user) for user in sorted(users, key=lambda item: str(item.get("_id")), reverse=True)[:6]]
    return jsonify(
        _to_jsonable(
            {
                "stats": {
                    "users": len(users),
                    "active_users": active_users,
                    "weddings": weddings,
                    "functions": programs,
                    "events": episodes,
                    "photos": photos,
                    "plans": mongo.db.plans.count_documents({}),
                },
                "plan_counts": plan_counts,
                "role_counts": role_counts,
                "recent_users": recent_users,
            }
        )
    )


@api_bp.route("/developer/plans/<plan_id>", methods=["PATCH", "POST"])
def developer_update_plan(plan_id):
    if not _developer_required():
        return jsonify({"error": "Developer access required"}), 403
    payload = request.get_json(force=True) or {}
    update = {}
    for key in ("name", "description", "active"):
        if key in payload:
            update[key] = payload[key]
    if "limits" in payload:
        update["limits"] = normalize_plan({"limits": payload.get("limits") or {}})["limits"]
    if "features" in payload:
        update["features"] = normalize_plan({"features": payload.get("features") or {}})["features"]
    mongo.db.plans.update_one({"plan_id": plan_id}, {"$set": update}, upsert=False)
    return jsonify(_to_jsonable(normalize_plan(mongo.db.plans.find_one({"plan_id": plan_id}))))


@api_bp.route("/developer/users", methods=["GET"])
def developer_users():
    if not _developer_required():
        return jsonify({"error": "Developer access required"}), 403
    users = [_json_user(doc) for doc in mongo.db.users.find().sort("email", 1)]
    return jsonify(users)


@api_bp.route("/developer/users/<user_id>", methods=["PATCH", "POST"])
def developer_update_user(user_id):
    if not _developer_required():
        return jsonify({"error": "Developer access required"}), 403
    payload = request.get_json(force=True) or {}
    update = {}
    for key in ("name", "plan_id", "status"):
        if key in payload:
            update[key] = payload[key]
    if "wedding_ids" in payload and isinstance(payload.get("wedding_ids"), list):
        update["wedding_ids"] = payload["wedding_ids"]
    mongo.db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    return jsonify(_json_user(mongo.db.users.find_one({"_id": ObjectId(user_id)})))


@api_bp.route("/developer/weddings/<wedding_id>", methods=["PATCH", "POST"])
def developer_update_wedding(wedding_id):
    if not _developer_required():
        return jsonify({"error": "Developer access required"}), 403
    if not ObjectId.is_valid(wedding_id):
        return jsonify({"error": "Invalid wedding id"}), 400
    payload = request.get_json(force=True) or {}
    update = {}
    if "show_on_demo_home" in payload:
        update["show_on_demo_home"] = bool(payload.get("show_on_demo_home"))
    if "access_level" in payload:
        access_level = (payload.get("access_level") or "private").strip().lower()
        if access_level not in {"public", "private"}:
            return jsonify({"error": "Invalid access level"}), 400
        update["access_level"] = access_level
    if not update:
        return jsonify({"error": "No wedding changes provided"}), 400
    mongo.db.weddings.update_one({"_id": ObjectId(wedding_id)}, {"$set": update})
    return jsonify(_to_jsonable(mongo.db.weddings.find_one({"_id": ObjectId(wedding_id)})))


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
    file_response = requests.get(file_url, stream=True, timeout=(20, 120))
    if not file_response.ok:
        return jsonify({"error": "Telegram file download failed"}), 502

    content_type = file_response.headers.get("content-type") or mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    disposition = "attachment" if request.args.get("download") == "1" else "inline"
    return Response(
        stream_with_context(file_response.iter_content(chunk_size=1024 * 64)),
        content_type=content_type,
        headers={
            "Cache-Control": "private, max-age=300",
            "Content-Disposition": f'{disposition}; filename="{os.path.basename(file_path) or "wedflix-photo"}"',
        },
    )
