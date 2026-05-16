from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user
from bson import ObjectId

from app.models.comment import Comment
from app.models.episode import Episode
from app.models.photo import Photo
from app.models.program import Program
from app.models.wedding import Wedding
from app.models.user import User

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


@api_bp.route("/episodes/<episode_id>/photos", methods=["GET"])
def episode_photos(episode_id):
    episode = Episode.get(episode_id)
    if not episode:
        return jsonify({"error": "Episode not found"}), 404

    program = Program.get(str(episode.get("program_id")))
    wedding = Wedding.get(str(program.get("wedding_id"))) if program else None
    if not _can_view_wedding(wedding):
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify(_to_jsonable(Photo.by_episode(episode_id)))


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
